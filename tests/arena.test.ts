import { expect, test } from 'claude-code/testing'

import { levelFor, levelProgress, rankFor, weaponInHand } from '../hooks/level'
import { gearTier } from '../hooks/weapons'
import { detectLang } from '../hooks/lang'
import { machineCount, mergeOwn, othersKills, parseLedger } from '../hooks/sync'
import { chipAt } from '../hooks/chips'
import type { Chip } from '../hooks/chips'

const band = (isWorking: boolean, maxRows = 14, bodyColumns = 100) => ({
  plugin: 'taskbar-claude',
  component: 'AbovePrompt' as const,
  props: {
    hasSurvey: false,
    isWorking,
    maxRows,
    bodyColumns,
    scroll: { offset: 0, bodyRows: maxRows },
    view: {},
  },
})

const PIXELS = /[▀▄█]/
const TR = { options: { language: 'tr' } }

/** Opens the panel as the person would on each surface. */
async function openPanel(
  ui: { post: (d: unknown, s: { in: string }) => Promise<void>; press: (t: { key: string }) => Promise<unknown> },
  surface: string,
) {
  if (surface === 'desktop') await ui.post({ chip: 'usage-open-more' }, { in: 'chips' })
  else await ui.press({ key: 'usage-open-more' })
}

/** The arena's own Svg, told apart from the chips' pies by its alt text. */
async function arena(ui: { findAll: (q: { type: string }) => Promise<Array<{ props?: unknown }>> }) {
  const all = await ui.findAll({ type: 'Svg' })
  return all.find(x => String((x.props as { alt?: string } | undefined)?.alt).startsWith('Claude fights'))
}

test('the terminal draws the usage row above a moving arena', TR, async $ => {
  const ui = await $.ui.mount({ ...band(true), surface: 'terminal' })
  expect(await ui.find({ text: /Hazır/ })).toBeDefined()
  expect(await ui.find({ in: 'arena', text: PIXELS })).toBeDefined()
  await ui.advance(3_000)
  expect(await ui.find({ in: 'arena', text: PIXELS })).toBeDefined()
  await ui.unmount()
})

test('the desktop draws the usage row above the smooth scene', TR, async $ => {
  const ui = await $.ui.mount({ ...band(true), surface: 'desktop' })
  expect(await arena(ui)).toBeDefined()
  expect(await ui.find({ in: 'chips', key: 'usage-open-more' })).toBeDefined()
  await ui.unmount()
})

test('pressing the usage row opens the detailed panel and closes it again', TR, async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...band(true), surface })
    await openPanel(ui, surface)
    expect(await ui.find({ text: /BAĞLAM/ })).toBeDefined()
    expect(await ui.find({ text: /5 SAATLİK LİMİT/ })).toBeDefined()
    expect(await ui.find({ text: /MALİYET/ })).toBeDefined()
    expect(await ui.find({ text: /SEVİYE/ })).toBeDefined()
    expect(await ui.find({ key: 'wpn-select' })).toBeDefined()
    await ui.select({ key: 'wpn-select', value: 'katana' })
    await ui.select({ key: 'wpn-select', value: 'auto' })
    await ui.press({ key: 'usage-close' })
    expect(await (surface === 'desktop' ? ui.find({ in: 'chips', key: 'usage-open-more' }) : ui.find({ key: 'usage-open-more' }))).toBeDefined()
    await ui.unmount()
  }
})

test('the arena rests when Claude is idle', TR, async $ => {
  const ui = await $.ui.mount({ ...band(false), surface: 'terminal' })
  await ui.advance(5_000)
  expect(await ui.find({ text: /Hazır/ })).toBeDefined()
  await ui.unmount()
})

test('mobile is left to the engine', TR, async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return Text({ children: 'engine band' })
  })
  const ui = await $.ui.mount({ ...band(true), surface: 'mobile' })
  expect(await ui.find({ text: 'engine band' })).toBeDefined()
  await ui.unmount()
})

test('100 levels, each a little steeper; ranks at 30, 70 and 100', async () => {
  expect(levelFor(0)).toBe(1)
  expect(levelFor(12)).toBe(1)
  expect(levelFor(13)).toBe(2)
  expect(levelFor(850)).toBe(7)
  expect(levelFor(1e9)).toBe(100)
  expect(levelProgress(13)).toMatchObject({ level: 2, into: 0 })
  expect(rankFor(29)).toBe('rookie')
  expect(rankFor(30)).toBe('mid')
  expect(rankFor(70)).toBe('experienced')
  expect(rankFor(100)).toBe('legend')
  expect(gearTier(29)).toBe(0)
  expect(gearTier(30)).toBe(1)
  expect(gearTier(70)).toBe(2)
  expect(gearTier(85)).toBe(3)
  expect(gearTier(100)).toBe(4)
})

