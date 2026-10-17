import { useState } from 'react'
import { importGuests } from '@/ai/import'
import type { Guest } from '@/domain/types'
import { repair } from '@/engine/solver'
import { useChart } from '@/store/chart'
import { guestTags } from './derived'
import { useUi } from './ui'

type ImportState = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; guests: Guest[] } | { status: 'error'; message: string }

const PLACEHOLDER = 'Nino Beridze +1\nKapanadze family of 4, veg\nGiorgi (wheelchair)'

/**
 * Paste a messy guest list, Parse previews the guests, Add commits them as one undo step
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
    const res = repair(useChart.getState().chart)
    store.propose({
      assignments: res.assignments,
      rules: [],
      moved: res.moved,
      violations: res.violations,
      explanation: `Seat ${guests.length} imported ${guests.length === 1 ? 'guest' : 'guests'}`,
    })
    close()
  }

  const guests = state.status === 'ready' ? state.guests : []
  const btn = 'border border-[#555] px-2.5 py-px enabled:hover:border-white disabled:text-[#444]'
  return (
    <div
      className="fixed inset-0 z-10 bg-black/60"
      onPointerDown={close}
      onKeyDown={(e) => {
        // Esc closes the panel without reaching the global proposal shortcuts.
        if (e.key === 'Escape') {
          e.stopPropagation()
          close()
        }
      }}
    >
      <div className="absolute top-16 left-1/2 w-[640px] max-w-[calc(100%-32px)] -translate-x-1/2 border border-[#555] bg-black" onPointerDown={(e) => e.stopPropagation()}>
        <div className="px-2.5 pt-2 pb-1 font-semibold">Import guests</div>
        <textarea
          autoFocus
          rows={6}
          className="block w-full resize-y border-y border-line bg-black px-2.5 py-1.5 outline-none placeholder:text-dim"
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
        {state.status === 'loading' && <div className="px-2.5 py-1.5 text-dim">Parsing...</div>}
        {state.status === 'error' && <div className="px-2.5 py-1.5 text-hard">{state.message}</div>}
        {state.status === 'ready' && (
          <div className="max-h-72 overflow-y-auto border-b border-line">
            {guests.length === 0 && <div className="px-2.5 py-1.5 text-dim">No guests found</div>}
            {guests.length > 0 && (
              <table className="w-full">
                <thead className="text-left text-dim">
                  <tr>
                    <th className="px-2.5 py-1 font-normal">Name</th>
                    <th className="pr-3 font-normal">Size</th>
                    <th className="pr-3 font-normal">Group</th>
                    <th className="pr-3 font-normal">Needs</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {guests.map((g) => (
                    <tr key={g.id} className="hover:bg-[#0b0b0b]">
                      <td className="px-2.5">{g.name}</td>
                      <td className="pr-3 tabular-nums">{g.size}</td>
                      <td className="pr-3 text-dim">{g.group}</td>
                      <td className="pr-3 text-dim">{guestTags({ ...g, size: 1 })}</td>
                      <td className="pr-2.5 text-right">
                        <button
                          title="Remove"
                          className="text-dim hover:text-white"
                          onClick={() => setState({ status: 'ready', guests: guests.filter((x) => x.id !== g.id) })}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        <div className="flex items-center gap-3 px-2.5 py-1.5">
          <span className="text-[11px] text-dim">Ctrl Enter to parse · Esc to close</span>
          <span className="flex-1" />
          <button className={btn} disabled={!text.trim() || state.status === 'loading'} onClick={parse}>
            Parse
          </button>
          <button className="bg-white px-2.5 py-0.5 font-semibold text-black disabled:bg-[#333] disabled:text-[#777]" disabled={guests.length === 0} onClick={() => add(guests)}>
            Add {guests.length} {guests.length === 1 ? 'guest' : 'guests'}
          </button>
        </div>
      </div>
    </div>
  )
}
