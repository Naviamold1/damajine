import { useEffect, useRef, useState } from 'react'
import { presets } from '@/presets'
import { useChart } from '@/store/chart'
import { presetOf, solveProposal, violationsOf } from './derived'
import { Icon, Logo } from './icons'
import { useUi } from './ui'

/**
 * Top bar: wordmark, event switcher (demos, then your saved events), new event, seated progress, rule counts,
 * reseat, import, print, undo/redo. The open saved event renames on double-click and has a delete ×.
 */
export function Header() {
  const chart = useChart((s) => s.chart)
  const events = useChart((s) => s.events)
  const canUndo = useChart((s) => s.past.length > 0)
  const canRedo = useChart((s) => s.future.length > 0)
  const { loadChart, undo, redo, propose } = useChart.getState()
  const current = presetOf(chart)
  const navRef = useRef<HTMLElement>(null)
  const [renaming, setRenaming] = useState(false)

  // The switcher can be wider than the header: keep the open event's pill centered in view.
  const activeKey = chart.id ?? chart.name
  useEffect(() => {
    const nav = navRef.current
    const pill = nav?.querySelector<HTMLElement>('[data-active]')
    if (nav && pill) nav.scrollLeft = pill.offsetLeft - (nav.clientWidth - pill.offsetWidth) / 2
  }, [activeKey])

  const attending = chart.guests.filter((g) => g.attending)
  const seated = new Set(chart.assignments.map((a) => a.guestId))
  const people = (gs: typeof attending) => gs.reduce((n, g) => n + g.size, 0)
  const total = people(attending)
  const done = people(attending.filter((g) => seated.has(g.id)))
  const violations = violationsOf(chart)
  const hard = violations.filter((v) => v.hard).length
  const soft = violations.length - hard

  const iconBtn = 'grid size-8 place-items-center rounded-lg text-[17px] text-dim enabled:hover:bg-floor enabled:hover:text-ink disabled:text-line'
  const btn = 'flex h-8 flex-none items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 font-medium text-dim hover:bg-floor hover:text-ink'
  const pill = (active: boolean) => `flex-none max-w-40 truncate rounded-lg px-3 py-1 font-medium ${active ? 'bg-white text-ink shadow-island' : 'text-dim hover:text-ink'}`
  const open = (next: typeof chart) => {
    useUi.getState().selectGuest(null)
    loadChart(next)
  }
  const finishRename = (value: string) => {
    setRenaming(false)
    const name = value.trim()
    if (name && name !== chart.name) useChart.getState().renameChart(name)
  }
  // Deleting the open event lands on the wedding demo.
  const remove = (id: string) => {
    if (!window.confirm(`Delete "${chart.name}"? This cannot be undone.`)) return
    open(presets.wedding.chart)
    useChart.getState().deleteEvent(id)
  }
  return (
    <header className="flex h-14 flex-none items-center gap-4 border-b border-line px-4">
      <div className="flex flex-none items-center gap-2">
        <Logo />
        <span className="font-display text-[20px] font-bold tracking-[-0.02em]">damajine</span>
      </div>

      {/* Scrolls sideways (mouse wheel too) instead of pushing the header wider when there are many saved events. */}
      <nav
        ref={navRef}
        className="relative flex min-w-0 items-center overflow-x-auto rounded-xl bg-floor p-1 [scrollbar-width:none]"
        onWheel={(e) => (e.currentTarget.scrollLeft += e.deltaY)}
      >
        <span className="flex-none px-2 text-[12px] font-medium text-faint">Demos</span>
        {Object.entries(presets).map(([id, p]) => (
          <button key={id} data-active={p === current || undefined} className={pill(p === current)} onClick={() => open(p.chart)}>
            {p.label}
          </button>
        ))}
        {events.length > 0 && <span className="ml-1 flex-none border-l border-line px-2 text-[12px] font-medium text-faint">Yours</span>}
        {events.map((e) =>
          e.id !== chart.id ? (
            <button key={e.id} className={pill(false)} title={e.name} onClick={() => open(e)}>
              {e.name}
            </button>
          ) : (
            <span key={e.id} data-active className="flex flex-none items-center rounded-lg bg-white shadow-island">
              {renaming ? (
                <input
                  autoFocus
                  defaultValue={chart.name}
                  className="w-40 bg-transparent py-1 pl-3 font-medium outline-none"
                  onFocus={(ev) => ev.currentTarget.select()}
                  onBlur={(ev) => finishRename(ev.currentTarget.value)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter') ev.currentTarget.blur()
                    if (ev.key === 'Escape') {
                      // Restore the old name so the blur that follows changes nothing.
                      ev.currentTarget.value = chart.name
                      ev.currentTarget.blur()
                    }
                  }}
                />
              ) : (
                <button className="max-w-40 truncate py-1 pl-3 font-medium text-ink" title="Double-click to rename" onDoubleClick={() => setRenaming(true)}>
                  {chart.name}
                </button>
              )}
              <button className="grid size-6 place-items-center rounded-md text-[13px] text-faint hover:text-hard" title="Delete event" onClick={() => remove(e.id)}>
                <Icon name="close" />
              </button>
            </span>
          ),
        )}
        {!current && !events.some((e) => e.id === chart.id) && (
          <span data-active className={`ml-1 ${pill(true)}`}>
            {chart.name}
          </span>
        )}
      </nav>
      <button className={btn} onClick={() => useUi.getState().setNewOpen(true)}>
        <Icon name="plus" /> New event
      </button>

      <span className="flex-1" />

      <div className="flex flex-none items-center gap-2.5 whitespace-nowrap" title={`${done} of ${total} people seated`}>
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

      <div className="flex flex-none items-center gap-0.5 border-l border-line pl-3">
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
        <button className="ml-1 flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-ink px-3 font-medium text-white hover:bg-wine" onClick={() => useUi.getState().setImportOpen(true)}>
          <Icon name="import" /> Import guests
        </button>
      </div>
    </header>
  )
}
