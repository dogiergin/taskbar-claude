// The desktop arena: one animated SVG the desktop runs on its own clock, so
// motion is smooth and costs no redraws.
//
// A whole turn is ONE drawing: the fight is a long scripted loop of bugs at
// irregular times, each met by the strike that suits it (slash, jump chop,
// spin, dash thrust), with a snack break and weapon swaps written into the
// same loop. Nothing in it depends on what Claude is doing right now, so the
// markup never changes mid-turn and the animation never starts over.

import type { WeaponKind } from '../types'
import { GEAR_CSS, GUN_SCALE, MUZZLE, TRACER, WEAPON_CSS, WEAPON_DEFS, gear, isRanged, weapon } from './weapons'

/** fight and win while Claude works; sleep, wake and camp between turns. */
export type SvgMode = 'sleep' | 'wake' | 'camp' | 'fight' | 'win'

export const SVG_HEIGHT = 136

/** The fight loop's length, in seconds. */
export const LOOP_S = 48
/** When in the loop Claude breaks off to eat, and for how long, in seconds. */
export const EAT_AT = 22
export const EAT_LEN = 4.6
/** The part of the snack break the usage bar stays open for, in loop seconds. */
export const PEEK_WINDOW = { open: EAT_AT + 0.75, close: EAT_AT + 3.9 }

const GROUND = 120
const HERO_X = 150
const REACH = HERO_X + 78

const f = (n: number) => Number(n.toFixed(2))
const f3 = (n: number) => Number(n.toFixed(3))

// A fixed sequence, so the same inputs draw the same markup.
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const CONFETTI = ['#F07B86', '#F2C94C', '#6CCB7A', '#5FB4F5', '#C792EA', '#FFB38A']

// ---------------------------------------------------------------- the script

type BugKind = 'beetle' | 'spider' | 'mantis' | 'wasp'
type Move = 'slash' | 'jump' | 'spin' | 'dash'
type Hit = { t: number; bug: BugKind; move: Move }

const MOVES_FOR: Record<BugKind, readonly Move[]> = {
  beetle: ['slash', 'dash', 'slash'],
  spider: ['dash', 'slash'],
  mantis: ['spin'],
  wasp: ['jump'],
}
// Where each strike lands, from the hero's feet.
const HIT_AT: Record<Move, { x: number; y: number }> = {
  slash: { x: REACH, y: 0 },
  jump: { x: REACH + 4, y: -62 },
  spin: { x: REACH - 4, y: 0 },
  dash: { x: REACH + 50, y: 0 },
}
// Walking speed per bug, in px/s.
const SPEED: Record<BugKind, number> = { beetle: 170, spider: 230, mantis: 140, wasp: 200 }

/** The loop's strikes, at irregular gaps, clear of the snack break. */
function script(): Hit[] {
  const rnd = seeded(42)
  const out: Hit[] = []
  let t = 1.6
  while (t < LOOP_S - 0.7) {
    if (t > EAT_AT - 1.2 && t < EAT_AT + EAT_LEN + 0.6) {
      t = EAT_AT + EAT_LEN + 0.6
      continue
    }
    const r = rnd()
    const bug: BugKind = r < 0.32 ? 'beetle' : r < 0.56 ? 'spider' : r < 0.78 ? 'mantis' : 'wasp'
    const moves = MOVES_FOR[bug]
    const move = moves[Math.floor(rnd() * moves.length)] ?? 'slash'
    out.push({ t: f3(t), bug, move })
    // Mostly a beat or two apart, now and then hard on the last one's heels.
    t += rnd() < 0.22 ? 1.0 + rnd() * 0.25 : 1.15 + rnd() * 1.5
  }
  return out
}

const SCRIPT = script()

/** Loop seconds at which a bug falls: what the hooks count kills by. */
export const KILL_TIMES: readonly number[] = SCRIPT.map(h => h.t)

// ---------------------------------------------------------------- keyframes

type Stop = [number, string]

/** Keyframes over the loop from stops in seconds, sorted, ends filled in. */
function keyframes(name: string, stops: Stop[], rest: string): string {
  const sorted = [...stops].sort((a, b) => a[0] - b[0])
  if (sorted.length === 0 || (sorted[0]?.[0] ?? 0) > 0) sorted.unshift([0, rest])
  if ((sorted[sorted.length - 1]?.[0] ?? LOOP_S) < LOOP_S) sorted.push([LOOP_S, rest])
  const body = sorted.map(([t, css]) => `${f3((Math.max(0, Math.min(LOOP_S, t)) / LOOP_S) * 100)}%{${css}}`).join('')
  return `@keyframes ${name}{${body}}`
}

const at = (x: number, y: number, r = 0) => `transform:translate(${f(x)}px,${f(y)}px) rotate(${r}deg)`
const rot = (r: number) => `transform:rotate(${r}deg)`

// ---------------------------------------------------------------- scenery

function defs(): string {
  return `<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0A0F24"/><stop offset=".65" stop-color="#18214A"/><stop offset="1" stop-color="#262B58"/>
  </linearGradient>
  <linearGradient id="front" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#EC9474"/><stop offset=".55" stop-color="#D97757"/><stop offset="1" stop-color="#C2643F"/>
  </linearGradient>
  <linearGradient id="steel" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#9AA7BA"/><stop offset=".5" stop-color="#F4F8FF"/><stop offset="1" stop-color="#B5C1D3"/>
  </linearGradient>
  <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FF4D3D" stop-opacity="0"/><stop offset="1" stop-color="#FF4D3D" stop-opacity=".3"/>
  </linearGradient>
  <linearGradient id="chunk" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#A6E3A1"/><stop offset="1" stop-color="#5DAA5F"/>
  </linearGradient>
  <linearGradient id="blade" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset=".55" stop-color="#FFFFFF" stop-opacity=".95"/><stop offset="1" stop-color="#BFE9FF"/>
  </linearGradient>
  <radialGradient id="aura" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#C8FFB0" stop-opacity=".7"/><stop offset="1" stop-color="#C8FFB0" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="gold" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#FFD98A" stop-opacity=".75"/><stop offset="1" stop-color="#FFD98A" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="lamp" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#FFF1C9" stop-opacity=".95"/><stop offset=".35" stop-color="#FFD98A" stop-opacity=".45"/><stop offset="1" stop-color="#FFD98A" stop-opacity="0"/>
  </radialGradient>
  <filter id="redGlow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  ${WEAPON_DEFS}
  <clipPath id="cutTop" clipPathUnits="userSpaceOnUse"><path d="M-60 -90 L60 -90 L60 -20 L-60 -8 Z"/></clipPath>
  <clipPath id="cutBot" clipPathUnits="userSpaceOnUse"><path d="M-60 -8 L60 -20 L60 30 L-60 30 Z"/></clipPath>
  <symbol id="bug-beetle" overflow="visible">${beetle()}</symbol>
  <symbol id="bug-spider" overflow="visible">${spider()}</symbol>
  <symbol id="bug-mantis" overflow="visible">${mantis()}</symbol>
  <symbol id="bug-wasp" overflow="visible">${wasp()}</symbol>
</defs>`
}

function skyline(w: number, seed: number, color: string, minH: number, maxH: number, windowOdds: number): string {
  const rnd = seeded(seed)
  let x = 0
  let out = ''
  while (x < w) {
    const bw = 26 + Math.floor(rnd() * 46)
    const bh = minH + Math.floor(rnd() * (maxH - minH))
    const top = GROUND - bh
    out += `<rect x="${x}" y="${top}" width="${bw - 3}" height="${bh}" fill="${color}"/>`
    for (let wy = top + 6; wy < GROUND - 6; wy += 9) {
      for (let wx = x + 5; wx < x + bw - 8; wx += 8) {
        if (rnd() < windowOdds) {
          const warm = rnd() < 0.8
          out += `<rect x="${wx}" y="${wy}" width="3" height="4" fill="${warm ? '#FFD98A' : '#9FD4FF'}" opacity="${f(0.35 + rnd() * 0.5)}"/>`
        }
      }
    }
    x += bw
  }
  return out
}

