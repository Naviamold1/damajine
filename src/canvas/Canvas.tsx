import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent } from 'react'
import type { Seatable } from '@/domain/types'
import { useChart } from '@/store/chart'
import { severities, shortName, violationsOf } from './derived'
import { chartBounds, guestPoints, layoutSlots, seatableAt, seatOffsets, toCanvas, type Point } from './layout'
import { Palette } from './Palette'
import { ProposalBar } from './ProposalBar'
import { SeatableShape, type Tone } from './SeatableShape'
import { GUEST_DRAG, isTyping, useUi } from './ui'
import { useViewport, type View } from './useViewport'

type Gesture =
  | { kind: 'pan'; client: Point; view: View; moved: boolean }
  | { kind: 'move'; id: string; start: Point; orig: Point; moved: boolean }

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
 * The seating canvas: decor, seatables, seat dots, violations and the pending proposal overlay.
 * Drag background (or space-drag) to pan, wheel to zoom, drag a table to move it (one undo step),
 * drop a guest from the sidebar onto a table to seat them.
 */
export function Canvas() {
  const chart = useChart((s) => s.chart)
  const proposal = useChart((s) => s.proposal)
  const { moveSeatable, moveGuest } = useChart.getState()
  const { guestId, seatableId, selectGuest, selectSeatable } = useUi()
  const svgRef = useRef<SVGSVGElement>(null)
  const { view, setView, toCanvas: clientToCanvas, zoomBy, fit } = useViewport(svgRef)
  const gesture = useRef<Gesture | null>(null)
  const [drag, setDrag] = useState<{ id: string } & Point>()
  const [dropId, setDropId] = useState<string | null>(null)
  const space = useSpaceHeld()

  // Fit when a different chart (preset) is loaded.
  const fitKey = `${chart.kind}:${chart.name}`
  useEffect(() => fit(chartBounds(useChart.getState().chart)), [fitKey, fit])

  const seatables = drag ? chart.seatables.map((s) => (s.id === drag.id ? { ...s, x: drag.x, y: drag.y } : s)) : chart.seatables
  const base = useMemo(() => layoutSlots(chart, chart.assignments), [chart])
  const shown = useMemo(() => (proposal ? layoutSlots(chart, proposal.assignments, base) : base), [chart, proposal, base])
  const violations = proposal ? proposal.violations : violationsOf(chart)
  const sev = useMemo(() => severities(violations), [violations])
  const moved = new Set(proposal?.moved)
  const pinned = new Set((proposal?.assignments ?? chart.assignments).filter((a) => a.pinned).map((a) => a.guestId))
  const points = guestPoints(seatables, shown)
  const oldPoints = proposal ? guestPoints(seatables, base) : points

  const onBackgroundDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return
    svgRef.current?.setPointerCapture(e.pointerId)
    gesture.current = { kind: 'pan', client: { x: e.clientX, y: e.clientY }, view, moved: false }
  }

  const onSeatableDown = (s: Seatable) => (e: PointerEvent) => {
    if (space || e.button !== 0) return
    e.stopPropagation()
    svgRef.current?.setPointerCapture(e.pointerId)
    gesture.current = { kind: 'move', id: s.id, start: clientToCanvas(e.clientX, e.clientY), orig: { x: s.x, y: s.y }, moved: false }
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
    g.moved ||= Math.hypot(p.x - g.start.x, p.y - g.start.y) * view.k > 3
    if (g.moved) setDrag({ id: g.id, x: Math.round(g.orig.x + p.x - g.start.x), y: Math.round(g.orig.y + p.y - g.start.y) })
  }

  const onPointerUp = () => {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    if (g.kind === 'pan') {
      if (!g.moved) selectGuest(null)
    } else if (g.moved && drag) {
      moveSeatable(g.id, drag.x, drag.y)
    } else {
      selectSeatable(g.id)
    }
    setDrag(undefined)
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

  const highlight = dropId ?? seatableId
  const tone = (s: Seatable): Tone => (s.id === highlight ? 'select' : (sev.seatables.get(s.id) ?? null))
  const used = (id: string) => (shown.get(id) ?? []).filter(Boolean).length

  return (
    <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
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
            <circle cx={1} cy={1} r={0.8} fill="#1c1c1c" />
          </pattern>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0L10 5L0 10z" className="fill-moved" />
          </marker>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {chart.decor.map((d) => (
            <g key={d.id} className="pointer-events-none">
              <rect x={d.x - d.w / 2} y={d.y - d.h / 2} width={d.w} height={d.h} className="fill-none stroke-[#2e2e2e]" />
              <text x={d.x} y={d.y + 4} textAnchor="middle" className="fill-[#5c5c5c] text-[11px]">
                {d.label}
              </text>
            </g>
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
                  <line key={`${v.ruleId}-${id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`${v.hard ? 'stroke-hard' : 'stroke-soft'} [stroke-dasharray:2_2]`} />
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
                <circle cx={a.x} cy={a.y} r={5} className="fill-none stroke-moved [stroke-dasharray:2_2]" />
                {b && (
                  <path
                    d={`M${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${Math.min(a.y, b.y) - 50} ${b.x} ${b.y}`}
                    markerEnd="url(#arrow)"
                    className="fill-none stroke-moved [stroke-dasharray:4_3] [stroke-width:1.2]"
                  />
                )}
              </g>
            )
          })}

          {seatables.map((s) =>
            seatOffsets(s).map((off, i) => {
              const p = toCanvas(s, off)
              const slot = shown.get(s.id)?.[i]
              if (!slot) return <circle key={`${s.id}-${i}`} cx={p.x} cy={p.y} r={4} className="pointer-events-none fill-none stroke-[#3d3d3d]" />
              const g = slot.guest
              const state = proposal && moved.has(g.id) ? 'fill-moved' : sev.guests.get(g.id) === 'hard' ? 'fill-hard' : sev.guests.get(g.id) === 'soft' ? 'fill-soft' : g.needs.includes('kid') ? 'fill-[#bbb]' : 'fill-[#e6e6e6]'
              const big = state !== 'fill-[#e6e6e6]' && state !== 'fill-[#bbb]'
              return (
                <g
                  key={`${s.id}-${i}`}
                  className="cursor-pointer"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => selectGuest(g.id, s.id)}
                >
                  {(pinned.has(g.id) || g.id === guestId) && slot.first && (
                    <circle cx={p.x} cy={p.y} r={7} className={`fill-none ${g.id === guestId ? 'stroke-white [stroke-width:1.5]' : 'stroke-[#bbb]'}`} />
                  )}
                  <circle cx={p.x} cy={p.y} r={big ? 5 : 4.2} className={state} />
                </g>
              )
            }),
          )}

          {/* Names only where attention is needed: violations, moves, selection. */}
          {[...points].map(([id, p]) => {
            const s = sev.guests.get(id)
            const isMoved = proposal && moved.has(id)
            if (!s && !isMoved && id !== guestId) return null
            const g = chart.guests.find((x) => x.id === id)
            if (!g) return null
            const anchor = p.dir.x > 0.3 ? 'start' : p.dir.x < -0.3 ? 'end' : 'middle'
            const dy = anchor === 'middle' ? (p.dir.y < 0 ? -2 : 9) : 3
            const color = isMoved ? 'fill-moved' : s === 'hard' ? 'fill-hard' : s === 'soft' ? 'fill-soft' : 'fill-white'
            return (
              <text
                key={id}
                x={p.x + p.dir.x * 9}
                y={p.y + p.dir.y * 9 + dy}
                textAnchor={anchor}
                className={`pointer-events-none stroke-black text-[9.5px] font-semibold [paint-order:stroke] [stroke-width:3] ${color}`}
              >
                {shortName(g.name)}
              </text>
            )
          })}
        </g>
      </svg>

      <Legend />
      <Palette center={() => { const r = svgRef.current?.getBoundingClientRect(); return clientToCanvas((r?.left ?? 0) + (r?.width ?? 0) / 2, (r?.top ?? 0) + (r?.height ?? 0) / 2) }} />
      <div className="absolute right-3 bottom-3 flex items-center gap-3 text-dim">
        <button className="hover:text-white" onClick={() => zoomBy(1 / 1.25)}>−</button>
        <span className="w-10 text-center tabular-nums">{Math.round(view.k * 100)}%</span>
        <button className="hover:text-white" onClick={() => zoomBy(1.25)}>+</button>
        <button className="hover:text-white" onClick={() => fit(chartBounds(chart))}>Fit</button>
      </div>
      <ProposalBar />
    </div>
  )
}

/** Dot legend, top left of the canvas. */
function Legend() {
  const items = [
    ['seated', 'bg-[#e6e6e6]'],
    ['empty', 'border border-[#555]'],
    ['pinned', 'bg-[#e6e6e6] outline outline-1 outline-offset-1 outline-[#bbb]'],
    ['hard', 'bg-hard'],
    ['soft', 'bg-soft'],
    ['proposed', 'bg-moved'],
  ]
  return (
    <div className="pointer-events-none absolute top-2.5 left-3 flex gap-3 text-[11px] text-dim">
      {items.map(([label, cls]) => (
        <span key={label} className="flex items-center gap-1">
          <i className={`inline-block size-2 rounded-full ${cls}`} />
          {label}
        </span>
      ))}
    </div>
  )
}
