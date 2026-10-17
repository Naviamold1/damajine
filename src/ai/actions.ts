import { z } from 'zod'
import { removeGuests, removeSeatables, movedBetween } from '@/domain/edits'
import { DEFAULT_SEATS, footprint, nextLabel, rotatedSize } from '@/domain/geometry'
import { Guest, GuestNeed, Rule, SeatableKind, minGuests, type Chart, type Decor, type Proposal, type Seatable } from '@/domain/types'
import { findViolations, repair, solve } from '@/engine/solver'
import { slug } from '@/presets/build'
import { callGemini } from './client'
import { findAmbiguousNames, matchGuest } from './match'
import { chartZones, describeRule, parseRulesOffline, ruleId, type Candidates } from './rules'

/**
 * Plain language -> a plan of typed actions -> one proposal. Gemini picks actions from the menu below;
 * `applyActions` validates each against the chart and applies it to a copy (a bad action is skipped with a
 * reason, the rest still apply); `planProposal` lets the solver reseat around the result. Nothing here touches the store.
 */

export const ACTION_TYPES = [
  // Rules (the solver keeps them from now on)
  'apart', 'together', 'zone', 'accessible', 'balance', 'maxPerTable', 'removeRule',
  // Seating
  'seat', 'unseat', 'pin', 'unpin', 'reseat',
  // Tables
  'addTable', 'updateTable', 'removeTable',
  // Guests
  'addGuest', 'updateGuest', 'removeGuest',
  // Room features
  'addDecor', 'updateDecor', 'removeDecor',
  // Questions
  'answer',
] as const

/** Action fields with the descriptions Gemini sees. Each action below picks the ones it uses. */
const F = {
  guestIds: z.array(z.string()).describe('Guest ids'),
  tableIds: z.array(z.string()).describe('Table ids'),
  tableId: z.string().describe('Table id, or the label of a table added earlier in this plan'),
  decorId: z.string().describe('Room feature id'),
  ruleId: z.string().describe('Rule id'),
  zone: z.string().describe('Zone tag that zone rules match, like near-stage. Never a table name'),
  hard: z.boolean().describe('true = must, false = only a preference'),
  max: z.number().describe('Most people allowed at any table'),
  pin: z.boolean().describe('Lock them at that table'),
  kind: SeatableKind,
  label: z.string().describe('Display name, like "Kids table" or "VIP". Use this to rename'),
  seats: z.number().describe('Number of seats'),
  accessible: z.boolean().describe('Step-free, wheelchair friendly'),
  rotation: z.number().describe('Degrees'),
  near: z.string().describe('Id of the table or room feature to place it next to'),
  x: z.number().describe('Exact x, only when asked for a position'),
  y: z.number().describe('Exact y, only when asked for a position'),
  w: z.number().describe('Width'),
  h: z.number().describe('Height'),
  name: z.string().describe('Full name'),
  size: z.number().describe('Party size: seats this entry takes'),
  group: z.string(),
  needs: z.array(GuestNeed),
  tags: z.array(z.string()),
  attending: z.boolean().describe('false = cancelled, not coming'),
  text: z.string().describe('The answer, from the chart data only'),
}

const act = <T extends string, S extends z.ZodRawShape>(type: T, shape: S) => z.object({ type: z.literal(type), ...shape })

/**
 * The action menu Gemini answers with: one small object per type, essentials required (Gemini fills a union of
 * small schemas far more reliably than one flat object of optional fields). References are ids, but `applyActions`
 * also accepts names and labels.
 */