test('a locked weapon falls back to the katana', async () => {
  expect(weaponInHand('spear', 'think', 3)).toBe('katana')
  expect(weaponInHand('spear', 'think', 25)).toBe('spear')
  expect(weaponInHand('auto', 'run', 12)).toBe('mace')
  expect(weaponInHand('auto', 'run', 2)).toBe('katana')
})

test('the desktop fight does not redraw when Claude moves from thinking to coding', TR, async ($, on) => {
  const ui = await $.ui.mount({ ...band(true), surface: 'desktop' })
  const before = (await arena(ui))?.props
  await $.tool.call({ tool: 'Read', input: { file_path: '/tmp/x' } }).catch(() => undefined)
  await $.tool.call({ tool: 'Edit', input: { file_path: '/tmp/x', old_string: 'a', new_string: 'b' } }).catch(() => undefined)
  await ui.redraw()
  const after = (await arena(ui))?.props
  expect(after).toEqual(before)
  await ui.unmount()
})

test('every summary chip opens the panel', TR, async $ => {
  for (const key of ['usage-open-level', 'usage-open-more']) {
    const ui = await $.ui.mount({ ...band(true), surface: 'desktop' })
    await ui.post({ chip: key }, { in: 'chips' })
    expect(await ui.find({ text: /SEVİYE/ })).toBeDefined()
    await ui.press({ key: 'usage-close' })
    await ui.unmount()
  }
})

test('a fresh session sleeps in camp until the first prompt', TR, async $ => {
  const ui = await $.ui.mount({ ...band(false), surface: 'desktop' })
  const svg = await arena(ui)
  expect(String((svg?.props as { source?: string } | undefined)?.source)).toContain('class="breath"')
  await ui.unmount()
})

test('the opened panel never makes the band scroll when it can avoid it', TR, async $ => {
  // Room for panel and scene: both stay.
  const roomy = await $.ui.mount({ ...band(true, 40, 120), surface: 'desktop' })
  await roomy.post({ chip: 'usage-open-more' }, { in: 'chips' })
  expect(await arena(roomy)).toBeDefined()
  await roomy.press({ key: 'usage-close' })
  await roomy.unmount()
  // A short band: the scene steps aside while the panel is open, and returns.
  const tight = await $.ui.mount({ ...band(true, 14, 120), surface: 'desktop' })
  await tight.post({ chip: 'usage-open-more' }, { in: 'chips' })
  expect(await arena(tight)).toBeUndefined()
  await tight.press({ key: 'usage-close' })
  expect(await arena(tight)).toBeDefined()
  await tight.unmount()
})

test('the band follows the language the person writes in', async () => {
  expect(detectLang('panele bir buton ekle ve yazıları büyüt')).toBe('tr')
  expect(detectLang('please add a button to the panel and make the text bigger')).toBe('en')
  expect(detectLang('ls -la')).toBeNull()
})

test('English labels when the band is in English', { options: { language: 'en' } }, async $ => {
  const ui = await $.ui.mount({ ...band(true), surface: 'desktop' })
  await ui.post({ chip: 'usage-open-more' }, { in: 'chips' })
  expect(await ui.find({ text: /CONTEXT/ })).toBeDefined()
  expect(await ui.find({ key: 'usage-close', text: /Back to battle/ })).toBeDefined()
  await ui.unmount()
})

test('the style chip switches the fight from blades to guns and back', TR, async $ => {
  const ui = await $.ui.mount({ ...band(true), surface: 'desktop' })
  const source = async () => String(((await arena(ui))?.props as { source?: string } | undefined)?.source)
  expect(await source()).not.toContain('class="mf"')
  await ui.post({ chip: 'usage-mode' }, { in: 'chips' })
  expect(await ui.find({ in: 'chips', text: /Uzak/ })).toBeDefined()
  expect(await source()).toContain('class="mf"')
  await ui.post({ chip: 'usage-mode' }, { in: 'chips' })
  expect(await ui.find({ in: 'chips', text: /Yakın/ })).toBeDefined()
  await ui.unmount()
})

