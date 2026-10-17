import { z } from 'zod'
import { Rule, type Chart, type Guest } from '@/domain/types'
import { callGemini } from './client'
import { findAmbiguousNames, matchGuest, nameTokens, normalize } from './match'

/** One rule as Gemini returns it: flat (Gemini handles flat objects better than unions), no id. */
const RuleDraft = z.object({
  type: z.enum(['apart', 'together', 'zone', 'accessible']),
  guestIds: z.array(z.string()),
  zone: z.string().optional(),
  hard: z.boolean().optional(),
})
type RuleDraft = z.infer<typeof RuleDraft>

const RulesResponse = z.object({
  rules: z.array(RuleDraft),
  /** Names Gemini could not pin to one guest; non-empty means ask back. */
  ambiguous: z.array(z.object({ name: z.string(), guestIds: z.array(z.string()) })),
  explanation: z.string(),
})

export type Candidates = { name: string; guests: Guest[] }[]

export type ParseRulesResult =
  | { kind: 'rules'; rules: Rule[]; explanation: string }
  | { kind: 'ask'; question: string; candidates: Candidates }

/** Deterministic rule id from content, so the same request never adds a duplicate rule. */
export const ruleId = (draft: Pick<RuleDraft, 'type' | 'guestIds' | 'zone'>): string =>
  `${draft.type}:${[...draft.guestIds].sort().join(',')}${draft.zone ? `@${draft.zone}` : ''}`

export const chartZones = (chart: Chart): string[] =>
  [...new Set(chart.seatables.flatMap((s) => (s.zone ? [s.zone] : [])))]

/**
 * Turn drafts into contract `Rule`s: assign ids, apply schema defaults, and reject any guest id
 * or zone that is not in the chart. Throws with a readable message; parseRules then falls back.
 */
export function validateRules(drafts: RuleDraft[], chart: Chart): Rule[] {
  const known = new Set(chart.guests.map((g) => g.id))
  const zones = chartZones(chart)
  return drafts.map((draft) => {
    const guestIds = [...new Set(draft.guestIds)]
    const unknown = guestIds.filter((id) => !known.has(id))
    if (unknown.length) throw new Error(`Rule references unknown guest ids: ${unknown.join(', ')}`)
    if (draft.type === 'zone' && !zones.includes(draft.zone ?? '')) throw new Error(`Unknown zone: ${draft.zone}`)
    const base = { id: ruleId({ ...draft, guestIds }), guestIds }
    if (draft.type === 'zone') return Rule.parse({ ...base, type: 'zone', zone: draft.zone, hard: draft.hard })
    if (draft.type === 'accessible') return Rule.parse({ ...base, type: 'accessible' })
    return Rule.parse({ ...base, type: draft.type, hard: draft.hard })
  })
}

/** Human sentence for a rule. Used as the offline explanation and by explainSeat. */
export function describeRule(rule: Rule, guests: Guest[]): string {
  const names = rule.guestIds.map((id) => guests.find((g) => g.id === id)?.name ?? id)
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]
  const soft = 'hard' in rule && !rule.hard ? ' (preferred)' : ''
  switch (rule.type) {
    case 'apart':
      return `Keep ${list} at different tables${soft}.`
    case 'together':
      return `Seat ${list} at the same table${soft}.`
    case 'zone':
      return `Seat ${list} in zone "${rule.zone}"${soft}.`
    case 'accessible':
      return `Seat ${list} at a step-free table.`
  }
}

const askAmbiguous = (candidates: Candidates): ParseRulesResult => ({
  kind: 'ask',
  question: candidates
    .map((c) => `Which ${c.name}: ${c.guests.map((g) => g.name).join(' or ')}?`)
    .join(' '),
  candidates,
})

const HELP = 'Try "keep A and B apart", "seat A with B", "A needs wheelchair access" or "put A near the stage".'

/**
 * Plain language -> rules for the current chart. Ambiguous first names ask back before any AI call.
 * Gemini (or the demo cache) goes first; if it fails or returns ids not in the chart, the offline parser runs.
 * The result is a proposal: nothing here touches the store.
 */
export async function parseRules(text: string, chart: Chart): Promise<ParseRulesResult> {
  const ambiguous = findAmbiguousNames(text, chart.guests)
  if (ambiguous.length) return askAmbiguous(ambiguous)

  try {
    const res = await callGemini('rules', rulesPrompt(text, chart), RulesResponse, text)
    const asks = res.ambiguous
      .map((a) => ({ name: a.name, guests: chart.guests.filter((g) => a.guestIds.includes(g.id)) }))
      .filter((a) => a.guests.length > 1)
    if (asks.length) return askAmbiguous(asks)
    const rules = validateRules(res.rules, chart)
    if (rules.length) return { kind: 'rules', rules, explanation: res.explanation }
  } catch {
    // Network, schema or validation failure: fall through to the deterministic parser.
  }
  return parseRulesOffline(text, chart)
}

