// The usage block above the arena: one clickable summary row, or, opened,
// five columns that explain each figure, with ring charts on the desktop.
//
// Text takes its colors from the person's theme (success, warning, error,
// subtle...), so it keeps its contrast in a light theme and a dark one alike.

import type { ElementConstructor, ElementTable, RenderElement, SvgProps, ThemeKey } from 'claude-code'

import type { Limit, Scene, WeaponChoice } from '../types'
import type { Chip } from './chips'
import { RANK_NAMES, WEAPONS, WEAPON_NAMES, isUnlocked, levelProgress, rankFor } from './level'

type Lang = 'tr' | 'en'
type Els = Pick<ElementTable<'terminal' | 'desktop' | 'vscode'>, 'Box' | 'Text' | 'Button' | 'Select'>

// Ring charts are images, outside the theme: mid tones that read on both.
const RING = { ok: '#2EA043', warn: '#C69026', bad: '#E5534B', claude: '#D97757', track: '#8B949E' }

const T = {
  tr: {
    idle: 'Hazır',
    think: 'Düşünüyor',
    answer: 'Yanıtlıyor',
    code: 'Kod yazıyor',
    run: 'Komut çalıştırıyor',
    search: 'Araştırıyor',
    win: 'Zafer!',
    eat: 'Token yiyor',
    title: 'Savaş durumu',
    details: 'Detaylar',
    close: 'Küçült',
    backToBattle: "⚔ Savaş'a dön",
    ctx: 'Bağlam',
    five_hour: '5 saat',
    seven_day: 'Hafta',
    spend_limit: 'Harcama',
    perHour: '/sa',
    lv: 'Sv',
    mode: 'Mod',
    melee: 'Yakın',
    ranged: 'Uzak',
    plan: 'Plan',
    planValue: 'Abonelik',
    noCharge: 'ek ücret yok',
    cost: 'Maliyet',
    d: 'g',
    h: 's',
    m: 'dk',
    days: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
  },
  en: {
    idle: 'Ready',
    think: 'Thinking',
    answer: 'Answering',
    code: 'Coding',
    run: 'Running',
    search: 'Searching',
    win: 'Victory!',
    eat: 'Eating tokens',
    title: 'Battle status',
    details: 'Details',
    close: 'Collapse',
    backToBattle: '⚔ Back to battle',
    ctx: 'Context',
    five_hour: '5h',
    seven_day: 'Week',
    spend_limit: 'Spend',
    perHour: '/h',
    lv: 'Lv',
    mode: 'Style',
    melee: 'Melee',
    ranged: 'Ranged',
    plan: 'Plan',
    planValue: 'Subscription',
    noCharge: 'no extra charge',
    cost: 'Cost',
    d: 'd',
    h: 'h',
    m: 'm',
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
}

const COLS = {
  tr: {
    ctx: 'BAĞLAM',
    five_hour: '5 SAATLİK LİMİT',
    seven_day: 'HAFTALIK LİMİT',
    cost: 'MALİYET',
    plan: 'PLAN',
    planNoCharge: 'Ek ücret yok',
    planFromLimits: 'limitlerden düşer',
    apiWorth: (x: string) => `API ≈ ${x} (ödenmez)`,
    usedPct: (p: number) => `%${p} kullanıldı`,
    level: 'SEVİYE',
    full: 'dolu',
    used: 'kullanıldı',
    of: (u: string, w: string) => `${u} / ${w}`,
    free: (f: string) => `${f} boş`,
    compact: 'dolunca özetlenir',
    bite: '◆ bir parça koptu!',
    inT: (x: string) => `↻ ${x} sonra`,
    at: (x: string) => `sıfırlanır ${x}`,
    noData: 'veri yok',
    noDataNote: 'ilk yanıttan sonra',
    session: 'bu oturumda',
    perHour: (x: string) => `≈ ${x} / saat`,
    dur: (x: string) => `süre ${x}`,
    estimate: 'liste fiyatı tahmini',
    total: (n: string) => `${n} böcek`,
    next: (n: string) => `sonraki: ${n} kaldı`,
    maxed: 'son seviye!',
    thisSession: (n: number) => `bu oturum: ${n}`,
    weapon: 'Silah',
    auto: 'Otomatik',
    rotating: 'sırayla',
    locked: (lv: number) => `Sv ${lv}`,
    lockedMore: (n: number, name: string, lv: number) => `+${n} kilitli · ${name} Sv ${lv}`,
    weaponTitle: 'SİLAH',
    syncOff: 'PC senkronu: kapalı',
    syncError: 'PC senkronu: hata',
    syncWaiting: 'PC senkronu: bağlanıyor…',
    syncOn: (n: number, ago: string) => `${n} PC senkron · ${ago} önce`,
    owned: (n: number, all: number) => `${n} / ${all} silah açık`,
    nextWeapon: (name: string, lv: number) => `sıradaki: ${name} · Sv ${lv}`,
  },
  en: {
    ctx: 'CONTEXT',
    five_hour: '5-HOUR LIMIT',
    seven_day: 'WEEKLY LIMIT',
    cost: 'COST',
    plan: 'PLAN',
    planNoCharge: 'No extra charge',
    planFromLimits: 'usage counts against limits',
    apiWorth: (x: string) => `API ≈ ${x} (not billed)`,
    usedPct: (p: number) => `${p}% used`,
    level: 'LEVEL',
    full: 'full',
    used: 'used',
    of: (u: string, w: string) => `${u} / ${w}`,
    free: (f: string) => `${f} free`,
    compact: 'summarized when full',
    bite: '◆ a piece came off!',
    inT: (x: string) => `↻ in ${x}`,
    at: (x: string) => `resets ${x}`,
    noData: 'no data',
    noDataNote: 'after the first reply',
    session: 'this session',
    perHour: (x: string) => `≈ ${x} / hour`,
    dur: (x: string) => `time ${x}`,
    estimate: 'list-price estimate',
    total: (n: string) => `${n} bugs (all time)`,
    next: (n: string) => `${n} to next level`,
    maxed: 'max level!',
    thisSession: (n: number) => `this session: ${n}`,
    weapon: 'Weapon',
    auto: 'Auto',
    rotating: 'rotating',
    locked: (lv: number) => `Lv ${lv}`,
    lockedMore: (n: number, name: string, lv: number) => `+${n} locked · ${name} Lv ${lv}`,
    weaponTitle: 'WEAPON',
    syncOff: 'PC sync: off',
    syncError: 'PC sync: error',
    syncWaiting: 'PC sync: connecting…',
    syncOn: (n: number, ago: string) => `${n} PCs synced · ${ago} ago`,
    owned: (n: number, all: number) => `${n} / ${all} weapons unlocked`,
    nextWeapon: (name: string, lv: number) => `next: ${name} (Lv ${lv})`,
  },
}

function pctTheme(p: number): ThemeKey {
  return p < 70 ? 'success' : p < 90 ? 'warning' : 'error'
}

function pctRing(p: number): string {
  return p < 70 ? RING.ok : p < 90 ? RING.warn : RING.bad
}

function kTokens(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}k`
}

function count(n: number) {
  return n >= 1e15 ? n.toExponential(2) : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function span(ms: number, t: (typeof T)[Lang]) {
  const mins = Math.max(0, Math.floor(ms / 60_000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return d > 0 ? `${d}${t.d} ${h}${t.h}` : h > 0 ? `${h}${t.h} ${m}${t.m}` : `${m}${t.m}`
}

function clockAt(iso: string, now: number, t: (typeof T)[Lang]) {
  const at = new Date(iso)
  const hm = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
  return at.getTime() - now > 20 * 3_600_000 ? `${t.days[at.getDay()] ?? ''} ${hm}` : hm
}

function until(l: Limit, now: number) {
  if (l.resetsAt === null) return null
  const ms = Date.parse(l.resetsAt) - now
  return ms > 0 ? ms : null
}

/** A ring chart: `fraction` of the ring in `color`, `label` in its middle. */
function ringSvg(fraction: number, color: string, label: string, sub?: string, size = 80): string {
  const r = 30
  const c = 2 * Math.PI * r
  const len = Math.max(0, Math.min(1, fraction)) * c
  const y = sub ? 40 : size < 64 ? 47 : 44
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 80 80">
<circle cx="40" cy="40" r="${r}" fill="none" stroke="${RING.track}" stroke-opacity=".28" stroke-width="10"/>
<circle cx="40" cy="40" r="${r}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${len.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 40 40)"/>
<text x="40" y="${y}" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="${size < 64 ? (label.length > 3 ? 17 : 22) : label.length > 5 ? 13 : 16}" font-weight="700" fill="${color}">${label}</text>
${sub ? `<text x="40" y="54" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="10" font-weight="600" fill="${color}">${sub}</text>` : ''}
</svg>`
}

