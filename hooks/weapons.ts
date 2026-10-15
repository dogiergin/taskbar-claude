// The armoury's drawings and the hero's late-game gear.
//
// One set of rules for every weapon, so they read as a set: drawn pointing up
// from the hand at the origin; one light from the upper left, so each blade
// is split along its ridge into a lit half and a shaded half; the brightest
// line on the cutting edge; the guard in its own hue; one thin dark outline.

import type { WeaponKind } from '../types'

const INK = '#1E2230'
const LIT = '#F4F8FF'
const SHADE = '#A3B0C4'
const RIDGE = '#7D8AA0'
const WOOD = '#7A4A2A'
const WOOD_DARK = '#4F2F18'
const GOLD = '#E2B651'

const line = (d: string, color: string, width: number, extra = '') =>
  `<path d="${d}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round"${extra}/>`
const fill = (d: string, color: string, outline = true) =>
  `<path d="${d}" fill="${color}"${outline ? ` stroke="${INK}" stroke-width=".7" stroke-linejoin="round"` : ''}/>`

/** Gradients the weapons and gear use; part of the scene's <defs>. */
export const WEAPON_DEFS = `
  <linearGradient id="goldMetal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE9A8"/><stop offset=".5" stop-color="#E2B651"/><stop offset="1" stop-color="#9C6D16"/></linearGradient>
  <linearGradient id="woodGrain" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9A6638"/><stop offset=".5" stop-color="#7A4A2A"/><stop offset="1" stop-color="#5A341B"/></linearGradient>
  <linearGradient id="dragonFire" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFE38A"/><stop offset=".45" stop-color="#FF7A1F"/><stop offset="1" stop-color="#B3121F"/></linearGradient>
  <linearGradient id="frostIce" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#E8FBFF"/><stop offset=".5" stop-color="#8EDBFF"/><stop offset="1" stop-color="#2F7FBF"/></linearGradient>
  <linearGradient id="helmMetal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9EEF5"/><stop offset=".5" stop-color="#A9B4C6"/><stop offset="1" stop-color="#6E7A90"/></linearGradient>
  <filter id="legendGlow" x="-100%" y="-50%" width="300%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`

/** A wooden haft from the hand up to `top`, with a little grain. */
function haft(top: number, width = 3.8): string {
  const h = -top + 5
  return `<rect x="${-width / 2}" y="${top}" width="${width}" height="${h}" rx="1.5" fill="url(#woodGrain)" stroke="${INK}" stroke-width=".6"/>
${line(`M-0.6 ${top + 8} v${Math.max(6, h * 0.25)} M0.7 ${top + h * 0.45} v${Math.max(6, h * 0.2)}`, WOOD_DARK, 0.6)}`
}

/** A wrapped grip from the hand down: leather turns over a dark core. */
function grip(len: number, color = '#3A2618'): string {
  let wraps = ''
  for (let y = -len + 2; y < 1; y += 3) wraps += `M-2.2 ${y} L2.2 ${y + 1.6} `
  return `<rect x="-2.3" y="${-len}" width="4.6" height="${len + 2}" rx="1.4" fill="${color}" stroke="${INK}" stroke-width=".6"/>${line(wraps, '#8C6A4A', 0.8)}`
}

