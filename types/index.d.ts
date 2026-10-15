/** What Claude is doing right now; picks the weapon and the bug rate. */
export type Phase = 'idle' | 'think' | 'answer' | 'code' | 'run' | 'search' | 'win'

/** One rate-limit window, as the band shows it. */
export type Limit = { kind: string; pct: number; resetsAt: string | null }

/** The status figures drawn under the arena. */
export type Metrics = {
  ctxPct: number | null
  ctxTokens: number | null
  ctxWindow: number
  limits: Limit[]
  costUsd: number | null
  burnPerHour: number | null
  /** When the session began, in ms since the epoch. */
  startedAt: number | null
}

/** A weapon the hero can hold. */
export type WeaponKind =
  | 'katana'
  | 'sword'
  | 'axe'
  | 'mace'
  | 'scimitar'
  | 'warhammer'
  | 'spear'
  | 'halberd'
  | 'trident'
  | 'scythe'
  | 'dragon'
  | 'frost'
  | 'ppk'
  | 'deagle'
  | 'berettas'
  | 'ak47'
  | 'minigun'
  | 'blaster'

/** Close in with a blade, or shoot from afar. */
export type Combat = 'melee' | 'ranged'

/** The weapon the person picked, or `auto` to follow what Claude is doing. */
export type WeaponChoice = 'auto' | WeaponKind

/** Where sharing the kill count between computers stands. */
export type SyncStatus = {
  on: boolean
  /** Computers counting toward the total, this one included. */
  machines: number
  /** When the last sync finished, in ms since the epoch. */
  at: number | null
  error: string | null
}

/** A one-shot scene the desktop plays before the fight resumes. */
export type Stage = 'eat' | 'win' | 'wake' | null

/** Everything the hooks module tells the arena. */
export type Scene = {
  phase: Phase
  tool: string | null
  /** Bumped when Claude spends tokens on a new request: the knight eats one. */
  eatSeq: number
  /** Bumped when a turn ends with an answer: the knight celebrates. */
  winSeq: number
  stage: Stage
  /** Bugs the desktop's fight has slain this session. */
  kills: number
  /** Bugs slain across every session: what the level counts. */
  totalKills: number
  weapon: WeaponChoice
  combat: Combat
  /** False until the session's first prompt wakes Claude in camp. */
  awake: boolean
  sync: SyncStatus
  metrics: Metrics
}

/** The arena Client's props. */
export type SceneProps = Scene & {
  working: boolean
  rows: number
  cols: number
  /** Whether the Client draws its own one-row readout under the arena. */
  readout: boolean
  lang: 'tr' | 'en'
}

declare module 'claude-code' {
  interface PluginState {
    'taskbar-claude': {
      scene: Scene
      /** Whether the usage block is opened into its detailed panel. */
      expanded: boolean
      /** The minute the countdowns were last drawn at, so they move on. */
      clock: number
      /** True while the eat scene holds the usage bar open. */
      peek: boolean
      /** The language the band is drawn in: the one the person writes in. */
      lang: 'tr' | 'en'
    }
  }
}
