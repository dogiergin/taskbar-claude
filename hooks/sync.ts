// Kill counts shared between computers through a private GitHub gist.
//
// Each computer only ever raises its own counter; the gist holds one entry per
// computer and merging keeps the larger count of each, so two computers saving
// at once never lose each other's kills. The total is the sum of the entries.

export const GIST_DESCRIPTION = 'taskbar-claude sync'
export const GIST_FILE = 'taskbar-claude.json'

export type Ledger = { machines: Record<string, { kills: number; name: string; at: string }> }

/** A ledger from the gist file's text; an empty one when it is missing or unreadable. */
export function parseLedger(text: string | null | undefined): Ledger {
  try {
    const raw = JSON.parse(text ?? '') as { machines?: unknown }
    const machines: Ledger['machines'] = {}
    if (raw && typeof raw.machines === 'object' && raw.machines !== null) {
      for (const [id, v] of Object.entries(raw.machines as Record<string, unknown>)) {
        const e = v as { kills?: unknown; name?: unknown; at?: unknown }
        if (typeof e?.kills === 'number' && e.kills >= 0) {
          machines[id] = { kills: Math.floor(e.kills), name: typeof e.name === 'string' ? e.name : id.slice(0, 8), at: typeof e.at === 'string' ? e.at : '' }
        }
      }
    }
    return { machines }
  } catch {
    return { machines: {} }
  }
}

/** This computer's count put into the ledger; `changed` when the gist needs it. */
export function mergeOwn(ledger: Ledger, id: string, name: string, kills: number, at: string): { ledger: Ledger; changed: boolean } {
  const own = ledger.machines[id]
  if (own !== undefined && own.kills >= kills) return { ledger, changed: false }
  return { ledger: { machines: { ...ledger.machines, [id]: { kills, name, at } } }, changed: true }
}

/** The kills every other computer has made. */
export function othersKills(ledger: Ledger, id: string): number {
  return Object.entries(ledger.machines).reduce((n, [k, v]) => (k === id ? n : n + v.kills), 0)
}

/** How many computers count toward the total, this one included. */
export function machineCount(ledger: Ledger, id: string): number {
  return new Set([...Object.keys(ledger.machines), id]).size
}
