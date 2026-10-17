import { useRef, useState } from 'react'
import { parseRequest, planProposal } from '@/ai/actions'
import type { Candidates } from '@/ai/rules'
import type { Guest, Proposal } from '@/domain/types'
import { useChart } from '@/store/chart'

export type RuleFlow =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ask'; question: string; candidates: Candidates }
  /** Only text came back (a question about the chart): nothing to propose. */
  | { status: 'answer'; answers: string[]; skipped: string[] }
  | { status: 'ready'; proposal: Proposal; answers: string[]; skipped: string[] }
  | { status: 'error'; message: string }

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Replace an ambiguous name in the text with the picked guest's full name. */
export const resolveName = (text: string, name: string, guest: Guest) =>
  text.replace(new RegExp(`\\b${escapeRe(name)}\\b`, 'i'), guest.name)

/**
 * Plain language -> action plan -> proposal (or a text answer). Used by the command bar.
 * `run` parses against the current chart; on `ask` the caller shows candidates and re-runs with
 * `resolveName`. Returns the proposal when ready so the caller can propose it right away.
 */
export function useRuleFlow() {
  const [flow, setFlow] = useState<RuleFlow>({ status: 'idle' })
  const [ranText, setRanText] = useState('')
  const runId = useRef(0)

  async function run(text: string): Promise<Proposal | null> {
    const id = ++runId.current
    setRanText(text)
    setFlow({ status: 'loading' })
    const chart = useChart.getState().chart
    try {
      const res = await parseRequest(text, chart)
      if (id !== runId.current) return null
      if (res.kind === 'ask') {
        setFlow({ status: 'ask', question: res.question, candidates: res.candidates })
        return null
      }
      const { plan } = res
      const proposal = planProposal(chart, plan, res.explanation)
      if (proposal.changes.length === 0 && proposal.moved.length === 0) {
        if (plan.answers.length) setFlow({ status: 'answer', answers: plan.answers, skipped: plan.skipped })
        // Everything was skipped, or already true (an existing rule, guests already in place).
        else setFlow({ status: 'ask', question: plan.skipped.length ? `Nothing changed. ${plan.skipped.join('. ')}.` : `Nothing to change. ${res.explanation}`.trim(), candidates: [] })
        return null
      }
      setFlow({ status: 'ready', proposal, answers: plan.answers, skipped: plan.skipped })
      return proposal
    } catch (e) {
      if (id === runId.current) setFlow({ status: 'error', message: e instanceof Error ? e.message : String(e) })
      return null
    }
  }

  const reset = () => {
    runId.current++
    setFlow({ status: 'idle' })
    setRanText('')
  }

  return { flow, ranText, run, reset }
}
