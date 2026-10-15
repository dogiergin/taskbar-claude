import { describe, expect, test } from 'claude-code/testing'

import { addSample, burnRate, toMetrics } from '../hooks/metrics'
import type { CostSample } from '../hooks/metrics'
import { summaryChips } from '../hooks/panel'
import type { PanelArgs } from '../hooks/panel'
import type { Limit, Scene } from '../types'

const MIN = 60_000

/** Whether a number is within `d` of `want`. */
const near = (got: number | null, want: number, d: number) => got !== null && Math.abs(got - want) <= d
const HOUR = 60 * MIN
const T0 = 1_800_000_000_000

/** Readings every five minutes, the cost growing as `costAt` says. */
function readings(until: number, costAt: (t: number) => number): CostSample[] {
  let s: CostSample[] = []
  for (let t = T0 + 5 * MIN; t <= until; t += 5 * MIN) s = addSample(s, t, costAt(t))
  return s
}

describe('burn rate, as an API user pays it', () => {
  test('half an hour at $3/h reads $3/h', () => {
    const now = T0 + 30 * MIN
    const s = readings(now, t => ((t - T0) / HOUR) * 3)
    expect(near(burnRate(s, now, T0), 3, 1e-05)).toBe(true)
  })

  test('a young session is averaged over ten minutes at least', () => {
    const now = T0 + 4 * MIN
    expect(near(burnRate([{ at: now, usd: 0.2 }], now, T0), 1.2, 1e-05)).toBe(true)
  })

  test('a long session shows what it spends now, not its average', () => {
    // Two quiet hours at $0.50/h, then an hour at $4/h.
    const costAt = (t: number) => {
      const h = (t - T0) / HOUR
      return h <= 2 ? h * 0.5 : 1 + (h - 2) * 4
    }
    const now = T0 + 3 * HOUR
    const s = readings(now, costAt)
    expect(near(burnRate(s, now, T0), 4, 1e-05)).toBe(true)
    // The old session average would have said $1.67/h.
    expect(near(costAt(now) / 3, 1.667, 0.01)).toBe(true)
  })

  test('old readings are dropped but the window keeps its base', () => {
    const now = T0 + 5 * HOUR
    const s = readings(now, t => (t - T0) / HOUR)
    expect(s.length).toBeLessThanOrEqual(14)
    expect(s[0]!.at).toBeLessThanOrEqual(now - HOUR)
    expect(near(burnRate(s, now, T0), 1, 1e-5)).toBe(true)
  })
})

describe('what an API user sees', () => {
  const usage = {
    startedAt: T0,
    context: { tokens: 120_000, window: 200_000, percent: 60 },
    rateLimits: [],
    cost: { usd: 2.5 },
  }

  test('figures come through as Claude Code reports them', () => {
    const m = toMetrics(usage, T0 + HOUR, [{ at: T0 + HOUR, usd: 2.5 }])
    expect(m.costUsd).toBe(2.5)
    expect(m.limits).toEqual([])
    expect(m.ctxPct).toBe(60)
    expect(near(m.burnPerHour, 2.5, 1e-5)).toBe(true)
  })

  test('no plan is claimed: the cost chip shows dollars and the rate', () => {
    const m = toMetrics(usage, T0 + HOUR, [{ at: T0 + HOUR, usd: 2.5 }])
    const rows = summaryChips(args({ metrics: m }, T0 + HOUR))
    const all = rows.flat()
    const cost = all.find(c => c.key === 'usage-open-cost')
    expect(cost?.value).toBe('$2.50')
    expect(cost?.extra).toBe('$2.50/h')
    expect(all.some(c => c.value === 'Subscription')).toBe(false)
    expect(all.some(c => c.key.startsWith('usage-open-five_hour'))).toBe(false)
  })
})

describe('limits read from the last response', () => {
  test('a window past its reset reads 0%, renewed, until the next request', () => {
    const now = T0 + 6 * HOUR
    const limits: Limit[] = [
      { kind: 'five_hour', pct: 99, resetsAt: new Date(T0 + 5 * HOUR).toISOString() },
      { kind: 'seven_day', pct: 15, resetsAt: new Date(T0 + 48 * HOUR).toISOString() },
    ]
    const all = summaryChips(args({ metrics: { ...base().metrics, limits } }, now)).flat()
    const five = all.find(c => c.key === 'usage-open-five_hour')
    const week = all.find(c => c.key === 'usage-open-seven_day')
    expect(five?.value).toBe('0%')
    expect(five?.extra).toBe('↻ renewed')
    expect(week?.value).toBe('15%')
  })
})

function base(): Scene {
  return {
    phase: 'idle',
    tool: null,
    eatSeq: 0,
    winSeq: 0,
    stage: null,
    kills: 0,
    totalKills: 0,
    weapon: 'auto',
    combat: 'melee',
    awake: true,
    sync: { on: false, machines: 1, at: null, error: null },
    metrics: { ctxPct: null, ctxTokens: null, ctxWindow: 0, limits: [], costUsd: null, burnPerHour: null, startedAt: T0 },
  }
}

function args(over: Partial<Scene>, now: number): PanelArgs {
  return {
    s: { ...base(), ...over },
    working: false,
    expanded: false,
    eating: false,
    width: 120,
    lang: 'en',
    now,
    ringSize: 52,
    onToggle: () => undefined,
    onPick: () => undefined,
    onCombat: () => undefined,
    onSync: () => undefined,
  }
}