/** Grounded prompt: the full guest list and zones, so Gemini can only reference real ids. */
function rulesPrompt(text: string, chart: Chart): string {
  const guests = chart.guests
    .map((g) => [g.id, g.name, g.group ?? '', g.tags.join(' '), g.needs.join(' '), `size ${g.size}`].join(' | '))
    .join('\n')
  const zones = chartZones(chart)
  return [
    `Event: ${chart.kind}, "${chart.name}".`,
    'Guests (id | name | group | tags | needs | size):',
    guests,
    `Zones: ${zones.length ? zones.join(', ') : 'none'}.`,
    `Step-free tables: ${chart.seatables.filter((s) => s.accessible).length}.`,
    '',
    'Convert the request below into seating rules.',
    '- apart: guests must not share a table. together: guests share one table.',
    '- zone: guests sit at a table in that zone; use only a listed zone. accessible: guests need a step-free table.',
    '- Use only ids from the list. Groups like "the cousins" or "sales team" expand to every matching guest.',
    '- hard=true for must/never, false for preferences like "near" or "spread".',
    '- If a name fits several guests and context does not decide, return no rules and list it in `ambiguous` with the candidate ids.',
    '- explanation: one short sentence naming the guests.',
    '',
    `Request: ${text}`,
  ].join('\n')
}

/** Split "A, B and C" into names. */
const splitNames = (list: string): string[] =>
  list
    .split(/\s*(?:,|&|\band\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean)

/** Find the chart zone a phrase like "the dance floor" or "terrace" refers to. */
function matchZone(phrase: string, zones: string[]): string | undefined {
  const compact = nameTokens(phrase).join('')
  if (!compact) return undefined
  const hits = zones.filter((z) => normalize(z).replace(/[\s-]+/g, '').includes(compact))
  return hits.length === 1 ? hits[0] : undefined
}

type Clause = { type: 'apart' | 'together' | 'accessible'; names: string[] } | { type: 'zone'; names: string[]; place: string }

/** Recognize one simple English clause. Order matters: "seat A with B" is together, "seat A near X" is zone. */
function readClause(clause: string): Clause | null {
  let m: RegExpMatchArray | null
  if ((m = clause.match(/^(.+?)\s+(?:needs?|requires?|uses?|is in)\s+(?:an?\s+)?(?:wheelchair|accessible|step-free)/i)))
    return { type: 'accessible', names: splitNames(m[1]) }
  if ((m = clause.match(/^(?:keep|seat|put|sit)?\s*(.+?)\s+apart$/i)) || (m = clause.match(/^separate\s+(.+)$/i)))
    return { type: 'apart', names: splitNames(m[1]) }
  if ((m = clause.match(/^(.+?)\s+(?:away from|not with|(?:shouldn'?t|should not|can'?t|cannot|can not|mustn'?t|must not) sit (?:with|next to))\s+(.+)$/i)))
    return { type: 'apart', names: [...splitNames(m[1].replace(/^(?:keep|seat|put)\s+/i, '')), ...splitNames(m[2])] }
  if ((m = clause.match(/^(?:keep|seat|put|sit)?\s*(.+?)\s+together$/i))) return { type: 'together', names: splitNames(m[1]) }
  if ((m = clause.match(/^(?:keep|seat|put|sit|place)\s+(.+?)\s+(?:with|next to|beside)\s+(.+)$/i)))
    return { type: 'together', names: [...splitNames(m[1]), ...splitNames(m[2])] }
  if ((m = clause.match(/^(?:keep|seat|put|sit|place)\s+(.+?)\s+(?:near|by|at|on|in)\s+(.+)$/i)))
    return { type: 'zone', names: splitNames(m[1]), place: m[2] }
  return null
}

/**
 * Deterministic parser for simple phrasings, one rule per sentence. Used when Gemini is unavailable.
 * Unknown or ambiguous names ask back instead of guessing.
 */
export function parseRulesOffline(text: string, chart: Chart): ParseRulesResult {
  const zones = chartZones(chart)
  const drafts: RuleDraft[] = []
  const ambiguous: Candidates = []
  const missing: string[] = []

  for (const sentence of text.split(/[.;!\n]+/).map((s) => s.trim()).filter(Boolean)) {
    const clause = readClause(sentence)
    if (!clause) continue
    const ids: string[] = []
    for (const name of clause.names) {
      const hit = matchGuest(name, chart.guests)
      if (hit.kind === 'match') ids.push(hit.guest.id)
      else if (hit.kind === 'ambiguous') ambiguous.push({ name, guests: hit.guests })
      else missing.push(name)
    }
    if (clause.type === 'zone') {
      const zone = matchZone(clause.place, zones)
      if (!zone) missing.push(clause.place)
      else drafts.push({ type: 'zone', guestIds: ids, zone, hard: false })
    } else {
      drafts.push({ type: clause.type, guestIds: ids })
    }
  }

  if (ambiguous.length) return askAmbiguous(ambiguous)
  if (missing.length) return { kind: 'ask', question: `I could not find ${missing.map((m) => `"${m}"`).join(', ')}. ${HELP}`, candidates: [] }
  const valid = drafts.filter((d) => d.guestIds.length >= (d.type === 'apart' || d.type === 'together' ? 2 : 1))
  if (!valid.length) return { kind: 'ask', question: `I could not turn that into a rule. ${HELP}`, candidates: [] }
  const rules = validateRules(valid, chart)
  return { kind: 'rules', rules, explanation: rules.map((r) => describeRule(r, chart.guests)).join(' ') }
}
