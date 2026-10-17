import type { z } from 'zod'
import type { Chart, Guest } from '@/domain/types'
import { solve } from '@/engine/solver'

type GuestInput = z.input<typeof Guest>

/** Stable id from a name: "Nino Beridze" -> "nino-beridze". Preset ids are referenced by the demo cache. */
export const slug = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Preset guest shorthand: `guest('Nino Beridze', { group: 'Bride family' })`. */
export const guest = (name: string, rest: Omit<GuestInput, 'id' | 'name'> = {}): GuestInput => ({
  id: slug(name),
  name,
  ...rest,
})

/**
 * Preset starting state: everyone seated by the solver except late arrivals (tag `late` or `walk-in`),
 * so a demo rule shows a small diff instead of seating the whole room.
 * The solver packs tightly; here we first cap every seatable at the room's fill ratio (plus one) so
 * guests spread across tables, and fall back to a normal solve if the cap leaves anyone unseated.
 */
export function seeded(chart: Chart): Chart {
  const late = (g: Guest) => g.tags.includes('late') || g.tags.includes('walk-in')
  const base = { ...chart, guests: chart.guests.filter((g) => !late(g)) }
  const people = base.guests.filter((g) => g.attending).reduce((n, g) => n + g.size, 0)
  const ratio = people / chart.seatables.reduce((n, s) => n + s.seats, 0)
  const capped = solve({ ...base, seatables: base.seatables.map((s) => ({ ...s, seats: Math.min(s.seats, Math.ceil(s.seats * ratio) + 1) })) })
  const { assignments } = capped.unseated.length === 0 ? capped : solve(base)
  return { ...chart, assignments }
}