function backdrop(w: number): string {
  const rnd = seeded(7)
  let bokeh = ''
  const lamps = Math.max(3, Math.round(w / 170))
  for (let i = 0; i < lamps; i++) {
    const cx = f((i + 0.5) * (w / lamps) + (rnd() - 0.5) * 40)
    const cy = f(16 + rnd() * 18)
    const r = f(16 + rnd() * 12)
    bokeh += `<circle class="tw" style="animation-delay:-${f(rnd() * 4)}s" cx="${cx}" cy="${cy}" r="${r}" fill="url(#lamp)"/>`
  }
  let dust = ''
  for (let i = 0; i < 14; i++) {
    dust += `<circle class="tw" style="animation-delay:-${f(rnd() * 4)}s" cx="${f(rnd() * w)}" cy="${f(10 + rnd() * 70)}" r="${f(0.8 + rnd() * 1.6)}" fill="${rnd() < 0.3 ? '#F07B86' : '#CFE3FF'}" opacity=".55"/>`
  }
  const far = skyline(w, 11, '#161D3F', 30, 72, 0.18)
  const near = skyline(w, 23, '#0F1430', 18, 46, 0.1)
  return `<rect x="-10" y="-10" width="${w + 20}" height="${SVG_HEIGHT + 20}" fill="url(#sky)"/>
${bokeh}${dust}
<g class="far"><g id="tile-far">${far}</g><use href="#tile-far" x="${w}"/></g>
<g class="near"><g id="tile-near">${near}</g><use href="#tile-near" x="${w}"/></g>
<rect x="-10" y="${GROUND}" width="${w + 20}" height="${SVG_HEIGHT - GROUND + 10}" fill="#0C1026"/>
<line x1="0" y1="${GROUND + 0.5}" x2="${w}" y2="${GROUND + 0.5}" stroke="#3A4380" stroke-width="1"/>
<line class="dash" x1="0" y1="${GROUND + 7}" x2="${w}" y2="${GROUND + 7}" stroke="#262E60" stroke-width="2" stroke-dasharray="14 22"/>`
}

// ---------------------------------------------------------------- the hero

const EYES = `<g class="blink"><rect x="-13" y="-46" width="6.5" height="12" rx="1.4" fill="#1B1210"/>
<rect x="7" y="-46" width="6.5" height="12" rx="1.4" fill="#1B1210"/>
<rect x="-12" y="-45" width="2.2" height="3" fill="#FFFFFF" opacity=".55"/><rect x="8" y="-45" width="2.2" height="3" fill="#FFFFFF" opacity=".55"/></g>`

// The battle look is all in the face: brows down, war paint, teeth set.
const BATTLE_FACE = `<path d="M-16 -52 L-5 -48 L-5 -45.5 L-16 -49.5 Z" fill="#1B1210"/>
<path d="M16.5 -52 L5.5 -48 L5.5 -45.5 L16.5 -49.5 Z" fill="#1B1210"/>
<path d="M-23 -33 l7 -2.2 M-23 -29.5 l7 -2.2 M16 -35.2 l7 2.2 M16 -31.7 l7 2.2" stroke="#7A1A1F" stroke-width="1.9" stroke-linecap="round"/>
<rect x="-8" y="-29" width="16" height="7" rx="1.6" fill="#1B1210"/>
<path d="M-6.5 -25.5 h13 M-3.5 -28.2 v5.4 M0 -28.2 v5.4 M3.5 -28.2 v5.4" stroke="#F4EDE0" stroke-width="1.1"/>`
const HAPPY_FACE = `<path d="M-7 -28 Q 0 -21 7 -28" stroke="#1B1210" stroke-width="2.2" fill="none" stroke-linecap="round"/>`

function hero(weapons: readonly WeaponKind[], mode: SvgMode, tier = 0): string {
  const g = gear(tier)
  const legs = mode === 'fight' || mode === 'win' ? 'leg' : ''
  const faces =
    mode === 'fight'
      ? `<g class="fb">${BATTLE_FACE}</g><g class="fh">${HAPPY_FACE}</g>`
      : mode === 'win' || mode === 'camp'
        ? HAPPY_FACE
        : ''
  const arms = weapons
    .map(k => `<g class="wk wk-${k}">${isRanged(k) ? `<g transform="scale(${GUN_SCALE})">${weapon(k)}</g>` : weapon(k)}</g>`)
    .join('')
  return `<ellipse cx="2" cy="0" rx="34" ry="5" fill="#000" opacity=".35"/>
<g class="atk">
<g class="${legs} la"><rect x="-25" y="-14" width="8" height="14" rx="2" fill="#A9532F"/></g>
<g class="${legs} lb"><rect x="-12" y="-14" width="8" height="14" rx="2" fill="#B85C3E"/></g>
<g class="${legs} la"><rect x="5" y="-14" width="8" height="14" rx="2" fill="#A9532F"/></g>
<g class="${legs} lb"><rect x="18" y="-14" width="8" height="14" rx="2" fill="#B85C3E"/></g>
<g class="bob"><g class="chew">
  ${g.back}
  <path d="M-29 -54 L-21 -61 L37 -61 L29 -54 Z" fill="#F0A385"/>
  <path d="M29 -54 L37 -61 L37 -21 L29 -14 Z" fill="#A24B2A"/>
  <rect x="-29" y="-54" width="58" height="40" rx="2" fill="url(#front)"/>
  <g class="lhand"><rect x="-37" y="-40" width="8" height="11" rx="2" fill="#C8673F"/></g>
  ${EYES}
  ${faces}
  ${g.front}
  ${g.shield}
  <g transform="translate(34 -34)"><g class="arm">
    <g class="wpn">${arms}</g>
    <rect x="-4" y="-5" width="10" height="10" rx="2.5" fill="#D97757"/>
  </g></g>
</g></g>
</g>`
}

// ---------------------------------------------------------------- the bugs

function beetle(): string {
  const body = '#4E8F3A'
  const dark = '#1F3D18'
  let spikes = ''
  for (let k = 0; k < 5; k++) {
    const x = -8 + k * 5.5
    spikes += `<path d="M${x - 2.5} -16 L${x} -24 L${x + 2.5} -16 Z" fill="${dark}"/>`
  }
  return `<g class="crawl">
  <path d="M-8 -4 l-6 3 l-1 5 M-1 -3 l-4 4 l1 5 M7 -4 l3 4 l-1 5 M13 -5 l5 3 l1 5" stroke="${dark}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  ${spikes}
  <ellipse cx="3" cy="-10" rx="16" ry="10" fill="${body}"/>
  <path d="M3 -20 L3 0" stroke="${dark}" stroke-width="1.6"/>
  <path d="M-6 -15 C 0 -18 8 -18 14 -14" stroke="#FFFFFF" stroke-width="1.6" fill="none" opacity=".3"/>
  <circle cx="-13" cy="-9" r="8" fill="${dark}"/>
  <path d="M-19 -15 L-9 -12" stroke="#000" stroke-width="2" stroke-linecap="round"/>
  <circle cx="-15.5" cy="-10" r="2.8" fill="#FF3B3B" filter="url(#redGlow)"/>
  <g class="jaw"><path d="M-20 -6 C -27 -8 -29 -3 -25 0 C -25 -3 -23 -4 -20 -3 Z" fill="#E8E0C8"/></g>
  <g class="jaw2"><path d="M-20 -4 C -26 -1 -26 4 -21 4 C -23 2 -22 0 -19 -1 Z" fill="#D6CDB2"/></g>
  <path d="M-15 -16 L-22 -26 L-26 -24 M-11 -16 L-14 -28 L-18 -28" stroke="${dark}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
</g>`
}

