import type { Assignment, Chart, Guest, Proposal, Rule, Violation } from '@/domain/types'
import { findViolations, repair, solve } from '@/engine/solver'
import { presets } from '@/presets'

const violationCache = new WeakMap<Chart, Violation[]>()

/** findViolations memoized per chart object. Charts are immutable, so identity is a safe key. */
export function violationsOf(chart: Chart): Violation[] {
  let v = violationCache.get(chart)
  if (!v) violationCache.set(chart, (v = findViolations(chart)))
  return v
}

export type Severity = 'hard' | 'soft'

/** Worst severity per guest and per seatable, for highlighting. */
export function severities(violations: Violation[]) {
  const guests = new Map<string, Severity>()
  const seatables = new Map<string, Severity>()
  for (const v of violations) {
    const sev: Severity = v.hard ? 'hard' : 'soft'
    for (const id of v.guestIds) if (guests.get(id) !== 'hard') guests.set(id, sev)
    for (const id of v.seatableIds) if (seatables.get(id) !== 'hard') seatables.set(id, sev)
  }
  return { guests, seatables }
}

/** The demo preset the chart came from (by name), for the header switcher and its rule templates. Undefined for events made with "New event". */
export function presetOf(chart: Chart) {
  if (chart.id) return undefined
  return Object.values(presets).find((p) => p.chart.name === chart.name)
}

const NEED_SHORT: Record<Guest['needs'][number], string> = {
  wheelchair: 'wc',
  vegetarian: 'veg',
  vegan: 'vegan',
  allergy: 'allergy',
  kid: 'kid',
}

/** Compact party size and needs, e.g. "×2 wc veg". */
export const guestTags = (g: Guest) => [g.size > 1 ? `×${g.size}` : '', ...g.needs.map((n) => NEED_SHORT[n])].filter(Boolean).join(' ')

const NEED_ICON: Record<Guest['needs'][number], string> = {
  wheelchair: '♿',
  vegetarian: '🥕',
  vegan: '🌱',
  allergy: '⚠️',
  kid: '🧸',
}

/** Party size and needs as glyphs for the sidebar and import preview, e.g. "×2 ♿ 🥕". */
export const guestBadges = (g: Guest) => [g.size > 1 ? `×${g.size}` : '', ...g.needs.map((n) => NEED_ICON[n])].filter(Boolean).join(' ')

// Coral sits last: it is closest to the hard-violation red.
const TINTS = ['#a0d2ff', '#a8e6cf', '#cdb9f5', '#ffe08a', '#f9b4d9', '#c9dda0', '#ffcba4', '#9de3e8', '#d9c3a5', '#ffad9e']
const tintOf = new Map<string, string>()

/**
 * Pastel per guest group, so a family or team reads as one color on canvas and in the sidebar.
 * Groups get the next unused tint the first time they are seen, which keeps neighbours distinct (unlike hashing).
 */
export function groupTint(group: string | undefined) {
  if (!group) return '#dfe2ea'
  let t = tintOf.get(group)
  if (!t) tintOf.set(group, (t = TINTS[tintOf.size % TINTS.length]))
  return t
}

/** "Nino Beridze" -> "NB", for seat chips. */
export function initials(name: string) {
  const [first = '', last = ''] = name.split(' ')
  return (first[0] ?? '') + (last[0] ?? '')
}

/** "Nino Beridze" -> "Nino B." for labels on the canvas. */
export function shortName(name: string) {
  const [first, last] = name.split(' ')
  return last ? `${first} ${last[0]}.` : first
}

/** Guest ids whose seatable differs between two assignment lists (seated, unseated or moved). */
export function movedBetween(before: Assignment[], after: Assignment[]): string[] {
  const a = new Map(before.map((x) => [x.guestId, x.seatableId]))
  const b = new Map(after.map((x) => [x.guestId, x.seatableId]))
  return [...new Set([...a.keys(), ...b.keys()])].filter((id) => a.get(id) !== b.get(id))
}

/** Proposal for adding `rules`: minimal-move repair of the chart with those rules applied. Already-present rules are not re-added. */
export function ruleProposal(chart: Chart, rules: Rule[], explanation: string): Proposal {
  const known = new Set(chart.rules.map((r) => r.id))
  const fresh = rules.filter((r) => !known.has(r.id))
  const res = repair({ ...chart, rules: [...chart.rules, ...fresh] })
  return { assignments: res.assignments, rules: fresh, moved: res.moved, violations: res.violations, explanation }
}

/** Proposal that re-seats everyone from scratch (pins kept). */
export function solveProposal(chart: Chart): Proposal {
  const res = solve(chart)
  const left = res.unseated.length ? `, ${res.unseated.length} unseated` : ''
  return {
    assignments: res.assignments,
    rules: [],
    moved: movedBetween(chart.assignments, res.assignments),
    violations: res.violations,
    explanation: `Solved from scratch${left}`,
  }
}

/** Moved guests of a proposal with their from/to seatable labels, for move lists. */
export function movesOf(chart: Chart, proposal: Proposal) {
  const label = (id: string | undefined) => chart.seatables.find((s) => s.id === id)?.label ?? 'unseated'
  return proposal.moved.flatMap((id) => {
    const guest = chart.guests.find((g) => g.id === id)
    if (!guest) return []
    const from = label(chart.assignments.find((a) => a.guestId === id)?.seatableId)
    const to = label(proposal.assignments.find((a) => a.guestId === id)?.seatableId)
    return [{ guest, from, to }]
  })
}
