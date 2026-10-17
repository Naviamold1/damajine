import { presets } from '@/presets'
import { useChart } from '@/store/chart'
import { presetOf, solveProposal, violationsOf } from './derived'
import { Icon, Logo } from './icons'
import { useUi } from './ui'

/** Top bar: wordmark, demo switcher (plus the current own event), new event, seated progress, rule counts, reseat, import, print, undo/redo. */
export function Header() {
  const chart = useChart((s) => s.chart)
  const canUndo = useChart((s) => s.past.length > 0)
  const canRedo = useChart((s) => s.future.length > 0)
  const { loadChart, undo, redo, propose } = useChart.getState()
  const current = presetOf(chart)

  const attending = chart.guests.filter((g) => g.attending)
  const seated = new Set(chart.assignments.map((a) => a.guestId))
  const people = (gs: typeof attending) => gs.reduce((n, g) => n + g.size, 0)
  const total = people(attending)
  const done = people(attending.filter((g) => seated.has(g.id)))
  const violations = violationsOf(chart)
  const hard = violations.filter((v) => v.hard).length
  const soft = violations.length - hard

  const iconBtn = 'grid size-8 place-items-center rounded-lg text-[17px] text-dim enabled:hover:bg-floor enabled:hover:text-ink disabled:text-line'
  const btn = 'flex h-8 items-center gap-1.5 rounded-lg px-2.5 font-medium text-dim hover:bg-floor hover:text-ink'
  return (
    <header className="flex h-14 flex-none items-center gap-4 border-b border-line px-4">
      <div className="flex items-center gap-2">
        <Logo />
        <span className="font-display text-[20px] font-bold tracking-[-0.02em]">damajine</span>
      </div>

      <nav className="flex items-center rounded-xl bg-floor p-1">
        <span className="px-2 text-[12px] font-medium text-faint">Demos</span>
        {Object.entries(presets).map(([id, p]) => (
          <button
            key={id}
            className={`rounded-lg px-3 py-1 font-medium ${p === current ? 'bg-white text-ink shadow-island' : 'text-dim hover:text-ink'}`}
            onClick={() => {
              useUi.getState().selectGuest(null)
              loadChart(p.chart)
            }}
          >
            {p.label}
          </button>
        ))}
        {!current && <span className="ml-1 max-w-48 truncate rounded-lg bg-white px-3 py-1 font-medium shadow-island">{chart.name}</span>}
      </nav>
      <button className={btn} onClick={() => useUi.getState().setNewOpen(true)}>
        <Icon name="plus" /> New event
      </button>

      <span className="flex-1" />

      <div className="flex items-center gap-2.5" title={`${done} of ${total} people seated`}>
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-floor">
          <div className="h-full rounded-full bg-wine transition-[width] duration-300" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        <span className="tabular-nums">
          <b className="font-semibold">{done}</b>
          <span className="text-dim">/{total} seated</span>
        </span>
      </div>
      {(hard > 0 || soft > 0) && (
        <div className="flex items-center gap-2 font-medium tabular-nums">
          {hard > 0 && <span className="rounded-md bg-hard/10 px-1.5 text-hard">{hard} hard</span>}
          {soft > 0 && <span className="rounded-md bg-soft/12 px-1.5 text-soft">{soft} soft</span>}
        </div>
      )}

      <div className="flex items-center gap-0.5 border-l border-line pl-3">
        <button className={iconBtn} title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
          <Icon name="undo" />
        </button>
        <button className={iconBtn} title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo}>
          <Icon name="redo" />
        </button>
        <button className={btn} title="Reseat every guest from scratch. Pinned guests stay." onClick={() => propose(solveProposal(chart))}>
          <Icon name="shuffle" /> Reseat all
        </button>
        <button className={btn} onClick={() => window.print()}>
          <Icon name="print" /> Print
        </button>
        <button className="ml-1 flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 font-medium text-white hover:bg-wine" onClick={() => useUi.getState().setImportOpen(true)}>
          <Icon name="import" /> Import guests
        </button>
      </div>
    </header>
  )
}