/** A small filled pie: `fraction` of the disc in `color`, the rest a faint track. */
function pieSvg(fraction: number, color: string, size: number): string {
  const r = size / 2 - 1
  const c = size / 2
  const p = Math.max(0, Math.min(1, fraction))
  const a = p * Math.PI * 2
  const x = c + r * Math.sin(a)
  const y = c - r * Math.cos(a)
  const wedge =
    p >= 0.999
      ? `<circle cx="${c}" cy="${c}" r="${r}" fill="${color}"/>`
      : p <= 0.001
        ? ''
        : `<path d="M${c} ${c} L${c} ${c - r} A ${r} ${r} 0 ${p > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z" fill="${color}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${c}" cy="${c}" r="${r}" fill="${RING.track}" fill-opacity=".3" stroke="${color}" stroke-width="1"/>${wedge}</svg>`
}

export type PanelArgs = {
  s: Scene
  working: boolean
  expanded: boolean
  width: number
  lang: Lang
  now: number
  /** True while Claude is biting a piece off the context block. */
  eating: boolean
  /** The desktop's vector leaf, for the charts; absent on the terminal. */
  Svg?: ElementConstructor<SvgProps>
  /** The panel's ring size in px: full where the band has room, small where not. */
  ringSize: number
  onToggle: () => void
  onPick: (choice: WeaponChoice) => void
  /** Switches between blade and gun. */
  onCombat: () => void
  /** Turns sharing the kill count between computers on or off. */
  onSync: () => void
}

