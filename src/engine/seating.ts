import { isGuestRule, type Chart, type Guest, type GuestRule, type RoomRule, type Seatable } from '@/domain/types'
import { balanceTargets } from './violations'

/** Cost weights. Hard rules dominate; leaving a guest unseated beats breaking a hard rule. */
const HARD = 1000
const UNSEATED = 200
const SOFT = 10
const GROUP_BONUS = 1
/**
 * `balance`: per squared person off a table's fair share. As strong as a soft rule, so evening out a table beats
 * the move cost plus splitting a group from its tablemates.
 */
const BALANCE = SOFT
/** Repair only: cost of moving a guest off their original seatable. Bigger parties cost more. */
const moveCost = (g: Guest) => 5 + g.size

const MAX_PASSES = 40

/**
 * Mutable seating state plus the score the solver minimizes.
 * `solve` and `repair` both drive it: seed, place unseated guests greedily, then `improve`.
 * When `original` is given (repair), moving a guest off their original seatable is penalized.
 */
export class Seating {
  readonly guests: Map<string, Guest>
  readonly seatables: Seatable[]
  readonly seatOf = new Map<string, string>()
  private readonly byId: Map<string, Seatable>
  private readonly load = new Map<string, number>()
  private readonly groups = new Map<string, Map<string, number>>()
  private readonly rules: GuestRule[]
  private readonly rulesOf = new Map<string, GuestRule[]>()
  /** `balance` / `maxPerTable`: scored per table, not per guest. */
  private readonly roomRules: RoomRule[]
  /** Fair share of people per seatable, for `balance`. */
  private readonly targets: Map<string, number>
  private readonly pinned: Set<string>
  private readonly original: Map<string, string> | undefined
  /** Restaurant: a party gets its own table (bars stay shared). */
  private readonly exclusive: boolean
  /** Together-blocks of unpinned guests, moved as one unit. */
  readonly units: string[][]

  constructor(chart: Chart, pinned: Set<string>, original?: Map<string, string>) {
    const attending = chart.guests.filter((g) => g.attending).sort(byId)
    this.guests = new Map(attending.map((g) => [g.id, g]))
    this.seatables = [...chart.seatables].sort(byId)
    this.byId = new Map(this.seatables.map((s) => [s.id, s]))
    this.pinned = pinned
    this.original = original
    this.exclusive = chart.kind === 'restaurant'

    // Keep only attending members; wheelchair users get an implicit accessible rule.
    const needs: GuestRule[] = attending
      .filter((g) => g.needs.includes('wheelchair'))
      .map((g) => ({ id: `need:${g.id}`, type: 'accessible' as const, guestIds: [g.id] }))
    this.rules = [...chart.rules.filter(isGuestRule), ...needs].map((r) => ({ ...r, guestIds: [...new Set(r.guestIds)].filter((id) => this.guests.has(id)) }))
    for (const r of this.rules) for (const id of r.guestIds) this.rulesOf.set(id, [...(this.rulesOf.get(id) ?? []), r])
    this.roomRules = chart.rules.filter((r): r is RoomRule => !isGuestRule(r))
    this.targets = balanceTargets(this.seatables, attending)

    this.units = this.buildUnits(chart)
  }

  /** Union-find over `together` rules; blocks too big for any seatable fall back to singles. */
  private buildUnits(chart: Chart): string[][] {
    const parent = new Map<string, string>()
    const find = (id: string): string => {
      const p = parent.get(id) ?? id
      if (p === id) return id
      const root = find(p)
      parent.set(id, root)
      return root
    }
    for (const r of chart.rules) {
      if (r.type !== 'together') continue
      const ids = r.guestIds.filter((id) => this.guests.has(id) && !this.pinned.has(id)).sort()
      for (const id of ids.slice(1)) {
        const [a, b] = [find(ids[0]), find(id)].sort()
        parent.set(b, a)
      }
    }
    const blocks = new Map<string, string[]>()
    for (const id of this.guests.keys()) {
      if (this.pinned.has(id)) continue
      const root = find(id)
      blocks.set(root, [...(blocks.get(root) ?? []), id])
    }
    const maxSeats = Math.max(0, ...this.seatables.map((s) => s.seats))
    return [...blocks.values()].flatMap((ids) => (this.size(ids) > maxSeats && ids.length > 1 ? ids.map((id) => [id]) : [ids]))
  }

  size(ids: string[]) {
    return ids.reduce((n, id) => n + (this.guests.get(id)?.size ?? 0), 0)
  }

  /** Seat a guest (or unseat with `undefined`), keeping load and group counts in sync. */
  place(id: string, sid: string | undefined) {
    const g = this.guests.get(id)
    if (!g) return
    const prev = this.seatOf.get(id)
    if (prev === sid) return
    if (prev) this.bump(prev, g, -1)
    if (sid) {
      this.seatOf.set(id, sid)
      this.bump(sid, g, 1)
    } else this.seatOf.delete(id)
  }

