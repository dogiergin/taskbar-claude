import type { ClientModule, ClientSurface, RenderElement } from 'claude-code'

import type { Limit, Phase, SceneProps } from '../types'

// ---------------------------------------------------------------- palette

const C = {
  body: '#D97757',
  bodyGlow: '#FFB38A',
  leg: '#9E4F36',
  eye: '#2B1B17',
  eyeShut: '#8C4A32',
  steel: '#D8E1EC',
  steelDim: '#9AA6B8',
  gold: '#E8B33A',
  wood: '#7A4A2A',
  wrap: '#3A3550',
  slash: '#FFF3B0',
  ground: '#4A4A4A',
  groundDot: '#6E6E6E',
  grass: '#4F7A4F',
  coinEdge: '#C9A227',
  coin: '#F2C94C',
  coinShine: '#FFF6C8',
  sleep: '#8FB8DE',
  ok: '#7BC67E',
  warn: '#E5C07B',
  bad: '#E06C75',
}

const BUG_COLORS: ReadonlyArray<readonly [string, string]> = [
  ['#7BC67E', '#3E7D42'],
  ['#E06C75', '#9E3B44'],
  ['#B48EAD', '#6E4F69'],
  ['#61AFEF', '#2F6C9E'],
]
function bugColors(kind: number): readonly [string, string] {
  return BUG_COLORS[kind] ?? ['#7BC67E', '#3E7D42']
}
const CONFETTI = ['#E06C75', '#E5C07B', '#7BC67E', '#61AFEF', '#C678DD', '#FFB38A']

// ---------------------------------------------------------------- sprites

// Claude's spark in two poses; flipping between them makes it twinkle as it runs.
const SPARK_A = [
  '....O....',
  '.O..O..O.',
  '..OOOOO..',
  'OOOEOEOOO',
  '..OOOOO..',
  '.O..O..O.',
  '....O....',
]
const SPARK_B = [
  '..O...O..',
  '....O....',
  'O.OOOOO.O',
  '.OOEOEOO.',
  'O.OOOOO.O',
  '....O....',
  '..O...O..',
]
const LEGS_RUN = ['...L.L...', '..L...L..']
const LEGS_STAND = '...L.L...'

type WeaponKind = 'katana' | 'sword' | 'mace' | 'axe'
type Pose = 'up' | 'fwd' | 'raise'

const WEAPON_FOR: Record<Phase, WeaponKind> = {
  idle: 'sword',
  think: 'katana',
  answer: 'sword',
  code: 'sword',
  run: 'mace',
  search: 'axe',
  win: 'katana',
}
// How far along its direction each weapon reaches, in pixels.
const REACH: Record<WeaponKind, number> = { katana: 9, sword: 6, mace: 6, axe: 6 }
// Ticks between new bugs, per phase (lower = busier fight).
const SPAWN_GAP: Record<Phase, number> = {
  idle: 999,
  think: 14,
  answer: 12,
  code: 9,
  run: 8,
  search: 11,
  win: 999,
}

const TEXT = {
  tr: {
    idle: 'Hazır',
    think: 'Düşünüyor',
    answer: 'Yanıtlıyor',
    code: 'Kod yazıyor',
    run: 'Komut çalıştırıyor',
    search: 'Araştırıyor',
    win: 'Zafer!',
    eat: 'Token yiyor',
    ctx: 'Bağlam',
    five_hour: '5s',
    seven_day: 'Hafta',
    spend_limit: 'Harcama',
    perHour: '/sa',
    bugs: 'Böcek',
    d: 'g',
    h: 's',
    m: 'dk',
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
    ctx: 'Context',
    five_hour: '5h',
    seven_day: 'Week',
    spend_limit: 'Spend',
    perHour: '/h',
    bugs: 'Bugs',
    d: 'd',
    h: 'h',
    m: 'm',
  },
}

// ---------------------------------------------------------------- game state

type Bug = { x: number; y: number; kind: number; hp: number; fly: boolean; boss: boolean; flee: boolean; hit: number }
type Particle = { x: number; y: number; vx: number; vy: number; c: string; life: number; g: number }
type Mode = 'idle' | 'fight' | 'eat' | 'win'