function katana(): string {
  // Tsuka wrapped in a diamond pattern, gold collar, a dark round tsuba,
  // a curved two-tone blade with a wavy hamon on its edge.
  const ito = 'M-2.4 -14 L2.4 -11 L-2.4 -8 L2.4 -5 L-2.4 -2 L2.4 1 M2.4 -14 L-2.4 -11 L2.4 -8 L-2.4 -5 L2.4 -2 L-2.4 1'
  return `<rect x="-2.7" y="1" width="5.4" height="3.2" rx="1" fill="#2B2A33"/>
<rect x="-2.4" y="-16" width="4.8" height="18" rx="1.3" fill="#1F1C2E" stroke="${INK}" stroke-width=".6"/>
${line(ito, '#CFC7EE', 0.85)}
<rect x="-2.8" y="-17.6" width="5.6" height="2" fill="${GOLD}"/>
<ellipse cx="0" cy="-19.2" rx="6.8" ry="2.3" fill="#3A3328" stroke="#C9A14A" stroke-width=".9"/>
<rect x="-2" y="-23" width="4" height="3" fill="${GOLD}"/>
${fill('M-2.2 -22 C -2.2 -46 0 -64 7.5 -82 L 3.4 -61 C 1.3 -47 0.4 -36 0.4 -22 Z', LIT, false)}
${fill('M0.4 -22 C 0.4 -36 1.3 -47 3.4 -61 L 7.5 -82 C 4.8 -65 2.7 -47 2.7 -22 Z', SHADE, false)}
${fill('M-2.2 -22 C -2.2 -46 0 -64 7.5 -82 C 4.8 -65 2.7 -47 2.7 -22 Z', 'none')}
${line('M-1.3 -24 q1 -3 0 -6 q-1 -3 0 -6 q1 -3 .2 -6 q-.8 -3 .4 -6 q1 -3 .6 -6 q-.4 -3 1 -6 q1 -3 1.4 -5 q.6 -3 2 -5', '#FFFFFF', 0.85, ' opacity=".9"')}`
}

function longsword(): string {
  return `${grip(14)}
<circle cx="0" cy="3.4" r="3.2" fill="url(#goldMetal)" stroke="${INK}" stroke-width=".6"/><circle cx="0" cy="3.4" r="1.2" fill="#C2263A"/>
${fill('M-12 -15 Q -6 -19 0 -17.5 Q 6 -19 12 -15 L 12 -12.6 Q 6 -15.6 0 -14.4 Q -6 -15.6 -12 -12.6 Z', 'url(#goldMetal)')}
<rect x="-2.6" y="-21" width="5.2" height="5" fill="${SHADE}" stroke="${INK}" stroke-width=".6"/>
${fill('M-3.8 -21 L-3.8 -64 L0 -74 L0 -21 Z', LIT, false)}
${fill('M0 -21 L0 -74 L3.8 -64 L3.8 -21 Z', SHADE, false)}
${fill('M-3.8 -21 L-3.8 -64 L0 -74 L3.8 -64 L3.8 -21 Z', 'none')}
${line('M0 -23 V-58', RIDGE, 1.3)}
${line('M-3.4 -22 V-63', '#FFFFFF', 0.8)}`
}

function scimitar(): string {
  // Broad blade that widens toward a curved tip, sweeping forward.
  return `${grip(13, '#2C1B12')}
${fill('M-2.6 1 Q -5 4 -1 5.6 Q 3 5 2.4 1 Z', 'url(#goldMetal)')}
${fill('M-9 -14 L9 -14 L9 -11.4 L-9 -11.4 Z', 'url(#goldMetal)')}<circle cx="-9.5" cy="-12.7" r="1.8" fill="${GOLD}"/><circle cx="9.5" cy="-12.7" r="1.8" fill="${GOLD}"/>
${fill('M-2.6 -14 C -3.6 -36 0 -56 12 -72 C 17 -64 16 -54 10 -46 C 5 -38 2.6 -26 2.6 -14 Z', LIT, false)}
${fill('M0.4 -14 C 0.6 -30 3 -44 8 -52 C 12 -58 14 -64 12 -72 C 17 -64 16 -54 10 -46 C 5 -38 2.6 -26 2.6 -14 Z', SHADE, false)}
${fill('M-2.6 -14 C -3.6 -36 0 -56 12 -72 C 17 -64 16 -54 10 -46 C 5 -38 2.6 -26 2.6 -14 Z', 'none')}
${line('M-2 -16 C -3 -36 0 -55 11 -70', '#FFFFFF', 0.8)}`
}

