import type { Guest } from '@/domain/types'
import { useChart } from '@/store/chart'
import { movesOf } from './derived'
import type { RuleFlow } from './useRuleFlow'

/**
 * Status of a rule flow: static loading text, ask-back with candidate buttons, or the parsed rules.
 * With `moves`, also lists the moves the proposal would make (command bar).
 */
export function FlowResult({ flow, onPick, moves = false }: { flow: RuleFlow; onPick: (name: string, guest: Guest) => void; moves?: boolean }) {
  const chart = useChart((s) => s.chart)
  const guests = chart.guests

  if (flow.status === 'idle') return null
  if (flow.status === 'loading') return <div className="text-dim">Parsing</div>
  if (flow.status === 'error') return <div className="text-hard">{flow.message}</div>
  if (flow.status === 'ask')
    return (
      <div>
        <div className="text-soft">{flow.question}</div>
        {flow.candidates.map((c) => (
          <div key={c.name} className="mt-1 flex flex-wrap gap-x-3">
            {c.guests.map((g) => (
              <button key={g.id} className="text-left underline-offset-4 hover:underline" onClick={() => onPick(c.name, g)}>
                {g.name}
              </button>
            ))}
          </div>
        ))}
      </div>
    )

  const name = (id: string) => guests.find((g) => g.id === id)?.name ?? id
  const hard = flow.proposal.violations.filter((v) => v.hard).length
  const soft = flow.proposal.violations.length - hard
  return (
    <div>
      {flow.proposal.rules.length === 0 && <div className="text-dim">Rule already exists</div>}
      {flow.proposal.rules.map((r) => (
        <div key={r.id}>
          <span className="text-moved">{r.type}</span> {r.guestIds.map(name).join(', ')}
          {r.type === 'zone' && <span className="text-dim"> in {r.zone}</span>}
          <span className="text-dim"> · {'hard' in r && !r.hard ? 'soft' : 'hard'}</span>
        </div>
      ))}
      {moves && (
        <table className="mt-1 w-full">
          <tbody>
            {movesOf(chart, flow.proposal).map(({ guest, from, to }) => (
              <tr key={guest.id}>
                <td className="pr-3 text-moved">{guest.name}</td>
                <td className="pr-2 text-dim">{from}</td>
                <td className="pr-2">→</td>
                <td className="text-moved">{to}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-1 text-dim">
        {flow.proposal.moved.length} moves
        {hard > 0 && <span className="text-hard"> · {hard} hard left</span>}
        {soft > 0 && <span className="text-soft"> · {soft} soft left</span>}
      </div>
    </div>
  )
}