function spider(): string {
  const body = '#6D3FA0'
  const dark = '#24103D'
  const leg = (x: number, side: number, cls: string) =>
    `<path class="${cls}" d="M${x} -10 Q ${x + side * 6} -24 ${x + side * 12} -16 L ${x + side * 15} 0" stroke="${dark}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
  return `<g class="crawl">
  ${leg(-6, -1, 'sl1')}${leg(-2, -1, 'sl2')}${leg(4, 1, 'sl1')}${leg(8, 1, 'sl2')}
  ${leg(-4, -1, 'sl2')}${leg(0, -1, 'sl1')}${leg(6, 1, 'sl2')}${leg(10, 1, 'sl1')}
  <ellipse cx="8" cy="-12" rx="12" ry="10" fill="${body}"/>
  <path d="M4 -18 L12 -18 L8 -10 Z" fill="#E8B33A" opacity=".85"/>
  <circle cx="-6" cy="-10" r="7" fill="${dark}"/>
  <circle cx="-9" cy="-13" r="1.8" fill="#FF3B3B" filter="url(#redGlow)"/><circle cx="-5" cy="-14" r="1.6" fill="#FF3B3B" filter="url(#redGlow)"/>
  <circle cx="-10.5" cy="-9.5" r="1.3" fill="#FF3B3B"/><circle cx="-7" cy="-10" r="1.2" fill="#FF3B3B"/>
  <g class="jaw"><path d="M-11 -5 L-14 1 L-10 -2 Z" fill="#E8E0C8"/></g>
  <g class="jaw2"><path d="M-7 -4 L-9 2 L-5 -1 Z" fill="#E8E0C8"/></g>
</g>`
}

// Stands on two legs and fights with four arms: two scythes up, two claws low.
function mantis(): string {
  const body = '#B8323A'
  const dark = '#4A0E12'
  return `<g class="stride">
  <path class="ml1" d="M2 -16 L-4 -8 L-6 0" stroke="${dark}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path class="ml2" d="M4 -16 L8 -8 L10 0" stroke="${dark}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <ellipse cx="10" cy="-20" rx="10" ry="6" fill="${dark}"/>
  <ellipse cx="2" cy="-28" rx="7" ry="13" fill="${body}"/>
  <path d="M-2 -36 C 2 -32 2 -24 -2 -18" stroke="#FF8A8F" stroke-width="1.2" fill="none" opacity=".5"/>
  <g class="claw">
    <path d="M-2 -36 L-12 -46 L-20 -40 L-17 -38 L-12 -42 L-4 -34" fill="${dark}"/>
    <path d="M1 -35 L-6 -50 L-16 -50 L-13 -47 L-7 -46 L-1 -33" fill="${body}" stroke="${dark}" stroke-width="1"/>
  </g>
  <g class="claw2">
    <path d="M-3 -26 L-14 -24 L-18 -18 L-15 -18 L-12 -21 L-3 -23" fill="${dark}"/>
    <path d="M0 -24 L-10 -18 L-12 -12 L-9 -13 L-7 -16 L1 -21" fill="${body}" stroke="${dark}" stroke-width="1"/>
  </g>
  <path d="M-4 -40 L-12 -46 L-4 -50 L4 -46 Z" fill="${body}" stroke="${dark}" stroke-width="1"/>
  <circle cx="-7" cy="-46" r="2.6" fill="#FF3B3B" filter="url(#redGlow)"/>
  <circle cx="1" cy="-47" r="2.2" fill="#FF3B3B" filter="url(#redGlow)"/>
  <path d="M-6 -50 C -10 -58 -16 -60 -20 -58 M-1 -50 C -2 -58 -6 -62 -10 -62" stroke="${dark}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
</g>`
}

function wasp(): string {
  return `<g class="hover">
  <g class="wing"><ellipse cx="4" cy="-12" rx="9" ry="5" fill="#DDEEFF" opacity=".55"/><ellipse cx="12" cy="-10" rx="7" ry="4" fill="#DDEEFF" opacity=".4"/></g>
  <ellipse cx="8" cy="-2" rx="13" ry="7" fill="#F2C230"/>
  <path d="M2 -8.5 L2 4.5 M8 -9 L8 5 M14 -8 L14 4" stroke="#1A1A1A" stroke-width="3"/>
  <path d="M20 -2 L30 0 L20 2 Z" fill="#1A1A1A"/>
  <circle cx="-7" cy="-3" r="6.5" fill="#1A1A1A"/>
  <circle cx="-9.5" cy="-4.5" r="2.4" fill="#FF3B3B" filter="url(#redGlow)"/>
  <path d="M-12 -9 L-6 -6.5" stroke="#FF3B3B" stroke-width="1.2"/>
  <path d="M-12 1 l-4 4 M-10 2 l-1 5" stroke="#1A1A1A" stroke-width="1.6" stroke-linecap="round"/>
</g>`
}

// ---------------------------------------------------------------- the fight

// Hero stops around one strike landing at `t`, in seconds.
function strikeStops(h: Hit): { body: Stop[]; arm: Stop[] } {
  const t = h.t
  const rest = at(0, 0)
  if (h.move === 'slash') {
    return {
      body: [[t - 0.35, rest], [t - 0.12, at(-5, 0)], [t, at(10, 0)], [t + 0.3, rest]],
      arm: [[t - 0.35, rot(14)], [t - 0.12, rot(-30)], [t, rot(105)], [t + 0.08, rot(92)], [t + 0.3, rot(14)]],
    }
  }
  if (h.move === 'jump') {
    return {
      body: [[t - 0.55, rest], [t - 0.42, at(2, 4)], [t - 0.2, at(14, -46)], [t, at(20, -30)], [t + 0.12, at(8, 2)], [t + 0.3, rest]],
      arm: [[t - 0.55, rot(14)], [t - 0.2, rot(-75)], [t, rot(135)], [t + 0.12, rot(122)], [t + 0.3, rot(14)]],
    }
  }
  if (h.move === 'spin') {
    return {
      body: [[t - 0.4, rest], [t - 0.25, at(0, -8)], [t, at(4, -8, 360)], [t + 0.15, at(0, 0, 360)], [t + 0.16, rest]],
      arm: [[t - 0.4, rot(14)], [t - 0.25, rot(90)], [t, rot(90)], [t + 0.25, rot(14)]],
    }
  }
  return {
    body: [[t - 0.4, rest], [t - 0.15, at(-10, 0)], [t, at(54, 0)], [t + 0.12, at(54, 0)], [t + 0.4, rest]],
    arm: [[t - 0.4, rot(14)], [t - 0.15, rot(80)], [t, rot(90)], [t + 0.12, rot(90)], [t + 0.4, rot(14)]],
  }
}

// Claude hops up and taps the usage bar above, a piece of the context block
// drops down, and Claude eats it before heading back into the fight.
function snack(): { svg: string; css: string; body: Stop[]; arm: Stop[] } {
  const E = EAT_AT
  const s = (p: number) => E + EAT_LEN * p
  const mouthX = HERO_X + 44
  const mouthY = GROUND - 28
  const body: Stop[] = [
    [E, at(0, 0)], [s(0.08), at(40, 0)], [s(0.11), at(40, 4)], [s(0.16), at(40, -58)], [s(0.19), at(40, -60)],
    [s(0.28), at(40, 0)], [s(0.84), at(40, 0)], [s(1), at(0, 0)],
  ]
  const arm: Stop[] = [[E, rot(14)], [s(0.12), rot(-20)], [s(0.16), rot(-8)], [s(0.19), rot(-8)], [s(0.26), rot(150)], [s(0.84), rot(150)], [s(1), rot(14)]]
  const off = 'opacity:0'
  let css = ''
  css += keyframes('fb', [[s(0.02), 'opacity:1'], [s(0.03), off], [s(0.97), off], [s(0.98), 'opacity:1']], 'opacity:1')
  css += keyframes('fh', [[s(0.02), off], [s(0.03), 'opacity:1'], [s(0.97), 'opacity:1'], [s(0.98), off]], off)
  css += keyframes('lhand', [[s(0.12), 'transform:translate(0,0)'], [s(0.16), 'transform:translate(4px,-14px)'], [s(0.19), 'transform:translate(4px,-14px)'], [s(0.24), 'transform:translate(0,0)']], 'transform:translate(0,0)')
  css += keyframes('ripple', [[s(0.17), `${off};transform:scale(.3)`], [s(0.19), 'opacity:1;transform:scale(.6)'], [s(0.3), `${off};transform:scale(2.2)`]], `${off};transform:scale(.3)`)
  css += keyframes('topglow', [[s(0.17), off], [s(0.2), 'opacity:1'], [s(0.4), off]], off)
  css += keyframes('chunk', [
    [s(0.24), `${off};transform:translate(0,-12px) rotate(0)`],
    [s(0.26), 'opacity:1;transform:translate(0,-6px) rotate(-6deg)'],
    [s(0.4), `opacity:1;transform:translate(0,${mouthY}px) rotate(14deg)`],
    [s(0.46), `opacity:1;transform:translate(0,${mouthY}px) rotate(8deg) scale(.75)`],
    [s(0.52), `opacity:1;transform:translate(0,${mouthY}px) rotate(8deg) scale(.45)`],
    [s(0.58), `opacity:1;transform:translate(0,${mouthY}px) rotate(8deg) scale(.15)`],
    [s(0.6), `${off};transform:translate(0,${mouthY}px) scale(0)`],
  ], `${off};transform:translate(0,-12px)`)
  css += keyframes('chew', [
    [s(0.42), 'transform:translate(0,0)'], [s(0.45), 'transform:translate(0,2px) scale(1.05,.92)'], [s(0.48), 'transform:translate(0,0)'],
    [s(0.51), 'transform:translate(0,2px) scale(1.05,.92)'], [s(0.54), 'transform:translate(0,0)'], [s(0.57), 'transform:translate(0,2px) scale(1.05,.92)'],
    [s(0.62), 'transform:translate(0,-8px)'], [s(0.68), 'transform:translate(0,0)'],
  ], 'transform:translate(0,0)')
  css += keyframes('glow', [[s(0.58), off], [s(0.66), 'opacity:1;transform:translateX(0)'], [s(0.84), 'opacity:.6;transform:translateX(0)'], [s(1), `${off};transform:translateX(-40px)`]], off)

  const rnd = seeded(9)
  let crumbs = ''
  for (let k = 0; k < 8; k++) {
    const dx = f((rnd() - 0.5) * 50)
    const dy = f(-10 - rnd() * 26)
    crumbs += `<rect class="cr c${k}" x="-2" y="-2" width="4" height="4" rx="1" fill="${k % 2 ? '#A6E3A1' : '#FFE08A'}"/>`
    css += `.c${k}{animation-name:c${k}}` + keyframes(`c${k}`, [[s(0.47), `${off};transform:translate(0,0)`], [s(0.5), 'opacity:1'], [s(0.72), `${off};transform:translate(${dx}px,${dy}px)`]], `${off};transform:translate(0,0)`)
  }
  const svg = `<g class="ripple" style="transform-origin:${mouthX}px 3px"><circle cx="${mouthX}" cy="3" r="14" fill="none" stroke="#A6E3A1" stroke-width="2"/></g>
<rect class="topglow" x="0" y="0" width="100%" height="3" fill="#A6E3A1"/>
<g class="chunk"><g transform="translate(${mouthX} 0)">
  <rect x="-15" y="-8" width="30" height="16" rx="3" fill="url(#chunk)" stroke="#3E7D42" stroke-width="1.2"/>
  <path d="M-11 -3 h4 M-5 -3 h4 M1 -3 h4 M7 -3 h4 M-11 2 h4 M-5 2 h4 M1 2 h4" stroke="#3E7D42" stroke-width="1.4" opacity=".6"/>
</g></g>
<g transform="translate(${mouthX} ${mouthY})">${crumbs}</g>
<g class="glow"><circle cx="${mouthX}" cy="${GROUND - 36}" r="58" fill="url(#aura)"/></g>`
  return { svg, css, body, arm }
}

/** On auto the weapon changes every few bugs: the swap times, and who holds when. */
function weaponSchedule(weapons: readonly WeaponKind[]): { swaps: number[]; at: (t: number) => WeaponKind } {
  const swaps: number[] = []
  if (weapons.length > 1) {
    const per = Math.max(2, Math.min(6, Math.floor(SCRIPT.length / weapons.length)))
    for (let i = per; i < SCRIPT.length; i += per) {
      const a = SCRIPT[i - 1]?.t ?? 0
      const b = SCRIPT[i]?.t ?? LOOP_S
      swaps.push(f3((a + b) / 2))
    }
  }
  const first = weapons[0] ?? 'katana'
  return { swaps, at: t => weapons[swaps.filter(s => s <= t).length % weapons.length] ?? first }
}

// Where a gun shot lands: far off, low for crawlers, high for wasps.
function rangedHit(h: Hit, w: number): { x: number; y: number } {
  return { x: Math.min(HERO_X + 250, w - 70), y: h.bug === 'wasp' ? -62 : 0 }
}

// The hand's place in the scene, where every gun pivots.
const HAND = { x: HERO_X + 34, y: GROUND - 34 }

/** Hero stops around a shot fired at `t`: aim, kick, settle. */
function shotStops(h: Hit, aim: number): { body: Stop[]; arm: Stop[] } {
  const t = h.t
  return {
    body: [[t - 0.3, at(0, 0)], [t, at(-4, 0)], [t + 0.1, at(-1, 0)], [t + 0.3, at(0, 0)]],
    arm: [[t - 0.32, rot(0)], [t - 0.16, rot(aim)], [t, rot(aim - 9)], [t + 0.12, rot(aim)], [t + 0.36, rot(0)]],
  }
}

function fightLayer(weapons: readonly WeaponKind[], w: number, ranged: boolean): { svg: string; css: string } {
  const L = `${LOOP_S}s`
  const loop = (cls: string) => `.${cls}{animation:${cls} ${L} linear infinite}`
  const off = 'opacity:0'
  let svg = `<rect class="haze" x="0" y="${GROUND - 60}" width="${w}" height="60" fill="url(#haze)"/>`
  let css = ''
  const plan = weaponSchedule(weapons)
  const hitFor = (h: Hit) => (ranged ? rangedHit(h, w) : HIT_AT[h.move])

  // The bugs: each walks in from the right, meets its strike, and is cut in two.
  SCRIPT.forEach((h, k) => {
    const hit = hitFor(h)
    const scale = h.bug === 'wasp' ? 1.2 : 1.3
    const startX = w + 50
    const speed = SPEED[h.bug]
    const travel = (startX - hit.x) / speed
    const xAt = (t: number) => hit.x + speed * (h.t - t)
    const start = h.t - travel
    const walk: Stop[] = []
    const show = (t: number, x: number) => `opacity:1;transform:translate(${f(x)}px,0)`
    const hide = (x: number) => `${off};transform:translate(${f(x)}px,0)`
    if (start >= 0) {
      walk.push([0, hide(startX)], [start - 0.001, hide(startX)], [start, show(start, startX)], [h.t, show(h.t, hit.x)], [h.t + 0.001, hide(hit.x)], [LOOP_S, hide(hit.x)])
    } else {
      // It set out in the previous loop: already on its way at 0.
      const back = start + LOOP_S
      walk.push([0, show(0, xAt(0))], [h.t, show(h.t, hit.x)], [h.t + 0.001, hide(hit.x)], [back - 0.001, hide(startX)], [back, show(back, startX)], [LOOP_S, show(LOOP_S, xAt(0))])
    }
    css += `.w${k}{animation:w${k} ${L} linear infinite}` + keyframes(`w${k}`, walk, hide(startX))
    const place = `translate(0 ${GROUND + hit.y}) scale(${scale})`
    svg += `<g class="w${k}"><g transform="${place}"><use href="#bug-${h.bug}"/></g></g>`

    // The cut: two halves fly apart where it fell.
    const cut = `translate(${hit.x} ${GROUND + hit.y}) scale(${scale})`
    svg += `<g transform="${cut}"><g class="ht t${k}"><use href="#bug-${h.bug}" clip-path="url(#cutTop)"/></g><g class="ht b${k}"><use href="#bug-${h.bug}" clip-path="url(#cutBot)"/></g></g>`
    css += `.t${k}{animation:t${k} ${L} linear infinite}` + keyframes(`t${k}`, [[h.t - 0.001, `${off};transform:translate(0,0)`], [h.t, 'opacity:1;transform:translate(0,0) rotate(0)'], [h.t + 0.4, `${off};transform:translate(14px,-20px) rotate(-32deg)`]], `${off};transform:translate(0,0)`)
    css += `.b${k}{animation:b${k} ${L} linear infinite}` + keyframes(`b${k}`, [[h.t - 0.001, `${off};transform:translate(0,0)`], [h.t, 'opacity:1;transform:translate(0,0) rotate(0)'], [h.t + 0.4, `${off};transform:translate(-8px,6px) rotate(16deg)`]], `${off};transform:translate(0,0)`)

    // A gun's shot: a trace from the muzzle to the bug, as the weapon in hand fires it.
    if (ranged) {
      const gun = plan.at(h.t)
      const raw = MUZZLE[gun] ?? { x: 20, y: -6 }
      const muzzle = { x: raw.x * GUN_SCALE, y: raw.y * GUN_SCALE }
      const tx = hit.x
      const ty = GROUND + hit.y - 14
      const aim = Math.atan2(ty - HAND.y, tx - HAND.x)
      const mx = HAND.x + Math.cos(aim) * muzzle.x
      const my = HAND.y + Math.sin(aim) * muzzle.x + muzzle.y
      const len = Math.hypot(tx - mx, ty - my)
      const kind = TRACER[gun] ?? 'single'
      const seg = (dy: number, cls: string, color: string, width: number, dash: string) =>
        `<line class="${cls}" x1="${f(mx)}" y1="${f(my + dy)}" x2="${f(tx)}" y2="${f(ty + dy)}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-dasharray="${dash}"/>`
      if (kind === 'beam') {
        svg += `<g class="sh s${k}">${seg(0, '', '#7CF7FF', 7, 'none').replace('stroke-width="7"', 'stroke-width="7" opacity=".35"')}${seg(0, '', '#E8FFFF', 2.4, 'none')}</g>`
        css += `.s${k}{animation:s${k} ${L} linear infinite}` + keyframes(`s${k}`, [[h.t - 0.06, off], [h.t - 0.04, 'opacity:1'], [h.t + 0.12, off]], off)
      } else {
        const burst = kind === 'burst'
        const dash = burst ? '9 11' : `14 ${f(len + 40)}`
        const lines = kind === 'double' ? seg(-4, '', '#FFE38A', 2, dash) + seg(5, '', '#FFE38A', 2, dash) : seg(0, '', burst ? '#FFB347' : '#FFE38A', 2.2, dash)
        svg += `<g class="sh s${k}">${lines}</g>`
        const flight = burst ? 0.16 : 0.08
        css += `.s${k}{animation:s${k} ${L} linear infinite}` + keyframes(`s${k}`, [[h.t - flight - 0.001, `${off};stroke-dashoffset:0`], [h.t - flight, 'opacity:1;stroke-dashoffset:0'], [h.t, `opacity:1;stroke-dashoffset:${f(-(burst ? 40 : len - 14))}`], [h.t + 0.01, `${off};stroke-dashoffset:${f(-(burst ? 40 : len - 14))}`]], `${off};stroke-dashoffset:0`)
      }
    }
  })

  // The hero's whole loop: strikes or shots, then the snack break.
  const meal = snack()
  const body: Stop[] = [...meal.body]
  const arm: Stop[] = [...meal.arm]
  for (const h of SCRIPT) {
    let s: { body: Stop[]; arm: Stop[] }
    if (ranged) {
      const hit = rangedHit(h, w)
      const aim = (Math.atan2(GROUND + hit.y - 14 - HAND.y, hit.x - HAND.x) * 180) / Math.PI
      s = shotStops(h, aim)
    } else {
      s = strikeStops(h)
    }
    body.push(...s.body)
    arm.push(...s.arm)
  }
  css += `.atk{animation:atk ${L} linear infinite;transform-origin:2px -34px}` + keyframes('atk', body, at(0, 0))
  css += loop('wpn') + keyframes('wpn', arm, rot(ranged ? 0 : 14))
  css += loop('fb') + loop('fh') + loop('lhand') + loop('ripple') + loop('topglow') + loop('chunk') + loop('chew') + loop('glow')
  css += `.chunk{transform-box:fill-box;transform-origin:center}`
  css += `.cr{animation-duration:${L};animation-iteration-count:infinite;animation-timing-function:linear}`
  css += meal.css

  // Impacts: one element per place a hit lands, lit at each of its hits.
  const flash = (t: number): Stop[] => [[t - 0.03, `${off};transform:scale(.4)`], [t, 'opacity:1;transform:scale(.5)'], [t + 0.16, `${off};transform:scale(1.35)`]]
  const blink = (t: number): Stop[] => [[t - 0.05, off], [t - 0.01, 'opacity:1'], [t + 0.13, off]]
  const places = ranged
    ? (['ground', 'air'] as const).map(p => ({ name: p, times: SCRIPT.filter(h => (p === 'air') === (h.bug === 'wasp')).map(h => h.t), hit: { x: Math.min(HERO_X + 250, w - 70), y: p === 'air' ? -62 : 0 } }))
    : (['slash', 'jump', 'spin', 'dash'] as const).map(m => ({ name: m, times: SCRIPT.filter(h => h.move === m).map(h => h.t), hit: HIT_AT[m] }))
  for (const p of places) {
    css += `.im-${p.name}{animation:im-${p.name} ${L} linear infinite}` + keyframes(`im-${p.name}`, p.times.flatMap(flash), `${off};transform:scale(.4)`)
    if (!ranged) css += `.tr-${p.name}{animation:tr-${p.name} ${L} linear infinite}` + keyframes(`tr-${p.name}`, p.times.flatMap(blink), off)
    let rays = ''
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.2
      const r0 = i % 2 ? 6 : 9
      const r1 = i % 2 ? 16 : 26
      rays += `<path d="M${f(Math.cos(a) * r0)} ${f(Math.sin(a) * r0)} L${f(Math.cos(a) * r1)} ${f(Math.sin(a) * r1)}" stroke="${i % 3 ? '#FFFFFF' : '#FFE08A'}" stroke-width="${i % 2 ? 1.6 : 2.4}" stroke-linecap="round"/>`
    }
    svg += `<g transform="translate(${p.hit.x} ${GROUND + p.hit.y - 14})"><g class="im-${p.name}"><circle r="9" fill="#FFFFFF"/>${rays}</g></g>`
  }
  if (!ranged) {
    // Sharp crescents for the cuts, a ring for the spin, streaks for the dash.
    const crescent = (x1: number, y1: number, x2: number, y2: number, r: number) =>
      `M${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} A ${r * 0.86} ${r * 0.86} 0 0 0 ${x1 + 8} ${y1 + 6} Z`
    svg += `<path class="tr-slash" d="${crescent(HERO_X + 30, GROUND - 104, HERO_X + 100, GROUND - 18, 66)}" fill="url(#blade)"/>
<path class="tr-jump" d="${crescent(HERO_X + 36, GROUND - 134, HERO_X + 108, GROUND - 50, 72)}" fill="url(#blade)"/>
<g class="tr-spin"><circle cx="${HERO_X + 6}" cy="${GROUND - 42}" r="74" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-dasharray="60 12 20 12" opacity=".9"/><circle cx="${HERO_X + 6}" cy="${GROUND - 42}" r="68" fill="none" stroke="#BFE9FF" stroke-width="1" opacity=".7"/></g>
<g class="tr-dash" stroke="#FFFFFF" stroke-linecap="round"><path d="M${HERO_X - 34} ${GROUND - 46} h58" stroke-width="2"/><path d="M${HERO_X - 46} ${GROUND - 32} h70" stroke-width="1.4"/><path d="M${HERO_X - 30} ${GROUND - 18} h50" stroke-width="2"/></g>`
  } else {
    // Muzzle flashes, each gun at its own shots: a burst flashes three times.
    for (const k of weapons) {
      const shots = SCRIPT.filter(h => plan.at(h.t) === k).map(h => h.t)
      const kind = TRACER[k] ?? 'single'
      const times = kind === 'burst' ? shots.flatMap(t => [t - 0.12, t - 0.06, t]) : kind === 'double' ? shots.flatMap(t => [t - 0.08, t]) : shots
      css += `.wk-${k} .mf{animation:mf-${k} ${L} linear infinite}` + keyframes(`mf-${k}`, times.flatMap(t => [[t - 0.005, off], [t, 'opacity:1'], [t + 0.045, off]] as Stop[]), off)
    }
  }

  // Every hit jolts the scene a little.
  const shake: Stop[] = []
  for (const h of SCRIPT) {
    shake.push([h.t - 0.001, 'transform:translate(0,0)'], [h.t, 'transform:translate(2.5px,-1.5px)'], [h.t + 0.04, 'transform:translate(-2px,1px)'], [h.t + 0.08, 'transform:translate(1px,0)'], [h.t + 0.12, 'transform:translate(0,0)'])
  }
  css += loop('world') + keyframes('world', shake, 'transform:translate(0,0)')

  // The weapon in hand follows the schedule; a single weapon just stays.
  if (weapons.length > 1) {
    weapons.forEach((k, wi) => {
      const stops: Stop[] = []
      let shown = wi === 0
      plan.swaps.forEach((t, si) => {
        const next = (si + 1) % weapons.length === wi
        if (next !== shown) {
          stops.push([t - 0.001, shown ? 'opacity:1' : off], [t, next ? 'opacity:1' : off])
          shown = next
        }
      })
      // Back to the first weapon as the loop starts over.
      stops.push([LOOP_S - 0.001, shown ? 'opacity:1' : off])
      css += `.wk-${k}{animation:wk-${k} ${L} linear infinite}` + keyframes(`wk-${k}`, [[0, wi === 0 ? 'opacity:1' : off], ...stops, [LOOP_S, wi === 0 ? 'opacity:1' : off]], off)
    })
  }

  css += `.haze{animation:haze 2.4s ease-in-out infinite}@keyframes haze{0%,100%{opacity:.6}50%{opacity:1}}
.ht{transform-origin:0 -12px}`
  // The city scrolls on the same loop and stands still while Claude eats.
  // Moving for LOOP_S - EAT_LEN seconds, the near row covers two tile widths
  // and the far row one, so the loop closes without a jump.
  const moving = LOOP_S - EAT_LEN
  const pause = (tiles: number): Stop[] => {
    const at = -(EAT_AT / moving) * tiles * w
    return [[EAT_AT, `transform:translateX(${f(at)}px)`], [EAT_AT + EAT_LEN, `transform:translateX(${f(at)}px)`], [LOOP_S, `transform:translateX(${-tiles * w}px)`]]
  }
  css += `.near{animation:near ${L} linear infinite}` + keyframes('near', [[0, 'transform:translateX(0)'], ...pause(2)], 'transform:translateX(0)')
  css += `.far{animation:far ${L} linear infinite}` + keyframes('far', [[0, 'transform:translateX(0)'], ...pause(1)], 'transform:translateX(0)')
  return { svg: svg + meal.svg, css }
}

