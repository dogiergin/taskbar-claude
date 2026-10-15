// Turning Claude Code's own figures into what the band draws.
//
// Context, limits and cost are the engine's: `$.session.usage()`, the same
// numbers the status line and /cost show. The one figure worked out here is
// the burn rate, the dollars an hour the session spends right now.

import type { SessionUsage } from 'claude-code'

import type { Metrics } from '../types'

/** One reading of the session's cost: when, and the total so far in USD. */
export type CostSample = { at: number; usd: number }

/** How far back the burn rate looks. */
export const BURN_WINDOW_MS = 60 * 60_000
/** The shortest stretch a rate is worked out over, so a fresh session is not wild. */
export const MIN_BURN_SPAN_MS = 10 * 60_000

/**
 * The dollars an hour spent over the last hour: the cost added since the
 * oldest reading inside the window, over the time between. Readings start
 * with the session's start at zero cost, so a young session is averaged
 * from its start; never over less than ten minutes.
 */
export function burnRate(samples: readonly CostSample[], now: number, startedAt: number): number | null {
  const last = samples[samples.length - 1]
  if (last === undefined) return null
  const from = now - BURN_WINDOW_MS
  // The reading the window starts from: the latest one at or before its edge,
  // else the session's own start at no cost.
  const before = [...samples].reverse().find(s => s.at <= from)
  const base = before ?? (startedAt >= from ? { at: startedAt, usd: 0 } : samples[0] ?? last)
  const span = Math.max(now - Math.max(base.at, from), MIN_BURN_SPAN_MS)
  const spent = Math.max(0, last.usd - base.usd)
  return spent / (span / 3_600_000)
}

/** Keeps readings that still matter to the window, adding the newest. */
export function addSample(samples: readonly CostSample[], at: number, usd: number): CostSample[] {
  const from = at - BURN_WINDOW_MS
  const kept = samples.filter(s => s.usd <= usd)
  // Keep one reading at or before the window's edge, as the rate's base.
  const edge = [...kept].reverse().find(s => s.at <= from)
  const inside = kept.filter(s => s.at > from)
  return [...(edge ? [edge] : []), ...inside, { at, usd }]
}

export function toMetrics(usage: SessionUsage, now: number, samples: readonly CostSample[]): Metrics {
  const cost = usage.cost?.usd ?? null
  return {
    ctxPct: usage.context.percent ?? null,
    ctxTokens: usage.context.tokens ?? null,
    ctxWindow: usage.context.window,
    limits: usage.rateLimits.map(l => ({
      kind: l.kind,
      pct: l.percentUsed,
      resetsAt: l.resetsAt ?? null,
    })),
    costUsd: cost,
    burnPerHour: cost === null ? null : burnRate(samples, now, usage.startedAt),
    startedAt: usage.startedAt,
  }
}
