// What every scene is measured in, shared by the arena and its themes.

/** The scene's height in px. */
export const SVG_HEIGHT = 136
/** Where the ground starts, in px from the top. */
export const GROUND = 120

export const f = (n: number) => Number(n.toFixed(2))
export const f3 = (n: number) => Number(n.toFixed(3))

/** A fixed sequence, so the same inputs draw the same markup. */
export function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}
