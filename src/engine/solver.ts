import type { Assignment, Chart, Violation } from '@/domain/types'
import { Seating } from './seating'
import { findViolations } from './violations'

export { findViolations }

export type SolveResult = {
  assignments: Chart['assignments']
  /** Attending guest ids that could not be seated. */
  unseated: string[]
  /** Violations remaining after the solve. */
  violations: Violation[]
}

/**
 * Seat every attending guest from scratch. Keeps pinned assignments; honors hard rules where possible.
 * Greedy placement of together-blocks (most constrained, largest first), then local search.
 */
export function solve(chart: Chart): SolveResult {
  const current = validAssignments(chart)
  const pins = current.filter((a) => a.pinned)
  const seating = new Seating(chart, new Set(pins.map((a) => a.guestId)))
  for (const a of pins) seating.place(a.guestId, a.seatableId)
  seating.placeUnseated()
  seating.improve('all')
  return result(chart, seating, pins)
}

/**
 * Fix broken rules or seat late arrivals while moving as few guests as possible.
 * Only guests in a violation (or unseated) move, plus swap partners when a swap is cheapest. Pinned guests never move.
 * Returns the new assignments plus the guest ids that moved (newly seated and newly unseated included).
 */
export function repair(chart: Chart): SolveResult & { moved: string[] } {
  const current = validAssignments(chart)
  const original = new Map(current.map((a) => [a.guestId, a.seatableId]))
  const pins = current.filter((a) => a.pinned)
  const seating = new Seating(chart, new Set(pins.map((a) => a.guestId)), original)
  for (const a of current) seating.place(a.guestId, a.seatableId)
  seating.evictOverflow()
  seating.placeUnseated()
  seating.improve('violating')

  const out = result(chart, seating, pins)
  const moved = [...seating.guests.keys()].filter((id) => seating.seatOf.get(id) !== original.get(id))
  return { ...out, moved }
}

/** Current assignments that still make sense: attending guest, existing seatable, first entry per guest. */
function validAssignments(chart: Chart): Assignment[] {
  const attending = new Set(chart.guests.filter((g) => g.attending).map((g) => g.id))
  const seatables = new Set(chart.seatables.map((s) => s.id))
  const seen = new Set<string>()
  return chart.assignments.filter((a) => {
    if (!attending.has(a.guestId) || !seatables.has(a.seatableId) || seen.has(a.guestId)) return false
    seen.add(a.guestId)
    return true
  })
}

/** Assignments in guest order, unseated ids, and the violations left in the resulting chart. */
function result(chart: Chart, seating: Seating, pins: Assignment[]): SolveResult {
  const pinned = new Set(pins.map((a) => a.guestId))
  const assignments: Assignment[] = []
  const unseated: string[] = []
  for (const g of chart.guests) {
    if (!seating.guests.has(g.id)) continue
    const seatableId = seating.seatOf.get(g.id)
    if (seatableId) assignments.push({ guestId: g.id, seatableId, pinned: pinned.has(g.id) })
    else unseated.push(g.id)
  }
  return { assignments, unseated, violations: findViolations({ ...chart, assignments }) }
}
