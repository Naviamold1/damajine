import { useChart } from '@/store/chart'
import { movesOf } from './derived'

/** One-line Keep / Revert bar at the bottom of the canvas while a proposal is pending. Enter / Esc work too (see useShortcuts). */
export function ProposalBar() {
  const chart = useChart((s) => s.chart)
  const proposal = useChart((s) => s.proposal)
  const { keepProposal, revertProposal } = useChart.getState()
  if (!proposal) return null

  const moves = movesOf(chart, proposal)
  const hard = proposal.violations.filter((v) => v.hard).length
  const soft = proposal.violations.length - hard
  return (
    <div className="absolute bottom-3.5 left-1/2 flex max-w-[calc(100%-260px)] -translate-x-1/2 items-center gap-3.5 border border-moved bg-black px-2.5 py-1.5 whitespace-nowrap">
      <span className="text-moved">{proposal.moved.length} {proposal.moved.length === 1 ? 'move' : 'moves'}</span>
      {moves.slice(0, 3).map(({ guest, from, to }) => (
        <span key={guest.id}>
          {guest.name} <span className="text-dim">{from}</span> → {to}
        </span>
      ))}
      {moves.length > 3 && <span className="text-dim">+{moves.length - 3}</span>}
      <span className="min-w-0 truncate text-dim" title={proposal.explanation}>
        {proposal.explanation}
      </span>
      {hard > 0 && <span className="text-hard">{hard} hard left</span>}
      {soft > 0 && <span className="text-soft">{soft} soft left</span>}
      <button className="bg-white px-2.5 py-0.5 font-semibold text-black" onClick={keepProposal}>
        Keep ⏎
      </button>
      <button className="border border-[#555] px-2.5 py-px" onClick={revertProposal}>
        Revert esc
      </button>
    </div>
  )
}