function battleAxe(): string {
  const right = 'M2 -66 C 15 -73 25 -62 22 -46 C 15 -51 8 -51 2 -49 Z'
  const left = 'M-2 -64 C -11 -68 -18 -60 -16 -50 C -11 -53 -6 -53 -2 -52 Z'
  return `${haft(-70)}
${fill(right, LIT)}${fill('M2 -58 C 9 -58 16 -55 22 -46 C 15 -51 8 -51 2 -49 Z', SHADE, false)}${line('M20 -61 C 24 -56 24 -50 22 -46', '#FFFFFF', 0.9)}
${fill(left, LIT)}${fill('M-2 -57 C -7 -57 -12 -55 -16 -50 C -11 -53 -6 -53 -2 -52 Z', SHADE, false)}
<rect x="-3.4" y="-68" width="6.8" height="22" rx="1.6" fill="${SHADE}" stroke="${INK}" stroke-width=".6"/>
${fill('M-2.6 -68 L0 -77 L2.6 -68 Z', LIT)}`
}

function flangedMace(): string {
  let flanges = ''
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2
    const c = Math.cos(a)
    const s = Math.sin(a)
    const tip = (r: number) => `${(c * r).toFixed(2)} ${(-50 + s * r).toFixed(2)}`
    const side = (r: number, d: number) => `${(c * r - s * d).toFixed(2)} ${(-50 + s * r + c * d).toFixed(2)}`
    flanges += fill(`M${side(4, -3)} L${tip(14)} L${side(4, 3)} Z`, i < 3 ? LIT : SHADE)
  }
  return `${haft(-42)}
<rect x="-3.2" y="-8" width="6.4" height="5" rx="1" fill="#3A2618"/>
${flanges}<circle cx="0" cy="-50" r="5.6" fill="url(#steel)" stroke="${INK}" stroke-width=".7"/><circle cx="-1.8" cy="-52" r="1.6" fill="#FFFFFF" opacity=".8"/>`
}

function warhammer(): string {
  return `${haft(-64)}
${fill('M-11 -70 L7 -70 L7 -56 L-11 -56 Z', SHADE)}${fill('M-11 -70 L7 -70 L7 -64 L-11 -64 Z', LIT, false)}
${fill('M7 -71 L12 -71 L12 -55 L7 -55 Z', '#D8E0EC')}
${fill('M-11 -67 L-24 -63 L-11 -59 Z', LIT)}
${fill('M-2 -70 L0 -78 L2 -70 Z', LIT)}
${line('M8.5 -70 V-56', '#FFFFFF', 0.9)}`
}

function spear(): string {
  return `${haft(-84, 3.4)}
${fill('M-3.6 -84 L0 -104 L0 -80 Z', LIT, false)}${fill('M0 -104 L3.6 -84 L0 -80 Z', SHADE, false)}${fill('M-3.6 -84 L0 -104 L3.6 -84 L0 -80 Z', 'none')}
${line('M0 -100 V-84', RIDGE, 0.9)}
<rect x="-2.6" y="-82" width="5.2" height="5" rx="1" fill="${GOLD}" stroke="${INK}" stroke-width=".5"/>
${line('M-2 -77 C -6 -72 -6 -66 -4 -62 M0 -77 C -2 -71 -1 -65 0 -61 M2 -77 C 5 -72 4 -66 3 -62', '#D9363E', 1.6)}`
}

function halberd(): string {
  return `${haft(-98, 3.4)}
${fill('M-2 -98 L0 -116 L2 -98 Z', LIT)}
${fill('M2 -98 C 15 -101 22 -90 17 -76 C 11 -80 6 -82 2 -82 Z', LIT)}${fill('M2 -88 C 8 -88 14 -84 17 -76 C 11 -80 6 -82 2 -82 Z', SHADE, false)}${line('M15 -95 C 20 -89 20 -82 17 -76', '#FFFFFF', 0.9)}
${fill('M-2 -94 L-15 -99 L-10 -91 L-2 -88 Z', SHADE)}
<rect x="-2.8" y="-100" width="5.6" height="20" rx="1.2" fill="${SHADE}" stroke="${INK}" stroke-width=".6"/>
${line('M-2 -80 l-3 5 M2 -80 l3 5', '#D9363E', 1.6)}`
}

