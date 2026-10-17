import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { Chart } from '@/domain/types'
import { footprint } from '@/domain/geometry'
import { demoCache, demoKey } from '@/ai/demoCache'
import { validateRules } from '@/ai/rules'
import { presets } from '.'

type Box = { id: string; left: number; right: number; top: number; bottom: number }

/** Axis-aligned box around a center point. */
const box = (id: string, x: number, y: number, { w, h }: { w: number; h: number }): Box => ({
  id,
  left: x - w / 2,
  right: x + w / 2,
  top: y - h / 2,
  bottom: y + h / 2,
})

/** Shape of a cached rules response, enough to validate it against the chart. */
const CachedRules = z.object({
  rules: z.array(
    z.object({
      type: z.enum(['apart', 'together', 'zone', 'accessible']),
      guestIds: z.array(z.string()),
      zone: z.string().optional(),
      hard: z.boolean().optional(),
    }),
  ),
})

const inCanvas = (b: Box) => b.left >= 0 && b.top >= 0 && b.right <= 1200 && b.bottom <= 800
const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

describe.each(Object.entries(presets))('%s preset', (_, { chart, ruleTemplates }) => {
  it('parses through the Chart schema', () => {
    expect(Chart.parse(chart)).toEqual(chart)
  })

  it('has no overlapping seatables inside a 1200x800 canvas', () => {
    const boxes = chart.seatables.map((s) => box(s.id, s.x, s.y, footprint(s)))
    for (const b of boxes) expect(inCanvas(b), b.id).toBe(true)
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) expect(overlaps(a, b), `${a.id} overlaps ${b.id}`).toBe(false)
    }
  })

  it('keeps decor inside the canvas and clear of seatables', () => {
    const seatables = chart.seatables.map((s) => box(s.id, s.x, s.y, footprint(s)))
    expect(new Set(chart.decor.map((d) => d.id)).size).toBe(chart.decor.length)
    for (const d of chart.decor) {
      const b = box(d.id, d.x, d.y, d)
      expect(inCanvas(b), d.id).toBe(true)
      for (const s of seatables) expect(overlaps(b, s), `${d.id} overlaps ${s.id}`).toBe(false)
    }
  })

  it('has cached rule templates that reference real guests and zones', () => {
    for (const text of ruleTemplates) {
      const cached = demoCache.get(demoKey('rules', text))
      if (cached === undefined) continue
      expect(() => validateRules(CachedRules.parse(cached).rules, chart), text).not.toThrow()
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
