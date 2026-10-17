import { useState } from 'react'
import { importGuests } from '@/ai/import'
import type { Guest } from '@/domain/types'
import { repair } from '@/engine/solver'
import { useChart } from '@/store/chart'
import { guestBadges } from './derived'
import { Icon } from './icons'
import { GuestChip } from './Sidebar'
import { useUi } from './ui'

type ImportState = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; guests: Guest[] } | { status: 'error'; message: string }

const PLACEHOLDER = 'Nino Beridze +1\nKapanadze family of 4, veg\nGiorgi (wheelchair)'

/**
 * Paste a messy guest list, Read list previews the guests, Add commits them as one undo step
 * and proposes seats for them via `repair`. Opened from the header or the command bar. Esc closes.
 */
export function ImportPanel() {
  const open = useUi((s) => s.importOpen)
  if (!open) return null
  return <ImportPanelOpen />
}

function ImportPanelOpen() {
  const [text, setText] = useState('')
  const [state, setState] = useState<ImportState>({ status: 'idle' })
  const close = () => useUi.getState().setImportOpen(false)

  const parse = async () => {
    if (!text.trim()) return
    setState({ status: 'loading' })
    try {
      setState({ status: 'ready', guests: await importGuests(text, useChart.getState().chart.guests) })
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  const add = (guests: Guest[]) => {
    const store = useChart.getState()
    store.addGuests(guests)
    const chart = useChart.getState().chart
    const res = repair(chart)
    store.propose({
      chart: { ...chart, assignments: res.assignments },
      moved: res.moved,
      violations: res.violations,
      changes: [],
      explanation: `Seat ${guests.length} imported ${guests.length === 1 ? 'guest' : 'guests'}`,
    })
    close()
  }

  const guests = state.status === 'ready' ? state.guests : []
  return (
    <div
      className="fixed inset-0 z-10 bg-ink/25"
      onPointerDown={close}
      onKeyDown={(e) => {
        // Esc closes the panel without reaching the global proposal shortcuts.
        if (e.key === 'Escape') {
          e.stopPropagation()
          close()
        }
      }}
    >
      <div className="absolute top-20 left-1/2 w-[640px] max-w-[calc(100%-32px)] -translate-x-1/2 animate-pop overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-ink/10" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 pt-4 pb-1">
          <span className="font-display text-[20px] font-bold">Import guests</span>
          <span className="flex-1" />
          <button title="Close" className="grid size-7 place-items-center rounded-lg text-dim hover:bg-floor hover:text-ink" onClick={close}>
            <Icon name="close" />
          </button>
        </div>
        <p className="px-4 pb-3 text-dim">Paste any list. Names, plus-ones, families, diets and wheelchairs all get picked up.</p>
        <div className="px-4">
          <textarea
            autoFocus
            rows={6}
            className="block w-full resize-y rounded-xl bg-floor px-3 py-2.5 outline-none placeholder:text-faint focus:ring-2 focus:ring-wine/30"
            placeholder={PLACEHOLDER}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              if (state.status !== 'loading') setState({ status: 'idle' })
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) parse()
            }}
          />
        </div>
        {state.status === 'loading' && <div className="px-4 pt-3 text-dim">Reading your list</div>}
        {state.status === 'error' && <div className="px-4 pt-3 text-hard">{state.message}</div>}
        {state.status === 'ready' && (
          <div className="mx-4 mt-3 max-h-72 overflow-y-auto rounded-xl ring-1 ring-line">
            {guests.length === 0 && <div className="px-3 py-2 text-dim">No guests found. Try one name per line.</div>}
            {guests.map((g) => (
              <div key={g.id} className="group flex items-center gap-2.5 border-b border-line px-3 py-1.5 last:border-0">
                <GuestChip g={g} />
                <span className="font-medium">{g.name}</span>
                {g.size > 1 && <span className="text-dim tabular-nums">party of {g.size}</span>}
                <span className="text-dim">{guestBadges({ ...g, size: 1 })}</span>
                <span className="ml-auto text-[12px] text-faint">{g.group}</span>
                <button
                  title="Remove"
                  className="grid size-6 place-items-center rounded-md text-faint opacity-0 group-hover:opacity-100 hover:bg-floor hover:text-ink"
                  onClick={() => setState({ status: 'ready', guests: guests.filter((x) => x.id !== g.id) })}
                >
                  <Icon name="close" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-center gap-2 bg-floor px-4 py-2.5">
          <span className="text-[12px] text-dim">
            <kbd className="font-semibold text-ink">Ctrl Enter</kbd> to read the list
          </span>
          <span className="flex-1" />
          <button className="rounded-lg px-3 py-1.5 font-medium text-ink enabled:hover:bg-white disabled:text-faint" disabled={!text.trim() || state.status === 'loading'} onClick={parse}>
            Read list
          </button>
          <button className="rounded-lg bg-ink px-4 py-1.5 font-semibold text-white enabled:hover:bg-wine disabled:bg-line disabled:text-faint" disabled={guests.length === 0} onClick={() => add(guests)}>
            Add {guests.length} {guests.length === 1 ? 'guest' : 'guests'}
          </button>
        </div>
      </div>
    </div>
  )
}