type Game = {
  props: SceneProps
  tick: number
  scroll: number
  kx: number
  jump: number
  attack: number
  bugs: Bug[]
  parts: Particle[]
  kills: number
  bossDue: boolean
  mode: Mode
  eatStage: number
  eatTimer: number
  tokenX: number
  glow: number
  winTimer: number
  seenEat: number
  seenWin: number
  spawnIn: number
}

type Holder = { g: Game }

const HOME_X = 4
const TICK_MS = 80

function rand(a: number, b: number) {
  return a + Math.random() * (b - a)
}

function newGame(props: SceneProps): Game {
  return {
    props,
    tick: 0,
    scroll: 0,
    kx: HOME_X,
    jump: 0,
    attack: 0,
    bugs: [],
    parts: [],
    kills: 0,
    bossDue: false,
    mode: props.working ? 'fight' : 'idle',
    eatStage: 0,
    eatTimer: 0,
    tokenX: 0,
    glow: 0,
    winTimer: 0,
    // Events from before this arena mounted are not replayed.
    seenEat: props.eatSeq,
    seenWin: props.winSeq,
    spawnIn: 6,
  }
}

function width(g: Game) {
  return g.props.cols
}
function groundY(g: Game) {
  return g.props.rows * 2 - 1
}

function burst(g: Game, x: number, y: number, colors: readonly string[], n: number) {
  for (let i = 0; i < n; i++) {
    g.parts.push({
      x,
      y,
      vx: rand(-0.4, 1.4),
      vy: rand(-1.3, -0.2),
      c: colors[i % colors.length] ?? C.slash,
      life: Math.round(rand(8, 16)),
      g: 0.15,
    })
  }
}

function bugWidth(b: Bug) {
  return b.boss ? 12 : b.fly ? 5 : 6
}

function spawnBug(g: Game) {
  const gy = groundY(g)
  const kind = Math.floor(Math.random() * BUG_COLORS.length)
  if (g.bossDue && gy >= 9) {
    g.bossDue = false
    g.bugs.push({ x: width(g) + 2, y: gy - 8, kind, hp: 3, fly: false, boss: true, flee: false, hit: 0 })
    return
  }
  const fly = gy >= 7 && Math.random() < 0.25
  const y = fly ? Math.max(0, gy - 8 + Math.floor(rand(0, 3))) : gy - 4
  g.bugs.push({ x: width(g) + 2, y, kind, hp: 1, fly, boss: false, flee: false, hit: 0 })
}

function killBug(g: Game, b: Bug) {
  const [body, dark] = bugColors(b.kind)
  burst(g, b.x + bugWidth(b) / 2, b.y + 1, [body, dark, '#FFFFFF', C.slash], b.boss ? 22 : 9)
  g.kills += 1
  if (g.kills % 15 === 0) g.bossDue = true
}

// ---------------------------------------------------------------- one tick

function syncMode(g: Game) {
  const p = g.props
  if (p.winSeq > g.seenWin) {
    g.seenWin = p.winSeq
    g.mode = 'win'
    g.winTimer = 45
    for (const b of g.bugs) killBug(g, b)
    g.bugs = []
    return
  }
  if (p.eatSeq > g.seenEat) {
    g.seenEat = p.eatSeq
    if (g.mode === 'fight' && width(g) >= 40) {
      g.mode = 'eat'
      g.eatStage = 0
      g.tokenX = Math.min(width(g) - 7, Math.round(g.kx) + 26)
      for (const b of g.bugs) b.flee = true
    }
  }
  if (g.mode === 'fight' || g.mode === 'idle') {
    g.mode = p.working ? 'fight' : 'idle'
  }
}

