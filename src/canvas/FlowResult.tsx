import type { Guest } from '@/domain/types'
import { useChart } from '@/store/chart'
import { movesOf } from './derived'
import { GuestChip } from './Sidebar'
import type { RuleFlow } from './useRuleFlow'

const RULE_VERB = { apart: 'Keep apart', together: 'Seat together', zone: 'Put', accessible: 'Step-free seat for' } as const

/**
 * Status of a rule flow: static loading text, ask-back with candidate buttons, or the parsed rules.
 * With `moves`, also lists the moves the proposal would make (command bar).
 */
export function FlowResult({ flow, onPick, moves = false }: { flow: RuleFlow; onPick: (name: string, guest: Guest) => void; moves?: boolean }) {
  const chart = useChart((s) => s.chart)
  const guests = chart.guests

  if (flow.status === 'idle') return null
  if (flow.status === 'loading') return <div className="text-dim">Reading your rule</div>
  if (flow.status === 'error') return <div className="text-hard">{flow.message}</div>
  if (flow.status === 'ask')
    return (
      <div>
        <div className="mb-2 font-medium">{flow.question}</div>
        {flow.candidates.map((c) => (
          <div key={c.name} className="mb-1 flex flex-wrap gap-2">
            {c.guests.map((g) => (
              <button key={g.id} className="flex items-center gap-2 rounded-full bg-floor py-1 pr-3 pl-1 font-medium hover:bg-wine-soft hover:text-wine" onClick={() => onPick(c.name, g)}>
                <GuestChip g={g} size={22} />
                {g.name}
                {g.group && <span className="text-[12px] font-normal text-dim">{g.group}</span>}
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
      {flow.proposal.rules.length === 0 && <div className="text-dim">You already have this rule</div>}
      {flow.proposal.rules.map((r) => (
        <div key={r.id} className="flex items-baseline gap-2 py-0.5">
          <span className={`rounded-md px-1.5 text-[11px] font-semibold uppercase ${'hard' in r && !r.hard ? 'bg-soft/12 text-soft' : 'bg-wine-soft text-wine'}`}>{'hard' in r && !r.hard ? 'soft' : 'hard'}</span>
          <span>
            <span className="text-dim">{RULE_VERB[r.type]}</span> <b className="font-semibold">{r.guestIds.map(name).join(', ')}</b>
            {r.type === 'zone' && <span className="text-dim"> in {r.zone}</span>}
          </span>
        </div>
      ))}
      {moves && flow.proposal.moved.length > 0 && (
        <ul className="mt-2 space-y-1">
          {movesOf(chart, flow.proposal).map(({ guest, from, to }) => (
            <li key={guest.id} className="flex items-center gap-2">
              <GuestChip g={guest} size={20} />
              <span className="font-medium">{guest.name}</span>
              <span className="text-dim">{from}</span>
              <span className="text-faint">→</span>
              <span className="font-semibold text-moved">{to}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 text-[13px] text-dim">
        {flow.proposal.moved.length === 0 ? 'Nobody needs to move' : `${flow.proposal.moved.length} ${flow.proposal.moved.length === 1 ? 'move' : 'moves'}`}
        {hard > 0 && <span className="text-hard"> · {hard} hard left</span>}
        {soft > 0 && <span className="text-soft"> · {soft} soft left</span>}
      </div>
    </div>
  )
}
