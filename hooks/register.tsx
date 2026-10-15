import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Combat, Phase, Scene, Stage, WeaponChoice, WeaponKind } from '../types'
import { RANK_NAMES, WEAPONS, WEAPON_NAMES, isUnlocked, levelFor, rankFor, unlockedBetween } from './level'
import { gearTier, isRanged } from './weapons'
import { detectLang, langFromSetting } from './lang'
import { addSample, toMetrics } from './metrics'
import type { CostSample } from './metrics'
import { GIST_DESCRIPTION, GIST_FILE, machineCount, mergeOwn, othersKills, parseLedger } from './sync'
import type { Lang } from './lang'
import { CHIP_ROW_HEIGHT } from './chips'
import { chipButtons, panelRows, summaryChips, usageBlock } from './panel'
import type { PanelArgs } from './panel'
import { KILL_TIMES, LOOP_S, PEEK_WINDOW, SVG_HEIGHT, arenaSvg } from './svg'

const INITIAL: Scene = {
  phase: 'idle',
  tool: null,
  eatSeq: 0,
  winSeq: 0,
  stage: null,
  kills: 0,
  totalKills: 0,
  weapon: 'auto',
  combat: 'melee',
  awake: false,
  sync: { on: false, machines: 1, at: null, error: null },
  metrics: {
    ctxPct: null,
    ctxTokens: null,
    ctxWindow: 0,
    limits: [],
    costUsd: null,
    burnPerHour: null,
    startedAt: null,
  },
}

const scene = atom({ plugin: 'taskbar-claude', key: 'scene' } as const, INITIAL)
const expanded = atom({ plugin: 'taskbar-claude', key: 'expanded' } as const, false)
const clock = atom({ plugin: 'taskbar-claude', key: 'clock' } as const, 0)
const peek = atom({ plugin: 'taskbar-claude', key: 'peek' } as const, false)
// The language the person writes to Claude in; the band follows it.
const langAtom = atom({ plugin: 'taskbar-claude', key: 'lang' } as const, 'en' as Lang)

// At most one token snack per this many ms, so the fight stays the main act.
const EAT_EVERY_MS = 25_000
// Rows the desktop scene (136px) takes in the band.
const SCENE_ROWS = 8
// Rows the summary chips take: two bordered rows of four.
const CHIP_ROWS = (_width: number) => 2 * CHIP_ROW_HEIGHT

// How long Claude takes to climb out of the bedroll on the first prompt.
const WAKE_MS = 2_300
// How long the victory scene plays before Claude rests.
const WIN_MS = 4_600
const TICK_MS = 500

const SEARCH_TOOLS = /^(Read|Grep|Glob|LS|WebFetch|WebSearch|ToolSearch|NotebookRead)$|^mcp__.*(read|get|list|search|query|fetch)/i
const CODE_TOOLS = /^(Edit|Write|MultiEdit|NotebookEdit)$/
const RUN_TOOLS = /^(Bash|PowerShell|Monitor|Task|Agent)$/

function phaseForTool(name: string): Phase {
  if (CODE_TOOLS.test(name)) return 'code'
  if (RUN_TOOLS.test(name)) return 'run'
  if (SEARCH_TOOLS.test(name)) return 'search'
  return 'run'
}

function shortTool(name: string): string {
  const parts = name.split('__')
  return (parts[parts.length - 1] ?? name).slice(0, 24)
}

// Per-load memory; a reload starts these over, which only costs one redraw.
let lastPhase: Phase = 'idle'
let lastTool: string | null = null
let lastEatAt = 0
let stageUntil = 0
// When this turn's fight began, and how far into its loop the last tick was.
let fightStart = 0
let lastLoopT = 0
let fighting = false
// The weapons the fight was drawn with: fixed for the turn, so it never redraws.
let turnWeapons: WeaponKind[] | null = null
// The gear the fight was drawn with, fixed for the turn the same way.
let turnTier: number | null = null
let ticker: { cancel: () => void } | null = null
let syncTimer: { cancel: () => void } | null = null
let syncing = false
// The session's cost readings over the last hour, for the burn rate.
let costSamples: CostSample[] = []
let syncSetting = false
let lang: Lang = 'en'
// A language the plugin's settings pin, which detection then leaves alone.
let pinnedLang: Lang | null = null