function step(g: Game) {
  g.tick += 1
  syncMode(g)
  const gy = groundY(g)
  const W = width(g)
  const weapon = WEAPON_FOR[g.props.phase]

  if (g.mode === 'fight') {
    g.scroll += 0.8
    g.kx += (HOME_X - g.kx) * 0.3
    g.jump = 0
    g.spawnIn -= 1
    if (g.spawnIn <= 0) {
      spawnBug(g)
      const gap = SPAWN_GAP[g.props.phase]
      g.spawnIn = Math.round(rand(gap, gap * 1.8))
    }
  } else if (g.mode === 'eat') {
    if (g.eatStage === 0) {
      g.kx += 1.1
      if (g.kx + 8 >= g.tokenX) {
        g.eatStage = 1
        g.eatTimer = 12
      }
    } else if (g.eatStage === 1) {
      g.eatTimer -= 1
      g.jump = g.eatTimer % 4 < 2 ? 1 : 0
      if (g.eatTimer % 3 === 0) {
        g.parts.push({ x: g.tokenX + 2, y: gy - 4, vx: rand(-0.4, 0.4), vy: rand(-0.9, -0.5), c: C.coinShine, life: 10, g: 0 })
      }
      if (g.eatTimer <= 0) {
        g.eatStage = 2
        g.glow = 28
        g.jump = 0
        burst(g, g.kx + 4, gy - 6, [C.coin, C.coinShine, C.bodyGlow], 12)
      }
    } else {
      g.kx -= 1.1
      if (g.kx <= HOME_X) {
        g.kx = HOME_X
        g.mode = g.props.working ? 'fight' : 'idle'
        g.spawnIn = 4
      }
    }
  } else if (g.mode === 'win') {
    g.winTimer -= 1
    g.kx += (HOME_X + 4 - g.kx) * 0.2
    g.jump = Math.round(Math.abs(Math.sin(g.tick * 0.45)) * Math.min(3, gy - 8))
    for (let i = 0; i < 2; i++) {
      g.parts.push({ x: rand(0, W), y: 0, vx: rand(-0.2, 0.2), vy: rand(0.2, 0.5), c: CONFETTI[Math.floor(rand(0, CONFETTI.length))] ?? C.slash, life: 24, g: 0.02 })
    }
    if (g.winTimer <= 0) {
      g.jump = 0
      g.mode = g.props.working ? 'fight' : 'idle'
    }
  } else {
    g.kx += (HOME_X - g.kx) * 0.3
    g.jump = 0
    if (g.tick % 18 === 0) {
      g.parts.push({ x: g.kx + 6, y: gy - 8, vx: 0.25, vy: -0.25, c: C.sleep, life: 16, g: 0 })
    }
  }

  // Bugs advance (or run off while the knight eats).
  for (const b of g.bugs) {
    if (b.flee) b.x += 1.6
    else b.x -= b.boss ? 0.9 : b.fly ? 1.8 : 1.5
    if (b.hit > 0) b.hit -= 1
  }
  g.bugs = g.bugs.filter(b => b.x < W + 16 && b.x > -16)

  // Swing when something is in reach; the third tick of a swing lands it.
  if (g.mode === 'fight') {
    const front = g.kx + 9 + REACH[weapon] + 2
    const inReach = (b: Bug) => !b.flee && b.x <= front && b.x + bugWidth(b) >= g.kx + 4
    if (g.attack === 0 && g.bugs.some(inReach)) g.attack = 4
    if (g.attack === 2) {
      for (const b of g.bugs.filter(inReach)) {
        b.hp -= 1
        if (b.hp <= 0) {
          killBug(g, b)
        } else {
          b.hit = 3
          b.x += 3
          burst(g, b.x, b.y + 3, [C.slash, '#FFFFFF'], 4)
        }
      }
      g.bugs = g.bugs.filter(b => b.hp > 0)
    }
  }
  if (g.attack > 0) g.attack -= 1
  if (g.glow > 0) g.glow -= 1

  for (const p of g.parts) {
    p.x += p.vx
    p.y += p.vy
    p.vy += p.g
    p.life -= 1
  }
  g.parts = g.parts.filter(p => p.life > 0 && p.y < gy + 1).slice(-160)
}

// ---------------------------------------------------------------- drawing

type Canvas = { w: number; h: number; px: (string | undefined)[][] }

function canvas(w: number, h: number): Canvas {
  return { w, h, px: Array.from({ length: h }, () => new Array<string | undefined>(w)) }
}

