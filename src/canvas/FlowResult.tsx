import type { Guest } from '@/domain/types'
import { useChart } from '@/store/chart'
import { movesOf } from './derived'
import { Icon } from './icons'
import { GuestChip } from './Sidebar'
import type { RuleFlow } from './useRuleFlow'

/**
 * Status of a request: static loading text, ask-back with candidate buttons, a text answer, or the plan:
 * answers, changes (rules, tables, guests...), skipped actions, then (with `moves`) the moves it would make.
 */
export function FlowResult({ flow, onPick, moves = false }: { flow: RuleFlow; onPick: (name: string, guest: Guest) => void; moves?: boolean }) {
  const chart = useChart((s) => s.chart)

  if (flow.status === 'idle') return null
  if (flow.status === 'loading') return <div className="text-dim">Working on it</div>
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

  const answers = (
    <>
      {flow.answers.map((a) => (
        <p key={a} className="pb-1.5 whitespace-pre-line text-ink">
          {a}
        </p>
      ))}
    </>
  )
  const skipped = flow.skipped.length > 0 && (
    <ul className="pt-1 text-[12px] text-faint">
      {flow.skipped.map((s) => (
        <li key={s}>Skipped {s}</li>
      ))}
    </ul>
  )
  if (flow.status === 'answer')
    return (
      <div>
        {answers}
        {skipped}
      </div>
    )

  const { proposal } = flow
  const hard = proposal.violations.filter((v) => v.hard).length
  const soft = proposal.violations.length - hard
  return (
    <div>
      {answers}
      {proposal.changes.map((c, i) => (
        <div key={i} className="flex items-baseline gap-2 py-0.5">
          <Icon name="sparkle" className="flex-none translate-y-0.5 text-[12px] text-wine" />
          <span>{c}</span>
        </div>
      ))}
      {skipped}
      {moves && proposal.moved.length > 0 && (
        <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
          {movesOf(chart, proposal).map(({ guest, from, to }) => (
            <li key={guest.id} className="flex items-center gap-2">
              <GuestChip g={guest} size={20} />
              <span className="font-medium">{guest.name}</span>
              <span className="text-dim">{from}</span>
              <span className="text-faint">→</span>
              <span className={`font-semibold ${to === 'removed' ? 'text-hard' : 'text-moved'}`}>{to}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 text-[13px] text-dim">
        {proposal.moved.length === 0 ? 'Nobody needs to move' : `${proposal.moved.length} ${proposal.moved.length === 1 ? 'move' : 'moves'}`}
        {hard > 0 && <span className="text-hard"> · {hard} hard left</span>}
        {soft > 0 && <span className="text-soft"> · {soft} soft left</span>}
      </div>
    </div>
  )
}