const STORE_KILLS = 'totalKills'
const STORE_LANG = 'lang'
const STORE_COMBAT = 'combat'
// This computer's own count, the other computers' sum as last synced, this
// computer's id in the shared ledger, the gist's id, and whether to sync.
const STORE_OWN = 'machineKills'
const STORE_OTHERS = 'othersKills'
const STORE_MACHINE = 'machineId'
const STORE_GIST = 'gistId'
const STORE_SYNC = 'sync'
// Set once the `sync: on` setting has switched sharing on, so the panel's
// switch can still turn it off afterwards.
const STORE_SYNC_OPTED = 'syncOptedIn'
// How often a session shares its count while it runs.
const SYNC_EVERY_MS = 5 * 60_000
const STORE_WEAPON = 'weapon'
const CHOICES: readonly WeaponChoice[] = ['auto', ...WEAPONS.map(w => w.kind)]

// Writes go through here so a failure never reaches Claude's own work.
async function patch($: EngineInterface, fn: (s: Scene) => Scene) {
  try {
    await update($, scene, s => fn(s ?? INITIAL))
  } catch {
    // The arena is decoration: drop the frame rather than the turn.
  }
}

async function setPhase($: EngineInterface, phase: Phase, tool: string | null = null) {
  if (phase === lastPhase && tool === lastTool) return
  lastPhase = phase
  lastTool = tool
  await patch($, s => ({ ...s, phase, tool }))
}

/** The weapons a scene's fight swaps between: the pick, or on auto all unlocked. */
function weaponsFor(s: Scene): WeaponKind[] {
  const level = levelFor(s.totalKills)
  const ranged = s.combat === 'ranged'
  const pool = WEAPONS.filter(w => w.level <= level && isRanged(w.kind) === ranged).map(w => w.kind)
  const fallback: WeaponKind = ranged ? 'ppk' : 'katana'
  if (s.weapon !== 'auto') return [isUnlocked(s.weapon, level) && pool.includes(s.weapon) ? s.weapon : fallback]
  return pool.length > 0 ? pool : [fallback]
}

async function startFight($: EngineInterface) {
  fightStart = await $.clock.now()
  lastLoopT = 0
  fighting = true
  const s = await read($, scene)
  turnWeapons = weaponsFor(s)
  turnTier = gearTier(levelFor(s.totalKills))
}

async function setStage($: EngineInterface, stage: Stage, ms: number) {
  stageUntil = (await $.clock.now()) + ms
  await patch($, s => ({ ...s, stage }))
}

// Ends the victory scene, follows the fight loop to count the bugs that fall
// and to open the usage bar while Claude reaches up to eat.
async function tick($: EngineInterface) {
  const s = await read($, scene)
  const now = await $.clock.now()
  // Countdowns are drawn by the minute: nudge the band when one turns over.
  const minute = Math.floor(now / 60_000)
  if (minute !== (await read($, clock))) await update($, clock, () => minute)
  if (s.stage !== null && now >= stageUntil) {
    await patch($, x => ({ ...x, stage: null }))
    // Up and armed: the fight starts as the waking scene ends.
    if (s.stage === 'wake') await startFight($)
  }

  const loopT = fighting ? (((now - fightStart) / 1000) % LOOP_S + LOOP_S) % LOOP_S : 0
  const isPeeking = fighting && loopT >= PEEK_WINDOW.open && loopT < PEEK_WINDOW.close
  if (isPeeking !== (await read($, peek))) await update($, peek, () => isPeeking)

  if (fighting) {
    const prev = lastLoopT
    lastLoopT = loopT
    // The kills the loop played since the last tick, across its seam too.
    const slain = KILL_TIMES.filter(t => (loopT >= prev ? t > prev && t <= loopT : t > prev || t <= loopT)).length
    if (slain > 0) await addKills($, slain)
  }
}

