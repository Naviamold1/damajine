import { z } from 'zod'

/**
 * Shared domain model. Every other module (canvas, solver, AI, presets)
 * builds on these schemas, so change them deliberately and tell the team.
 * Gemini output is validated against the same schemas before it touches the store.
 */

export const EventKind = z.enum(['wedding', 'corporate', 'restaurant', 'hackathon', 'auditorium', 'train', 'custom'])
export type EventKind = z.infer<typeof EventKind>

export const GuestNeed = z.enum(['wheelchair', 'vegetarian', 'vegan', 'allergy', 'kid'])
export type GuestNeed = z.infer<typeof GuestNeed>

export const Guest = z.object({
  id: z.string(),
  name: z.string(),
  /** Seats this entry occupies: a party of 4 is one Guest with size 4. */
  size: z.number().int().min(1).default(1),
  group: z.string().optional(),
  tags: z.array(z.string()).default([]),
  needs: z.array(GuestNeed).default([]),
  attending: z.boolean().default(true),
})
export type Guest = z.infer<typeof Guest>

export const SeatableKind = z.enum(['round', 'rect', 'booth', 'row', 'bar', 'zone'])
export type SeatableKind = z.infer<typeof SeatableKind>

/** A thing people sit at. Shape drives rendering; `seats` drives capacity. x/y is the center in canvas units. */
export const Seatable = z.object({
  id: z.string(),
  kind: SeatableKind,
  label: z.string(),
  seats: z.number().int().min(1),
  x: z.number(),
  y: z.number(),
  rotation: z.number().default(0),
  /** Matched by `zone` rules, e.g. "terrace", "near-stage". */
  zone: z.string().optional(),
  /** Satisfies `accessible` rules (step-free, wheelchair space). */
  accessible: z.boolean().default(false),
})
export type Seatable = z.infer<typeof Seatable>

/** Non-seatable room feature drawn on the canvas (stage, dance floor, screen, shelves). x/y is the center; the solver ignores it. */
export const Decor = z.object({
  id: z.string(),
  label: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
})
export type Decor = z.infer<typeof Decor>

export const Rule = z.discriminatedUnion('type', [
  z.object({ id: z.string(), type: z.literal('apart'), guestIds: z.array(z.string()).min(2), hard: z.boolean().default(true) }),
  z.object({ id: z.string(), type: z.literal('together'), guestIds: z.array(z.string()).min(2), hard: z.boolean().default(true) }),
  z.object({ id: z.string(), type: z.literal('zone'), guestIds: z.array(z.string()).min(1), zone: z.string(), hard: z.boolean().default(false) }),
  z.object({ id: z.string(), type: z.literal('accessible'), guestIds: z.array(z.string()).min(1) }),
])
export type Rule = z.infer<typeof Rule>
export type RuleType = Rule['type']

/** guestId -> seatableId. Pinned guests are never moved by the solver. */
export const Assignment = z.object({
  guestId: z.string(),
  seatableId: z.string(),
  pinned: z.boolean().default(false),
})
export type Assignment = z.infer<typeof Assignment>

export const Chart = z.object({
  kind: EventKind,
  name: z.string(),
  guests: z.array(Guest),
  seatables: z.array(Seatable),
  decor: z.array(Decor).default([]),
  rules: z.array(Rule),
  assignments: z.array(Assignment),
})
export type Chart = z.infer<typeof Chart>

/**
 * A broken rule. `capacity` violations have no rule; they point at the overfull seatable.
 * The canvas highlights `guestIds` and `seatableIds`.
 */
export type Violation = {
  ruleId: string | null
  kind: RuleType | 'capacity'
  hard: boolean
  message: string
  guestIds: string[]
  seatableIds: string[]
}

/**
 * A pending change from the solver or AI. The UI overlays it on the chart;
 * Keep commits `rules` + `assignments` as one undo step, Revert drops it.
 */
export type Proposal = {
  /** Full replacement assignment list. */
  assignments: Assignment[]
  /** Rules to add on Keep (e.g. parsed from plain language). */
  rules: Rule[]
  /** Guest ids whose seatable changed vs the current chart. */
  moved: string[]
  /** Violations that remain if the proposal is kept. */
  violations: Violation[]
  explanation: string
}

export const emptyChart = (kind: EventKind = 'custom', name = 'Untitled'): Chart => ({
  kind,
  name,
  guests: [],
  seatables: [],
  decor: [],
  rules: [],
  assignments: [],
})
