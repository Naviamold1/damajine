import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent } from 'react'
import type { Decor, Seatable } from '@/domain/types'
import { useChart } from '@/store/chart'
import { AskPill } from './AskPill'
import { DecorShape } from './DecorShape'
import { groupTint, initials, severities, shortName, violationsOf } from './derived'
import { Icon } from './icons'
import { chartBounds, guestPoints, layoutSlots, seatableAt, seatOffsets, toCanvas, type Point } from './layout'
import { Palette } from './Palette'
import { ProposalBar } from './ProposalBar'
import { SeatableShape, type Tone } from './SeatableShape'
import { SelectionBar } from './SelectionBar'
import { GUEST_DRAG, isTyping, useUi } from './ui'
import { useViewport, type View } from './useViewport'

/** Seat chip radius in canvas units. Seat spacing in `seatOffsets` leaves room for it. */
export const CHIP = 10.5

/** Smallest room feature side when resizing, in canvas units. */
const MIN_DECOR = 30

type Gesture =
  /** `select`: room feature to select if this turns out to be a click (unselected features pan, so they are not dragged by accident). */
  | { kind: 'pan'; client: Point; view: View; moved: boolean; select?: string }
  | { kind: 'move'; target: 'seatable' | 'decor'; id: string; start: Point; orig: Point; moved: boolean }
  | { kind: 'resize'; id: string }

/** Uncommitted geometry while dragging; committed as one undo step on release. */
type Draft = { kind: 'seatable'; id: string; x: number; y: number } | { kind: 'decor'; decor: Decor }

/** True while the space bar is held (outside inputs), for space-drag panning. */
function useSpaceHeld() {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping()) {
        e.preventDefault()
        setHeld(true)
      }
    }
    const up = (e: KeyboardEvent) => e.code === 'Space' && setHeld(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])
  return held
}

/**
 * The seating canvas: decor, seatables, seat chips (initials tinted by group), violations and the pending proposal overlay.
 * Drag background (or space-drag) to pan, wheel to zoom, drag a table to move it (one undo step),
 * drop a guest from the sidebar onto a table to seat them. Click a table or room feature to select it
 * (SelectionBar: seats, rotate, delete); drag a selected room feature to move it, its corner handles to resize.
 */
