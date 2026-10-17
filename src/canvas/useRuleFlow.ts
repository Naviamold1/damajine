import { useRef, useState } from 'react'
import { parseRules, type Candidates } from '@/ai/rules'
import type { Guest, Proposal } from '@/domain/types'
import { useChart } from '@/store/chart'
import { ruleProposal } from './derived'

export type RuleFlow =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ask'; question: string; candidates: Candidates }
  | { status: 'ready'; proposal: Proposal }
  | { status: 'error'; message: string }

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Replace an ambiguous name in the text with the picked guest's full name. */
export const resolveName = (text: string, name: string, guest: Guest) =>
  text.replace(new RegExp(`\\b${escapeRe(name)}\\b`, 'i'), guest.name)

/**
 * Plain language -> rules -> repaired proposal. Shared by the sidebar rule box and the command bar.
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
      const res = await parseRules(text, chart)
      if (id !== runId.current) return null
      if (res.kind === 'ask') {
        setFlow({ status: 'ask', question: res.question, candidates: res.candidates })
        return null
      }
      const proposal = ruleProposal(chart, res.rules, res.explanation)
      setFlow({ status: 'ready', proposal })
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
