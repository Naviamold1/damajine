import { presets } from '@/presets'
import { useChart } from '@/store/chart'
import { presetOf, solveProposal, violationsOf } from './derived'
import { useUi } from './ui'

/** Top bar: preset switcher, seated count, violation counts, solve, command bar, import, print, undo/redo. */
export function Header() {
  const chart = useChart((s) => s.chart)
  const canUndo = useChart((s) => s.past.length > 0)
  const canRedo = useChart((s) => s.future.length > 0)
  const { loadChart, undo, redo, propose } = useChart.getState()
  const current = presetOf(chart)

  const attending = chart.guests.filter((g) => g.attending)
  const seated = new Set(chart.assignments.map((a) => a.guestId))
  const people = (gs: typeof attending) => gs.reduce((n, g) => n + g.size, 0)
  const violations = violationsOf(chart)
  const hard = violations.filter((v) => v.hard).length
  const soft = violations.length - hard

  const btn = 'min-w-[26px] border border-line px-1.5 py-px text-center enabled:hover:border-[#555] disabled:text-[#444]'
  return (
    <header className="flex h-10 flex-none items-center gap-3.5 border-b border-line px-3">
      <b className="tracking-[.01em]">Damajine</b>
      <nav className="flex gap-3">
        {Object.entries(presets).map(([id, p]) => (
          <button
            key={id}
            className={p === current ? 'underline underline-offset-[5px]' : 'text-dim hover:text-white'}
            onClick={() => {
              useUi.getState().selectGuest(null)
              loadChart(p.chart)
            }}
          >
            {p.label}
          </button>
        ))}
      </nav>
      <span className="flex-1" />
      <span className="text-dim tabular-nums">
        {people(attending.filter((g) => seated.has(g.id)))}/{people(attending)} seated
      </span>
      {hard > 0 && <span className="text-hard">{hard} hard</span>}
      {soft > 0 && <span className="text-soft">{soft} soft</span>}
      <button className={btn} onClick={() => propose(solveProposal(chart))}>
        Solve all
      </button>
      <button className={btn} onClick={() => useUi.getState().setCommandOpen(true)}>
        Rule…
      </button>
      <button className={btn} onClick={() => useUi.getState().setImportOpen(true)}>
        Import
      </button>
      <button className={btn} onClick={() => window.print()}>
        Print
      </button>
      <button className={btn} title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
        ↶
      </button>
      <button className={btn} title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo}>
        ↷
      </button>
    </header>
  )
}
