// The winter look: a snowy pine forest instead of the city, falling snow,
// a Santa hat on Claude and, over the camp, Santa's reindeer sleigh.

import { GROUND, SVG_HEIGHT, f, seeded } from './geometry'

export type Theme = 'winter' | 'classic'

/** Winter from November through February, by the computer's own month. */
export function themeFor(option: unknown, now: Date): Theme {
  if (option === 'winter' || option === 'classic') return option
  const m = now.getMonth()
  return m >= 10 || m <= 1 ? 'winter' : 'classic'
}



/** A snow-capped pine 100 high, its foot at the origin, in the given colours. */
function pineShape(body: string, snow: string): string {
  const tier = (top: number, bottom: number, half: number) =>
    `<path d="M0 ${-top} L${-half} ${-bottom} L${half} ${-bottom} Z" fill="${body}"/>` +
    `<path d="M0 ${-top} L${f(-half * 0.42)} ${f(-top + (top - bottom) * 0.42)} Q0 ${f(-top + (top - bottom) * 0.3)} ${f(half * 0.42)} ${f(-top + (top - bottom) * 0.42)} Z" fill="${snow}"/>`
  return `<rect x="-4" y="-14" width="8" height="14" fill="#2A1C14"/>` + tier(100, 50, 26) + tier(72, 28, 34.4) + tier(46, 10, 42)
}

/** One pine of a kind, `h` high, its foot at (x, base). */
const pine = (x: number, base: number, h: number, kind: string) =>
  `<use href="#${kind}" transform="translate(${f(x)} ${base}) scale(${f(h / 100)})"/>`

/** A row of pines `w` wide; trees near the edges repeat across the seam. */
function forest(w: number, seed: number, step: number, minH: number, maxH: number, kind: string): string {
  const rnd = seeded(seed)
  let out = ''
  for (let x = step / 2; x < w; x += step * (0.7 + rnd() * 0.6)) {
    const h = minH + rnd() * (maxH - minH)
    const tree = (dx: number) => pine(x + dx, GROUND + 1, h, kind)
    out += tree(0)
    // A tree hanging over either edge is drawn on the other side too, so the
    // tiles meet without a cut.
    if (x + h * 0.42 > w) out += tree(-w)
    if (x - h * 0.42 < 0) out += tree(w)
  }
  return out
}

function snowfall(w: number, n: number, seed: number): string {
  const rnd = seeded(seed)
  let out = ''
  for (let i = 0; i < n; i++) {
    const dur = f(5 + rnd() * 6)
    const r = f(0.7 + rnd() * 1.5)
    out += `<circle class="flake" cx="${f(rnd() * w)}" cy="-6" r="${r}" fill="#FFFFFF" opacity="${f(0.55 + rnd() * 0.4)}" style="animation-duration:${dur}s;animation-delay:-${f(rnd() * dur)}s;--sx:${f((rnd() - 0.5) * 40)}px"/>`
  }
  return out
}

function snowGround(w: number, seed: number): string {
  const rnd = seeded(seed)
  let drifts = ''
  for (let i = 0; i < Math.round(w / 60); i++) {
    const x = rnd() * w
    drifts += `<ellipse cx="${f(x)}" cy="${GROUND + 1}" rx="${f(14 + rnd() * 22)}" ry="${f(2 + rnd() * 2)}" fill="#F6FAFF"/>`
  }
  return `<rect x="-10" y="${GROUND}" width="${w + 20}" height="${SVG_HEIGHT - GROUND + 10}" fill="url(#snowGround)"/>${drifts}`
}

function moonAndStars(w: number, seed: number, moonX: number): string {
  const rnd = seeded(seed)
  let stars = ''
  for (let i = 0; i < Math.round(w / 34); i++) {
    stars += `<circle class="tw" style="animation-delay:-${f(rnd() * 4)}s" cx="${f(rnd() * w)}" cy="${f(4 + rnd() * 50)}" r="${f(0.5 + rnd() * 1)}" fill="#E6EEFF"/>`
  }
  return `<rect x="-10" y="-10" width="${w + 20}" height="${SVG_HEIGHT + 20}" fill="url(#winterSky)"/>
${stars}
<circle cx="${moonX}" cy="28" r="28" fill="url(#winterMoon)"/><circle cx="${moonX}" cy="28" r="12" fill="#F4F6FF"/><circle cx="${moonX + 5}" cy="25" r="11" fill="#1C3260" opacity=".16"/>`
}