// ---------------------------------------------------------------- the other scenes

function winLayer(w: number): { svg: string; css: string } {
  const rnd = seeded(3)
  let svg = ''
  let css = ''
  for (let i = 0; i < 46; i++) {
    const c = CONFETTI[i % CONFETTI.length] ?? '#F2C94C'
    const x = f(rnd() * w)
    const dur = f(1.6 + rnd() * 1.6)
    const spin = Math.round(180 + rnd() * 540)
    const drift = f((rnd() - 0.5) * 50)
    svg += `<rect class="cf k${i}" x="${x}" y="-8" width="${f(3 + rnd() * 3)}" height="${f(5 + rnd() * 4)}" rx="1" fill="${c}" style="animation-delay:-${f(rnd() * dur)}s;animation-duration:${dur}s;transform-origin:${x}px -4px"/>`
    css += `.k${i}{animation-name:k${i}}@keyframes k${i}{0%{transform:translate(0,0) rotate(0)}100%{transform:translate(${drift}px,${GROUND + 12}px) rotate(${spin}deg)}}`
  }
  svg += `<g class="burst"><circle cx="${HERO_X + 4}" cy="${GROUND - 40}" r="60" fill="url(#gold)"/></g>`
  css += `
.cf{animation-iteration-count:infinite;animation-timing-function:linear}
.atk{animation:jump .62s cubic-bezier(.3,0,.4,1) infinite}
@keyframes jump{0%,100%{transform:translateY(0)}45%{transform:translateY(-30px)}55%{transform:translateY(-30px)}}
.chew{animation:land .62s ease-out infinite}
@keyframes land{0%{transform:translateY(0) scale(1.06,.9)}15%,85%{transform:translateY(0) scale(1)}}
.wpn{animation:raise .62s ease-in-out infinite}
@keyframes raise{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(-2deg)}}
.burst{animation:pulse 1.24s ease-in-out infinite;transform-origin:${HERO_X + 4}px ${GROUND - 40}px}
@keyframes pulse{0%,100%{opacity:.35;transform:scale(.85)}50%{opacity:.8;transform:scale(1.1)}}
.leg{animation:none}`
  return { svg, css }
}