export const Action = z.discriminatedUnion('type', [
  act('apart', { guestIds: F.guestIds, hard: F.hard.optional() }),
  act('together', { guestIds: F.guestIds, hard: F.hard.optional() }),
  act('zone', { guestIds: F.guestIds, zone: F.zone, hard: F.hard.optional() }),
  act('accessible', { guestIds: F.guestIds }),
  act('balance', {}),
  act('maxPerTable', { max: F.max }),
  act('removeRule', { ruleId: F.ruleId }),
  act('seat', { guestIds: F.guestIds, tableId: F.tableId, pin: F.pin.optional() }),
  act('unseat', { guestIds: F.guestIds }),
  act('pin', { guestIds: F.guestIds }),
  act('unpin', { guestIds: F.guestIds }),
  act('reseat', {}),
  // No `zone` on table actions: the model confused it with `label` when renaming. Zones come from the presets.
  act('addTable', { kind: F.kind, seats: F.seats, label: F.label.optional(), near: F.near.optional(), accessible: F.accessible.optional(), rotation: F.rotation.optional(), x: F.x.optional(), y: F.y.optional() }),
  // No x/y either: the model copied the current position into them instead of filling `label`.
  act('updateTable', { tableIds: F.tableIds, seats: F.seats.optional(), label: F.label.optional(), accessible: F.accessible.optional(), rotation: F.rotation.optional(), kind: F.kind.optional() }),
  act('removeTable', { tableIds: F.tableIds }),
  act('addGuest', { name: F.name, size: F.size.optional(), group: F.group.optional(), needs: F.needs.optional(), tags: F.tags.optional(), tableId: F.tableId.optional(), pin: F.pin.optional() }),
  act('updateGuest', { guestIds: F.guestIds, attending: F.attending.optional(), name: F.name.optional(), size: F.size.optional(), group: F.group.optional(), needs: F.needs.optional(), tags: F.tags.optional() }),
  act('removeGuest', { guestIds: F.guestIds }),
  act('addDecor', { label: F.label, w: F.w.optional(), h: F.h.optional(), near: F.near.optional(), rotation: F.rotation.optional(), x: F.x.optional(), y: F.y.optional() }),
  act('updateDecor', { decorId: F.decorId, label: F.label.optional(), w: F.w.optional(), h: F.h.optional(), rotation: F.rotation.optional(), x: F.x.optional(), y: F.y.optional() }),
  act('removeDecor', { decorId: F.decorId }),
  act('answer', { text: F.text }),
])
export type Action = z.infer<typeof Action>

/**
 * Any action, flattened: `type` plus every field optional. `applyActions` works on this so Gemini's actions, cached
 * plans and offline rules share one path; every `Action` variant is assignable to it.
 */
export const ActionDraft = z.object({
  type: z.enum(ACTION_TYPES),
  guestIds: F.guestIds.optional(), tableIds: F.tableIds.optional(), tableId: F.tableId.optional(), decorId: F.decorId.optional(),
  ruleId: F.ruleId.optional(), zone: F.zone.optional(), hard: F.hard.optional(), max: F.max.optional(), pin: F.pin.optional(),
  kind: F.kind.optional(), label: F.label.optional(), seats: F.seats.optional(), accessible: F.accessible.optional(),
  rotation: F.rotation.optional(), near: F.near.optional(), x: F.x.optional(), y: F.y.optional(), w: F.w.optional(), h: F.h.optional(),
  name: F.name.optional(), size: F.size.optional(), group: F.group.optional(), needs: F.needs.optional(), tags: F.tags.optional(),
  attending: F.attending.optional(), text: F.text.optional(),
})
export type ActionDraft = z.infer<typeof ActionDraft>

const PlanResponse = z.object({
  actions: z.array(Action),
  /** Names Gemini could not pin to one guest; non-empty means ask back. */
  ambiguous: z.array(z.object({ name: z.string(), guestIds: z.array(z.string()) })),
  explanation: z.string(),
})

/** The chart after the actions, plus what the solver must respect when it reseats around them. */
export type Plan = {
  chart: Chart
  /** Guests the plan seated directly: the solver must not move them. */
  fixed: Set<string>
  /** Guests the plan unseated: the solver must not reseat them. */
  held: Set<string>
  /** Solve from scratch instead of a minimal repair. */
  reseat: boolean
  /** Non-seating changes in plain words, in order. */
  changes: string[]
  /** Actions that could not apply, with the reason. */
  skipped: string[]
  /** Text answers to questions. */
  answers: string[]
}

const shortId = () => crypto.randomUUID().slice(0, 8)
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
const list = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : (names[0] ?? ''))

