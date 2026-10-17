import type { PointerEvent } from 'react'
import { footprint } from '@/domain/geometry'
import type { Seatable } from '@/domain/types'
import { toCanvas } from './layout'

export type Tone = 'hard' | 'soft' | 'select' | null

const STROKE: Record<NonNullable<Tone>, string> = { hard: 'stroke-hard', soft: 'stroke-soft', select: 'stroke-white' }

/**
 * Table body for one seatable, drawn by kind with `footprint()` sizes and rotation.
 * Labels are placed in canvas space so they stay upright. Seat dots are drawn by the canvas on top.
 */
export function SeatableShape({ s, used, tone, onPointerDown }: { s: Seatable; used: number; tone: Tone; onPointerDown: (e: PointerEvent) => void }) {
  const { w, h } = footprint(s)
  const stroke = tone ? STROKE[tone] : 'stroke-[#3a3a3a]'
  const body = `fill-[#0b0b0b] ${stroke} ${tone ? '[stroke-width:1.6]' : ''}`
  const capTone = used > s.seats || tone === 'hard' ? 'fill-hard' : tone === 'soft' ? 'fill-soft' : 'fill-dim'
  const cap = `${used}/${s.seats}${s.accessible ? ' ♿︎' : ''}`

  const shape = (() => {
    switch (s.kind) {
      case 'round':
        return <circle className={body} r={w / 2 - 18} />
      case 'rect':
        return <rect className={body} x={-w / 2} y={-(h - 24) / 2} width={w} height={h - 24} />
      case 'booth':
        return (
          <>
            <rect className="fill-[#1a1a1a] stroke-[#333]" x={-w / 2} y={-h / 2} width={8} height={h} />
            <rect className="fill-[#1a1a1a] stroke-[#333]" x={w / 2 - 8} y={-h / 2} width={8} height={h} />
            <rect className={body} x={-18} y={-h / 2 + 2} width={36} height={h - 4} />
          </>
        )
      case 'row':
        return <line className={tone ? stroke : 'stroke-[#444]'} x1={-w / 2 + 6} x2={w / 2 - 6} y1={10} y2={10} />
      case 'bar':
        return <rect className={body} x={-w / 2} y={2} width={w} height={12} />
      case 'zone':
        return <rect className={`fill-none ${tone ? stroke : 'stroke-[#555]'} [stroke-dasharray:4_4]`} x={-w / 2} y={-h / 2} width={w} height={h} />
    }
  })()

  const twoLine = s.kind === 'round' || s.kind === 'booth'
  const labelAt = toCanvas(
    s,
    twoLine ? { x: 0, y: -1 } : s.kind === 'rect' ? { x: 0, y: 4 } : s.kind === 'bar' ? { x: 0, y: 11 } : s.kind === 'row' ? { x: 0, y: 24 } : { x: 0, y: -h / 2 - 5 },
  )

  return (
    <g className="cursor-move" onPointerDown={onPointerDown}>
      <g transform={`translate(${s.x} ${s.y}) rotate(${s.rotation})`}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="transparent" />
        {shape}
      </g>
      <text x={labelAt.x} y={labelAt.y} textAnchor="middle" className="pointer-events-none select-none fill-white text-[10px] font-semibold">
        {s.label}
        {!twoLine && <tspan className={`text-[9px] font-normal ${capTone}`}> {cap}</tspan>}
      </text>
      {twoLine && (
        <text x={labelAt.x} y={labelAt.y + 11} textAnchor="middle" className={`pointer-events-none select-none text-[9px] ${capTone}`}>
          {cap}
        </text>
      )}
    </g>
  )
}