test('a click anywhere inside a chip, border included, lands on that chip', async () => {
  const c = (key: string): Chip => ({ key, label: '', value: key, tone: 'claude', extra: null, fill: null, fillColor: null, clickable: true })
  const props = { rows: [[c('a'), c('b'), c('c'), c('d')], [c('e'), c('f'), c('g'), c('h')]], cols: 103 }
  // 103 cells, four chips of 25 with a one-cell gap: 0-24, 26-50, 52-76, 78-102.
  expect(chipAt(props, 103, 0, 0)?.key).toBe('a')
  expect(chipAt(props, 103, 24, 2)?.key).toBe('a')
  expect(chipAt(props, 103, 25, 1)).toBeNull()
  expect(chipAt(props, 103, 26, 1)?.key).toBe('b')
  expect(chipAt(props, 103, 102, 1)?.key).toBe('d')
  expect(chipAt(props, 103, 0, 3)?.key).toBe('e')
  expect(chipAt(props, 103, 90, 5)?.key).toBe('h')
  expect(chipAt(props, 103, 10, 6)).toBeNull()
})

test('clicking a chip on its border opens the panel', TR, async $ => {
  const ui = await $.ui.mount({ ...band(true, 30, 100), surface: 'desktop' })
  await ui.resize({ in: 'chips', columns: 100, rows: 6 })
  // Four chips on top, 24 cells each; this is the level chip's top border,
  // well clear of its text.
  await ui.pointer({ in: 'chips', type: 'down', x: 45, y: 0, button: 'left' })
  await ui.pointer({ in: 'chips', type: 'up', x: 45, y: 0, button: 'left' })
  expect(await ui.find({ text: /SEVİYE/ })).toBeDefined()
  await ui.unmount()
})

test('the state chip only shows, and the style chip only switches the style', TR, async $ => {
  const ui = await $.ui.mount({ ...band(true, 30, 100), surface: 'desktop' })
  await ui.resize({ in: 'chips', columns: 100, rows: 6 })
  // The state chip (cells 0-23): no panel.
  await ui.pointer({ in: 'chips', type: 'up', x: 5, y: 1, button: 'left' })
  expect(await ui.find({ text: /SEVİYE/ })).toBeUndefined()
  // The style chip (cells 50-73): the style changes, the panel stays shut.
  await ui.pointer({ in: 'chips', type: 'up', x: 60, y: 1, button: 'left' })
  expect(await ui.find({ in: 'chips', text: /Uzak/ })).toBeDefined()
  expect(await ui.find({ text: /SEVİYE/ })).toBeUndefined()
  await ui.unmount()
})

test('VS Code gets the smooth scene, button chips and the full panel', TR, async $ => {
  const ui = await $.ui.mount({ ...band(true, 40, 120), surface: 'vscode' })
  expect(await arena(ui)).toBeDefined()
  expect(await ui.find({ key: 'usage-open-more' })).toBeDefined()
  await ui.press({ key: 'usage-mode' })
  expect(await ui.find({ text: /Uzak/ })).toBeDefined()
  await ui.press({ key: 'usage-open-more' })
  expect(await ui.find({ key: 'wpn-select' })).toBeDefined()
  await ui.press({ key: 'usage-close' })
  await ui.unmount()
})

test('the terminal chips are buttons the keyboard can reach', TR, async $ => {
  const ui = await $.ui.mount({ ...band(true, 30, 120), surface: 'terminal' })
  expect(await ui.find({ type: 'Button', key: 'usage-open-more' })).toBeDefined()
  // The state chip is no button: there is nothing to press.
  expect(await ui.find({ type: 'Button', key: 'usage-state' })).toBeUndefined()
  await ui.press({ key: 'usage-open-more' })
  expect(await ui.find({ text: /SEVİYE/ })).toBeDefined()
  await ui.unmount()
})

test('the shared ledger keeps every computer whole and never loses kills', async () => {
  const a = mergeOwn(parseLedger(''), 'pc-a', 'Laptop', 100, 't1')
  expect(a.changed).toBe(true)
  const b = mergeOwn(a.ledger, 'pc-b', 'Desktop', 40, 't2')
  expect(othersKills(b.ledger, 'pc-a')).toBe(40)
  expect(othersKills(b.ledger, 'pc-b')).toBe(100)
  expect(machineCount(b.ledger, 'pc-a')).toBe(2)
  // A stale count from one computer never lowers what the gist holds.
  expect(mergeOwn(b.ledger, 'pc-a', 'Laptop', 90, 't3').changed).toBe(false)
  // Unreadable gist text is an empty ledger, not a crash.
  expect(parseLedger('{nope').machines).toEqual({})
})
