import type { Seatable, SeatableKind } from './types'

/**
 * Canvas footprint of a seatable in canvas units (unrotated). Shared by the canvas renderer
 * and the preset layout test so drawn sizes and overlap checks agree.
 */
export function footprint(s: Pick<Seatable, 'kind' | 'seats'>): { w: number; h: number } {
  switch (s.kind) {
    case 'round':
      return { w: 120, h: 120 }
    case 'rect':
      return { w: Math.max(120, s.seats * 25), h: 50 }
    case 'booth':
      return { w: 100, h: 60 }
    default:
      return { w: Math.max(40, s.seats * 30), h: 40 }
  }
}

/** Axis-aligned size of a w x h box rotated by `deg` degrees. Used for bounds, placement and the selection toolbar. */
export function rotatedSize(w: number, h: number, deg = 0) {
  const a = (deg * Math.PI) / 180
  const c = Math.abs(Math.cos(a))
  const s = Math.abs(Math.sin(a))
  return { w: w * c + h * s, h: w * s + h * c }
}

/** Seats a new table of each kind starts with (Add dock, AI `addTable`). */
export const DEFAULT_SEATS: Record<SeatableKind, number> = { round: 8, rect: 8, booth: 4, row: 8, bar: 6, zone: 6 }

const PREFIX: Record<SeatableKind, string> = { round: 'T', rect: 'T', booth: 'B', row: 'Row ', bar: 'Bar ', zone: 'Zone ' }

/**
 * Next label for a new seatable of `kind`, following the room's own numbering: after "Table 1".."Table 8" comes
 * "Table 9", after "B1", "B2" comes "B3". Rooms with no numbered seatables of a similar kind start at "T1", "Bar 1".
 */
export function nextLabel(seatables: Pick<Seatable, 'kind' | 'label'>[], kind: SeatableKind): string {
  const numbered = seatables
    .filter((s) => PREFIX[s.kind] === PREFIX[kind])
    .flatMap((s) => {
      const m = s.label.match(/^(.*?)(\d+)$/)
      return m ? [{ prefix: m[1], n: Number(m[2]) }] : []
    })
  const counts = new Map<string, number>()
  for (const { prefix } of numbered) counts.set(prefix, (counts.get(prefix) ?? 0) + 1)
  const prefix = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? PREFIX[kind]
  const taken = new Set(seatables.map((s) => s.label))
  let n = Math.max(0, ...numbered.filter((x) => x.prefix === prefix).map((x) => x.n)) + 1
  while (taken.has(`${prefix}${n}`)) n++
  return `${prefix}${n}`
}