/**
 * Whether the session runs on a subscription: only then do responses report
 * the 5-hour and weekly windows. Its dollar figure is no bill.
 */
function onPlan(a: PanelArgs): boolean {
  return a.s.metrics.limits.some(l => l.kind === 'five_hour' || l.kind === 'seven_day')
}

/** A percentage as the language writes it: %62 in Turkish, 62% in English. */
function pct(n: number, lang: Lang): string {
  return lang === 'tr' ? `%${n}` : `${n}%`
}

/**
 * The summary as data for the chips region: two even rows of four. State,
 * level, fighting style and the way into the details on top; the gauges and
 * the plan beneath. A chip's key is what a click on it posts: `usage-mode`
 * switches blade and gun and nothing else, the state chip only shows, any
 * other opens the panel.
 */
export function summaryChips(a: PanelArgs): Chip[][] {
  const t = T[a.lang]
  const m = a.s.metrics
  const lp = levelProgress(a.s.totalKills)
  const up = (x: string) => x.toLocaleUpperCase(a.lang === 'tr' ? 'tr-TR' : 'en-US')
  const label = stateLabel(a)
  const chip = (key: string, name: string, value: string, tone: string, extra?: string, pie?: { fill: number; color: string }): Chip => ({
    key,
    label: name,
    value,
    tone,
    extra: extra ?? null,
    fill: pie ? pie.fill : null,
    fillColor: pie ? pie.color : null,
    clickable: key !== 'usage-state',
  })
  const top: Chip[] = []
  const gauges: Chip[] = []

  top.push(chip('usage-state', '', `⚔ ${label}`, 'claude', a.s.tool && a.working ? a.s.tool : undefined))
  top.push(chip('usage-open-level', up(t.lv), String(lp.level), 'claude', RANK_NAMES[a.lang][rankFor(lp.level)], { fill: lp.fraction, color: RING.claude }))
  const ranged = a.s.combat === 'ranged'
  top.push(chip('usage-mode', up(t.mode), ranged ? t.ranged : t.melee, ranged ? 'warning' : 'claude', '⇄'))
  top.push(chip('usage-open-more', '', `▾ ${t.details}`, 'claude'))

  if (m.ctxPct !== null) {
    const bite = a.eating ? (a.lang === 'tr' ? '◆ ısırıldı!' : '◆ bitten!') : undefined
    gauges.push(chip('usage-open-ctx', up(t.ctx), pct(m.ctxPct, a.lang), a.eating ? 'warning' : pctTheme(m.ctxPct), bite, { fill: m.ctxPct / 100, color: a.eating ? RING.warn : pctRing(m.ctxPct) }))
  }
  for (const l of m.limits) {
    const ms = until(l, a.now)
    const name = ((t as Record<string, unknown>)[l.kind] as string | undefined) ?? l.kind
    gauges.push(chip(`usage-open-${l.kind}`, up(name), pct(l.pct, a.lang), pctTheme(l.pct), ms !== null ? `↻ ${span(ms, t)}` : undefined, { fill: l.pct / 100, color: pctRing(l.pct) }))
  }
  if (onPlan(a)) {
    gauges.push(chip('usage-open-cost', up(t.plan), t.planValue, 'success'))
  } else if (m.costUsd !== null) {
    const burn = m.burnPerHour !== null ? `$${m.burnPerHour.toFixed(2)}${t.perHour}` : undefined
    gauges.push(chip('usage-open-cost', up(t.cost), `$${m.costUsd.toFixed(2)}`, 'warning', burn))
  }
  return [top, gauges]
}