function set(cv: Canvas, x: number, y: number, c: string) {
  const ix = Math.round(x)
  const iy = Math.round(y)
  const row = cv.px[iy]
  if (row !== undefined && ix >= 0 && ix < cv.w) row[ix] = c
}

function drawGround(cv: Canvas, g: Game) {
  const gy = groundY(g)
  const s = Math.floor(g.scroll)
  for (let x = 0; x < cv.w; x++) {
    set(cv, x, gy, (x + s) % 6 === 0 ? C.groundDot : C.ground)
    if ((x + s) % 29 === 0 || (x + s) % 29 === 2) set(cv, x, gy - 1, C.grass)
    if ((x + s) % 29 === 1) set(cv, x, gy - 2, C.grass)
  }
}

function drawKnight(cv: Canvas, g: Game) {
  const gy = groundY(g)
  const top = gy - 8 - g.jump
  const x0 = Math.round(g.kx)
  const running = g.mode === 'fight' || (g.mode === 'eat' && g.eatStage !== 1)
  const frame = Math.floor(g.tick / 2) % 2
  const sprite = running || g.mode === 'win' ? (frame ? SPARK_B : SPARK_A) : SPARK_A
  const body = g.glow > 0 && g.glow % 4 < 2 ? C.bodyGlow : C.body
  const eye = g.mode === 'idle' ? C.eyeShut : C.eye
  sprite.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const ch = row[dx]
      if (ch === 'O') set(cv, x0 + dx, top + dy, body)
      else if (ch === 'E') set(cv, x0 + dx, top + dy, eye)
    }
  })
  const legs = (running ? LEGS_RUN[frame] : undefined) ?? LEGS_STAND
  for (let dx = 0; dx < legs.length; dx++) {
    if (legs[dx] === 'L') set(cv, x0 + dx, top + 7, C.leg)
  }

  const weapon = WEAPON_FOR[g.props.phase]
  const pose: Pose = g.mode === 'win' ? 'raise' : g.attack >= 1 && g.attack <= 3 ? 'fwd' : 'up'
  drawWeapon(cv, weapon, x0 + 9, top + 3, pose)
  if (g.attack === 2 || g.attack === 1) {
    const fx = x0 + 9 + REACH[weapon]
    const arc: Array<[number, number]> = [[0, -3], [1, -2], [2, -1], [2, 0], [2, 1], [1, 2]]
    for (const [ax, ay] of arc) set(cv, fx + ax, top + 3 + ay, C.slash)
  }
}

function drawWeapon(cv: Canvas, kind: WeaponKind, bx: number, by: number, pose: Pose) {
  const [dx, dy] = pose === 'fwd' ? [1, 0] : pose === 'up' ? [1, -1] : [0, -1]
  // The side the edge faces: up for a forward blade, up-left for a raised one.
  const [ux, uy] = pose === 'fwd' ? [0, -1] : pose === 'up' ? [-1, -1] : [-1, 0]
  let x = bx
  let y = by
  const line = (n: number, c: string) => {
    for (let i = 0; i < n; i++) {
      set(cv, x, y, c)
      x += dx
      y += dy
    }
  }
  if (kind === 'katana') {
    line(2, C.wrap)
    set(cv, x + ux, y + uy, C.gold)
    set(cv, x - ux, y - uy, C.gold)
    line(1, C.gold)
    line(5, C.steel)
    set(cv, x + ux, y + uy, C.steel)
  } else if (kind === 'sword') {
    line(1, C.wood)
    set(cv, x + ux, y + uy, C.gold)
    set(cv, x - ux, y - uy, C.gold)
    line(1, C.gold)
    line(4, C.steel)
  } else if (kind === 'mace') {
    line(3, C.wood)
    const cx = x + dx
    const cy = y + dy
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) set(cv, cx + i, cy + j, C.steelDim)
    set(cv, cx, cy - 2, C.steel)
    set(cv, cx + 2, cy, C.steel)
    set(cv, cx, cy + 2, C.steel)
    set(cv, cx - 2, cy, C.steel)
  } else {
    line(5, C.wood)
    const hx = x - dx
    const hy = y - dy
    for (let i = 1; i <= 2; i++) {
      set(cv, hx + ux * i, hy + uy * i, C.steel)
      set(cv, hx + ux * i - dx, hy + uy * i - dy, C.steelDim)
    }
    set(cv, hx - ux, hy - uy, C.steelDim)
  }
}

