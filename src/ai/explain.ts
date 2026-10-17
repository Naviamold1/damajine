import { z } from 'zod'
import type { Chart, Violation } from '@/domain/types'
import { callGemini } from './client'
import { describeRule } from './rules'

const ExplainResponse = z.object({ explanation: z.string() })

type SeatFacts = {
  guest: string
  table: string | null
  pinned: boolean
  tablemates: string[]
  rules: string[]
  violations: string[]
  needs: string[]
}

/** Everything the explanation may mention, taken from the chart and solver output. Nothing else is given to Gemini. */
function seatFacts(guestId: string, chart: Chart, violations: Violation[]): SeatFacts | null {
  const guest = chart.guests.find((g) => g.id === guestId)
  if (!guest) return null
  const assignment = chart.assignments.find((a) => a.guestId === guestId)
  const seatable = chart.seatables.find((s) => s.id === assignment?.seatableId)
  const name = (id: string) => chart.guests.find((g) => g.id === id)?.name ?? id
  const extras = [
    seatable?.zone && `zone ${seatable.zone}`,
    seatable?.accessible && 'step-free',
  ].filter(Boolean)
  return {
    guest: guest.size > 1 ? `${guest.name} (party of ${guest.size})` : guest.name,
    table: seatable ? `${seatable.label}${extras.length ? ` (${extras.join(', ')})` : ''}` : null,
    pinned: assignment?.pinned ?? false,
    tablemates: seatable
      ? chart.assignments.filter((a) => a.seatableId === seatable.id && a.guestId !== guestId).map((a) => name(a.guestId))
      : [],
    rules: chart.rules.filter((r) => r.guestIds.includes(guestId)).map((r) => describeRule(r, chart.guests)),
    violations: violations.filter((v) => v.guestIds.includes(guestId)).map((v) => v.message),
    needs: guest.needs,
  }
}

/** Offline explanation built from the same facts. */
function templateExplanation(f: SeatFacts): string {
  const parts = [
    f.table
      ? `${f.guest} sits at ${f.table}${f.pinned ? ', pinned by hand' : ''}${f.tablemates.length ? ` with ${f.tablemates.join(', ')}` : ''}.`
      : `${f.guest} is not seated yet.`,
  ]
  if (f.rules.length) parts.push(`Rules: ${f.rules.join(' ')}`)
  if (f.needs.length) parts.push(`Needs: ${f.needs.join(', ')}.`)
  parts.push(f.violations.length ? `Problems: ${f.violations.join(' ')}` : 'No rules are broken for this guest.')
  return parts.join(' ')
}

/**
 * Why does this guest sit where they do? Used by the guest detail popover.
 * Gemini rewrites the facts into 1-2 friendly sentences; offline or on error the template is returned.
 */
export async function explainSeat(guestId: string, chart: Chart, violations: Violation[]): Promise<string> {
  const facts = seatFacts(guestId, chart, violations)
  if (!facts) return 'Unknown guest.'
  const fallback = templateExplanation(facts)
  try {
    const prompt = [
      'Explain in one or two short sentences why this guest sits where they do, for the event planner.',
      'Use only these facts; do not invent reasons. Mention any problems plainly.',
      JSON.stringify(facts, null, 2),
    ].join('\n')
    const res = await callGemini('explain', prompt, ExplainResponse, `${guestId}:${fallback}`)
    return res.explanation.trim() || fallback
  } catch {
    return fallback
  }
}
