import { describe, expect, it } from 'vitest'
import { Chart, type Seatable } from '@/domain/types'
import { footprint } from '@/domain/geometry'
import { presets } from '.'

function box(s: Seatable) {
  const { w, h } = footprint(s)
  return { left: s.x - w / 2, right: s.x + w / 2, top: s.y - h / 2, bottom: s.y + h / 2 }
}

describe.each(Object.entries(presets))('%s preset', (_, { chart }) => {
  it('parses through the Chart schema', () => {
    expect(Chart.parse(chart)).toEqual(chart)
  })

  it('has no overlapping seatables inside a 1200x800 canvas', () => {
    const boxes = chart.seatables.map((s) => ({ id: s.id, ...box(s) }))
    for (const b of boxes) {
      expect(b.left >= 0 && b.top >= 0 && b.right <= 1200 && b.bottom <= 800, b.id).toBe(true)
    }
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) {
        const overlap = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
        expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false)
      }
    }
  })

  it('only references ids that exist', () => {
    const guests = new Set(chart.guests.map((g) => g.id))
    const seatables = new Set(chart.seatables.map((s) => s.id))
    expect(guests.size).toBe(chart.guests.length)
    expect(chart.rules.flatMap((r) => r.guestIds).every((id) => guests.has(id))).toBe(true)
    expect(chart.assignments.every((a) => guests.has(a.guestId) && seatables.has(a.seatableId))).toBe(true)
  })
})
