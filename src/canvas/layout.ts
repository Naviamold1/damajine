import { footprint, rotatedSize } from '@/domain/geometry'
import type { Assignment, Chart, Guest, Seatable } from '@/domain/types'

export type Point = { x: number; y: number }

/** Seat dot positions relative to the seatable center, unrotated. One entry per seat. */
export function seatOffsets(s: Pick<Seatable, 'kind' | 'seats'>): Point[] {
  const { w, h } = footprint(s)
  const n = s.seats
  const range = (count: number) => Array.from({ length: count }, (_, i) => i)
  const spread = (count: number, span: number, i: number) => -span / 2 + (span / count) * (i + 0.5)
  switch (s.kind) {
    case 'round':
      return range(n).map((i) => {
        const a = (i * 2 * Math.PI) / n - Math.PI / 2
        return { x: (w / 2 - 6) * Math.cos(a), y: (w / 2 - 6) * Math.sin(a) }
      })
    case 'rect': {
      const top = Math.ceil(n / 2)
      const bottom = n - top
      return [
        ...range(top).map((i) => ({ x: spread(top, w, i), y: -h / 2 + 3 })),
        ...range(bottom).map((i) => ({ x: spread(bottom, w, i), y: h / 2 - 3 })),
      ]
    }
    case 'booth': {
      const left = Math.ceil(n / 2)
      const right = n - left
      return [
        ...range(left).map((i) => ({ x: -w / 2 + 16, y: spread(left, h - 8, i) })),
        ...range(right).map((i) => ({ x: w / 2 - 16, y: spread(right, h - 8, i) })),
      ]
    }
    case 'row':
    case 'bar':
      return range(n).map((i) => ({ x: (i - (n - 1) / 2) * 30, y: -8 }))
    case 'zone':
      return range(n).map((i) => ({ x: (i - (n - 1) / 2) * 30, y: 2 }))
  }
}

/** Seatable-local point to canvas coordinates, honoring rotation (degrees). */
export function toCanvas(s: Pick<Seatable, 'x' | 'y' | 'rotation'>, p: Point): Point {
  const a = (s.rotation * Math.PI) / 180
  return { x: s.x + p.x * Math.cos(a) - p.y * Math.sin(a), y: s.y + p.x * Math.sin(a) + p.y * Math.cos(a) }
}

/** Topmost seatable whose footprint (plus margin) contains a canvas point. Used for guest drops. */
export function seatableAt(seatables: Seatable[], p: Point, margin = 12): Seatable | undefined {
  return seatables.findLast((s) => {
    const a = (-s.rotation * Math.PI) / 180
    const dx = p.x - s.x
    const dy = p.y - s.y
    const lx = dx * Math.cos(a) - dy * Math.sin(a)
    const ly = dx * Math.sin(a) + dy * Math.cos(a)
    const { w, h } = footprint(s)
    return Math.abs(lx) <= w / 2 + margin && Math.abs(ly) <= h / 2 + margin
  })
}

/** Bounding box of everything drawn, for fit-to-content. Null when the chart is empty. */
export function chartBounds(chart: Pick<Chart, 'seatables' | 'decor'>) {
  const boxes = [
    ...chart.seatables.map((s) => {
      const { w, h } = footprint(s)
      const r = Math.hypot(w, h) / 2
      return { x: s.x, y: s.y, w: r * 2, h: r * 2 }
    }),
    ...chart.decor.map((d) => ({ x: d.x, y: d.y, ...rotatedSize(d.w, d.h, d.rotation) })),
  ]
  if (boxes.length === 0) return null
  return {
    minX: Math.min(...boxes.map((b) => b.x - b.w / 2)),
    minY: Math.min(...boxes.map((b) => b.y - b.h / 2)),
    maxX: Math.max(...boxes.map((b) => b.x + b.w / 2)),
    maxY: Math.max(...boxes.map((b) => b.y + b.h / 2)),
  }
}

/** One occupied seat: the party it belongs to, and whether it is the party's first seat (where names attach). */
export type Slot = { guest: Guest; first: boolean }
/** seatableId -> per-seat occupancy. Length is max(seats, seats used), so overflow is visible. */
export type Layout = Map<string, (Slot | null)[]>

/**
 * Which seat index each guest occupies at their seatable. Guests with an explicit `seat` go there first (when it is
 * free). With `anchor` (the current layout), guests who stay keep their seats and newcomers fill free ones, so a
 * proposal does not shuffle the table.
 */