// Counts kills into the lifetime total, keeps it, and calls out a level-up.
async function addKills($: EngineInterface, slain: number) {
  // Read fresh: another session on this computer may have added some too.
  const own = (Number(await $.store.get(STORE_OWN).catch(() => 0)) || 0) + slain
  const others = Number(await $.store.get(STORE_OTHERS).catch(() => 0)) || 0
  const before = (await read($, scene)).totalKills
  const total = own + others
  // Only this computer's own count is kept: the old total key stays as it
  // was, read once to migrate, so others' kills can never come back as ours.
  await $.store.set(STORE_OWN, own)
  await patch($, x => ({ ...x, kills: x.kills + slain, totalKills: total }))
  const from = levelFor(before)
  const to = levelFor(total)
  if (to > from) {
    const names = WEAPON_NAMES[lang]
    const fresh = unlockedBetween(from, to).map(k => names[k])
    const rank = rankFor(to)
    const promoted = rank !== rankFor(from) ? ` · ${RANK_NAMES[lang][rank]}` : ''
    const head = (lang === 'tr' ? `⚔ Seviye ${to}!` : `⚔ Level ${to}!`) + promoted
    const tail = fresh.length === 0 ? '' : lang === 'tr' ? ` Yeni silah: ${fresh.join(', ')}` : ` New weapon: ${fresh.join(', ')}`
    $.ui.toast(head + tail)
  }
}

async function pickWeapon($: EngineInterface, weapon: WeaponChoice) {
  // Picking a gun means a gunfight; a blade, close combat.
  const combat: Combat | null = weapon === 'auto' ? null : isRanged(weapon) ? 'ranged' : 'melee'
  await patch($, x => ({ ...x, weapon, combat: combat ?? x.combat }))
  await $.store.set(STORE_WEAPON, weapon)
  if (combat !== null) await $.store.set(STORE_COMBAT, combat)
  // A pick is the person's own act: the fight redraws with it at once.
  if (fighting) turnWeapons = weaponsFor(await read($, scene))
}

// Blade or gun: the weapon pick follows to that kind's auto rotation.
async function toggleCombat($: EngineInterface) {
  const combat: Combat = (await read($, scene)).combat === 'ranged' ? 'melee' : 'ranged'
  await patch($, x => ({ ...x, combat, weapon: 'auto' }))
  await $.store.set(STORE_COMBAT, combat)
  await $.store.set(STORE_WEAPON, 'auto')
  if (fighting) turnWeapons = weaponsFor(await read($, scene))
}

// Brings back what earlier sessions kept: the kill total, weapon and style.
async function restore($: EngineInterface) {
  try {
    const [kills, weapon, style, ownKept, othersKept, syncOn] = await Promise.all([
      $.store.get(STORE_KILLS),
      $.store.get(STORE_WEAPON),
      $.store.get(STORE_COMBAT),
      $.store.get(STORE_OWN),
      $.store.get(STORE_OTHERS),
      $.store.get(STORE_SYNC),
    ])
    const combat: Combat = style === 'ranged' ? 'ranged' : 'melee'
    const choice = CHOICES.find(c => c === weapon) ?? 'auto'
    // Before computers were told apart, the kept total was all this one's.
    const legacy = typeof kills === 'number' && kills >= 0 ? kills : 0
    const others = typeof othersKept === 'number' && othersKept >= 0 ? othersKept : 0
    // Kills this session made before anything was kept still count.
    const { kills: soFar } = await read($, scene)
    const own = Math.max(typeof ownKept === 'number' && ownKept >= 0 ? ownKept : legacy, soFar)
    if (own !== ownKept) await $.store.set(STORE_OWN, own)
    const on = syncOn === true
    await patch($, x => ({ ...x, totalKills: own + others, weapon: choice, combat, sync: { ...x.sync, on } }))
  } catch {
    // A fresh start.
  }
}

/** Runs the GitHub CLI; it brings its own sign-in, so no token passes through here. */
async function gh($: EngineInterface, args: string[], stdin?: string) {
  const r = await $.process.run(['gh', ...args], { timeoutMs: 20_000, ...(stdin === undefined ? {} : { stdin }) })
  if (r.exitCode !== 0) throw new Error((r.stderr || r.stdout).trim().split('\n')[0] || `gh exited ${r.exitCode}`)
  return r.stdout.trim()
}

/** This computer's id in the shared ledger, made once and kept. */
async function machineId($: EngineInterface): Promise<string> {
  const kept = await $.store.get(STORE_MACHINE)
  if (typeof kept === 'string' && kept.length > 0) return kept
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  const id = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  await $.store.set(STORE_MACHINE, id)
  return id
}