/**
 * The summary as buttons, for surfaces whose drawn regions take no clicks or
 * no keyboard (the terminal outside fullscreen, VS Code): the same chips, each
 * a button the band's focus ring reaches (ctrl+x tab) with a digit hotkey.
 */
export function chipButtons(E: Els, a: PanelArgs): RenderElement {
  const { Box, Button, Text } = E
  let hotkey = 0
  const rows = summaryChips(a).map((row, r) =>
    Box({
      key: `usage-row-${r}`,
      flexDirection: 'row',
      columnGap: 1,
      children: row.map(c => {
        const parts: RenderElement[] = []
        if (c.fill !== null) parts.push(Text({ color: c.fillColor ?? c.tone, children: `${PIE_GLYPHS[Math.max(0, Math.min(4, Math.round(c.fill * 4)))] ?? '○'} ` }))
        if (c.label) parts.push(Text({ bold: true, color: 'subtle', children: `${c.label}  ` }))
        parts.push(Text({ bold: true, color: c.tone, children: c.value }))
        if (c.extra) parts.push(Text({ bold: true, color: 'text', children: `  ${c.extra}` }))
        const press = c.key === 'usage-mode' ? a.onCombat : c.clickable ? a.onToggle : null
        hotkey += press ? 1 : 0
        return Box({
          key: `chip-${c.key}`,
          borderStyle: 'round',
          borderColor: c.tone,
          ...(press ? { hover: { borderColor: 'claude' } } : {}),
          paddingX: 1,
          width: '25%',
          flexGrow: 1,
          flexShrink: 1,
          minWidth: 0,
          children: press
            ? Button({ key: c.key, plain: true, hotkey: String(hotkey), onPress: press, children: parts })
            : Text({ wrap: 'truncate-end', children: parts }),
        })
      }),
    }),
  )
  return Box({ key: 'usage', flexDirection: 'column', children: rows })
}

const PIE_GLYPHS = ['○', '◔', '◑', '◕', '●']

/** The level card's switch for sharing the count between computers, with its state. */
function syncButton(E: Els, a: PanelArgs): RenderElement {
  const c = COLS[a.lang]
  const t = T[a.lang]
  const s = a.s.sync
  const state = !s.on
    ? c.syncOff
    : s.error !== null
      ? c.syncError
      : s.at === null
        ? c.syncWaiting
        : c.syncOn(s.machines, span(a.now - s.at, t))
  return E.Button({ key: 'sync-toggle', label: `↻ ${state}`, variant: s.on && s.error === null ? 'primary' : 'secondary', onPress: a.onSync })
}

function stateLabel(a: PanelArgs): string {
  const t = T[a.lang]
  return a.s.stage === 'eat' ? t.eat : a.s.stage === 'win' ? t.win : a.working ? t[a.s.phase] : t.idle
}

type Line = { text: string; color?: ThemeKey | string; bold?: boolean } | { bar: number }

function bar(E: Els, pct: number, cells: number): RenderElement[] {
  const filled = Math.max(0, Math.min(cells, Math.round((pct / 100) * cells)))
  return [
    E.Text({ color: pctTheme(pct), children: '█'.repeat(filled) }),
    E.Text({ color: 'subtle', children: '░'.repeat(cells - filled) }),
  ]
}

type Ring = { fraction: number; color: string; label: string; alt: string }

/**
 * One bordered card, laid out sideways so it stays short: the ring on the
 * left, the title and up to three lines on its right. Where the surface draws
 * no vectors the ring becomes its figure and a bar under the title.
 */