  private bump(sid: string, g: Guest, dir: 1 | -1) {
    this.load.set(sid, (this.load.get(sid) ?? 0) + dir * g.size)
    if (!g.group) return
    const counts = this.groups.get(sid) ?? new Map<string, number>()
    counts.set(g.group, (counts.get(g.group) ?? 0) + dir)
    this.groups.set(sid, counts)
  }

  free(sid: string) {
    return (this.byId.get(sid)?.seats ?? 0) - (this.load.get(sid) ?? 0)
  }

  /** Whether `ids` can move to `sid` without overfilling it (or, in a restaurant, sharing it with another party). */
  fits(ids: string[], sid: string) {
    return this.size(ids.filter((id) => this.seatOf.get(id) !== sid)) <= this.free(sid) && !this.taken(sid, ids)
  }

  /** Restaurant only: someone other than `ids` already sits at this non-bar table. */
  private taken(sid: string, ids: string[]) {
    if (!this.exclusive || this.byId.get(sid)?.kind === 'bar') return false
    const own = this.size(ids.filter((id) => this.seatOf.get(id) === sid))
    return (this.load.get(sid) ?? 0) - own > 0
  }

  /** Room rule cost of the given seatables (duplicates and undefined ignored). */
  private tableCost(sids: (string | undefined)[]) {
    let cost = 0
    for (const sid of new Set(sids)) {
      if (!sid) continue
      const n = this.load.get(sid) ?? 0
      for (const r of this.roomRules) {
        if (r.type === 'balance') cost += BALANCE * (n - (this.targets.get(sid) ?? 0)) ** 2
        else cost += HARD * Math.max(0, n - r.max)
      }
    }
    return cost
  }

  /** Whether a seatable breaks a room rule the way findViolations reports it (balance: a whole person or more off its share). */
  private tableViolates(sid: string | undefined) {
    if (!sid) return false
    const n = this.load.get(sid) ?? 0
    return this.roomRules.some((r) => (r.type === 'balance' ? Math.abs(n - (this.targets.get(sid) ?? 0)) >= 1 : n > r.max))
  }

  private ruleCost(rule: GuestRule): number {
    const seats = rule.guestIds.flatMap((id) => this.seatOf.get(id) ?? [])
    const weight = rule.type === 'accessible' || rule.hard ? HARD : SOFT
    switch (rule.type) {
      case 'apart': {
        const counts = new Map<string, number>()
        for (const s of seats) counts.set(s, (counts.get(s) ?? 0) + 1)
        let pairs = 0
        for (const c of counts.values()) pairs += (c * (c - 1)) / 2
        return pairs * weight
      }
      case 'together':
        return Math.max(0, new Set(seats).size - 1) * weight
      case 'zone':
        return seats.filter((s) => this.byId.get(s)?.zone !== rule.zone).length * weight
      case 'accessible':
        return seats.filter((s) => !this.byId.get(s)?.accessible).length * weight
    }
  }

  /** Rule cost touching any of `ids`. Positive means the guest is part of a violation. */
  violationCost(ids: string[]) {
    const rules = new Set(ids.flatMap((id) => this.rulesOf.get(id) ?? []))
    let cost = 0
    for (const r of rules) cost += this.ruleCost(r)
    return cost
  }

  /** Score of everything `ids` can affect. Comparing it before and after a change gives the delta. */
  private localCost(ids: string[]) {
    let cost = this.violationCost(ids)
    for (const id of ids) {
      const g = this.guests.get(id)
      const sid = this.seatOf.get(id)
      if (!g) continue
      if (!sid) {
        cost += UNSEATED
        continue
      }
      if (g.group) cost -= GROUP_BONUS * ((this.groups.get(sid)?.get(g.group) ?? 1) - 1)
      const from = this.original?.get(id)
      if (from && from !== sid) cost += moveCost(g)
    }
    return cost
  }

  /** Cost change if each guest in `ids` were moved to `to[i]`. Leaves the state unchanged. */
  private delta(ids: string[], to: (string | undefined)[]) {
    const prev = ids.map((id) => this.seatOf.get(id))
    const touched = [...prev, ...to]
    const before = this.localCost(ids) + this.tableCost(touched)
    ids.forEach((id, i) => this.place(id, to[i]))
    const after = this.localCost(ids) + this.tableCost(touched)
    ids.forEach((id, i) => this.place(id, prev[i]))
    return after - before
  }

  /** Best seatable for `ids` together (improving the score), or undefined. Ties go to the tightest fit, then id. */
  private bestTarget(ids: string[]) {
    let best: { sid: string; d: number; slack: number } | undefined
    for (const s of this.seatables) {
      if (ids.every((id) => this.seatOf.get(id) === s.id) || !this.fits(ids, s.id)) continue
      const d = this.delta(ids, ids.map(() => s.id))
      const slack = this.free(s.id) - this.size(ids)
      if (d < 0 && (!best || d < best.d || (d === best.d && slack < best.slack))) best = { sid: s.id, d, slack }
    }
    return best
  }