/** The sync gist: the one kept, else the one found by its description, else a new private one. */
async function syncGist($: EngineInterface): Promise<string> {
  const kept = await $.store.get(STORE_GIST)
  if (typeof kept === 'string' && /^[0-9a-f]+$/.test(kept)) return kept
  const found = await gh($, ['api', 'gists', '--paginate', '--jq', `.[] | select(.description == "${GIST_DESCRIPTION}") | .id`])
  let id = found.split('\n')[0]?.trim() ?? ''
  if (!id) {
    const body = JSON.stringify({ description: GIST_DESCRIPTION, public: false, files: { [GIST_FILE]: { content: JSON.stringify({ machines: {} }) } } })
    id = await gh($, ['api', '-X', 'POST', 'gists', '--input', '-', '--jq', '.id'], body)
  }
  await $.store.set(STORE_GIST, id)
  return id
}

/**
 * Shares this computer's count and takes in the others': reads the gist,
 * raises this computer's entry if it grew, writes it back, and sets the total
 * to this computer's count plus the others'.
 */
async function syncNow($: EngineInterface) {
  if (syncing || (await $.store.get(STORE_SYNC)) !== true) return
  syncing = true
  try {
    const id = await machineId($)
    const gist = await syncGist($)
    const text = await gh($, ['api', `gists/${gist}`, '--jq', `.files["${GIST_FILE}"].content // ""`])
    const own = Number(await $.store.get(STORE_OWN)) || 0
    const name = (await $.env.get('COMPUTERNAME')) ?? (await $.env.get('HOSTNAME')) ?? id.slice(0, 8)
    const merged = mergeOwn(parseLedger(text), id, name, own, new Date().toISOString())
    if (merged.changed) {
      const body = JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(merged.ledger, null, 2) } } })
      await gh($, ['api', '-X', 'PATCH', `gists/${gist}`, '--input', '-', '--jq', '.id'], body)
    }
    const others = othersKills(merged.ledger, id)
    const total = own + others
    await $.store.set(STORE_OTHERS, others)
    const machines = machineCount(merged.ledger, id)
    const at = await $.clock.now()
    await patch($, x => ({ ...x, totalKills: total, sync: { on: true, machines, at, error: null } }))
  } catch (err) {
    const error = String(err instanceof Error ? err.message : err).slice(0, 80)
    await patch($, x => ({ ...x, sync: { ...x.sync, error } }))
  } finally {
    syncing = false
  }
}

/** Turns sharing between computers on or off; on, it syncs at once. */
async function toggleSync($: EngineInterface) {
  const on = (await $.store.get(STORE_SYNC)) !== true
  await $.store.set(STORE_SYNC, on)
  await patch($, x => ({ ...x, sync: { ...x.sync, on, error: null } }))
  if (on) await syncNow($)
}

async function setLang($: EngineInterface, next: Lang) {
  lang = next
  if ((await read($, langAtom)) !== next) await update($, langAtom, () => next)
}

// The band's language: pinned by the plugin's setting, else the one last
// written in (kept across sessions), else Claude Code's own language setting.
async function restoreLang($: EngineInterface) {
  try {
    if (pinnedLang !== null) return await setLang($, pinnedLang)
    const kept = await $.store.get(STORE_LANG)
    if (kept === 'tr' || kept === 'en') return await setLang($, kept)
    const fromSetting = langFromSetting((await $.settings.read()).language)
    if (fromSetting !== null) await setLang($, fromSetting)
  } catch {
    // English, then.
  }
}

async function refreshMetrics($: EngineInterface) {
  try {
    const [usage, now] = await Promise.all([$.session.usage(), $.clock.now()])
    if (usage.cost) costSamples = addSample(costSamples, now, usage.cost.usd)
    const metrics = toMetrics(usage, now, costSamples)
    await patch($, s => ({ ...s, metrics }))
  } catch {
    // Figures stay as they were.
  }
}

