import { useEffect, useState, type DragEvent, type ReactNode } from 'react'
import { explainSeat } from '@/ai/explain'
import type { Guest } from '@/domain/types'
import { useChart } from '@/store/chart'
import { groupTint, guestBadges, initials, severities, violationsOf } from './derived'
import { Icon } from './icons'
import { GUEST_DRAG, useUi } from './ui'

/** Accept guest drops; `seatableId` null unseats. */
function dropProps(seatableId: string | null) {
  return {
    onDragOver: (e: DragEvent) => {
      if (e.dataTransfer.types.includes(GUEST_DRAG)) e.preventDefault()
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const id = e.dataTransfer.getData(GUEST_DRAG)
      if (id) useChart.getState().moveGuest(id, seatableId)
    },
  }
}

/**
 * Left column: guest search, an import prompt while there are no guests, unseated guests, seated guests grouped by table, problems.
 * Drag a guest onto the canvas to seat, onto a table group to seat there, anywhere else here to unseat.
 */
export function Sidebar() {
  const chart = useChart((s) => s.chart)
  const proposal = useChart((s) => s.proposal)
  const [query, setQuery] = useState('')

  const sev = severities(violationsOf(chart)).guests
  const q = query.trim().toLowerCase()
  const attending = chart.guests.filter((g) => g.attending)
  const shown = attending.filter((g) => !q || [g.name, g.group ?? '', ...g.tags].some((t) => t.toLowerCase().includes(q)))
  const seatOf = new Map(chart.assignments.map((a) => [a.guestId, a.seatableId]))
  // Proposed destinations can be tables the proposal adds, so look labels up in its chart.
  const label = (id: string | undefined) => (proposal?.chart ?? chart).seatables.find((s) => s.id === id)?.label ?? 'none'
  const movedTo = new Map(proposal?.moved.map((id) => [id, label(proposal.chart.assignments.find((a) => a.guestId === id)?.seatableId)]))
  const unseated = shown.filter((g) => !chart.seatables.some((s) => s.id === seatOf.get(g.id)))
  const seats = (gs: Guest[]) => gs.reduce((n, g) => n + g.size, 0)

  const row = (g: Guest) => <GuestRow key={g.id} g={g} sev={sev.get(g.id)} movedTo={movedTo.get(g.id)} seated={seatOf.has(g.id)} pinned={chart.assignments.some((a) => a.guestId === g.id && a.pinned)} />

  return (
    <aside className="flex w-[300px] flex-none flex-col overflow-hidden border-r border-line bg-white" {...dropProps(null)}>
      <label className="mx-3 mt-3 flex items-center gap-2 rounded-xl bg-floor px-3 py-2 text-dim focus-within:ring-2 focus-within:ring-wine/30">
        <Icon name="search" />
        <input
          className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-faint"
          placeholder={attending.length ? `Find one of ${attending.length} guests` : 'Search guests'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-3">
        {attending.length === 0 && (
          <div className="mx-1 mt-3 rounded-xl bg-wine-soft p-4">
            <div className="font-display text-[16px] font-semibold">No guests yet</div>
            <p className="pt-1 pb-3 text-dim">Paste your list in any shape. Plus-ones, families and diets get picked up.</p>
            <button className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 font-medium text-white hover:bg-wine" onClick={() => useUi.getState().setImportOpen(true)}>
              <Icon name="import" /> Import guests
            </button>
          </div>
        )}
        {attending.length > 0 && (unseated.length > 0 || !q) && (
          <div className={`mt-2 rounded-xl ${unseated.length ? 'bg-wine-soft' : ''}`}>
            <Section title={unseated.length ? 'Waiting for a seat' : 'Everyone has a seat'} count={unseated.length ? `${seats(unseated)}` : ''}>
              {unseated.map(row)}
            </Section>
          </div>
        )}
        {chart.seatables.map((s) => {
          const here = shown.filter((g) => seatOf.get(g.id) === s.id)
          if (q && here.length === 0) return null
          return (
            <div key={s.id} {...dropProps(s.id)}>
              <Section title={s.label} used={seats(here)} capacity={s.seats} onTitle={() => useUi.getState().selectSeatable(s.id)}>
                {here.map(row)}
              </Section>
            </div>
          )
        })}
      </div>
      <Problems />
    </aside>
  )
}

/** Group heading with an optional capacity meter, then its guest rows. */
function Section({ title, count, used, capacity, onTitle, children }: { title: string; count?: string; used?: number; capacity?: number; onTitle?: () => void; children: ReactNode }) {
  const over = used !== undefined && capacity !== undefined && used > capacity
  return (
    <div className="pt-2">
      <div className="flex items-center gap-2 px-2 pb-1">
        <button className="font-display text-[15px] font-semibold hover:text-wine" onClick={onTitle} disabled={!onTitle}>
          {title}
        </button>
        <span className="flex-1" />
        {capacity !== undefined && used !== undefined && (
          <span className="h-1 w-10 overflow-hidden rounded-full bg-floor">
            <span className={`block h-full rounded-full ${over ? 'bg-hard' : 'bg-ink/40'}`} style={{ width: `${Math.min(1, used / capacity) * 100}%` }} />
          </span>
        )}
        <span className={`text-[12px] tabular-nums ${over ? 'font-semibold text-hard' : 'text-dim'}`}>{count ?? `${used}/${capacity}`}</span>
      </div>
      <ul className="pb-1">{children}</ul>
    </div>
  )
}

/** Round initials chip tinted by the guest's group; matches the seat chips on the canvas. */
export function GuestChip({ g, size = 24 }: { g: Guest; size?: number }) {
  return (
    <span
      className="grid flex-none place-items-center rounded-full font-display text-[10px] font-bold text-ink ring-1 ring-ink/15"
      style={{ width: size, height: size, background: groupTint(g.group) }}
    >
      {initials(g.name)}
    </span>
  )
}

/** One guest line: chip, name, size/needs (or proposed destination), pin toggle. Selecting shows the seat explanation. */
function GuestRow({ g, sev, movedTo, seated, pinned }: { g: Guest; sev?: 'hard' | 'soft'; movedTo?: string; seated: boolean; pinned: boolean }) {
  const { guestId, selectGuest } = useUi()
  const selected = guestId === g.id
  const color = movedTo ? 'text-moved' : sev === 'hard' ? 'text-hard' : sev === 'soft' ? 'text-soft' : ''
  return (
    <li>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(GUEST_DRAG, g.id)
          e.dataTransfer.effectAllowed = 'move'
        }}
        onClick={() => {
          const seatableId = useChart.getState().chart.assignments.find((a) => a.guestId === g.id)?.seatableId ?? null
          selectGuest(selected ? null : g.id, selected ? null : seatableId)
        }}
        className={`group flex cursor-grab items-center gap-2.5 rounded-lg px-2 py-1 active:cursor-grabbing ${selected ? 'bg-ink text-white' : 'hover:bg-floor'}`}
      >
        <GuestChip g={g} />
        <span className={`truncate font-medium ${selected ? '' : color}`}>{g.name}</span>
        <span className={`ml-auto pl-1 text-[12px] whitespace-nowrap ${selected ? 'text-white/70' : 'text-dim'}`}>
          {movedTo ? <span className="font-medium text-moved">→ {movedTo}</span> : guestBadges(g)}
        </span>
        {seated && (
          <button
            title={pinned ? 'Unpin' : 'Pin to this table'}
            className={`text-[14px] ${pinned ? (selected ? 'text-white' : 'text-wine') : 'text-faint opacity-0 group-hover:opacity-100 hover:text-ink'}`}
            onClick={(e) => {
              e.stopPropagation()
              useChart.getState().pinGuest(g.id, !pinned)
            }}
          >
            <Icon name="pin" fill={pinned ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>
      {selected && <SeatExplanation guestId={g.id} />}
    </li>
  )
}

/** Why the selected guest sits where they do (explainSeat). Static text while loading. */
function SeatExplanation({ guestId }: { guestId: string }) {
  const chart = useChart((s) => s.chart)
  const [text, setText] = useState<{ key: object; value: string }>()
  useEffect(() => {
    let live = true
    explainSeat(guestId, chart, violationsOf(chart)).then((value) => live && setText({ key: chart, value }))
    return () => {
      live = false
    }
  }, [guestId, chart])
  const ready = text?.key === chart
  return (
    <p className={`mx-2 mt-1 mb-2 flex gap-2 rounded-lg border-l-2 border-wine bg-wine-soft px-2.5 py-1.5 text-[13px] ${ready ? 'text-ink' : 'text-dim'}`}>
      <Icon name="sparkle" className="mt-0.5 flex-none text-wine" />
      {ready ? text.value : 'Thinking about this seat'}
    </p>
  )
}

/** Compact list of broken rules; click one to select its first guest. */
function Problems() {
  const chart = useChart((s) => s.chart)
  const violations = violationsOf(chart)
  if (violations.length === 0) return null
  return (
    <div className="border-t border-line px-2 pt-2.5">
      <div className="px-2 pb-1 font-display text-[15px] font-semibold">
        Needs attention <span className="font-sans text-[12px] font-normal text-dim tabular-nums">{violations.length}</span>
      </div>
      <ul className="max-h-32 overflow-y-auto pb-2">
        {violations.map((v, i) => (
          <li key={`${v.ruleId}-${i}`}>
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[13px] hover:bg-floor"
              title={v.message}
              onClick={() => useUi.getState().selectGuest(v.guestIds[0] ?? null, v.seatableIds[0] ?? null)}
            >
              <i className={`size-2 flex-none rounded-full ${v.hard ? 'bg-hard' : 'bg-soft'}`} />
              <span className="truncate">{v.message}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