export function Canvas() {
  const chart = useChart((s) => s.chart)
  const proposal = useChart((s) => s.proposal)
  const { moveSeatable, moveGuest, updateDecor } = useChart.getState()
  const { guestId, seatableId, decorId, selectGuest, selectSeatable, selectDecor } = useUi()
  const svgRef = useRef<SVGSVGElement>(null)
  const { view, setView, toCanvas: clientToCanvas, zoomBy, fit } = useViewport(svgRef)
  const gesture = useRef<Gesture | null>(null)
  const [draft, setDraft] = useState<Draft>()
  const [dropId, setDropId] = useState<string | null>(null)
  const space = useSpaceHeld()

  // Fit when a different chart (preset) is loaded.
  const fitKey = `${chart.kind}:${chart.name}`
  useEffect(() => fit(chartBounds(useChart.getState().chart)), [fitKey, fit])

  // Fit to the proposal when it adds tables or room features, so nothing it adds lands off screen.
  useEffect(() => {
    const current = useChart.getState().chart
    const adds = (ids: string[], have: { id: string }[]) => ids.some((id) => !have.some((x) => x.id === id))
    if (proposal && (adds(proposal.chart.seatables.map((s) => s.id), current.seatables) || adds(proposal.chart.decor.map((d) => d.id), current.decor)))
      fit(chartBounds(proposal.chart))
  }, [proposal, fit])

  // While a proposal is pending, draw the chart it would produce (new tables, guests, room features included).
  const next = proposal?.chart ?? chart
  const seatables = draft?.kind === 'seatable' ? next.seatables.map((s) => (s.id === draft.id ? { ...s, x: draft.x, y: draft.y } : s)) : next.seatables
  const decor = draft?.kind === 'decor' ? next.decor.map((d) => (d.id === draft.decor.id ? draft.decor : d)) : next.decor
  const base = useMemo(() => layoutSlots(chart, chart.assignments), [chart])
  const shown = useMemo(() => (proposal ? layoutSlots(proposal.chart, proposal.chart.assignments, base) : base), [proposal, base])
  const violations = proposal ? proposal.violations : violationsOf(chart)
  const sev = useMemo(() => severities(violations), [violations])
  const moved = new Set(proposal?.moved)
  const pinned = new Set(next.assignments.filter((a) => a.pinned).map((a) => a.guestId))
  const points = guestPoints(seatables, shown)
  const oldPoints = proposal ? guestPoints(chart.seatables, base) : points

  const onBackgroundDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return
    svgRef.current?.setPointerCapture(e.pointerId)
    gesture.current = { kind: 'pan', client: { x: e.clientX, y: e.clientY }, view, moved: false }
  }

  const onSeatableDown = (s: Seatable) => (e: PointerEvent) => {
    if (space || e.button !== 0) return
    e.stopPropagation()
    svgRef.current?.setPointerCapture(e.pointerId)
    gesture.current = { kind: 'move', target: 'seatable', id: s.id, start: clientToCanvas(e.clientX, e.clientY), orig: { x: s.x, y: s.y }, moved: false }
  }

  const onDecorDown = (d: Decor) => (e: PointerEvent) => {
    if (space || e.button !== 0) return
    e.stopPropagation()
    svgRef.current?.setPointerCapture(e.pointerId)
    gesture.current =
      d.id === decorId
        ? { kind: 'move', target: 'decor', id: d.id, start: clientToCanvas(e.clientX, e.clientY), orig: { x: d.x, y: d.y }, moved: false }
        : { kind: 'pan', client: { x: e.clientX, y: e.clientY }, view, moved: false, select: d.id }
  }

  const onHandleDown = (d: Decor) => (e: PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    svgRef.current?.setPointerCapture(e.pointerId)
    gesture.current = { kind: 'resize', id: d.id }
  }

  const onPointerMove = (e: PointerEvent) => {
    const g = gesture.current
    if (!g) return
    if (g.kind === 'pan') {
      const dx = e.clientX - g.client.x
      const dy = e.clientY - g.client.y
      g.moved ||= Math.hypot(dx, dy) > 3
      setView({ ...g.view, x: g.view.x + dx, y: g.view.y + dy })
      return
    }
    const p = clientToCanvas(e.clientX, e.clientY)
    if (g.kind === 'resize') {
      // Resize symmetrically around the center: the pointer's distance from it, in the feature's own (unrotated) frame.
      const d = chart.decor.find((x) => x.id === g.id)
      if (!d) return
      const a = (-(d.rotation ?? 0) * Math.PI) / 180
      const dx = p.x - d.x
      const dy = p.y - d.y
      const w = Math.max(MIN_DECOR, Math.round(2 * Math.abs(dx * Math.cos(a) - dy * Math.sin(a))))
      const h = Math.max(MIN_DECOR, Math.round(2 * Math.abs(dx * Math.sin(a) + dy * Math.cos(a))))
      setDraft({ kind: 'decor', decor: { ...d, w, h } })
      return
    }
    g.moved ||= Math.hypot(p.x - g.start.x, p.y - g.start.y) * view.k > 3
    if (!g.moved) return
    const x = Math.round(g.orig.x + p.x - g.start.x)
    const y = Math.round(g.orig.y + p.y - g.start.y)
    if (g.target === 'seatable') return setDraft({ kind: 'seatable', id: g.id, x, y })
    const d = chart.decor.find((it) => it.id === g.id)
    if (d) setDraft({ kind: 'decor', decor: { ...d, x, y } })
  }

  const onPointerUp = () => {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    if (g.kind === 'pan') {
      if (!g.moved) {
        if (g.select) selectDecor(g.select)
        else selectGuest(null)
      }
    } else if (draft?.kind === 'seatable') {
      moveSeatable(draft.id, draft.x, draft.y)
    } else if (draft?.kind === 'decor') {
      const { x, y, w, h } = draft.decor
      updateDecor(draft.decor.id, { x, y, w, h })
    } else if (g.kind === 'move' && g.target === 'seatable') {
      selectSeatable(g.id)
    }
    setDraft(undefined)
  }

  const dropTarget = (e: DragEvent) => seatableAt(chart.seatables, clientToCanvas(e.clientX, e.clientY))
  const onDragOver = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes(GUEST_DRAG)) return
    e.preventDefault()
    setDropId(dropTarget(e)?.id ?? null)
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDropId(null)
    const id = e.dataTransfer.getData(GUEST_DRAG)
    const target = dropTarget(e)
    if (!id || !target) return
    moveGuest(id, target.id)
    selectGuest(id, target.id)
  }

  const isNew = (s: Seatable) => proposal !== null && !chart.seatables.some((x) => x.id === s.id)
  const tone = (s: Seatable): Tone => (s.id === dropId ? 'drop' : s.id === seatableId ? 'select' : isNew(s) ? 'added' : (sev.seatables.get(s.id) ?? null))
  const used = (id: string) => (shown.get(id) ?? []).filter(Boolean).length

  return (
    <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-floor">
      <svg
        ref={svgRef}
        className={`block h-full w-full touch-none select-none ${space ? 'cursor-grab' : ''}`}
        onPointerDown={onBackgroundDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDragOver={onDragOver}
        onDragLeave={() => setDropId(null)}
        onDrop={onDrop}
      >
        <defs>
          <pattern id="grid" width={24 * view.k} height={24 * view.k} x={view.x} y={view.y} patternUnits="userSpaceOnUse">
            <circle cx={1.2} cy={1.2} r={1.2} fill="#d3d7e2" />
          </pattern>
          <filter id="lift" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#17151f" floodOpacity="0.1" />
          </filter>
          <marker id="arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0 0L10 5L0 10z" className="fill-moved" />
          </marker>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {decor.map((d) => (
            <DecorShape key={d.id} d={d} selected={d.id === decorId} onPointerDown={onDecorDown(d)} />
          ))}

          {seatables.map((s) => (
            <SeatableShape key={s.id} s={s} used={used(s.id)} tone={tone(s)} onPointerDown={onSeatableDown(s)} />
          ))}

          {/* Apart violations: dotted link between the clashing guests. */}
          {violations
            .filter((v) => v.kind === 'apart')
            .flatMap((v) =>
              v.guestIds.slice(1).map((id, i) => {
                const a = points.get(v.guestIds[i])
                const b = points.get(id)
                return a && b ? (
                  <line key={`${v.ruleId}-${id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`${v.hard ? 'stroke-hard' : 'stroke-soft'} [stroke-dasharray:3_3] [stroke-width:2]`} />
                ) : null
              }),
            )}

          {/* Proposal: ghost at the old seat and a dashed arc to the new one. */}
          {[...moved].map((id) => {
            const a = oldPoints.get(id)
            const b = points.get(id)
            if (!a) return null
            return (
              <g key={id} className="pointer-events-none">
                <circle cx={a.x} cy={a.y} r={CHIP} className="fill-none stroke-moved [stroke-dasharray:3_3] [stroke-width:1.5]" />
                {b && (
                  <path
                    d={`M${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${Math.min(a.y, b.y) - 50} ${b.x} ${b.y}`}
                    markerEnd="url(#arrow)"
                    className="fill-none stroke-moved [stroke-dasharray:5_4] [stroke-width:2]"
                  />
                )}
              </g>
            )
          })}

          {seatables.map((s) =>
            seatOffsets(s).map((off, i) => {
              const p = toCanvas(s, off)
              const slot = shown.get(s.id)?.[i]
              if (!slot)
                return <circle key={`${s.id}-${i}`} cx={p.x} cy={p.y} r={CHIP - 1} className="pointer-events-none fill-white/60 stroke-[#c4c8d4] [stroke-dasharray:3_3] [stroke-width:1.2]" />
              const g = slot.guest
              const state = proposal && moved.has(g.id) ? 'moved' : (sev.guests.get(g.id) ?? null)
              const fill = state === 'moved' ? 'fill-moved' : state === 'hard' ? 'fill-hard' : state === 'soft' ? 'fill-soft' : ''
              return (
                <g
                  key={`${s.id}-${i}`}
                  className={`cursor-pointer ${state === 'moved' ? 'animate-pop' : ''}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => selectGuest(g.id, s.id)}
                >
                  <title>{g.name}</title>
                  {g.id === guestId && <circle cx={p.x} cy={p.y} r={CHIP + 3.5} className="fill-none stroke-wine [stroke-width:2.5]" />}
                  <circle cx={p.x} cy={p.y} r={CHIP} className={`${fill} stroke-ink/25`} style={fill ? undefined : { fill: groupTint(g.group) }} />
                  <text x={p.x} y={p.y + 3.2} textAnchor="middle" className={`pointer-events-none font-display text-[9px] font-bold ${state ? 'fill-white' : 'fill-ink'} ${slot.first ? '' : 'opacity-40'}`}>
                    {slot.first ? initials(g.name) : '+'}
                  </text>
                  {pinned.has(g.id) && slot.first && <circle cx={p.x + 7.5} cy={p.y - 7.5} r={3} className="fill-wine stroke-white [stroke-width:1.2]" />}
                </g>
              )
            }),
          )}

          {/* Names only where attention is needed: violations, moves, selection. */}
          {[...points].map(([id, p]) => {
            const s = sev.guests.get(id)
            const isMoved = proposal && moved.has(id)
            if (!s && !isMoved && id !== guestId) return null
            const g = next.guests.find((x) => x.id === id)
            if (!g) return null
            const anchor = p.dir.x > 0.3 ? 'start' : p.dir.x < -0.3 ? 'end' : 'middle'
            const dy = anchor === 'middle' ? (p.dir.y < 0 ? -2 : 9) : 3
            const color = isMoved ? 'fill-moved' : s === 'hard' ? 'fill-hard' : s === 'soft' ? 'fill-soft' : 'fill-wine'
            return (
              <text
                key={id}
                x={p.x + p.dir.x * (CHIP + 5)}
                y={p.y + p.dir.y * (CHIP + 5) + dy}
                textAnchor={anchor}
                className={`pointer-events-none stroke-floor text-[10.5px] font-semibold [paint-order:stroke] [stroke-linejoin:round] [stroke-width:4] ${color}`}
              >
                {shortName(g.name)}
              </text>
            )
          })}

          {/* Resize handles on the selected room feature's corners, constant size on screen. */}
          {decor
            .filter((d) => d.id === decorId)
            .flatMap((d) =>
              [-1, 1].flatMap((sx) =>
                [-1, 1].map((sy) => {
                  const p = toCanvas({ x: d.x, y: d.y, rotation: d.rotation ?? 0 }, { x: (sx * d.w) / 2, y: (sy * d.h) / 2 })
                  const r = 5 / view.k
                  return (
                    <rect
                      key={`${sx}${sy}`}
                      x={p.x - r}
                      y={p.y - r}
                      width={r * 2}
                      height={r * 2}
                      rx={r / 3}
                      className={`fill-white stroke-wine ${sx === sy ? 'cursor-nwse-resize' : 'cursor-nesw-resize'}`}
                      strokeWidth={1.5 / view.k}
                      onPointerDown={onHandleDown(d)}
                    />
                  )
                }),
              ),
            )}
        </g>
      </svg>

      {chart.seatables.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="max-w-xs text-center">
            <div className="font-display text-[22px] font-bold">An empty room</div>
            <p className="pt-1 text-dim">Add tables from the top right, then drag them where they stand in the room.</p>
          </div>
        </div>
      )}
      <Legend />
      <SelectionBar view={view} hidden={draft !== undefined} />
      <Palette center={() => { const r = svgRef.current?.getBoundingClientRect(); return clientToCanvas((r?.left ?? 0) + (r?.width ?? 0) / 2, (r?.top ?? 0) + (r?.height ?? 0) / 2) }} />
      <div className="absolute right-4 bottom-4 flex items-center rounded-xl bg-white p-1 text-dim shadow-island">
        <button className={ZOOM_BTN} title="Zoom out" onClick={() => zoomBy(1 / 1.25)}>
          <Icon name="minus" />
        </button>
        <span className="w-11 text-center text-[12px] font-medium tabular-nums">{Math.round(view.k * 100)}%</span>
        <button className={ZOOM_BTN} title="Zoom in" onClick={() => zoomBy(1.25)}>
          <Icon name="plus" />
        </button>
        <button className={`${ZOOM_BTN} w-auto gap-1 px-2 text-[13px] font-medium`} title="Fit everything in view" onClick={() => fit(chartBounds(chart))}>
          <Icon name="fit" /> Fit
        </button>
      </div>
      {proposal ? <ProposalBar /> : <AskPill />}
    </div>
  )
}

const ZOOM_BTN = 'flex h-7 w-7 items-center justify-center rounded-lg text-[15px] hover:bg-floor hover:text-ink'

/** Chip legend, top left of the canvas. */
function Legend() {
  const items = [
    ['seated', 'bg-[#a0d2ff]'],
    ['empty', 'border border-dashed border-[#b9bdca] bg-white'],
    ['rule broken', 'bg-hard'],
    ['rule bent', 'bg-soft'],
    ['proposed move', 'bg-moved'],
    ['pinned', 'size-2! bg-wine ring-2 ring-white'],
  ]
  return (
    <div className="pointer-events-none absolute top-4 left-4 flex gap-3.5 rounded-xl bg-white/90 px-3 py-1.5 text-[12px] text-dim shadow-island">
      {items.map(([label, cls]) => (
        <span key={label} className="flex items-center gap-1.5">
          <i className={`inline-block size-2.5 rounded-full ${cls}`} />
          {label}
        </span>
      ))}
    </div>
  )
}