function card(
  E: Els,
  a: PanelArgs,
  key: string,
  title: string,
  border: ThemeKey,
  ring: Ring | null,
  lines: Line[],
  width: string,
  extra: RenderElement[] = [],
): RenderElement {
  const { Box, Text } = E
  const text: RenderElement[] = [Text({ bold: true, color: border, wrap: 'truncate-end', children: title })]
  const chart =
    ring && a.Svg && a.ringSize > 0
      ? a.Svg({ source: ringSvg(ring.fraction, ring.color, ring.label, undefined, a.ringSize), alt: ring.alt, width: a.ringSize, height: a.ringSize })
      : null
  if (ring && chart === null) {
    text.push(Text({ wrap: 'truncate-end', children: [Text({ bold: true, color: border, children: `${ring.label} ` }), ...bar(E, ring.fraction * 100, 10)] }))
  }
  for (const l of lines) {
    if ('bar' in l) text.push(Text({ wrap: 'truncate-end', children: bar(E, Math.min(100, l.bar), 10) }))
    else text.push(Text({ color: l.color ?? 'text', bold: l.bold, wrap: 'truncate-end', children: l.text }))
  }
  text.push(...extra)
  const body = Box({ key: `${key}-text`, flexDirection: 'column', flexGrow: 1, flexShrink: 1, minWidth: 0, children: text })
  const kids = chart ? [Box({ key: `${key}-ring`, marginRight: 1, flexShrink: 0, children: chart }), body] : [body]
  return Box({
    key,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    flexShrink: 1,
    width,
    minWidth: 0,
    borderStyle: 'round',
    borderColor: border,
    paddingX: 1,
    children: kids,
  })
}

/**
 * The opened panel: the four figures on a row, level and weapon wider on the
 * row beneath, every card sideways so the whole panel is short.
 */