function drawBug(cv: Canvas, g: Game, b: Bug) {
  const [body0, dark0] = bugColors(b.kind)
  const body = b.hit > 0 ? '#FFFFFF' : body0
  const dark = b.hit > 0 ? '#DDDDDD' : dark0
  const x = Math.round(b.x)
  const y = Math.round(b.y)
  const f = Math.floor(g.tick / 3) % 2
  if (b.fly) {
    const wing = '#DDEEFF'
    if (f) {
      set(cv, x + 1, y, wing)
      set(cv, x + 3, y, wing)
    } else {
      set(cv, x, y, wing)
      set(cv, x + 4, y, wing)
    }
    set(cv, x, y + 1, body)
    set(cv, x + 1, y + 1, '#FFFFFF')
    for (let i = 2; i < 5; i++) set(cv, x + i, y + 1, body)
    for (let i = 1; i < 4; i++) set(cv, x + i, y + 2, dark)
    return
  }
  const s = b.boss ? 2 : 1
  const p = (px: number, py: number, c: string) => {
    for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) set(cv, x + px * s + i, y + py * s + j, c)
  }
  p(1, 0, dark)
  for (let i = 2; i < 5; i++) p(i, 1, body)
  p(0, 2, body)
  p(1, 2, '#FFFFFF')
  p(2, 2, body)
  p(3, 2, dark)
  p(4, 2, body)
  p(5, 2, body)
  for (let i = f; i < 6; i += 2) p(i, 3, dark)
}

function drawToken(cv: Canvas, g: Game) {
  if (g.mode !== 'eat' || g.eatStage === 2) return
  const gy = groundY(g)
  const size = g.eatStage === 1 ? Math.max(1, Math.ceil(g.eatTimer / 4) * 2 - 1) : 5
  const bob = g.eatStage === 0 && Math.floor(g.tick / 4) % 2 ? 1 : 0
  const cx = g.tokenX + 2
  const cy = gy - 4 - bob
  const r = (size - 1) / 2
  for (let i = -r; i <= r; i++) {
    for (let j = -r; j <= r; j++) {
      if (size >= 5 && Math.abs(i) === r && Math.abs(j) === r) continue
      const edge = Math.abs(i) === r || Math.abs(j) === r
      set(cv, cx + i, cy + j, edge && size > 1 ? C.coinEdge : C.coin)
    }
  }
  if (size >= 5) set(cv, cx - 1, cy - 1, C.coinShine)
}

function drawScene(g: Game): Canvas {
  const cv = canvas(width(g), g.props.rows * 2)
  if (g.props.rows < 4) return cv
  drawGround(cv, g)
  drawToken(cv, g)
  for (const b of g.bugs) drawBug(cv, g, b)
  drawKnight(cv, g)
  for (const p of g.parts) set(cv, p.x, p.y, p.c)
  return cv
}

// Two pixels per terminal cell: the upper half block's foreground is the top
// pixel and its background the bottom one. Runs of one color pair share a Text.
function toRows(cv: Canvas, s: ClientSurface<Holder>): RenderElement[] {
  const { Box, Text } = s.elements
  const out: RenderElement[] = []
  for (let r = 0; r < cv.h / 2; r++) {
    const top = cv.px[r * 2] ?? []
    const bot = cv.px[r * 2 + 1] ?? []
    const runs: RenderElement[] = []
    let text = ''
    let fg: string | undefined
    let bg: string | undefined
    const flush = () => {
      if (text === '') return
      runs.push(Text({ color: fg, backgroundColor: bg, children: text }))
      text = ''
    }
    for (let x = 0; x < cv.w; x++) {
      const t = top[x]
      const b = bot[x]
      let ch = ' '
      let cfg: string | undefined
      let cbg: string | undefined
      if (t && b) {
        ch = t === b ? '█' : '▀'
        cfg = t
        cbg = t === b ? undefined : b
      } else if (t) {
        ch = '▀'
        cfg = t
      } else if (b) {
        ch = '▄'
        cfg = b
      }
      if (cfg !== fg || cbg !== bg) {
        flush()
        fg = cfg
        bg = cbg
      }
      text += ch
    }
    flush()
    out.push(Box({ key: `r${r}`, flexDirection: 'row', children: runs }))
  }
  return out
}