function trident(): string {
  const prong = (x: number, top: number) =>
    `${fill(`M${x - 1.6} -88 L${x - 1.6} ${top + 6} L${x} ${top} L${x + 1.6} ${top + 6} L${x + 1.6} -88 Z`, LIT)}${fill(`M${x + 1.6} ${top + 6} L${x + 4.2} ${top + 10} L${x + 1.6} ${top + 9} Z`, SHADE)}`
  return `${haft(-86, 3.2)}
${fill('M-12 -86 Q 0 -92 12 -86 L 12 -83 Q 0 -89 -12 -83 Z', 'url(#goldMetal)')}
${prong(-10, -104)}${prong(10, -104)}${prong(0, -114)}
<circle cx="0" cy="-84" r="2.4" fill="#3FA7D6" stroke="${INK}" stroke-width=".5"/>`
}

function scythe(): string {
  return `${line('M0 4 C -2 -30 2 -60 -1 -96', WOOD_DARK, 4.6)}${line('M0 4 C -2 -30 2 -60 -1 -96', '#8A5A34', 3)}
<rect x="-3" y="-50" width="6" height="4" rx="1" fill="#3A2618"/>
${fill('M-2 -98 C 22 -106 44 -94 52 -72 C 38 -86 20 -90 -1 -88 Z', LIT)}
${fill('M-1 -92 C 18 -94 36 -88 52 -72 C 38 -86 20 -90 -1 -88 Z', SHADE, false)}
${line('M2 -99 C 24 -104 44 -92 51 -74', '#FFFFFF', 0.9)}
<rect x="-4" y="-100" width="7" height="6" rx="1.4" fill="${SHADE}" stroke="${INK}" stroke-width=".6"/>`
}

function dragonBlade(): string {
  // A legendary blade with a flame-cut edge, wing-shaped guard and a glow.
  return `${grip(15, '#4A0E12')}
<circle cx="0" cy="3.6" r="3.4" fill="#B3121F" stroke="${GOLD}" stroke-width="1"/>
${fill('M0 -16 C -6 -14 -12 -20 -18 -16 C -14 -22 -8 -24 -2 -20 Z', 'url(#goldMetal)')}${fill('M0 -16 C 6 -14 12 -20 18 -16 C 14 -22 8 -24 2 -20 Z', 'url(#goldMetal)')}
<g class="legend" filter="url(#legendGlow)">
${fill('M-4.4 -20 L-5 -34 L-3 -36 L-5.6 -48 L-3.4 -50 L-5 -62 L-2.4 -66 L0 -84 L2.4 -66 L5 -62 L3.4 -50 L5.6 -48 L3 -36 L5 -34 L4.4 -20 Z', 'url(#dragonFire)')}
${line('M0 -22 V-78', '#FFE9A8', 1)}
</g>
<circle cx="0" cy="-19" r="2.4" fill="#FFD25A" stroke="${INK}" stroke-width=".5"/>`
}

function frostBlade(): string {
  return `${grip(15, '#1D3A5C')}
${fill('M-2.6 2 L0 7 L2.6 2 Z', '#8EDBFF')}
${fill('M-11 -15 L-4 -19 L0 -16 L4 -19 L11 -15 L4 -13 L0 -15 L-4 -13 Z', '#BFEAFF')}
<g class="legend frost" filter="url(#legendGlow)">
${fill('M-4 -19 L-6 -30 L-3 -32 L-6 -46 L-2 -50 L-4 -62 L0 -86 L4 -62 L2 -50 L6 -46 L3 -32 L6 -30 L4 -19 Z', 'url(#frostIce)')}
${line('M0 -21 L-1 -40 L1 -58 L0 -80', '#FFFFFF', 1)}
</g>
${line('M-8 -60 l3 0 M-6.5 -61.5 l0 3 M7 -40 l3 0 M8.5 -41.5 l0 3', '#E8FBFF', 0.8, ' class="twinkle"')}`
}