export const register: Register = (on, options) => {
  pinnedLang = options.language === 'en' || options.language === 'tr' ? options.language : null
  syncSetting = options.sync === 'on'
  if (pinnedLang !== null) lang = pinnedLang

  on('session.start', async ($, e, next) => {
    await restore($)
    await restoreLang($)
    await refreshMetrics($)
    ticker?.cancel()
    ticker = $.clock.every(TICK_MS, () => {
      tick($).catch(() => undefined)
    })
    // The `sync: on` setting switches sharing on, once.
    if (syncSetting && (await $.store.get(STORE_SYNC_OPTED)) !== true) {
      await $.store.set(STORE_SYNC_OPTED, true)
      await $.store.set(STORE_SYNC, true)
      await patch($, x => ({ ...x, sync: { ...x.sync, on: true } }))
    }
    // Share the count now and every few minutes, when sharing is on.
    syncNow($).catch(() => undefined)
    syncTimer?.cancel()
    syncTimer = $.clock.every(SYNC_EVERY_MS, () => {
      syncNow($).catch(() => undefined)
    })
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    // Follow the language the person writes in, and keep it for next time.
    const written = pinnedLang === null ? detectLang(e.text) : null
    if (written !== null && written !== lang) {
      await setLang($, written)
      await $.store.set(STORE_LANG, written)
    }
    await setPhase($, 'think')
    // The first prompt of a session wakes Claude in camp before the fight.
    const { awake } = await read($, scene)
    if (awake) {
      await startFight($)
    } else {
      await patch($, x => ({ ...x, awake: true }))
      await setStage($, 'wake', WAKE_MS)
    }
    return next(e)
  })

  // Each model request spends tokens: refresh the figures and, now and then,
  // send the knight off for a snack.
  on('turn.step', async function* ($, e, next) {
    await refreshMetrics($)
    if (e.index > 0) {
      const now = await $.clock.now()
      if (now - lastEatAt > EAT_EVERY_MS) {
        lastEatAt = now
        await patch($, s => ({ ...s, eatSeq: s.eatSeq + 1 }))
      }
    }

    let kind = ''
    for await (const chunk of next(e)) {
      if (chunk.kind !== kind && (chunk.kind === 'thinking' || chunk.kind === 'text' || chunk.kind === 'tool')) {
        kind = chunk.kind
        if (chunk.kind === 'thinking') await setPhase($, 'think')
        else if (chunk.kind === 'text') await setPhase($, 'answer')
        else await setPhase($, phaseForTool(chunk.name), shortTool(chunk.name))
      }
      yield chunk
    }
  })

  on('tool.call', async ($, e, next) => {
    const name = String(e.tool)
    await setPhase($, phaseForTool(name), shortTool(name))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      fighting = false
      turnWeapons = null
      turnTier = null
      if (e.reason === 'answer') {
        lastPhase = 'win'
        lastTool = null
        await patch($, s => ({ ...s, phase: 'win', tool: null, winSeq: s.winSeq + 1 }))
        await setStage($, 'win', WIN_MS)
      } else {
        await setPhase($, 'idle')
      }
    }
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const usage = await $.session.usage().catch(() => null)
    if (usage !== null) {
      const now = await $.clock.now()
      if (e.cost) costSamples = addSample(costSamples, now, e.cost.usd)
      const metrics = toMetrics({ ...usage, context: e.context, rateLimits: e.rateLimits, cost: e.cost }, now, costSamples)
      await patch($, s => ({ ...s, metrics }))
    }
    return next(e)
  })

  on('ui.message', { element: 'chips' }, async ($, e, next) => {
    const data = e.data as { chip?: unknown } | null
    const key = typeof data?.chip === 'string' ? data.chip : null
    if (key === 'usage-mode') await toggleCombat($)
    else if (key !== null && key.startsWith('usage-open')) await update($, expanded, v => !v)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // The desktop, VS Code and mobile draw the vector scene; the terminal its pixels.
    if (e.props.hasSurvey) {
      return next(e)
    }

    const s = await read($, scene)
    const isOpen = await read($, expanded)
    const lang = pinnedLang ?? (await read($, langAtom))
    const vector = e.surface === 'desktop' || e.surface === 'vscode' || e.surface === 'mobile'
    // The eat scene opens the bar where Claude reaches up to it: the vector scene.
    const isPeeking = vector && (await read($, peek))
    await read($, clock)
    const cols = Math.max(20, Math.min(e.props.bodyColumns, 160))
    const working = e.props.isWorking
    const ui = $.ui.resolve(e)
    // The band never outgrows its slot: a taller tree scrolls inside the band.
    // The panel opens above the scene, which stays put on the prompt, so it
    // grows upward. Of these layouts the first that fits is drawn: rings with
    // the scene, then the panel alone with rings or bars. The snack break
    // opens the panel only where it fits beside the scene.
    const room = e.props.maxRows
    const sceneRows = vector ? SCENE_ROWS : 6
    // Where vectors draw, the figures are always ring charts: a smaller ring
    // when room is short, never a bar. Bars are the terminal's alone.
    const layouts = vector
      ? [
          { ring: 52, scene: true },
          { ring: 36, scene: true },
          { ring: 52, scene: false },
          { ring: 36, scene: false },
        ]
      : [
          { ring: 0, scene: true },
          { ring: 0, scene: false },
        ]
    const fits = (l: { ring: number; scene: boolean }) => panelRows(l.ring) + (l.scene ? sceneRows : 0) <= room
    const layout = layouts.find(fits) ?? layouts[layouts.length - 1] ?? { ring: vector ? 36 : 0, scene: false }
    const opens = isOpen || (isPeeking && fits({ ring: vector ? 52 : 0, scene: true }))
    const showScene = !opens || layout.scene
    const args: PanelArgs = {
      s,
      working,
      expanded: opens,
      eating: isPeeking,
      width: e.props.bodyColumns,
      lang,
      now: Date.now(),
      Svg: vector && 'Svg' in ui ? ui.Svg : undefined,
      ringSize: opens && !isOpen ? 52 : layout.ring,
      onToggle: () => {
        update($, expanded, v => !v).catch(() => undefined)
      },
      onPick: choice => {
        pickWeapon($, choice).catch(() => undefined)
      },
      onCombat: () => {
        toggleCombat($).catch(() => undefined)
      },
      onSync: () => {
        toggleSync($).catch(() => undefined)
      },
    }

    if (e.surface === 'desktop' || e.surface === 'vscode' || e.surface === 'mobile') {
      const { Box, Svg } = $.ui.resolve(e)
      // Closed on the desktop, the summary is one drawn region whose chips
      // take a click anywhere inside their borders; VS Code and mobile draw no
      // such region, so there the chips are buttons. Open, the panel of cards.
      // The engine fills a table's missing elements with empty stand-ins, so
      // mobile has a Select that draws nothing: take it away, and the panel
      // picks weapons with buttons there.
      const els = e.surface === 'mobile' ? { ...ui, Select: undefined } : ui
      let usage = opens ? usageBlock(els, args) : chipButtons(els, args, false)
      if (!opens && e.surface === 'desktop') {
        const { Client } = $.ui.resolve(e)
        usage = <Client key="chips" module="./chips.ts" width={cols} props={{ rows: summaryChips(args), cols }} />
      }
      // Asleep in camp until the first prompt, waking, fighting, celebrating,
      // then resting by the fire until the next one.
      const mode =
        s.stage === 'win' ? 'win' : s.stage === 'wake' ? 'wake' : working ? 'fight' : s.awake ? 'camp' : 'sleep'
      // The desktop sizes the scene to the band in pixels. VS Code's cells are
      // wider than the desktop's, so there the scene is drawn generously and
      // left to scale down to the band's full width.
      const fitsBand = e.surface !== 'desktop'
      const width = Math.min(1200, Math.max(360, e.props.bodyColumns * (fitsBand ? 11 : 8)))
      if (!showScene) return <Box flexDirection="column">{usage}</Box>
      return (
        <Box flexDirection="column">
          {usage}
          <Svg
            source={arenaSvg(mode, width, turnWeapons ?? weaponsFor(s), turnTier ?? gearTier(levelFor(s.totalKills)))}
            alt="Claude fights bugs while it works"
            {...(fitsBand ? {} : { width, height: SVG_HEIGHT })}
            isInteractive
          />
        </Box>
      )
    }

    // The terminal: the chips as buttons the keyboard reaches (a drawn region
    // takes clicks only in fullscreen), then pixels, two per row, below them.
    const { Box, Client } = $.ui.resolve(e)
    const usage = opens ? usageBlock(ui, args) : chipButtons(ui, args)
    const usageRows = opens ? panelRows(0) : CHIP_ROWS(e.props.bodyColumns)
    const rows = showScene ? Math.max(0, Math.min(5, room - usageRows)) : 0
    return (
      <Box flexDirection="column">
        {usage}
        {rows >= 4 ? (
          <Client
            key="arena"
            module="./scene.ts"
            width={cols}
            height={rows}
            props={{ ...s, working, rows, cols, lang, readout: false }}
          />
        ) : null}
      </Box>
    )
  })
}
