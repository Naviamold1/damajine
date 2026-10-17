import { useChart } from '@/store/chart'
import { movesOf } from './derived'
import { GuestChip } from './Sidebar'

/** Keep / Revert card at the bottom of the canvas while a proposal is pending. Enter / Esc work too (see useShortcuts). */
export function ProposalBar() {
  const chart = useChart((s) => s.chart)
  const proposal = useChart((s) => s.proposal)
  const { keepProposal, revertProposal } = useChart.getState()
  if (!proposal) return null

  const moves = movesOf(chart, proposal)
  const hard = proposal.violations.filter((v) => v.hard).length
  const soft = proposal.violations.length - hard
  return (
    <div className="absolute bottom-4 left-1/2 w-[min(600px,calc(100%-260px))] -translate-x-1/2 animate-pop overflow-hidden rounded-2xl bg-white shadow-island ring-2 ring-moved">
      <div className="flex items-center gap-3 px-4 pt-3">
        <span className="font-display text-[18px] font-bold text-moved">
          {proposal.moved.length} {proposal.moved.length === 1 ? 'move' : 'moves'}
        </span>
        <span className="min-w-0 flex-1 truncate text-dim" title={proposal.explanation}>
          {proposal.explanation}
        </span>
        {hard > 0 && <span className="font-medium text-hard">{hard} hard left</span>}
        {soft > 0 && <span className="font-medium text-soft">{soft} soft left</span>}
      </div>
      {moves.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-2">
          {moves.slice(0, 4).map(({ guest, from, to }) => (
            <span key={guest.id} className="flex items-center gap-1.5 whitespace-nowrap">
              <GuestChip g={guest} size={20} />
              <span className="font-medium">{guest.name}</span>
              <span className="text-dim">
                {from} → <b className="font-semibold text-moved">{to}</b>
              </span>
            </span>
          ))}
          {moves.length > 4 && <span className="text-dim">+{moves.length - 4} more</span>}
        </div>
      )}
      <div className="flex justify-end gap-2 px-3 pt-2.5 pb-3">
        <button className="rounded-lg px-3 py-1.5 font-medium text-dim hover:bg-floor hover:text-ink" onClick={revertProposal}>
          Revert <kbd className="ml-1 text-[11px] text-faint">Esc</kbd>
        </button>
        <button className="rounded-lg bg-moved px-4 py-1.5 font-semibold text-white hover:brightness-110" onClick={keepProposal}>
          Keep <kbd className="ml-1 text-[11px] text-white/70">Enter</kbd>
        </button>
      </div>
    </div>
  )
}
