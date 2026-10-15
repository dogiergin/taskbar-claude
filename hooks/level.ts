// Levels, ranks and the armoury.
//
// 100 levels. Leaving level n takes round(13 * n^1.72) kills, so each level
// asks a little more than the last: at the fight's ~1,800 kills per working
// hour, Mid (level 30) comes after about a day of work, Experienced (70)
// after some 270 hours, and level 100 after about 720.

import type { Phase, WeaponChoice, WeaponKind } from '../types'

export const MAX_LEVEL = 100

/** Kills it takes to leave level `n`. */
export function killsToLeave(n: number): number {
  return Math.round(13 * n ** 1.72)
}

// CUMULATIVE[L] is the kills needed in all to reach level L.
const CUMULATIVE: number[] = [0, 0]
for (let L = 2; L <= MAX_LEVEL; L++) CUMULATIVE[L] = (CUMULATIVE[L - 1] ?? 0) + killsToLeave(L - 1)

/** Kills needed in all to reach `level`. */
export function killsToReach(level: number): number {
  return CUMULATIVE[Math.max(1, Math.min(MAX_LEVEL, level))] ?? 0
}

/** The level a lifetime kill count has reached. */
export function levelFor(total: number): number {
  let level = 1
  while (level < MAX_LEVEL && (CUMULATIVE[level + 1] ?? Infinity) <= total) level++
  return level
}

/** Where a kill count stands inside its level: done, needed, and the fraction. */
export function levelProgress(total: number): { level: number; into: number; need: number; fraction: number } {
  const level = levelFor(total)
  if (level >= MAX_LEVEL) return { level, into: 0, need: 0, fraction: 1 }
  const need = killsToLeave(level)
  const into = total - killsToReach(level)
  return { level, into, need, fraction: Math.max(0, Math.min(1, into / need)) }
}

export type Rank = 'rookie' | 'mid' | 'experienced' | 'legend'

/** Rookie below 30, Mid from 30, Experienced from 70, Legend at 100. */
export function rankFor(level: number): Rank {
  return level >= 100 ? 'legend' : level >= 70 ? 'experienced' : level >= 30 ? 'mid' : 'rookie'
}

export const RANK_NAMES: Record<'tr' | 'en', Record<Rank, string>> = {
  tr: { rookie: 'Çaylak', mid: 'Orta', experienced: 'Deneyimli', legend: 'Efsane' },
  en: { rookie: 'Rookie', mid: 'Mid', experienced: 'Experienced', legend: 'Legend' },
}

/** The armoury, in unlock order; the legendary blades come with experience. */
export const WEAPONS: ReadonlyArray<{ kind: WeaponKind; level: number }> = [
  { kind: 'katana', level: 1 },
  { kind: 'sword', level: 4 },
  { kind: 'axe', level: 8 },
  { kind: 'mace', level: 12 },
  { kind: 'scimitar', level: 16 },
  { kind: 'warhammer', level: 20 },
  { kind: 'spear', level: 25 },
  { kind: 'halberd', level: 30 },
  { kind: 'trident', level: 38 },
  { kind: 'scythe', level: 46 },
  { kind: 'dragon', level: 70 },
  { kind: 'frost', level: 85 },
  { kind: 'ppk', level: 1 },
  { kind: 'deagle', level: 6 },
  { kind: 'berettas', level: 10 },
  { kind: 'ak47', level: 18 },
  { kind: 'minigun', level: 28 },
  { kind: 'blaster', level: 45 },
]

export const WEAPON_NAMES: Record<'tr' | 'en', Record<WeaponKind, string>> = {
  tr: {
    katana: 'Katana',
    sword: 'Uzun kılıç',
    axe: 'Savaş baltası',
    mace: 'Topuz',
    scimitar: 'Pala',
    warhammer: 'Savaş çekici',
    spear: 'Mızrak',
    halberd: 'Teber',
    trident: 'Üç dişli',
    scythe: 'Tırpan',
    dragon: 'Ejder kılıcı',
    frost: 'Buz kılıcı',
    ppk: 'Walther PPK (007)',
    deagle: 'Desert Eagle',
    berettas: 'Çift Beretta',
    ak47: 'AK-47',
    minigun: 'Taramalı (minigun)',
    blaster: 'Uzay blasterı',
  },
  en: {
    katana: 'Katana',
    sword: 'Longsword',
    axe: 'Battle axe',
    mace: 'Mace',
    scimitar: 'Scimitar',
    warhammer: 'Warhammer',
    spear: 'Spear',
    halberd: 'Halberd',
    trident: 'Trident',
    scythe: 'Scythe',
    dragon: 'Dragon blade',
    frost: 'Frost blade',
    ppk: 'Walther PPK (007)',
    deagle: 'Desert Eagle',
    berettas: 'Dual Berettas',
    ak47: 'AK-47',
    minigun: 'Minigun',
    blaster: 'Space blaster',
  },
}

const PHASE_WEAPON: Record<Phase, WeaponKind> = {
  idle: 'katana',
  think: 'katana',
  answer: 'sword',
  code: 'sword',
  run: 'mace',
  search: 'axe',
  win: 'katana',
}

export function isUnlocked(kind: WeaponKind, level: number): boolean {
  return level >= (WEAPONS.find(w => w.kind === kind)?.level ?? 1)
}

/** The weapon in hand: the chosen one, or on auto the phase's, if unlocked. */
export function weaponInHand(choice: WeaponChoice, phase: Phase, level: number): WeaponKind {
  const want = choice === 'auto' ? PHASE_WEAPON[phase] : choice
  return isUnlocked(want, level) ? want : 'katana'
}

/** The weapons a level-up from `from` to `to` unlocked. */
export function unlockedBetween(from: number, to: number): WeaponKind[] {
  return WEAPONS.filter(w => w.level > from && w.level <= to).map(w => w.kind)
}