// ---------------------------------------------------------------- readout

function pctColor(p: number) {
  return p < 70 ? C.ok : p < 90 ? C.warn : C.bad
}

function untilText(iso: string | null, t: (typeof TEXT)['tr']) {
  if (iso === null) return ''
  const ms = Date.parse(iso) - Date.now()
  if (!(ms > 0)) return ''
  const mins = Math.floor(ms / 60_000)
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return d > 0 ? `${d}${t.d}${h}${t.h}` : h > 0 ? `${h}${t.h}${m}${t.m}` : `${m}${t.m}`
}

function kTokens(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}k`
}

function readout(g: Game, s: ClientSurface<Holder>): RenderElement {
  const { Box, Text } = s.elements
  const p = g.props
  const t = TEXT[p.lang]
  const m = p.metrics
  const parts: RenderElement[] = []
  const add = (text: string, color?: string, dim?: boolean) => {
    parts.push(Text({ color, dimColor: dim, children: text }))
  }
  const sep = () => add(' │ ', undefined, true)

  const mode = p.rows >= 4 ? g.mode : p.stage ?? (p.working ? 'fight' : 'idle')
  const label = mode === 'eat' ? t.eat : mode === 'win' ? t.win : p.working ? t[p.phase] : t.idle
  add('● ', mode === 'win' ? C.gold : p.working ? C.body : C.steelDim)
  add(label, C.body)
  if (p.tool && p.working && mode !== 'win') add(` ${p.tool}`, undefined, true)

  if (m.ctxPct !== null) {
    sep()
    add(`${t.ctx} `, undefined, true)
    const filled = Math.round((m.ctxPct / 100) * 8)
    add('█'.repeat(filled), pctColor(m.ctxPct))
    add('░'.repeat(8 - filled), undefined, true)
    add(` ${m.ctxPct}%`, pctColor(m.ctxPct))
    if (m.ctxTokens !== null && m.ctxWindow > 0) add(` ${kTokens(m.ctxTokens)}/${kTokens(m.ctxWindow)}`, undefined, true)
  }

  for (const l of m.limits) {
    sep()
    const name = (t as Record<string, string>)[l.kind] ?? l.kind
    add(`${name} `, undefined, true)
    add(`${l.pct}%`, pctColor(l.pct))
    const until = untilText(l.resetsAt, t)
    if (until) add(` ↻${until}`, undefined, true)
  }

  if (m.costUsd !== null) {
    sep()
    add(`$${m.costUsd.toFixed(2)}`, C.gold)
    if (m.burnPerHour !== null) add(` ($${m.burnPerHour.toFixed(2)}${t.perHour})`, undefined, true)
  }

  // The terminal counts its own fight; the desktop's is counted by the hooks.
  const kills = p.rows >= 4 ? g.kills : p.kills
  if (kills > 0) {
    sep()
    add(`${t.bugs} ${kills}`, C.ok)
  }

  return Box({ key: 'readout', flexDirection: 'row', children: Text({ wrap: 'truncate-end', children: parts }) })
}

// ---------------------------------------------------------------- module

const Arena: ClientModule<SceneProps, Holder> = (props, s) => {
  let g: Game
  if (s.state === undefined) {
    g = newGame(props)
    const holder = g
    s.every(TICK_MS, () => {
      step(holder)
      s.setState({ g: holder })
    })
    s.setState({ g })
  } else {
    g = s.state.g
  }
  g.props = props

  const rows = toRows(drawScene(g), s)
  return s.elements.Box({ flexDirection: 'column', children: props.readout ? [...rows, readout(g, s)] : rows })
}

export default Arena