// ---------------------------------------------------------------- firearms

// Guns are drawn pointing forward (+x) from the hand, the grip under it; a
// muzzle flash sits at each muzzle, lit by the fight at every shot.

const GUNMETAL = '#2B2D33'
const GUNMETAL_LIT = '#4A4E57'

function flash(x: number, y: number, big = false): string {
  const r = big ? 9 : 6
  return `<g class="mf" transform="translate(${x} ${y})"><path d="M0 ${-r * 0.55} L${r * 1.6} 0 L0 ${r * 0.55} L${r * 0.5} 0 Z" fill="#FFE38A"/><path d="M0 -${r * 0.3} L${r} 0 L0 ${r * 0.3} Z" fill="#FFFFFF"/><circle r="${r * 0.45}" fill="#FFB347"/></g>`
}

function trigger(x: number, y: number, color: string): string {
  return line(`M${x} ${y} q6 0 6 4 q-4 1.4 -7 .2`, color, 1.4)
}

// James Bond's Walther PPK: small, black, brown grips.
function ppk(): string {
  return `<rect x="-4" y="-9" width="22" height="5.5" rx="1" fill="${GUNMETAL}" stroke="${INK}" stroke-width=".6"/>
${line('M-3 -8 H17', '#6B7080', 0.8)}
<rect x="-2" y="-3.6" width="15" height="3" fill="#23252B"/>
${fill('M-3.4 -3.6 L4 -3.6 L2.2 8 L-5.4 8 Z', '#5A3A22')}
${line('M-3 0 L2 0 M-3.4 3 L1.6 3', '#3A2414', 0.6)}
${trigger(4, -1, '#23252B')}
${flash(19, -6.3)}`
}

// Desert Eagle: big, silver, triangular barrel.
function deagle(): string {
  return `<rect x="-5" y="-11.5" width="32" height="8" rx="1" fill="url(#steel)" stroke="${INK}" stroke-width=".6"/>
${line('M3 -9.5 H25', RIDGE, 1)}${line('M-4 -10.6 H26', '#FFFFFF', 0.7)}
<rect x="-3" y="-3.5" width="22" height="3.5" fill="#9AA7BA" stroke="${INK}" stroke-width=".5"/>
${fill('M-4.4 -3.5 L6 -3.5 L4 10 L-6.4 10 Z', '#1E1E22')}
${trigger(6, -0.5, '#6E7A90')}
${flash(28, -7.5, true)}`
}

// One Beretta 92: the open-top slide shows the barrel.
function beretta(): string {
  return `<rect x="-4" y="-9" width="24" height="5.5" rx="1" fill="${GUNMETAL}" stroke="${INK}" stroke-width=".6"/>
<rect x="4" y="-9" width="10" height="2.4" fill="#8C99AD"/>
<rect x="-2" y="-3.6" width="17" height="3" fill="#23252B"/>
${fill('M-3.4 -3.6 L4.4 -3.6 L2.4 8.4 L-5.6 8.4 Z', '#1E1E22')}
${trigger(4.4, -1, '#23252B')}
${flash(21, -6.3)}`
}

// Two Berettas: one in each hand, the second a little lower behind.
function berettas(): string {
  return `<g transform="translate(-7 7)" opacity=".92">${beretta()}</g>${beretta()}`
}