/** The fight's backdrop: rows of snowy pines that scroll like the city did. */
export function winterBackdrop(w: number): string {
  const far = forest(w, 41, 34, 34, 58, 'pineFar')
  const near = forest(w, 53, 62, 46, 78, 'pineNear')
  return `${moonAndStars(w, 37, Math.round(w * 0.78))}
<path d="M0 ${GROUND - 30} Q ${f(w * 0.25)} ${GROUND - 58} ${f(w * 0.5)} ${GROUND - 34} T ${w} ${GROUND - 36} L ${w} ${GROUND} L 0 ${GROUND} Z" fill="#3A5682" opacity=".7"/>
<g class="far"><g id="tile-far">${far}</g><use href="#tile-far" x="${w}"/><use href="#tile-far" x="${2 * w}"/></g>
<g class="near"><g id="tile-near">${near}</g><use href="#tile-near" x="${w}"/><use href="#tile-near" x="${2 * w}"/></g>
${snowGround(w, 59)}
<line x1="0" y1="${GROUND + 0.5}" x2="${w}" y2="${GROUND + 0.5}" stroke="#FFFFFF" stroke-width="1"/>
<line class="dash" x1="0" y1="${GROUND + 8}" x2="${w}" y2="${GROUND + 8}" stroke="#A9BEDF" stroke-width="2" stroke-dasharray="14 22"/>
${snowfall(w, Math.round(w / 14), 61)}`
}

/** The camp's backdrop: a still snowy clearing with the fire in the middle. */
export function winterCampBackdrop(w: number): string {
  const fireX = w / 2
  const rnd = seeded(71)
  let pines = ''
  for (let i = 0; i < Math.round(w / 34); i++) {
    const x = rnd() * w
    if (Math.abs(x - fireX) < 200) continue
    const h = 34 + rnd() * 40
    pines += pine(x, GROUND + 1, h, rnd() < 0.5 ? 'pineNear' : 'pineCamp')
  }
  return `${moonAndStars(w, 67, w - 110)}
<path d="M0 ${GROUND - 26} Q ${f(w * 0.2)} ${GROUND - 52} ${f(w * 0.42)} ${GROUND - 30} T ${f(w * 0.8)} ${GROUND - 36} T ${w} ${GROUND - 28} L ${w} ${GROUND} L 0 ${GROUND} Z" fill="#2E4874"/>
${pines}
${snowGround(w, 73)}`
}

/** The snow on top of everything else in the camp. */
export function campSnow(w: number): string {
  return snowfall(w, Math.round(w / 18), 79)
}

/** A Santa hat on Claude's head, the tip falling back behind. Hero coordinates. */
export const SANTA_HAT = `<g class="santa">
<path d="M-24 -60 L35 -60 C 33 -76 22 -90 4 -92 C -10 -93 -24 -88 -34 -76 C -26 -79 -18 -78 -12 -72 Z" fill="#D42A2A"/>
<path d="M10 -60 L35 -60 C 33 -74 24 -86 10 -90 C 18 -80 16 -70 10 -60 Z" fill="#A81E22"/>
<rect x="-31" y="-64" width="68" height="9" rx="4.5" fill="#F7F4EE"/>
<path d="M-26 -60 h58" stroke="#D9D3C6" stroke-width="1.2" stroke-dasharray="3 4"/>
<g class="pom"><circle cx="-36" cy="-76" r="5.5" fill="#FFFFFF"/><circle cx="-37.5" cy="-77.5" r="2" fill="#E8E4DA"/></g>
</g>`

/** A small hat for the head peeking out of the bedroll. */
export const SLEEP_HAT = `<path d="M-12 -17 L13 -17 C 11 -26 2 -31 -6 -30 C -12 -29 -17 -26 -20 -21 C -16 -22 -12 -21 -10 -18 Z" fill="#D42A2A"/>
<rect x="-14" y="-19.5" width="28" height="5" rx="2.5" fill="#F7F4EE"/>
<circle cx="-21" cy="-21" r="3" fill="#FFFFFF"/>`

function reindeer(x: number, lead: boolean): string {
  const fur = '#8A5A34'
  const dark = '#5E3B20'
  return `<g transform="translate(${x} 0)">
<g class="gallop"><path d="M-10 4 l-4 9 M-5 5 l-2 9" stroke="${dark}" stroke-width="2" stroke-linecap="round"/></g>
<g class="gallop2"><path d="M7 4 l5 8 M11 3 l6 7" stroke="${dark}" stroke-width="2" stroke-linecap="round"/></g>
<ellipse cx="0" cy="0" rx="13" ry="6" fill="${fur}"/>
<ellipse cx="-11" cy="-1" rx="3" ry="2.2" fill="#EBDCC8"/>
<path d="M9 -2 L15 -10" stroke="${fur}" stroke-width="5" stroke-linecap="round"/>
<ellipse cx="18" cy="-12" rx="5.5" ry="3.6" fill="${fur}"/>
<circle cx="17" cy="-13.5" r=".9" fill="#1B1210"/>
<path d="M15 -15 l-2 -7 l-3 -2 M13 -21 l3 -3 M17 -15 l1 -7 l3 -3 M18 -20 l-2 -3" stroke="#D9C49A" stroke-width="1.3" stroke-linecap="round" fill="none"/>
${lead ? `<circle class="nose" cx="23.5" cy="-11.5" r="7" fill="url(#noseGlow)"/><circle cx="23.5" cy="-11.5" r="2.2" fill="#FF2A2A"/>` : `<circle cx="23.5" cy="-11.5" r="1.6" fill="#2A1A10"/>`}
</g>`
}

