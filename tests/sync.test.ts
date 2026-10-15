import { describe, expect, test } from 'claude-code/testing'

import { mergeOwn, othersKills, parseLedger } from '../hooks/sync'
import type { Ledger } from '../hooks/sync'

/**
 * A computer as the mod keeps it: its own count (kills it made itself) and
 * the others' sum as of its last sync. The total it shows is the two added.
 */
class Computer {
  own: number
  others = 0
  constructor(
    readonly id: string,
    own = 0,
  ) {
    this.own = own
  }
  get total() {
    return this.own + this.others
  }
  kill(n: number) {
    this.own += n
  }
  /** What syncNow does: read the gist, raise our entry, write, take the others' sum. */
  sync(gist: { text: string }) {
    const merged = mergeOwn(parseLedger(gist.text), this.id, this.id, this.own, 't')
    if (merged.changed) gist.text = JSON.stringify(merged.ledger)
    this.others = othersKills(merged.ledger, this.id)
  }
}

describe('kill counts across computers', () => {
  test('a second computer continues from the first one\'s 10,000, counting only its own kills', () => {
    const gist = { text: '' }
    const laptop = new Computer('laptop', 10_000)
    laptop.sync(gist)
    expect(laptop.total).toBe(10_000)

    // A new computer starts at 0 of its own and shows the shared 10,000.
    const desktop = new Computer('desktop')
    desktop.sync(gist)
    expect(desktop.own).toBe(0)
    expect(desktop.total).toBe(10_000)

    // It slays 50: only its own counter moves; the total is 10,050, not 20,050.
    desktop.kill(50)
    expect(desktop.total).toBe(10_050)
    desktop.sync(gist)

    // The laptop slays 20 meanwhile, then syncs: both agree on 10,070.
    laptop.kill(20)
    laptop.sync(gist)
    desktop.sync(gist)
    expect(laptop.total).toBe(10_070)
    expect(desktop.total).toBe(10_070)
    expect(laptop.own + desktop.own).toBe(10_070)
  })

  test('syncing again and again never counts anything twice', () => {
    const gist = { text: '' }
    const a = new Computer('a', 300)
    const b = new Computer('b', 200)
    for (let i = 0; i < 10; i++) {
      a.sync(gist)
      b.sync(gist)
    }
    expect(a.total).toBe(500)
    expect(b.total).toBe(500)
  })

  test('two computers writing at the same moment lose nothing for long', () => {
    const gist = { text: '' }
    const a = new Computer('a', 1_000)
    const b = new Computer('b', 0)
    a.sync(gist)
    b.sync(gist)
    a.kill(30)
    b.kill(40)
    // Both read the same gist, then both write: the later write drops a's 30.
    const seen = gist.text
    const fromA = mergeOwn(parseLedger(seen), 'a', 'a', a.own, 't').ledger
    const fromB = mergeOwn(parseLedger(seen), 'b', 'b', b.own, 't').ledger
    gist.text = JSON.stringify(fromA)
    gist.text = JSON.stringify(fromB)
    expect((parseLedger(gist.text) as Ledger).machines.a?.kills).toBe(1_000)
    // a still holds its own 1,030, so its next sync puts it back.
    a.sync(gist)
    b.sync(gist)
    expect(a.total).toBe(1_070)
    expect(b.total).toBe(1_070)
  })

  test('a computer that was off for a while catches up when it returns', () => {
    const gist = { text: '' }
    const a = new Computer('a', 5_000)
    const b = new Computer('b', 0)
    a.sync(gist)
    b.sync(gist)
    // a works for days while b is off.
    a.kill(2_500)
    a.sync(gist)
    expect(b.total).toBe(5_000)
    b.sync(gist)
    expect(b.total).toBe(7_500)
  })
})
