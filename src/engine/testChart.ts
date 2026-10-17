import { z } from 'zod'
import { Chart, Seatable } from '@/domain/types'

type ChartInput = z.input<typeof Chart>
type GuestInput = Omit<ChartInput['guests'][number], 'name'> & { name?: string }
type TableInput = Partial<z.input<typeof Seatable>> & { id: string; seats: number }

/** Test helper: builds a Chart through the Zod schema so defaults apply. Names default to ids, tables to round at 0,0. */
export function makeChart(input: {
  guests: (string | GuestInput)[]
  tables: TableInput[]
  rules?: ChartInput['rules']
  assignments?: ChartInput['assignments']
}): Chart {
  return Chart.parse({
    kind: 'custom',
    name: 'test',
    guests: input.guests.map((g) => (typeof g === 'string' ? { id: g, name: g } : { name: g.id, ...g })),
    seatables: input.tables.map((t) => ({ kind: 'round', label: t.id, x: 0, y: 0, ...t })),
    rules: input.rules ?? [],
    assignments: input.assignments ?? [],
  })
}

/** guestId -> seatableId lookup for assertions. */
export const seats = (assignments: Chart['assignments']) => new Map(assignments.map((a) => [a.guestId, a.seatableId]))