function ak47(): string {
  return `${fill('M-24 -5 L-6 -8 L-6 -2.4 L-22 3.4 Z', 'url(#woodGrain)')}
<rect x="-6" y="-9.4" width="27" height="6.4" fill="#3A3D44" stroke="${INK}" stroke-width=".6"/>
${line('M-5 -8.4 H20', '#5E636E', 0.8)}
<rect x="21" y="-8.6" width="12" height="4.8" rx="1" fill="url(#woodGrain)" stroke="${INK}" stroke-width=".5"/>
<rect x="21" y="-11" width="14" height="2" fill="${GUNMETAL}"/>
<rect x="33" y="-7.6" width="12" height="2.2" fill="${GUNMETAL}"/>
<rect x="41" y="-11.4" width="1.8" height="4" fill="${GUNMETAL}"/>
${fill('M6 -3 L12.4 -3 Q 14.6 6 10.4 13.4 L5 11.6 Q 8.4 5 6 -3 Z', '#3A3D44')}
${fill('M-2 -3 L3.4 -3 L1.4 6.4 L-3.2 6.4 Z', 'url(#woodGrain)')}
${trigger(3.4, -1, GUNMETAL)}
${flash(46, -6.5, true)}`
}

// A minigun: barrels spinning in a cluster, an ammo belt feeding in.
function minigun(): string {
  return `<path d="M-6 0 C -10 8 -18 10 -24 6" stroke="#B8892E" stroke-width="4" fill="none" stroke-dasharray="2 1.4"/>
<rect x="-9" y="-13" width="20" height="13" rx="2.4" fill="${GUNMETAL_LIT}" stroke="${INK}" stroke-width=".6"/>
${line('M-6 -13 C -4 -19 4 -19 6 -13', GUNMETAL, 2.2)}
<g class="spin">
  <rect x="11" y="-12" width="32" height="2.2" fill="${GUNMETAL}"/>
  <rect x="11" y="-8.6" width="32" height="2.2" fill="#3A3D44"/>
  <rect x="11" y="-5.2" width="32" height="2.2" fill="${GUNMETAL}"/>
</g>
<rect x="18" y="-13.4" width="3" height="11.6" rx="1" fill="#6B7080" stroke="${INK}" stroke-width=".5"/>
<rect x="38" y="-13.4" width="3.4" height="11.6" rx="1" fill="#6B7080" stroke="${INK}" stroke-width=".5"/>
${fill('M-3 0 L3 0 L1.6 7 L-3.6 7 Z', '#1E1E22')}
${flash(45, -7.5, true)}`
}

// A retro space blaster: a gold body, cyan rings, a glowing tip.
function blaster(): string {
  return `${fill('M-3 -2 L3.4 -2 L2 9.4 L-4.4 9.4 Z', '#C2263A')}
${fill('M-6 -9 L-12 -15 L-4 -11 Z', '#C2263A')}${fill('M-6 -5 L-12 1 L-4 -3 Z', '#C2263A')}
<ellipse cx="7" cy="-7" rx="12" ry="6.4" fill="url(#goldMetal)" stroke="${INK}" stroke-width=".6"/>
${fill('M17 -9.6 L33 -8.2 L33 -5.8 L17 -4.4 Z', 'url(#steel)')}
<rect x="19" y="-10.4" width="2.6" height="6.8" rx="1" fill="#3FA7D6"/><rect x="24" y="-10" width="2.4" height="6" rx="1" fill="#3FA7D6"/>
<circle cx="5" cy="-9" r="2" fill="#FFFFFF" opacity=".7"/>
<g class="legend" filter="url(#legendGlow)"><circle cx="34" cy="-7" r="2.6" fill="#7CF7FF"/></g>
${flash(35, -7, true)}`
}

/** How much bigger a gun is drawn in the hero's hand than in its own units. */
export const GUN_SCALE = 1.6

/** The guns. */
export const RANGED: readonly WeaponKind[] = ['ppk', 'deagle', 'berettas', 'ak47', 'minigun', 'blaster']

export function isRanged(kind: WeaponKind): boolean {
  return RANGED.includes(kind)
}