  /** Greedy: seat each unit's unseated members, most constrained and largest first. */
  placeUnseated() {
    const order = [...this.units].sort((a, b) => this.priority(b) - this.priority(a) || cmp(this.groupKey(a), this.groupKey(b)) || cmp(a[0], b[0]))
    for (const unit of order) {
      const todo = unit.filter((id) => !this.seatOf.has(id))
      if (todo.length === 0) continue
      const target = this.bestTarget(todo)
      if (target) todo.forEach((id) => this.place(id, target.sid))
      else if (todo.length > 1) for (const id of todo) {
        const t = this.bestTarget([id])
        if (t) this.place(id, t.sid)
      }
    }
  }

  /** Placement difficulty: seat-restricting rules weigh most, then party size, then rule count. */
  private priority(ids: string[]) {
    const rules = ids.flatMap((id) => this.rulesOf.get(id) ?? [])
    const restricted = rules.some((r) => r.type === 'accessible' || (r.type === 'zone' && r.hard)) ? 1 : 0
    return restricted * 10_000 + this.size(ids) * 100 + rules.length
  }

  private groupKey(ids: string[]) {
    return this.guests.get(ids[0])?.group ?? '￿'
  }

  /**
   * Local search with unit moves and swaps.
   * `scope: 'all'` (solve) tries every unit, first improvement per unit.
   * `scope: 'violating'` (repair) only moves units in a violation or unseated, applying the single best change per step
   * so the fewest, smallest moves win.
   */
  improve(scope: 'all' | 'violating') {
    // Movers: whole together-units, plus members on their own for units that need splitting.
    const movers = [...this.units, ...this.units.filter((u) => u.length > 1).flatMap((u) => u.map((id) => [id]))]
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      let best: { d: number; apply: () => void } | undefined
      let improved = false
      for (const mover of movers) {
        const violating = mover.some((id) => !this.seatOf.has(id)) || this.violationCost(mover) > 0 || this.tableViolates(this.homeOf(mover))
        if (scope === 'violating' && !violating) continue
        const option = this.bestOption(mover, violating ? movers : [])
        if (!option) continue
        if (scope === 'all') {
          option.apply()
          improved = true
        } else if (!best || option.d < best.d) best = option
      }
      if (best) best.apply()
      if (!best && !improved) return
    }
  }

  /** Best improving move of `mover` to another seatable, or swap with one of `partners`. */
  private bestOption(mover: string[], partners: string[][]) {
    let best: { d: number; apply: () => void } | undefined
    const target = this.bestTarget(mover)
    if (target) best = { d: target.d, apply: () => mover.forEach((id) => this.place(id, target.sid)) }

    const a = this.homeOf(mover)
    if (!a) return best
    const sizeA = this.size(mover)
    for (const other of partners) {
      const b = this.homeOf(other)
      if (!b || b === a) continue
      const sizeB = this.size(other)
      if (this.free(a) + sizeA < sizeB || this.free(b) + sizeB < sizeA) continue
      if (this.taken(a, [...mover, ...other]) || this.taken(b, [...mover, ...other])) continue
      const ids = [...mover, ...other]
      const d = this.delta(ids, [...mover.map(() => b), ...other.map(() => a)])
      if (d < 0 && (!best || d < best.d)) {
        best = {
          d,
          apply: () => {
            mover.forEach((id) => this.place(id, b))
            other.forEach((id) => this.place(id, a))
          },
        }
      }
    }
    return best
  }

  /** The single seatable all of `ids` sit at, if any. */
  private homeOf(ids: string[]) {
    const sid = this.seatOf.get(ids[0])
    return sid && ids.every((id) => this.seatOf.get(id) === sid) ? sid : undefined
  }

  /**
   * Repair only: unseat unpinned guests from overfull seatables so the rest fits again.
   * Prefers guests already in a violation, then the smallest party that clears the overflow, then smallest parties.
   */
  evictOverflow() {
    for (const s of this.seatables) {
      let over = -this.free(s.id)
      if (over <= 0) continue
      const here = [...this.seatOf].filter(([id, sid]) => sid === s.id && !this.pinned.has(id)).map(([id]) => id)
      const rank = (id: string) => {
        const size = this.guests.get(id)?.size ?? 0
        return [this.violationCost([id]) > 0 ? 0 : 1, size >= over ? 0 : 1, size] as const
      }
      while (over > 0 && here.length > 0) {
        here.sort((x, y) => {
          const [rx, ry] = [rank(x), rank(y)]
          return rx[0] - ry[0] || rx[1] - ry[1] || rx[2] - ry[2] || cmp(x, y)
        })
        const id = here.shift()
        if (!id) break
        over -= this.guests.get(id)?.size ?? 0
        this.place(id, undefined)
      }
    }
  }
}

/** Plain code-unit comparison: locale-independent, so results are identical everywhere. */
export const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
const byId = <T extends { id: string }>(a: T, b: T) => cmp(a.id, b.id)