/** Apply drafts in order to a copy of `chart`. Pure apart from fresh ids for new tables and room features. */
export function applyActions(chart: Chart, drafts: ActionDraft[]): Plan {
  const plan: Plan = { chart, fixed: new Set(), held: new Set(), reseat: false, changes: [], skipped: [], answers: [] }
  let c = chart

  const guestName = (id: string) => c.guests.find((g) => g.id === id)?.name ?? id
  /** Guest ids for refs (ids, else names). Throws on an unknown or ambiguous ref. */
  const guests = (refs: string[] | undefined) =>
    [...new Set((refs ?? []).map((ref) => {
      if (c.guests.some((g) => g.id === ref)) return ref
      const hit = matchGuest(ref, c.guests)
      if (hit.kind === 'match') return hit.guest.id
      throw new Error(hit.kind === 'ambiguous' ? `"${ref}" matches several guests` : `no guest "${ref}"`)
    }))]
  const table = (ref: string | undefined) => {
    const t = ref && c.seatables.find((s) => s.id === ref || same(s.label, ref))
    if (!t) throw new Error(`no table "${ref ?? ''}"`)
    return t
  }
  const tables = (refs: string[] | undefined, one?: string) => [...(refs ?? []), ...(one ? [one] : [])].map(table)
  const decor = (ref: string | undefined) => {
    const d = ref && c.decor.find((x) => x.id === ref || same(x.label, ref))
    if (!d) throw new Error(`no room feature "${ref ?? ''}"`)
    return d
  }
  /** A table or room feature by id or label, for `near`. */
  const anchorOf = (ref: string | undefined) => (ref ? (c.seatables.find((s) => s.id === ref || same(s.label, ref)) ?? decor(ref)) : undefined)
  /** Where a new w x h item goes: given x/y, else next to `near` (a table or room feature), else inside the room. */
  const position = (a: ActionDraft, w: number, h: number) => {
    if (a.x !== undefined && a.y !== undefined) return { x: Math.round(a.x), y: Math.round(a.y) }
    const anchor = anchorOf(a.near)
    return freeSpot(c, w, h, anchor && boxOf(anchor))
  }
  const nearText = (a: ActionDraft) => (a.near ? ` near ${anchorOf(a.near)?.label ?? a.near}` : '')
  const addRule = (rule: Rule) => {
    if (c.rules.some((r) => r.id === rule.id)) return
    c = { ...c, rules: [...c.rules, rule] }
    plan.changes.push(describeRule(rule, c.guests))
  }

  for (const a of drafts.map(clean)) {
    try {
      switch (a.type) {
        case 'apart':
        case 'together':
        case 'zone':
        case 'accessible': {
          const guestIds = guests(a.guestIds)
          if (guestIds.length < minGuests(a.type)) throw new Error(`${a.type} needs at least ${minGuests(a.type)} guests`)
          if (a.type === 'zone' && !chartZones(c).includes(a.zone ?? '')) throw new Error(`no zone "${a.zone ?? ''}"`)
          const id = ruleId({ type: a.type, guestIds, zone: a.zone })
          if (a.type === 'zone') addRule(Rule.parse({ id, type: 'zone', guestIds, zone: a.zone, hard: a.hard }))
          else if (a.type === 'accessible') addRule(Rule.parse({ id, type: 'accessible', guestIds }))
          else addRule(Rule.parse({ id, type: a.type, guestIds, hard: a.hard }))
          break
        }
        case 'balance':
          addRule({ id: 'balance', type: 'balance' })
          break
        case 'maxPerTable': {
          const max = Math.round(a.max ?? 0)
          if (max < 1) throw new Error('maxPerTable needs max of 1 or more')
          // One limit at a time: a new one replaces the old.
          c = { ...c, rules: c.rules.filter((r) => r.type !== 'maxPerTable') }
          addRule({ id: `maxPerTable:${max}`, type: 'maxPerTable', max })
          break
        }
        case 'removeRule': {
          const rule = c.rules.find((r) => r.id === a.ruleId)
          if (!rule) throw new Error(`no rule "${a.ruleId ?? ''}"`)
          c = { ...c, rules: c.rules.filter((r) => r !== rule) }
          plan.changes.push(`Drop rule: ${describeRule(rule, c.guests)}`)
          break
        }
        case 'seat': {
          const t = table(a.tableId)
          const ids = guests(a.guestIds)
          if (ids.length === 0) throw new Error('seat needs guests')
          const pinned = new Map(c.assignments.map((x) => [x.guestId, x.pinned]))
          c = {
            ...c,
            assignments: [
              ...c.assignments.filter((x) => !ids.includes(x.guestId)),
              ...ids.map((guestId) => ({ guestId, seatableId: t.id, pinned: a.pin ?? pinned.get(guestId) ?? false })),
            ],
          }
          ids.forEach((id) => {
            plan.fixed.add(id)
            plan.held.delete(id)
          })
          if (a.pin) plan.changes.push(`Pin ${list(ids.map(guestName))} at ${t.label}`)
          break
        }
        case 'unseat': {
          const ids = guests(a.guestIds)
          c = { ...c, assignments: c.assignments.filter((x) => !ids.includes(x.guestId)) }
          ids.forEach((id) => {
            plan.held.add(id)
            plan.fixed.delete(id)
          })
          break
        }
        case 'pin':
        case 'unpin': {
          const ids = guests(a.guestIds)
          const pinned = a.type === 'pin'
          c = { ...c, assignments: c.assignments.map((x) => (ids.includes(x.guestId) ? { ...x, pinned } : x)) }
          plan.changes.push(`${pinned ? 'Pin' : 'Unpin'} ${list(ids.map(guestName))}`)
          break
        }
        case 'reseat':
          plan.reseat = true
          plan.changes.push('Reseat everyone from scratch (pinned guests stay)')
          break
        case 'addTable': {
          const kind = a.kind ?? 'round'
          const seats = Math.max(1, Math.round(a.seats ?? DEFAULT_SEATS[kind]))
          const { w, h } = footprint({ kind, seats })
          const label = a.label?.trim() || nextLabel(c.seatables, kind)
          const at = position(a, w + 40, h + 40)
          const t: Seatable = { id: `${kind}-${shortId()}`, kind, label, seats, ...at, rotation: a.rotation ?? 0, accessible: a.accessible ?? false }
          c = { ...c, seatables: [...c.seatables, t] }
          plan.changes.push(`Add ${kind === 'rect' ? 'long' : kind} table ${label} (${seats} seats)${nearText(a)}`)
          break
        }
        case 'updateTable': {
          const targets = tables(a.tableIds, a.tableId)
          if (targets.length === 0) throw new Error('updateTable needs a table')
          const patch: Partial<Seatable> = {
            ...(a.seats !== undefined && { seats: Math.max(1, Math.round(a.seats)) }),
            ...(a.label && targets.length === 1 && { label: a.label }),
            ...(a.accessible !== undefined && { accessible: a.accessible }),
            ...(a.rotation !== undefined && { rotation: a.rotation }),
            ...(a.kind && { kind: a.kind }),
            ...(a.x !== undefined && { x: Math.round(a.x) }),
            ...(a.y !== undefined && { y: Math.round(a.y) }),
          }
          const ids = new Set(targets.map((t) => t.id))
          c = { ...c, seatables: c.seatables.map((s) => (ids.has(s.id) ? { ...s, ...patch } : s)) }
          const line = changeLine(list(targets.map((t) => t.label)), patch, targets)
          if (line) plan.changes.push(line)
          break
        }
        case 'removeTable': {
          const targets = tables(a.tableIds, a.tableId)
          if (targets.length === 0) throw new Error('removeTable needs a table')
          c = removeSeatables(c, new Set(targets.map((t) => t.id)))
          plan.changes.push(`Remove ${list(targets.map((t) => t.label))}`)
          break
        }
        case 'addGuest': {
          const name = a.name?.trim()
          if (!name) throw new Error('addGuest needs a name')
          const taken = new Set(c.guests.map((g) => g.id))
          let id = slug(name) || 'guest'
          for (let n = 2; taken.has(id); n++) id = `${slug(name)}-${n}`
          const g = Guest.parse({ id, name, size: Math.max(1, Math.round(a.size ?? 1)), group: a.group || undefined, needs: a.needs, tags: a.tags })
          c = { ...c, guests: [...c.guests, g] }
          plan.changes.push(`Add guest ${name}${g.size > 1 ? ` (party of ${g.size})` : ''}`)
          if (a.tableId) {
            const t = table(a.tableId)
            c = { ...c, assignments: [...c.assignments, { guestId: id, seatableId: t.id, pinned: a.pin ?? false }] }
            plan.fixed.add(id)
          }
          break
        }
        case 'updateGuest': {
          const ids = guests(a.guestIds)
          if (ids.length === 0) throw new Error('updateGuest needs guests')
          const patch: Partial<Guest> = {
            ...(a.name && ids.length === 1 && { name: a.name }),
            ...(a.size !== undefined && { size: Math.max(1, Math.round(a.size)) }),
            ...(a.group !== undefined && { group: a.group || undefined }),
            ...(a.needs && { needs: a.needs }),
            ...(a.tags && { tags: a.tags }),
            ...(a.attending !== undefined && { attending: a.attending }),
          }
          const line = changeLine(list(ids.map(guestName)), patch, c.guests.filter((g) => ids.includes(g.id)))
          c = { ...c, guests: c.guests.map((g) => (ids.includes(g.id) ? { ...g, ...patch } : g)) }
          if (line) plan.changes.push(line)
          break
        }
        case 'removeGuest': {
          const ids = guests(a.guestIds)
          if (ids.length === 0) throw new Error('removeGuest needs guests')
          plan.changes.push(`Remove ${list(ids.map(guestName))}`)
          c = removeGuests(c, new Set(ids))
          break
        }
        case 'addDecor': {
          const label = a.label?.trim()
          if (!label) throw new Error('addDecor needs a label')
          const w = Math.max(30, Math.round(a.w ?? 160))
          const h = Math.max(30, Math.round(a.h ?? 80))
          const d: Decor = { id: `decor-${shortId()}`, label, w, h, ...position(a, w + 40, h + 40), rotation: a.rotation }
          c = { ...c, decor: [...c.decor, d] }
          plan.changes.push(`Add ${label}${nearText(a)}`)
          break
        }
        case 'updateDecor': {
          const d = decor(a.decorId)
          const patch: Partial<Decor> = {
            ...(a.label && { label: a.label }),
            ...(a.w !== undefined && { w: Math.max(30, Math.round(a.w)) }),
            ...(a.h !== undefined && { h: Math.max(30, Math.round(a.h)) }),
            ...(a.rotation !== undefined && { rotation: a.rotation }),
            ...(a.x !== undefined && { x: Math.round(a.x) }),
            ...(a.y !== undefined && { y: Math.round(a.y) }),
          }
          c = { ...c, decor: c.decor.map((x) => (x.id === d.id ? { ...x, ...patch } : x)) }
          const line = changeLine(d.label, patch, [d])
          if (line) plan.changes.push(line)
          break
        }
        case 'removeDecor': {
          const d = decor(a.decorId)
          c = { ...c, decor: c.decor.filter((x) => x.id !== d.id) }
          plan.changes.push(`Remove ${d.label}`)
          break
        }
        case 'answer':
          if (a.text?.trim()) plan.answers.push(a.text.trim())
          break
      }
    } catch (e) {
      plan.skipped.push(`${a.type}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { ...plan, chart: c }
}

const JUNK = new Set(['', 'none', 'null', 'n/a', 'undefined'])

/** Models fill unused fields with placeholders ("none", "null", ""). Treat those as missing. */
function clean(a: ActionDraft): ActionDraft {
  return ActionDraft.parse(
    Object.fromEntries(Object.entries(a).filter(([k, v]) => k === 'type' || !(typeof v === 'string' && JUNK.has(v.trim().toLowerCase())))),
  )
}

/**
 * Change line for a patch applied to `targets`: "Change Table 6: seats 10, label Kids table". Only fields that differ
 * on at least one target are mentioned; empty when nothing actually changes.
 */
function changeLine(what: string, patch: Record<string, unknown>, targets: Record<string, unknown>[]): string {
  const parts = Object.entries(patch)
    .filter(([k, v]) => targets.some((t) => JSON.stringify(t[k]) !== JSON.stringify(v)))
    .map(([k, v]) => (typeof v === 'boolean' ? `${v ? '' : 'not '}${k === 'accessible' ? 'step-free' : k}` : v === undefined ? `no ${k}` : `${k} ${Array.isArray(v) ? v.join(', ') || 'none' : String(v)}`))
  return parts.length ? `Change ${what}: ${parts.join(', ')}` : ''
}

type Box = { x: number; y: number; w: number; h: number }

/** Axis-aligned box a table or room feature occupies, with room for seat chips around tables. */
function boxOf(item: Seatable | Decor): Box {
  if ('kind' in item) {
    const { w, h } = footprint(item)
    const r = rotatedSize(w, h, item.rotation)
    return { x: item.x, y: item.y, w: r.w + 30, h: r.h + 30 }
  }
  return { x: item.x, y: item.y, ...rotatedSize(item.w, item.h, item.rotation) }
}

const overlaps = (a: Box, b: Box) => Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h

/**
 * Center for a new w x h item that overlaps nothing, tried in rings around `anchor` (right, left, below, above,
 * then diagonals) or around the room's middle. Scores distance from the anchor plus a penalty for sticking out of
 * the room's current footprint, so "near the stage" stays near it without wandering off the floor plan.
 * Falls back to just right of everything.
 */
export function freeSpot(chart: Chart, w: number, h: number, anchor?: Box): { x: number; y: number } {
  const boxes = [...chart.seatables.map(boxOf), ...chart.decor.map(boxOf)]
  if (boxes.length === 0) return { x: 600, y: 400 }
  const minX = Math.min(...boxes.map((b) => b.x - b.w / 2))
  const maxX = Math.max(...boxes.map((b) => b.x + b.w / 2))
  const minY = Math.min(...boxes.map((b) => b.y - b.h / 2))
  const maxY = Math.max(...boxes.map((b) => b.y + b.h / 2))
  const from = anchor ?? { x: (minX + maxX) / 2, y: (minY + maxY) / 2, w: 0, h: 0 }
  /** How far a candidate sticks out of the room footprint. */
  const outside = (x: number, y: number) =>
    Math.max(0, minX - (x - w / 2)) + Math.max(0, x + w / 2 - maxX) + Math.max(0, minY - (y - h / 2)) + Math.max(0, y + h / 2 - maxY)

  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]
  let best: { x: number; y: number; score: number } | undefined
  for (let ring = 1; ring <= 6; ring++) {
    for (const [dx, dy] of dirs) {
      const x = Math.round(from.x + dx * ((from.w + w) / 2 + 20) * ring)
      const y = Math.round(from.y + dy * ((from.h + h) / 2 + 20) * ring)
      if (boxes.some((b) => overlaps(b, { x, y, w, h }))) continue
      const score = Math.hypot(x - from.x, y - from.y) + 3 * outside(x, y)
      if (!best || score < best.score) best = { x, y, score }
    }
  }
  return best ? { x: best.x, y: best.y } : { x: Math.round(maxX + w / 2 + 40), y: Math.round((minY + maxY) / 2) }
}

/**
 * Turn a plan into a proposal: reseat around it (repair, or a full solve for `reseat`), keeping guests the plan
 * seated where it put them and leaving guests it unseated off the floor. Pins come back as the plan set them.
 */
export function planProposal(before: Chart, plan: Plan, explanation: string): Proposal {
  const working = plan.chart
  const solverChart: Chart = {
    ...working,
    guests: working.guests.map((g) => (plan.held.has(g.id) ? { ...g, attending: false } : g)),
    assignments: working.assignments.map((a) => (plan.fixed.has(a.guestId) ? { ...a, pinned: true } : a)),
  }
  const res = plan.reseat ? solve(solverChart) : repair(solverChart)
  const pinned = new Map(working.assignments.map((a) => [a.guestId, a.pinned]))
  const assignments = res.assignments.map((a) => ({ ...a, pinned: pinned.get(a.guestId) ?? false }))
  const chart = { ...working, assignments }
  return { chart, moved: movedBetween(before.assignments, assignments), violations: findViolations(chart), changes: plan.changes, explanation }
}

export type ParseResult =
  | { kind: 'plan'; plan: Plan; explanation: string }
  | { kind: 'ask'; question: string; candidates: Candidates }

const askAmbiguous = (candidates: Candidates): ParseResult => ({
  kind: 'ask',
  question: candidates.map((c) => `Which ${c.name}: ${c.guests.map((g) => g.name).join(' or ')}?`).join(' '),
  candidates,
})

/** A rule as the action that adds it (offline parser output goes through the same path as Gemini's). */
function ruleDraft(r: Rule): ActionDraft {
  if (r.type === 'balance') return { type: 'balance' }
  if (r.type === 'maxPerTable') return { type: 'maxPerTable', max: r.max }
  if (r.type === 'zone') return { type: 'zone', guestIds: r.guestIds, zone: r.zone, hard: r.hard }
  if (r.type === 'accessible') return { type: 'accessible', guestIds: r.guestIds }
  return { type: r.type, guestIds: r.guestIds, hard: r.hard }
}

/** Whether a plan does anything worth showing. */
const hasEffect = (plan: Plan) => plan.changes.length > 0 || plan.answers.length > 0 || plan.fixed.size > 0 || plan.held.size > 0

/**
 * Any request about the chart -> a plan. Ambiguous first names ask back before any AI call. Gemini (or the demo
 * cache) goes first; if it fails or nothing in its plan applies, the offline parser tries the simple phrasings.
 * If that fails too, Gemini's own explanation (why it could not help) is shown instead of a generic hint.
 */
export async function parseRequest(text: string, chart: Chart): Promise<ParseResult> {
  const ambiguous = findAmbiguousNames(text, chart.guests)
  if (ambiguous.length) return askAmbiguous(ambiguous)

  let reason = ''
  try {
    const res = await callGemini('rules', planPrompt(text, chart), PlanResponse, text)
    const asks = res.ambiguous
      .map((a) => ({ name: a.name, guests: chart.guests.filter((g) => a.guestIds.includes(g.id)) }))
      .filter((a) => a.guests.length > 1)
    if (asks.length) return askAmbiguous(asks)
    const plan = applyActions(chart, res.actions)
    if (hasEffect(plan)) return { kind: 'plan', plan, explanation: res.explanation }
    reason = res.explanation
  } catch {
    // Network, schema or timeout: fall through to the deterministic parser.
  }

  const offline = parseRulesOffline(text, chart)
  if (offline.kind === 'rules') return { kind: 'plan', plan: applyActions(chart, offline.rules.map(ruleDraft)), explanation: offline.explanation }
  return reason && offline.candidates.length === 0 ? { kind: 'ask', question: reason, candidates: [] } : offline
}

/** Grounded prompt: everything in the chart with ids, so Gemini can only reference what exists. */
function planPrompt(text: string, chart: Chart): string {
  const seatOf = new Map(chart.assignments.map((a) => [a.guestId, a]))
  const label = new Map(chart.seatables.map((s) => [s.id, s.label]))
  const load = new Map<string, number>()
  for (const a of chart.assignments) {
    const g = chart.guests.find((x) => x.id === a.guestId)
    if (g?.attending) load.set(a.seatableId, (load.get(a.seatableId) ?? 0) + g.size)
  }
  const guests = chart.guests.map((g) => {
    const a = seatOf.get(g.id)
    const at = a ? `${label.get(a.seatableId) ?? '?'}${a.pinned ? ' (pinned)' : ''}` : 'unseated'
    return [g.id, g.name, g.size, g.group ?? '', g.tags.join(' '), g.needs.join(' '), g.attending ? at : 'not attending'].join(' | ')
  })
  // Who sits where, per table, so answers about tablemates need no lookup.
  const seated = new Map<string, string[]>()
  for (const a of chart.assignments) {
    const g = chart.guests.find((x) => x.id === a.guestId)
    if (g?.attending) seated.set(a.seatableId, [...(seated.get(a.seatableId) ?? []), g.name])
  }
  const tables = chart.seatables.map((s) =>
    [s.id, s.label, s.kind, `${load.get(s.id) ?? 0}/${s.seats}`, s.zone ?? '', s.accessible ? 'step-free' : '', `${s.x},${s.y}`, s.rotation, (seated.get(s.id) ?? []).join(', ')].join(' | '),
  )
  const decor = chart.decor.map((d) => [d.id, d.label, `${d.x},${d.y}`, `${d.w}x${d.h}`, d.rotation ?? 0].join(' | '))
  const rules = chart.rules.map((r) => `${r.id} | ${describeRule(r, chart.guests)}`)
  return [
    `Event: ${chart.kind}, "${chart.name}". Canvas units; x grows right, y grows down.`,
    'Guests (id | name | party size | group | tags | needs | seat):',
    ...guests,
    'Tables (id | label | kind | people/seats | zone | step-free | x,y | rotation | seated guests):',
    ...tables,
    'Room features (id | label | x,y | w x h | rotation):',
    ...(decor.length ? decor : ['none']),
    `Zones: ${chartZones(chart).join(', ') || 'none'}.`,
    'Rules (id | rule):',
    ...(rules.length ? rules : ['none']),
    '',
    'Turn the request into a list of actions. Use as many as it takes, in order. Only fill the fields an action uses.',
    'Rules (the solver keeps them from now on and moves people to satisfy them):',
    '- apart / together: guestIds. zone: guestIds + zone (a listed zone). accessible: guestIds need a step-free table.',
    '- hard=true for plain instructions and "must", "has to", "never", "can\'t" ("seat A with B", "keep A and B apart").',
    '  hard=false for "should", "prefer", "ideally", "if possible", "try to", "spread", "close to", "near". Must beats should.',
    '- balance: even out how many people sit at each table. maxPerTable: max people at any table.',
    '- removeRule: ruleId from the list.',
    'Seating (direct, the solver will not undo it):',
    '- seat: guestIds at tableId (pin=true to lock them). unseat: guestIds leave their table. pin / unpin: guestIds.',
    '- reseat: start the whole seating over. Only when asked to redo everything.',
    'Tables: addTable (kind round|rect|booth|row|bar|zone, seats, label, accessible, near = id of a table or room feature, or x,y);',
    '  updateTable (tableIds, then any of seats, label to rename, accessible, rotation, kind); removeTable (tableIds).',
    'Guests: addGuest (name, size, group, needs, tags, optional tableId); updateGuest (guestIds, then any of name, size, group, needs, tags, attending=false for cancellations); removeGuest (guestIds).',
    'Room features: addDecor (label, w, h, near or x,y); updateDecor (decorId, then label, w, h, rotation, x, y); removeDecor (decorId).',
    'answer: text, for questions about the chart ("who sits with...", "how many vegans..."). Answer from the data above only.',
    '- Use ids from the lists. Groups like "the cousins" or "the sales team" expand to every matching guest.',
    '- Prefer rules when the request states a lasting preference; use seat for explicit "put X at table Y".',
    '- "Next to the stage" etc. means near = that room feature\'s id. Zones are only for zone rules and table zones.',
    '- To seat guests at a table you add in the same plan, give it a label and use that label as tableId.',
    '- Leave out every field the action does not use.',
    'Examples (ids here are made up; use the real ones above):',
    '- "The Smiths cancelled" -> [{"type":"updateGuest","guestIds":["john-smith","mary-smith"],"attending":false}]',
    '- "Make table 3 a 12 seater called VIP" -> [{"type":"updateTable","tableIds":["t3"],"seats":12,"label":"VIP"}]',
    '- "Give table 5 two more seats and rename it Family" (table 5 has 8) -> [{"type":"updateTable","tableIds":["t5"],"seats":10,"label":"Family"}]',
    '- "Add a 10-seat round table by the stage for the band" -> [{"type":"addTable","kind":"round","seats":10,"label":"Band table","near":"stage"},{"type":"seat","guestIds":["ana-band","leo-band"],"tableId":"Band table"}]',
    '- "Seat Anna with Bob" -> [{"type":"together","guestIds":["anna-smith","bob-lee"],"hard":true}] (a rule, even if they already share a table)',
    '- "Who sits with Anna?" -> [{"type":"answer","text":"Anna Smith sits at Table 2 with Bob Lee and Cara Diaz."}]',
    '- "Even out the tables and keep Bob away from Carl" -> [{"type":"balance"},{"type":"apart","guestIds":["bob-lee","carl-ray"],"hard":true}]',
    '- If a name fits several guests and context does not decide, return no actions and list it in `ambiguous` with the candidate ids.',
    '- If nothing can be done, return no actions and say why in explanation.',
    '- explanation: one short sentence on what the plan does.',
    '',
    `Request: ${text}`,
  ].join('\n')
}