export function layoutSlots(chart: Chart, assignments: Assignment[], anchor?: Layout): Layout {
  const guests = new Map(chart.guests.filter((g) => g.attending).map((g) => [g.id, g]))
  const bySeatable = new Map<string, { g: Guest; seat?: number }[]>()
  for (const a of assignments) {
    const g = guests.get(a.guestId)
    if (g) bySeatable.set(a.seatableId, [...(bySeatable.get(a.seatableId) ?? []), { g, seat: a.seat }])
  }

  const layout: Layout = new Map()
  for (const s of chart.seatables) {
    const entries = bySeatable.get(s.id) ?? []
    const used = entries.reduce((n, e) => n + e.g.size, 0)
    const slots: (Slot | null)[] = Array.from({ length: Math.max(s.seats, used) }, () => null)
    const placed = new Set<string>()
    for (const { g, seat } of entries) {
      if (seat === undefined || seat + g.size > slots.length) continue
      const range = Array.from({ length: g.size }, (_, k) => seat + k)
      if (range.some((i) => slots[i])) continue
      range.forEach((i, k) => (slots[i] = { guest: g, first: k === 0 }))
      placed.add(g.id)
    }
    const here = entries.map((e) => e.g).filter((g) => !placed.has(g.id))
    const before = anchor?.get(s.id) ?? []
    const stay = here.filter((g) => before.some((x) => x?.guest.id === g.id))
    const fresh = here.filter((g) => !stay.includes(g))
    for (const g of stay) {
      before.forEach((x, i) => {
        if (x?.guest.id === g.id && i < slots.length && !slots[i]) slots[i] = { guest: g, first: x.first }
      })
    }
    for (const g of fresh) {
      for (let k = 0; k < g.size; k++) {
        const i = slots.indexOf(null)
        if (i >= 0) slots[i] = { guest: g, first: k === 0 }
      }
    }
    layout.set(s.id, slots)
  }
  return layout
}

/**
 * Assignments after dropping a guest on seat `seat` of `seatableId` (canvas drag). A party takes that seat and the
 * next ones, shifted left to fit. Whoever sits in those seats is unseated. Everyone else at the tables involved
 * keeps the seat they show in `layout`, so the rest of the table does not shuffle. Also returns who was unseated
 * and the first seat taken (for the drop preview). Null when the party is bigger than the table.
 */
export function seatAt(chart: Chart, layout: Layout, guestId: string, seatableId: string, seat: number) {
  const g = chart.guests.find((x) => x.id === guestId)
  const s = chart.seatables.find((x) => x.id === seatableId)
  if (!g || !s || g.size > s.seats) return null
  const start = Math.max(0, Math.min(seat, s.seats - g.size))
  const slots = layout.get(s.id) ?? []
  const evicted = new Set(
    Array.from({ length: g.size }, (_, k) => slots[start + k]?.guest.id).filter((id): id is string => id !== undefined && id !== guestId),
  )
  const from = chart.assignments.find((a) => a.guestId === guestId)
  const touched = new Set([s.id, from?.seatableId])
  const firstSeat = (a: Assignment) => (layout.get(a.seatableId) ?? []).findIndex((x) => x?.guest.id === a.guestId && x.first)
  const rest = chart.assignments
    .filter((a) => a.guestId !== guestId && !evicted.has(a.guestId))
    .map((a) => {
      const i = touched.has(a.seatableId) ? firstSeat(a) : -1
      return i >= 0 ? { ...a, seat: i } : a
    })
  return { assignments: [...rest, { guestId, seatableId: s.id, pinned: from?.pinned ?? false, seat: start }], evicted: [...evicted], start }
}

/** Canvas point of each guest's first seat, plus the outward direction for their name label. */
export function guestPoints(seatables: Seatable[], layout: Layout): Map<string, Point & { dir: Point }> {
  const out = new Map<string, Point & { dir: Point }>()
  for (const s of seatables) {
    const offsets = seatOffsets(s)
    layout.get(s.id)?.forEach((slot, i) => {
      const off = offsets[i]
      if (!slot?.first || !off || out.has(slot.guest.id)) return
      const p = toCanvas(s, off)
      const len = Math.hypot(off.x, off.y) || 1
      const d = toCanvas({ x: 0, y: 0, rotation: s.rotation }, { x: off.x / len, y: off.y / len })
      out.set(slot.guest.id, { ...p, dir: d })
    })
  }
  return out
}