/** Santa, his sleigh and three reindeer, crossing the sky over the camp. */
export function sleigh(w: number): string {
  // Drawn facing right around (0, 0); the .fly group carries it across.
  const deer = [36, 74, 112].map((x, i) => reindeer(x, i === 2)).join('')
  const reins = `<path d="M18 -10 Q 50 -2 110 -6" stroke="#C9A24A" stroke-width="1" fill="none"/>`
  let sparkles = ''
  for (let i = 0; i < 6; i++) {
    sparkles += `<circle class="spark" cx="${-18 - i * 9}" cy="${4 + (i % 2) * 4}" r="${f(1.6 - i * 0.18)}" fill="#FFE38A" style="animation-delay:-${f(i * 0.15)}s"/>`
  }
  const santa = `<g transform="translate(4 -6)">
<rect x="-6" y="-16" width="14" height="14" rx="4" fill="#D42A2A"/>
<circle cx="4" cy="-20" r="5" fill="#F2C6A0"/>
<path d="M-1 -19 Q 4 -10 9 -19 Z" fill="#FFFFFF"/>
<path d="M-1 -23 L9 -23 C 7 -29 2 -31 -2 -29 C -5 -28 -7 -25 -8 -22 Z" fill="#D42A2A"/>
<rect x="-2" y="-24.5" width="12" height="3" rx="1.5" fill="#FFFFFF"/><circle cx="-8.5" cy="-22" r="2" fill="#FFFFFF"/>
<path d="M7 -10 L18 -10" stroke="#D42A2A" stroke-width="3" stroke-linecap="round"/>
</g>`
  const body = `<path d="M-16 -10 L16 -10 C 20 -10 22 -6 20 -2 L18 2 L-14 2 C -20 2 -22 -4 -20 -12 Z" fill="#B3262E"/>
<path d="M-16 -10 L16 -10" stroke="#F2C94C" stroke-width="1.6"/>
<rect x="-18" y="-18" width="12" height="9" rx="3" fill="#6B3E22"/><path d="M-15 -18 v-3 M-9 -18 v-3" stroke="#3FA76A" stroke-width="2"/>
<path d="M-20 7 L18 7 C 24 7 26 3 24 0" stroke="#F2C94C" stroke-width="1.8" fill="none" stroke-linecap="round"/>
<path d="M-12 2 v5 M10 2 v5" stroke="#F2C94C" stroke-width="1.4"/>`
  return `<g class="fly" style="--w:${w + 380}px"><g class="bounce">${sparkles}${reins}${santa}${body}${deer}</g></g>`
}

export const WINTER_CSS = `
.flake{animation-name:flake;animation-timing-function:linear;animation-iteration-count:infinite}
@keyframes flake{0%{transform:translate(0,0)}100%{transform:translate(var(--sx),${SVG_HEIGHT + 12}px)}}
.santa .pom{animation:pom .64s ease-in-out infinite;transform-origin:-30px -78px}
@keyframes pom{0%,100%{transform:rotate(0)}50%{transform:rotate(-10deg)}}
.fly{animation:fly 16s linear infinite;transform:translate(-200px,52px)}
@keyframes fly{0%{transform:translate(-200px,56px) scale(1.15)}50%{transform:translate(calc(var(--w) / 2 - 200px),40px) scale(1.15)}100%{transform:translate(calc(var(--w) - 200px),50px) scale(1.15)}}
.bounce{animation:hover 1.2s ease-in-out infinite}
.gallop{animation:gal .4s ease-in-out infinite;transform-origin:-7px 4px}
.gallop2{animation:gal .4s ease-in-out infinite reverse;transform-origin:9px 4px}
@keyframes gal{0%,100%{transform:rotate(-20deg)}50%{transform:rotate(25deg)}}
.nose{animation:tw 1s ease-in-out infinite}
.spark{animation:spark .9s ease-out infinite}
@keyframes spark{0%{opacity:1;transform:translate(0,0)}100%{opacity:0;transform:translate(-14px,8px)}}`

export const WINTER_DEFS = `<defs>
  <symbol id="pineFar" overflow="visible">${pineShape('#2C4772', '#C9D8F0')}</symbol>
  <symbol id="pineNear" overflow="visible">${pineShape('#16304F', '#EEF4FF')}</symbol>
  <symbol id="pineCamp" overflow="visible">${pineShape('#1B3A5C', '#EEF4FF')}</symbol>
  <linearGradient id="winterSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0A1430"/><stop offset=".6" stop-color="#1C3260"/><stop offset="1" stop-color="#3B5C8C"/></linearGradient>
  <linearGradient id="snowGround" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EAF2FF"/><stop offset="1" stop-color="#B7C9E6"/></linearGradient>
  <radialGradient id="winterMoon" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#EAF4FF" stop-opacity=".45"/><stop offset="1" stop-color="#EAF4FF" stop-opacity="0"/></radialGradient>
  <radialGradient id="noseGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FF3B3B" stop-opacity=".9"/><stop offset="1" stop-color="#FF3B3B" stop-opacity="0"/></radialGradient>
</defs>`
