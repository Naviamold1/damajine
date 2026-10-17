import { useEffect, useState, type DragEvent, type ReactNode } from 'react'
import { explainSeat } from '@/ai/explain'
import type { Guest } from '@/domain/types'
import { useChart } from '@/store/chart'
import { guestTags, severities, violationsOf } from './derived'
import { FlowResult } from './FlowResult'
import { GUEST_DRAG, useUi } from './ui'
import { resolveName, useRuleFlow } from './useRuleFlow'

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
 * Left column: guest search, unseated guests, seated guests grouped by table, problems, rule box.
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
  const label = (id: string | undefined) => chart.seatables.find((s) => s.id === id)?.label ?? 'none'
  const movedTo = new Map(proposal?.moved.map((id) => [id, label(proposal.assignments.find((a) => a.guestId === id)?.seatableId)]))
  const unseated = shown.filter((g) => !chart.seatables.some((s) => s.id === seatOf.get(g.id)))
  const seats = (gs: Guest[]) => gs.reduce((n, g) => n + g.size, 0)

  const row = (g: Guest) => <GuestRow key={g.id} g={g} sev={sev.get(g.id)} movedTo={movedTo.get(g.id)} seated={seatOf.has(g.id)} pinned={chart.assignments.some((a) => a.guestId === g.id && a.pinned)} />

  return (
    <aside className="flex w-[270px] flex-none flex-col overflow-hidden border-r border-line" {...dropProps(null)}>
      <input
        className="mx-2.5 mt-2 border border-line bg-black px-2 py-1 outline-none placeholder:text-dim focus:border-[#555]"
        placeholder={`Search ${attending.length} guests`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        <Section title="Unseated" count={`${unseated.length} · ${seats(unseated)} seats`}>
          {unseated.map(row)}
        </Section>
        {chart.seatables.map((s) => {
          const here = shown.filter((g) => seatOf.get(g.id) === s.id)
          if (q && here.length === 0) return null
          return (
            <div key={s.id} {...dropProps(s.id)}>
              <Section title={s.label} count={`${seats(here)}/${s.seats}`} onTitle={() => useUi.getState().selectSeatable(s.id)}>
                {here.map(row)}
              </Section>
            </div>
          )
        })}
      </div>
      <Problems />
      <RuleBox key={chart.name} />
    </aside>
  )
}

function Section({ title, count, onTitle, children }: { title: string; count: string; onTitle?: () => void; children: ReactNode }) {
  return (
    <>
      <div className="flex justify-between px-2.5 pt-2.5 pb-1 font-semibold">
        <button className="text-left" onClick={onTitle}>
          {title}
        </button>
        <span className="font-normal text-dim tabular-nums">{count}</span>
      </div>
      <ul>{children}</ul>
    </>
  )
}

/** One guest line: drag handle, name, size/needs (or proposed destination), pin toggle. Selecting shows the seat explanation. */
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
        className={`group flex cursor-grab items-center px-2.5 py-0.5 ${selected ? 'bg-[#141414]' : 'hover:bg-[#0b0b0b]'} ${color}`}
      >
        <span className="mr-1.5 text-[#444]">⠿</span>
        <span className="truncate">{g.name}</span>
        <span className="ml-auto pl-2 text-[11px] whitespace-nowrap text-dim">{movedTo ? <span className="text-moved">→ {movedTo}</span> : guestTags(g)}</span>
        {seated && (
          <button
            title={pinned ? 'Unpin' : 'Pin to this table'}
            className={`ml-2 text-[11px] ${pinned ? 'text-white' : 'text-[#444] opacity-0 group-hover:opacity-100'}`}
            onClick={(e) => {
              e.stopPropagation()
              useChart.getState().pinGuest(g.id, !pinned)
            }}
          >
            pin
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
  return <p className="px-2.5 pt-0.5 pb-1.5 pl-6 text-[12px] text-dim">{text?.key === chart ? text.value : 'Explaining'}</p>
}

/** Compact list of broken rules; click one to select its first guest. */
function Problems() {
  const chart = useChart((s) => s.chart)
  const violations = violationsOf(chart)
  if (violations.length === 0) return null
  const hard = violations.filter((v) => v.hard).length
  return (
    <div className="border-t border-line">
      <div className="flex justify-between px-2.5 pt-2 pb-1 font-semibold">
        Problems
        <span className="font-normal">
          {hard > 0 && <span className="text-hard">{hard} hard</span>}
          {hard > 0 && hard < violations.length && <span className="text-dim"> · </span>}
          {violations.length > hard && <span className="text-soft">{violations.length - hard} soft</span>}
        </span>
      </div>
      <ul className="max-h-28 overflow-y-auto pb-1.5">
        {violations.map((v, i) => (
          <li key={`${v.ruleId}-${i}`}>
            <button
              className={`w-full truncate px-2.5 text-left text-[12px] ${v.hard ? 'text-hard' : 'text-soft'}`}
              title={v.message}
              onClick={() => useUi.getState().selectGuest(v.guestIds[0] ?? null, v.seatableIds[0] ?? null)}
            >
              {v.message}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Plain-language rule input. Enter parses, repairs and proposes; ambiguous names ask back first. */
function RuleBox() {
  const [text, setText] = useState('')
  const { flow, run } = useRuleFlow()
  const submit = async (t: string) => {
    if (!t.trim()) return
    const proposal = await run(t)
    if (proposal) useChart.getState().propose(proposal)
  }
  return (
    <div className="border-t border-line p-2.5">
      <input
        className="w-full border border-[#555] bg-black px-2 py-1.5 outline-none placeholder:text-dim focus:border-white"
        placeholder="Add a rule"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') e.stopPropagation()
          if (e.key === 'Enter') submit(text)
          if (e.key === 'Escape') e.currentTarget.blur()
        }}
      />
      <div className="pt-1.5 text-[12px] empty:hidden">
        <FlowResult
          flow={flow}
          onPick={(name, guest) => {
            const next = resolveName(text, name, guest)
            setText(next)
            submit(next)
          }}
        />
      </div>
    </div>
  )
}