/** Where a gun's muzzle is, from the hand, before it is aimed. */
export const MUZZLE: Partial<Record<WeaponKind, { x: number; y: number }>> = {
  ppk: { x: 19, y: -6.3 },
  deagle: { x: 28, y: -7.5 },
  berettas: { x: 21, y: -6.3 },
  ak47: { x: 46, y: -6.5 },
  minigun: { x: 45, y: -7.5 },
  blaster: { x: 35, y: -7 },
}

/** A shot's trace: a lone round, a pair, a burst, or a beam. */
export type Tracer = 'single' | 'double' | 'burst' | 'beam'
export const TRACER: Partial<Record<WeaponKind, Tracer>> = {
  ppk: 'single',
  deagle: 'single',
  berettas: 'double',
  ak47: 'burst',
  minigun: 'burst',
  blaster: 'beam',
}

/** The drawing of a weapon: a blade pointing up from the hand, a gun forward. */
export function weapon(kind: WeaponKind): string {
  switch (kind) {
    case 'katana': return katana()
    case 'sword': return longsword()
    case 'scimitar': return scimitar()
    case 'axe': return battleAxe()
    case 'mace': return flangedMace()
    case 'warhammer': return warhammer()
    case 'spear': return spear()
    case 'halberd': return halberd()
    case 'trident': return trident()
    case 'scythe': return scythe()
    case 'dragon': return dragonBlade()
    case 'frost': return frostBlade()
    case 'ppk': return ppk()
    case 'deagle': return deagle()
    case 'berettas': return berettas()
    case 'ak47': return ak47()
    case 'minigun': return minigun()
    case 'blaster': return blaster()
  }
}

/** Animation styles for the legendary blades. */
export const WEAPON_CSS = `
.legend{animation:legend 1.6s ease-in-out infinite}
@keyframes legend{0%,100%{opacity:.88}50%{opacity:1}}
.twinkle{animation:tw 1.2s ease-in-out infinite}
.mf{opacity:0}
.spin{animation:spin .08s linear infinite}
@keyframes spin{0%,100%{transform:translateY(0)}50%{transform:translateY(1.2px)}}`

// ---------------------------------------------------------------- late-game gear

/**
 * The gear a level has earned, by rank: none for a Rookie; a red headband
 * for Mid (30); helm, cape and shield for Experienced (70); all of it in gold
 * with an aura from 85; a crown on top for the Legend (100).
 */
export function gearTier(level: number): number {
  return level >= 100 ? 4 : level >= 85 ? 3 : level >= 70 ? 2 : level >= 30 ? 1 : 0
}

