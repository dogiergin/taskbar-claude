// The summary bar as one drawn region: two even rows of bordered chips, each
// clickable anywhere inside its border, lit while the pointer is over it.
// A click posts the chip's key to the hooks module, which acts on it.

import type { ClientModule, RenderElement } from 'claude-code'

/** One chip, as the hooks module describes it. */
export type Chip = {
  key: string
  label: string
  value: string
  /** The border and value's color: a theme key or a hex color. */
  tone: string
  extra: string | null
  /** How full its gauge is, 0 to 1, drawn as a pie glyph; null for none. */
  fill: number | null
  fillColor: string | null
  /** False for a chip that only shows something: no hover, no click. */
  clickable: boolean
}

export type ChipsProps = { rows: Chip[][]; cols: number }

/** Rows of text each chip row takes: a border above and below its line. */
export const CHIP_ROW_HEIGHT = 3

type State = { hover: string | null; latest: { props: ChipsProps } }

const GAP = 1
const PIE = ['○', '◔', '◑', '◕', '●']

/** The width of each chip in a row of `n` across `cols` cells, gaps between. */
function chipWidth(cols: number, n: number): number {
  return Math.max(6, Math.floor((cols - GAP * (n - 1)) / Math.max(1, n)))
}

/** The chip under a cell of the region, if any. */
export function chipAt(props: ChipsProps, cols: number, x: number, y: number): Chip | null {
  const row = props.rows[Math.floor(y / CHIP_ROW_HEIGHT)]
  if (row === undefined || row.length === 0 || x < 0) return null
  const w = chipWidth(cols, row.length)
  const i = Math.floor(x / (w + GAP))
  // A click in the gap between two chips belongs to neither.
  if (x - i * (w + GAP) >= w) return null
  return row[i] ?? null
}

function glyph(fill: number): string {
  return PIE[Math.max(0, Math.min(4, Math.round(fill * 4)))] ?? '○'
}

const Chips: ClientModule<ChipsProps, State> = (props, s) => {
  const { Box, Text } = s.elements
  let state = s.state
  if (state === undefined) {
    const fresh: State = { hover: null, latest: { props } }
    state = fresh
    s.onPointer(ev => {
      const cols = s.columns || fresh.latest.props.cols
      const chip = chipAt(fresh.latest.props, cols, ev.fine?.x ?? ev.x, ev.fine?.y ?? ev.y)
      const target = chip !== null && chip.clickable ? chip : null
      const hover = ev.type === 'leave' ? null : (target?.key ?? null)
      if (hover !== fresh.hover) {
        fresh.hover = hover
        s.setState({ ...fresh })
      }
      if (ev.type === 'up' && (ev.button === undefined || ev.button === 'left') && target !== null) s.post({ chip: target.key })
    })
    s.setState(fresh)
  }
  // The pointer listener reads the props it was last drawn with.
  state.latest.props = props
  const cols = s.columns || props.cols

  const rows: RenderElement[] = props.rows.map((row, r) => {
    const w = chipWidth(cols, row.length)
    const cells = row.map(c => {
      const lit = state.hover === c.key
      const parts: RenderElement[] = []
      if (c.fill !== null) parts.push(Text({ color: c.fillColor ?? c.tone, children: `${glyph(c.fill)} ` }))
      if (c.label) parts.push(Text({ bold: true, color: 'subtle', children: `${c.label}  ` }))
      parts.push(Text({ bold: true, color: c.tone, children: c.value }))
      if (c.extra) parts.push(Text({ bold: true, color: 'text', children: `  ${c.extra}` }))
      return Box({
        key: c.key,
        width: w,
        borderStyle: 'round',
        borderColor: lit ? 'claude' : c.tone,
        paddingX: 1,
        children: Text({ wrap: 'truncate-end', children: parts }),
      })
    })
    return Box({ key: `row-${r}`, flexDirection: 'row', columnGap: GAP, children: cells })
  })
  return Box({ flexDirection: 'column', children: rows })
}

export default Chips
