import { isGuestRule, minGuests, type Assignment, type Chart, type Rule } from './types'

/**
 * Pure chart edits shared by the store (human edits) and AI actions, so both clean up the same way.
 */

/** Drop guests with their seats, and take them out of rules (rules left with too few guests go too). */
export function removeGuests(chart: Chart, ids: Set<string>): Chart {
  const rules = chart.rules.flatMap((r): Rule[] => {
    if (!isGuestRule(r)) return [r]
    const guestIds = r.guestIds.filter((id) => !ids.has(id))
    return guestIds.length >= minGuests(r.type) ? [{ ...r, guestIds }] : []
  })
  return {
    ...chart,
    guests: chart.guests.filter((g) => !ids.has(g.id)),
    assignments: chart.assignments.filter((a) => !ids.has(a.guestId)),
    rules,
  }
}

/** Guest ids whose seatable differs between two assignment lists (seated, unseated or moved). */
export function movedBetween(before: Assignment[], after: Assignment[]): string[] {
  const a = new Map(before.map((x) => [x.guestId, x.seatableId]))
  const b = new Map(after.map((x) => [x.guestId, x.seatableId]))
  return [...new Set([...a.keys(), ...b.keys()])].filter((id) => a.get(id) !== b.get(id))
}

/** Drop seatables; their guests become unseated. */
export function removeSeatables(chart: Chart, ids: Set<string>): Chart {
  return {
    ...chart,
    seatables: chart.seatables.filter((s) => !ids.has(s.id)),
    assignments: chart.assignments.filter((a) => !ids.has(a.seatableId)),
  }
}
