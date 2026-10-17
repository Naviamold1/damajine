import type { Chart, Guest, Seatable, Violation } from '@/domain/types'

/**
 * Rules currently broken by the chart's assignments, plus overfull seatables.
 * Only attending guests assigned to an existing seatable count; unseated guests never violate.
 * Pure; used by the UI for highlighting and by the solver to report what is left.
 */
export function findViolations(chart: Chart): Violation[] {
  const guests = new Map(chart.guests.filter((g) => g.attending).map((g) => [g.id, g]))
  const seatables = new Map(chart.seatables.map((s) => [s.id, s]))
  const seatOf = new Map<string, Seatable>()
  for (const a of chart.assignments) {
    const seat = seatables.get(a.seatableId)
    if (guests.has(a.guestId) && seat && !seatOf.has(a.guestId)) seatOf.set(a.guestId, seat)
  }

  const name = (id: string) => guests.get(id)?.name ?? id
  const names = (ids: string[]) => ids.map(name).join(', ')
  /** Attending, seated members of a rule, deduped, in rule order. */
  const seated = (ids: string[]) => [...new Set(ids)].filter((id) => seatOf.has(id))

  const load = new Map<string, Guest[]>()
  for (const [gid, seat] of seatOf) {
    const g = guests.get(gid)
    if (g) load.set(seat.id, [...(load.get(seat.id) ?? []), g])
  }
  const people = (sid: string) => (load.get(sid) ?? []).reduce((n, g) => n + g.size, 0)

  const out: Violation[] = []
  for (const rule of chart.rules) {
    if (rule.type === 'balance') {
      const targets = balanceTargets(chart.seatables, [...guests.values()])
      // A whole person or more off the fair share; fractional shares (7.5) allow either neighbour (7 or 8).
      const off = chart.seatables.filter((s) => Math.abs(people(s.id) - (targets.get(s.id) ?? 0)) >= 1)
      if (off.length === 0) continue
      const counts = chart.seatables.map((s) => people(s.id))
      out.push({ ruleId: rule.id, kind: 'balance', hard: false, guestIds: [], seatableIds: off.map((s) => s.id), message: `Tables are uneven (${Math.min(...counts)} to ${Math.max(...counts)} people)` })
      continue
    }
    if (rule.type === 'maxPerTable') {
      const over = chart.seatables.filter((s) => people(s.id) > rule.max)
      if (over.length === 0) continue
      out.push({ ruleId: rule.id, kind: 'maxPerTable', hard: true, guestIds: over.flatMap((s) => (load.get(s.id) ?? []).map((g) => g.id)), seatableIds: over.map((s) => s.id), message: `${over.map((s) => s.label).join(', ')} ${over.length === 1 ? 'has' : 'have'} more than ${rule.max} people` })
      continue
    }
    const members = seated(rule.guestIds)
    switch (rule.type) {
      case 'apart': {
        const bySeat = groupBySeat(members, seatOf)
        const clashes = [...bySeat].filter(([, ids]) => ids.length > 1)
        if (clashes.length === 0) break
        const guestIds = clashes.flatMap(([, ids]) => ids)
        const seatableIds = clashes.map(([sid]) => sid)
        const where = clashes.map(([sid]) => seatables.get(sid)?.label ?? sid).join(', ')
        out.push({ ruleId: rule.id, kind: 'apart', hard: rule.hard, guestIds, seatableIds, message: `${names(guestIds)} should sit apart (${where})` })
        break
      }
      case 'together': {
        const bySeat = groupBySeat(members, seatOf)
        if (bySeat.size <= 1) break
        out.push({ ruleId: rule.id, kind: 'together', hard: rule.hard, guestIds: members, seatableIds: [...bySeat.keys()], message: `${names(members)} should sit together` })
        break
      }
      case 'zone': {
        const off = members.filter((id) => seatOf.get(id)?.zone !== rule.zone)
        if (off.length === 0) break
        out.push({ ruleId: rule.id, kind: 'zone', hard: rule.hard, guestIds: off, seatableIds: seatIds(off, seatOf), message: `${names(off)} should be in ${rule.zone}` })
        break
      }
      case 'accessible': {
        const off = members.filter((id) => !seatOf.get(id)?.accessible)
        if (off.length === 0) break
        out.push({ ruleId: rule.id, kind: 'accessible', hard: true, guestIds: off, seatableIds: seatIds(off, seatOf), message: `${names(off)} need${off.length === 1 ? 's' : ''} an accessible seat` })
        break
      }
    }
  }

  // Wheelchair users need an accessible seat even without an explicit rule.
  const covered = new Set(out.filter((v) => v.kind === 'accessible').flatMap((v) => v.guestIds))
  for (const [gid, seat] of seatOf) {
    const g = guests.get(gid)
    if (!g?.needs.includes('wheelchair') || seat.accessible || covered.has(gid)) continue
    out.push({ ruleId: null, kind: 'accessible', hard: true, guestIds: [gid], seatableIds: [seat.id], message: `${g.name} needs an accessible seat` })
  }

  for (const seat of chart.seatables) {
    const used = people(seat.id)
    if (used <= seat.seats) continue
    out.push({ ruleId: null, kind: 'capacity', hard: true, guestIds: (load.get(seat.id) ?? []).map((g) => g.id), seatableIds: [seat.id], message: `${seat.label} is over capacity (${used}/${seat.seats})` })
  }
  return out
}

/**
 * People each seatable should hold for a `balance` rule: everyone attending, spread in proportion to seats
 * (so a 10-seat table takes more than a 6-seat one). Shared by findViolations and the solver's cost.
 */
export function balanceTargets(seatables: Seatable[], attending: Guest[]): Map<string, number> {
  const seats = seatables.reduce((n, s) => n + s.seats, 0)
  const people = attending.reduce((n, g) => n + g.size, 0)
  const fill = seats ? Math.min(1, people / seats) : 0
  return new Map(seatables.map((s) => [s.id, s.seats * fill]))
}

/** seatableId -> member ids seated there, in first-seen order. */
function groupBySeat(ids: string[], seatOf: Map<string, Seatable>) {
  const bySeat = new Map<string, string[]>()
  for (const id of ids) {
    const sid = seatOf.get(id)?.id
    if (sid) bySeat.set(sid, [...(bySeat.get(sid) ?? []), id])
  }
  return bySeat
}

/** Distinct seatable ids of the given guests. */
function seatIds(ids: string[], seatOf: Map<string, Seatable>) {
  return [...new Set(ids.flatMap((id) => seatOf.get(id)?.id ?? []))]
}