/**
 * The whole arena as one SVG document. Its markup depends only on the mode,
 * the weapons and the width: a fight drawn at the start of a turn plays on
 * untouched until the turn ends.
 */
export function arenaSvg(mode: SvgMode, w: number, weapons: readonly WeaponKind[], tier = 0): string {
  if (mode === 'sleep' || mode === 'wake' || mode === 'camp') return campSvg(mode, w, tier)
  const held = weapons.length > 0 ? weapons : (['katana'] as const)
  const shown = mode === 'fight' ? held : held.slice(0, 1)
  // A gun in hand makes it a gunfight: the weapons come all of one kind.
  const ranged = held.some(isRanged)
  const layer = mode === 'fight' ? fightLayer(shown, w, ranged) : winLayer(w)
  const baseCss = baseStyle(w)
  const extra = mode === 'fight' && held.length > 1 ? held.slice(1).map(k => `.wk-${k}{opacity:0}`).join('') : ''
  const heroX = mode === 'win' ? HERO_X + 4 : HERO_X
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${SVG_HEIGHT}" viewBox="0 0 ${w} ${SVG_HEIGHT}">
${defs()}
<style>${baseCss}${extra}${layer.css}</style>
<g class="world">
${backdrop(w)}
<g transform="translate(${heroX} ${GROUND})">${hero(shown, mode, tier)}</g>
${layer.svg}
</g>
</svg>`
}

/** The animation styles every scene shares. */
function baseStyle(w: number): string {
  return WEAPON_CSS + GEAR_CSS + `
.far{animation:scroll 46s linear infinite}
.near{animation:scroll 22s linear infinite}
@keyframes scroll{to{transform:translateX(-${w}px)}}
.dash{animation:dash .55s linear infinite}
@keyframes dash{to{stroke-dashoffset:36}}
.tw{animation:tw 4s ease-in-out infinite}
@keyframes tw{0%,100%{opacity:.55}50%{opacity:1}}
.bob{animation:bob .32s ease-in-out infinite}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.leg.la{animation:la .32s linear infinite}.leg.lb{animation:lb .32s linear infinite}
@keyframes la{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes lb{0%,100%{transform:translateY(-4px)}50%{transform:translateY(0)}}
.wpn{transform:rotate(14deg)}
.blink{animation:blink 4.2s infinite;transform-origin:0 -40px}
@keyframes blink{0%,94%,100%{transform:scaleY(1)}97%{transform:scaleY(.1)}}
.crawl{animation:crawl .3s ease-in-out infinite}
@keyframes crawl{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
.jaw{animation:jaw .26s ease-in-out infinite;transform-origin:-20px -5px}
.jaw2{animation:jaw2 .26s ease-in-out infinite;transform-origin:-20px -3px}
@keyframes jaw{0%,100%{transform:rotate(0)}50%{transform:rotate(18deg)}}
@keyframes jaw2{0%,100%{transform:rotate(0)}50%{transform:rotate(-18deg)}}
.sl1{animation:sl .22s ease-in-out infinite}.sl2{animation:sl .22s ease-in-out infinite reverse}
@keyframes sl{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}
.stride{animation:stride .36s ease-in-out infinite}
@keyframes stride{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
.ml1{animation:ml .36s ease-in-out infinite;transform-origin:2px -16px}.ml2{animation:ml .36s ease-in-out infinite reverse;transform-origin:4px -16px}
@keyframes ml{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(14deg)}}
.claw{animation:claw .5s ease-in-out infinite;transform-origin:-2px -36px}
.claw2{animation:claw .5s ease-in-out infinite reverse;transform-origin:-3px -25px}
@keyframes claw{0%,100%{transform:rotate(0)}50%{transform:rotate(-22deg)}}
.hover{animation:hover .5s ease-in-out infinite}
@keyframes hover{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.wing{animation:wing .06s linear infinite;transform-origin:4px -8px}
@keyframes wing{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.35)}}
.wk{opacity:1}`
}

// ---------------------------------------------------------------- the camp

// Between turns Claude rests by a campfire in the middle of the scene, a dog
// and a cat for company. A fresh session starts with everyone asleep in camp;
// the first prompt wakes Claude up before the fight.

function campBackdrop(w: number): string {
  const rnd = seeded(31)
  let stars = ''
  for (let i = 0; i < 34; i++) {
    stars += `<circle class="tw" style="animation-delay:-${f(rnd() * 4)}s" cx="${f(rnd() * w)}" cy="${f(4 + rnd() * 60)}" r="${f(0.5 + rnd() * 1.2)}" fill="#E6EEFF"/>`
  }
  const hill = `M0 ${GROUND - 26} Q ${f(w * 0.2)} ${GROUND - 52} ${f(w * 0.42)} ${GROUND - 30} T ${f(w * 0.8)} ${GROUND - 36} T ${w} ${GROUND - 28} L ${w} ${GROUND} L 0 ${GROUND} Z`
  let pines = ''
  const fireX = w / 2
  for (let i = 0; i < Math.round(w / 38); i++) {
    const x = rnd() * w
    if (Math.abs(x - fireX) < 190) continue
    const h = 26 + rnd() * 34
    const base = GROUND - 2
    const tone = rnd() < 0.5 ? '#0B1A16' : '#0E211B'
    pines += `<path d="M${f(x)} ${f(base - h)} L${f(x - h * 0.32)} ${f(base - h * 0.45)} L${f(x - h * 0.18)} ${f(base - h * 0.45)} L${f(x - h * 0.4)} ${base} L${f(x + h * 0.4)} ${base} L${f(x + h * 0.18)} ${f(base - h * 0.45)} L${f(x + h * 0.32)} ${f(base - h * 0.45)} Z" fill="${tone}"/>`
  }
  let grass = ''
  for (let i = 0; i < Math.round(w / 26); i++) {
    const x = rnd() * w
    grass += `<path d="M${f(x)} ${GROUND + 1} l-2 -6 M${f(x + 3)} ${GROUND + 1} l1 -8 M${f(x + 6)} ${GROUND + 1} l3 -5" stroke="#1E3A2C" stroke-width="1.4" stroke-linecap="round"/>`
  }
  return `<rect x="-10" y="-10" width="${w + 20}" height="${SVG_HEIGHT + 20}" fill="url(#night)"/>
${stars}
<circle cx="${w - 110}" cy="30" r="26" fill="url(#moonGlow)"/><circle cx="${w - 110}" cy="30" r="12" fill="#F4F1DE"/><circle cx="${w - 105}" cy="27" r="11" fill="#141A33" opacity=".18"/>
<path d="${hill}" fill="#101E2A"/>
${pines}
<rect x="-10" y="${GROUND}" width="${w + 20}" height="${SVG_HEIGHT - GROUND + 10}" fill="#0B1712"/>
${grass}`
}

function campfire(x: number, low: boolean): string {
  const rnd = seeded(17)
  let embers = ''
  const n = low ? 3 : 9
  for (let i = 0; i < n; i++) {
    const dx = f((rnd() - 0.5) * 30)
    const dur = f(1.6 + rnd() * 1.2)
    embers += `<circle class="ember e${i}" cx="${f(x + (rnd() - 0.5) * 12)}" cy="${GROUND - 14}" r="${f(0.9 + rnd() * 1.1)}" fill="${i % 2 ? '#FFB347' : '#FFE066'}" style="animation-duration:${dur}s;animation-delay:-${f(rnd() * dur)}s;--dx:${dx}px"/>`
  }
  const scale = low ? 0.5 : 1
  return `<ellipse class="glow" cx="${x}" cy="${GROUND - 20}" rx="${low ? 70 : 120}" ry="${low ? 40 : 70}" fill="url(#fireGlow)"/>
<ellipse cx="${x}" cy="${GROUND + 2}" rx="${low ? 40 : 70}" ry="6" fill="#FF8A3D" opacity="${low ? 0.12 : 0.22}"/>
<g transform="translate(${x} ${GROUND})">
  <rect x="-20" y="-7" width="40" height="7" rx="3.5" fill="#5A3A22" transform="rotate(14)"/>
  <rect x="-20" y="-7" width="40" height="7" rx="3.5" fill="#6B4528" transform="rotate(-14)"/>
  <g transform="scale(${scale})">
    <path class="fl f1" d="M-14 -4 C -18 -20 -6 -26 -4 -40 C 2 -30 10 -28 8 -16 C 14 -22 16 -12 14 -4 Z" fill="#FF6A1A"/>
    <path class="fl f2" d="M-9 -4 C -12 -16 -2 -20 0 -32 C 4 -24 10 -20 8 -4 Z" fill="#FF9F1C"/>
    <path class="fl f3" d="M-5 -4 C -6 -12 0 -14 1 -22 C 4 -16 6 -12 5 -4 Z" fill="#FFE066"/>
  </g>
  ${[-22, -12, 0, 12, 22].map((sx, i) => `<ellipse cx="${sx}" cy="-2" rx="5" ry="3.5" fill="${i % 2 ? '#4A4F5C' : '#5C6270'}"/>`).join('')}
</g>
${embers}`
}

function dog(x: number, asleep: boolean): string {
  const body = '#C68B59'
  const dark = '#8A5A34'
  const eye = asleep
    ? `<path d="M-19 -15 q2 1.5 4 0" stroke="#2A1A10" stroke-width="1.2" fill="none"/>`
    : `<circle cx="-18" cy="-15" r="1.4" fill="#2A1A10"/>`
  return `<g transform="translate(${x} ${GROUND})"><g class="${asleep ? 'snooze' : 'dogbody'}">
  <g class="${asleep ? '' : 'wag'}"><path d="M16 -10 C 24 -14 26 -22 22 -26" stroke="${dark}" stroke-width="4" fill="none" stroke-linecap="round"/></g>
  <ellipse cx="2" cy="-8" rx="18" ry="8" fill="${body}"/>
  <ellipse cx="6" cy="-10" rx="8" ry="4" fill="#D9A273" opacity=".7"/>
  <ellipse cx="-12" cy="-2" rx="5" ry="2.6" fill="${dark}"/><ellipse cx="-4" cy="-2" rx="5" ry="2.6" fill="${dark}"/>
  <circle cx="-15" cy="-14" r="8" fill="${body}"/>
  <ellipse cx="-22" cy="-11" rx="5" ry="3.6" fill="#D9A273"/>
  <circle cx="-26" cy="-12" r="1.6" fill="#2A1A10"/>
  <path d="M-12 -21 C -6 -20 -4 -12 -8 -8 C -10 -12 -12 -16 -12 -21 Z" fill="${dark}"/>
  ${eye}
</g></g>`
}

function cat(x: number, asleep: boolean): string {
  const fur = '#7A7A88'
  const dark = '#4E4E5C'
  if (asleep) {
    return `<g transform="translate(${x} ${GROUND})"><g class="snooze">
  <ellipse cx="0" cy="-7" rx="13" ry="7" fill="${fur}"/>
  <path d="M12 -4 C 16 -10 8 -14 -2 -12" stroke="${dark}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
  <circle cx="-9" cy="-9" r="5.5" fill="${fur}"/>
  <path d="M-13 -13 l1 -5 l3 3 Z M-8 -14 l2 -4 l2 4 Z" fill="${dark}"/>
  <path d="M-12 -9 q1.5 1 3 0" stroke="#22222A" stroke-width="1" fill="none"/>
</g></g>`
  }
  return `<g transform="translate(${x} ${GROUND})">
  <g class="swish"><path d="M7 -3 C 18 -2 20 -14 14 -20" stroke="${dark}" stroke-width="3.4" fill="none" stroke-linecap="round"/></g>
  <ellipse cx="0" cy="-12" rx="9" ry="12" fill="${fur}"/>
  <ellipse cx="-1" cy="-9" rx="5" ry="7" fill="#9A9AA8" opacity=".6"/>
  <circle cx="-2" cy="-27" r="7" fill="${fur}"/>
  <path d="M-8 -30 l0 -8 l5 4 Z M2 -32 l3 -7 l2 7 Z" fill="${dark}"/>
  <g class="blink2"><ellipse cx="-5" cy="-28" rx="1.4" ry="1.8" fill="#C8E66A"/><ellipse cx="1" cy="-28" rx="1.4" ry="1.8" fill="#C8E66A"/></g>
  <path d="M-3 -24 l1 1 l1 -1" stroke="#F5B5C0" stroke-width="1" fill="none"/>
</g>`
}

// A katana stuck point-down in the ground, hilt up.
function planted(x: number): string {
  return `<g transform="translate(${x} ${GROUND - 62}) rotate(172)">${weapon('katana')}</g>`
}

function bedroll(x: number): string {
  return `<g transform="translate(${x} ${GROUND})">
  <ellipse cx="-44" cy="-7" rx="12" ry="6" fill="#D8D2C2"/>
  <g class="breath"><rect x="-38" y="-17" width="92" height="17" rx="8.5" fill="#2F5D8C"/>
  <path d="M-30 -8.5 H48" stroke="#4A7BB0" stroke-width="2" stroke-dasharray="6 5"/></g>
</g>`
}

function sleepHead(x: number): string {
  return `<g transform="translate(${x - 44} ${GROUND - 13})">
  <rect x="-13" y="-16" width="26" height="18" rx="2" fill="url(#front)"/>
  <path d="M-8 -9 h5 M3 -9 h5" stroke="#1B1210" stroke-width="1.6" stroke-linecap="round"/>
</g>`
}

function zzz(x: number, y: number): string {
  let out = ''
  for (let i = 0; i < 3; i++) {
    out += `<text class="z" style="animation-delay:${f(i * 1.1)}s" x="${x}" y="${y}" font-family="system-ui,sans-serif" font-weight="700" font-size="${11 + i * 2}" fill="#9FC3EA">z</text>`
  }
  return out
}

function campCss(): string {
  return `
.fl{transform-box:fill-box;transform-origin:50% 100%}
.f1{animation:fl1 .9s ease-in-out infinite}.f2{animation:fl2 .7s ease-in-out infinite}.f3{animation:fl3 .5s ease-in-out infinite}
@keyframes fl1{0%,100%{transform:scale(1,1) skewX(0)}30%{transform:scale(1.06,.9) skewX(4deg)}65%{transform:scale(.95,1.12) skewX(-5deg)}}
@keyframes fl2{0%,100%{transform:scale(1,1) skewX(0)}40%{transform:scale(.92,1.15) skewX(-6deg)}70%{transform:scale(1.05,.92) skewX(4deg)}}
@keyframes fl3{0%,100%{transform:scale(1,1)}50%{transform:scale(.88,1.2)}}
.glow{animation:fglow 1.4s ease-in-out infinite}
@keyframes fglow{0%,100%{opacity:.75}45%{opacity:1}70%{opacity:.85}}
.ember{animation-name:ember;animation-timing-function:ease-out;animation-iteration-count:infinite}
@keyframes ember{0%{opacity:0;transform:translate(0,0)}15%{opacity:1}100%{opacity:0;transform:translate(var(--dx),-64px)}}
.wag{animation:wag .45s ease-in-out infinite;transform-origin:16px -10px}
@keyframes wag{0%,100%{transform:rotate(-12deg)}50%{transform:rotate(18deg)}}
.swish{animation:swish 2.6s ease-in-out infinite;transform-origin:7px -3px}
@keyframes swish{0%,100%{transform:rotate(0)}50%{transform:rotate(-16deg)}}
.blink2{animation:blink 5s infinite;transform-box:fill-box;transform-origin:center}
.snooze{animation:snooze 3.2s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}
@keyframes snooze{0%,100%{transform:scale(1,1)}50%{transform:scale(1.03,1.08)}}
.breath{animation:snooze 3.4s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}
.mm{animation:toast 6s ease-in-out infinite}
@keyframes toast{0%,100%{fill:#FFF8EC}50%{fill:#E8B98A}}
.z{opacity:0;animation:z 3.3s ease-out infinite}
@keyframes z{0%{opacity:0;transform:translate(0,0)}15%{opacity:.9}100%{opacity:0;transform:translate(22px,-34px)}}
.wpn{display:none}
.bob{animation:breathe 3s ease-in-out infinite}
@keyframes breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.02,.97)}}`
}

/** Camp: asleep at the start of a session, resting between turns, or waking. */
function campSvg(mode: 'sleep' | 'camp' | 'wake', w: number, tier: number): string {
  const fireX = Math.round(w / 2)
  const heroX = fireX - 96
  const low = mode === 'sleep'
  let scene = campBackdrop(w) + campfire(fireX, low)
  let css = campCss()
  if (mode === 'camp') {
    // On a log by the fire, toasting a marshmallow; the katana stands by.
    scene += planted(heroX - 52)
    scene += `<rect x="${heroX - 34}" y="${GROUND - 11}" width="74" height="11" rx="5.5" fill="#5A3A22"/><path d="M${heroX - 28} ${GROUND - 6} h60" stroke="#3E2715" stroke-width="1.2"/>`
    scene += `<g transform="translate(${heroX} ${GROUND - 9})">${hero(['katana'], 'camp', tier)}</g>`
    scene += `<g transform="translate(${heroX} ${GROUND - 9})"><path d="M36 -32 L84 -22" stroke="#7A4A2A" stroke-width="2" stroke-linecap="round"/><rect class="mm" x="80" y="-27" width="9" height="8" rx="3" fill="#FFF8EC"/></g>`
    scene += dog(fireX + 66, false) + cat(fireX + 122, false)
  } else if (mode === 'sleep') {
    scene += planted(heroX - 70) + bedroll(heroX) + sleepHead(heroX) + zzz(heroX - 40, GROUND - 34)
    scene += dog(fireX + 66, true) + cat(fireX + 116, true) + zzz(fireX + 60, GROUND - 24)
  } else {
    // Out of the bag, a stretch, a startled "!", and up with the katana.
    scene += bedroll(heroX)
    scene += `<g class="rise" style="transform-origin:${heroX}px ${GROUND}px"><g transform="translate(${heroX} ${GROUND})">${hero(['katana'], 'wake', tier)}</g></g>`
    scene += `<text class="bang" x="${heroX + 2}" y="${GROUND - 74}" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="22" fill="#FFD25A">!</text>`
    scene += `<g class="gone">${planted(heroX - 70)}</g>`
    scene += `<g class="hop">${dog(fireX + 66, false)}</g>` + cat(fireX + 122, false)
    css += `
.rise{animation:rise 2.2s cubic-bezier(.3,0,.3,1) forwards}
@keyframes rise{0%{transform:translateY(22px) scale(1,.35);opacity:.2}30%{transform:translateY(0) scale(1,1);opacity:1}45%{transform:scale(1.06,1.1)}60%,100%{transform:scale(1,1)}}
.bang{opacity:0;animation:bang 2.2s ease-out forwards;transform-box:fill-box;transform-origin:50% 100%}
@keyframes bang{0%,25%{opacity:0;transform:scale(.3)}35%{opacity:1;transform:scale(1.3)}45%,75%{opacity:1;transform:scale(1)}90%,100%{opacity:0}}
.gone{animation:gone 2.2s ease-in forwards}
@keyframes gone{0%,55%{opacity:1}75%,100%{opacity:0}}
.wpn{display:inline;opacity:0;animation:grab 2.2s ease-out forwards}
@keyframes grab{0%,60%{opacity:0;transform:rotate(14deg)}80%,100%{opacity:1;transform:rotate(14deg)}}
.hop{animation:hop .5s ease-out 3}
@keyframes hop{0%,100%{transform:translateY(0)}40%{transform:translateY(-8px)}}`
  }
  const extraDefs = `<defs>
  <linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070B1C"/><stop offset=".7" stop-color="#121A38"/><stop offset="1" stop-color="#1B2244"/></linearGradient>
  <radialGradient id="fireGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FF9A3C" stop-opacity=".55"/><stop offset=".6" stop-color="#FF7A2A" stop-opacity=".15"/><stop offset="1" stop-color="#FF7A2A" stop-opacity="0"/></radialGradient>
  <radialGradient id="moonGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#F4F1DE" stop-opacity=".35"/><stop offset="1" stop-color="#F4F1DE" stop-opacity="0"/></radialGradient>
</defs>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${SVG_HEIGHT}" viewBox="0 0 ${w} ${SVG_HEIGHT}">
${defs()}${extraDefs}
<style>${baseStyle(w)}${css}</style>
${scene}
</svg>`
}