/** The hero's gear for a tier, in the hero's own coordinates (feet at the origin). */
export function gear(tier: number): { back: string; front: string; shield: string } {
  if (tier === 0) return { back: '', front: '', shield: '' }
  if (tier === 1) {
    // A hachimaki: a red band round the brow, the knot's tails streaming back.
    return {
      back: `<g class="tails"><path d="M-28 -56 C -38 -58 -46 -52 -54 -54 C -46 -50 -40 -50 -32 -52 Z" fill="#B3262E"/><path d="M-28 -54 C -36 -50 -42 -44 -50 -44 C -42 -46 -36 -48 -30 -51 Z" fill="#8E1C24"/></g>`,
      front: `<rect x="-30" y="-59" width="60" height="6.5" rx="1.5" fill="#C62828" stroke="${INK}" stroke-width=".5"/>
<path d="M0 -58.2 L1.1 -56.8 L2.6 -56 L1.1 -55.2 L0 -53.8 L-1.1 -55.2 L-2.6 -56 L-1.1 -56.8 Z" fill="#FFFFFF"/>
<circle cx="-29" cy="-55.5" r="2.6" fill="#8E1C24"/>`,
      shield: '',
    }
  }
  const golden = tier >= 3
  const metal = golden ? 'url(#goldMetal)' : 'url(#helmMetal)'
  const side = golden ? '#9C6D16' : '#5E687C'
  const top = golden ? '#FFE9A8' : '#AEB8C8'
  let back = `<g class="cape"><path d="M-22 -58 C -40 -54 -56 -40 -62 -14 C -52 -20 -46 -16 -40 -22 C -36 -16 -30 -18 -26 -22 L -24 -50 Z" fill="${golden ? '#7A1430' : '#B3262E'}"/>
<path d="M-22 -58 C -38 -54 -50 -42 -56 -24" stroke="${golden ? GOLD : '#7E1A21'}" stroke-width="2" fill="none" opacity=".8"/></g>`
  if (golden) back = `<circle class="aura" cx="2" cy="-36" r="52" fill="url(#gold)"/>` + back
  let rivets = ''
  for (let x = -24; x <= 24; x += 8) rivets += `<circle cx="${x}" cy="-55" r="1.1" fill="#FFFFFF" opacity=".85"/>`
  let front = `<path d="M-30 -58 L-22 -67 L38 -67 L30 -58 Z" fill="${top}"/>
<path d="M30 -60 L38 -67 L38 -57 L30 -50 Z" fill="${side}"/>
<rect x="-30" y="-60" width="60" height="10" rx="2" fill="${metal}" stroke="${INK}" stroke-width=".6"/>
${rivets}
<path d="M-27 -62 C -41 -66 -46 -80 -38 -92 C -37 -81 -33 -72 -21 -66 Z" fill="#EFE6CC" stroke="#B9AD8C" stroke-width="1"/>
<path d="M33 -63 C 47 -67 52 -81 44 -93 C 43 -82 39 -73 27 -67 Z" fill="#EFE6CC" stroke="#B9AD8C" stroke-width="1"/>`
  front +=
    tier >= 4
      ? `<path d="M-14 -67 L-14 -80 L-7 -73 L0 -84 L7 -73 L14 -80 L14 -67 Z" fill="url(#goldMetal)" stroke="${INK}" stroke-width=".6"/>
<circle cx="0" cy="-77" r="2" fill="#C2263A"/><circle cx="-10" cy="-73" r="1.4" fill="#3FA7D6"/><circle cx="10" cy="-73" r="1.4" fill="#3FA7D6"/>`
      : `<g class="crest"><path d="M-6 -67 C -4 -82 12 -86 26 -80 C 18 -78 22 -72 30 -70 C 18 -66 6 -66 -6 -67 Z" fill="#D9363E"/></g>`
  const shield = `<g transform="translate(-40 -30)"><g class="shield">
<circle r="14" fill="${golden ? '#7A1430' : '#6B3E22'}" stroke="${golden ? GOLD : '#9AA7BA'}" stroke-width="3"/>
<circle r="10.5" fill="none" stroke="#2A1A10" stroke-width="1"/>
<path d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" fill="#D97757"/><circle r="1.6" fill="${GOLD}"/></g></g>`
  return { back, front, shield }
}

/** Animation styles for the gear. */
export const GEAR_CSS = `
.cape{animation:cape .45s ease-in-out infinite;transform-origin:-22px -58px}
@keyframes cape{0%,100%{transform:skewY(0) scaleX(1)}50%{transform:skewY(-6deg) scaleX(1.08)}}
.crest{animation:crest .32s ease-in-out infinite;transform-origin:-6px -67px}
@keyframes crest{0%,100%{transform:rotate(0)}50%{transform:rotate(-7deg)}}
.shield{animation:shield .32s ease-in-out infinite}
@keyframes shield{0%,100%{transform:translateY(0)}50%{transform:translateY(2px)}}
.tails{animation:tails .4s ease-in-out infinite;transform-origin:-28px -55px}
@keyframes tails{0%,100%{transform:rotate(0)}50%{transform:rotate(-9deg)}}
.aura{animation:aura 1.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes aura{0%,100%{opacity:.45;transform:scale(.9)}50%{opacity:.85;transform:scale(1.08)}}`