function details(E: Els, a: PanelArgs): RenderElement {
  const { Box, Button } = E
  const t = T[a.lang]
  const c = COLS[a.lang]
  const m = a.s.metrics
  const top: RenderElement[] = []
  const quarter = '25%'
  const half = '50%'

  // Context.
  if (m.ctxPct !== null && m.ctxTokens !== null && m.ctxWindow > 0) {
    const tone = a.eating ? 'warning' : pctTheme(m.ctxPct)
    top.push(
      card(E, a, 'col-ctx', c.ctx, tone, { fraction: m.ctxPct / 100, color: a.eating ? RING.warn : pctRing(m.ctxPct), label: pct(m.ctxPct, a.lang), alt: `${c.ctx} ${pct(m.ctxPct, a.lang)}` }, [
        { text: c.of(kTokens(m.ctxTokens), kTokens(m.ctxWindow)), bold: true },
        { text: c.free(kTokens(Math.max(0, m.ctxWindow - m.ctxTokens))) },
        a.eating ? { text: c.bite, color: 'warning', bold: true } : { text: c.compact, color: 'subtle' },
      ], quarter),
    )
  } else {
    top.push(card(E, a, 'col-ctx', c.ctx, 'subtle', null, [{ text: c.noData }, { text: c.noDataNote, color: 'subtle' }], quarter))
  }

  // The two limit windows.
  for (const kind of ['five_hour', 'seven_day'] as const) {
    const l = m.limits.find(x => x.kind === kind)
    if (l === undefined) {
      top.push(card(E, a, `col-${kind}`, c[kind], 'subtle', null, [{ text: c.noData }, { text: c.noDataNote, color: 'subtle' }], quarter))
      continue
    }
    const ms = until(l, a.now)
    const lines: Line[] = [{ text: c.usedPct(l.pct), color: pctTheme(l.pct), bold: true }]
    if (ms !== null && l.resetsAt !== null) {
      lines.push({ text: c.inT(span(ms, t)) }, { text: c.at(clockAt(l.resetsAt, a.now, t)), color: 'subtle' })
    }
    top.push(card(E, a, `col-${kind}`, c[kind], pctTheme(l.pct), { fraction: l.pct / 100, color: pctRing(l.pct), label: pct(l.pct, a.lang), alt: `${c[kind]} ${pct(l.pct, a.lang)}` }, lines, quarter))
  }

  // Cost: what a subscription costs nothing extra for, or the API bill.
  if (onPlan(a)) {
    const lines: Line[] = [{ text: c.planNoCharge, color: 'success', bold: true }, { text: c.planFromLimits }]
    if (m.costUsd !== null) lines.push({ text: c.apiWorth(`$${m.costUsd.toFixed(2)}`), color: 'subtle' })
    top.push(card(E, a, 'col-cost', c.plan, 'success', null, lines, quarter))
  } else if (m.costUsd !== null) {
    const lines: Line[] = [{ text: `$${m.costUsd.toFixed(2)}`, color: 'warning', bold: true }]
    if (m.burnPerHour !== null) lines.push({ text: c.perHour(`$${m.burnPerHour.toFixed(2)}`) })
    lines.push({ text: c.estimate, color: 'subtle' })
    top.push(card(E, a, 'col-cost', c.cost, 'warning', null, lines, quarter))
  } else {
    top.push(card(E, a, 'col-cost', c.cost, 'subtle', null, [{ text: c.noData }], quarter))
  }

  // Level: the ring is the way to the next one.
  const lp = levelProgress(a.s.totalKills)
  const bottom: RenderElement[] = [
    card(E, a, 'col-level', c.level, 'claude', { fraction: lp.fraction, color: RING.claude, label: `${t.lv} ${lp.level}`, alt: `${c.level} ${lp.level}` }, [
      { text: `${RANK_NAMES[a.lang][rankFor(lp.level)]} · ${Math.round(lp.fraction * 100)}%`, color: 'claude', bold: true },
      { text: c.total(count(a.s.totalKills)), bold: true },
      { text: lp.need > 0 ? c.next(count(lp.need - lp.into)) : c.maxed },
    ], half, [syncButton(E, a)]),
  ]

  // The armoury: one drop-down, however many weapons there are.
  const names = WEAPON_NAMES[a.lang]
  const unlocked = WEAPONS.filter(w => isUnlocked(w.kind, lp.level))
  const locked = WEAPONS.filter(w => !isUnlocked(w.kind, lp.level))
  const nextUp = locked[0]
  const options = [
    { value: 'auto', label: `${c.auto} (${c.rotating})` },
    ...unlocked.map(w => ({ value: w.kind, label: names[w.kind] })),
  ]
  const picked = options.some(o => o.value === a.s.weapon) ? a.s.weapon : 'auto'
  // The picker, and beside it the button that folds the panel away.
  const armoury: RenderElement[] = [
    // The picker on the left, the way back to the fight pushed to the right.
    Box({
      key: 'arms-row',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexGrow: 1,
      columnGap: 2,
      children: [
        E.Select({
          key: 'wpn-select',
          options,
          value: picked,
          onSelect: value => {
            const choice = options.find(o => o.value === value)?.value
            if (choice !== undefined) a.onPick(choice as WeaponChoice)
          },
        }),
        // Wide padding makes the main action a bigger target; the text cannot grow.
        Button({ key: 'usage-close', label: `   ${t.backToBattle}   `, variant: 'primary', onPress: a.onToggle }),
      ],
    }),
  ]
  bottom.push(
    card(E, a, 'col-arms', c.weaponTitle, 'claude', null, [
      { text: c.owned(unlocked.length, WEAPONS.length), bold: true },
      ...(nextUp ? [{ text: c.nextWeapon(names[nextUp.kind], nextUp.level), color: 'subtle' }] : []),
    ], half, armoury),
  )

  return Box({
    key: 'usage',
    flexDirection: 'column',
    children: [
      Box({ key: 'row-figures', flexDirection: 'row', columnGap: 1, children: top }),
      Box({ key: 'row-progress', flexDirection: 'row', columnGap: 1, children: bottom }),
    ],
  })
}

// Rows a desktop text row is tall in px, for sizing the ring charts in rows.
const ROW_PX = 17

/**
 * Rows the opened panel takes: two rows of cards. A card is a
 * border round the taller of its ring and its four text rows (title and
 * three lines); without a ring the figure's bar adds one text row.
 */
export function panelRows(ringPx: number): number {
  const inside = ringPx > 0 ? Math.max(5, Math.ceil(ringPx / ROW_PX)) : 6
  return 2 * (2 + inside)
}

/** The opened panel; the closed summary is the chips region the render hook draws. */
export function usageBlock(E: Els, a: PanelArgs): RenderElement {
  return details(E, a)
}
