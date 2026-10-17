import type { PointerEvent } from 'react'
import { footprint } from '@/domain/geometry'
import type { Seatable } from '@/domain/types'
import { toCanvas } from './layout'

export type Tone = 'hard' | 'soft' | 'select' | 'drop' | null

const STROKE: Record<NonNullable<Tone>, string> = { hard: 'stroke-hard', soft: 'stroke-soft', select: 'stroke-wine', drop: 'stroke-wine' }

/**
 * Table body for one seatable, drawn by kind with `footprint()` sizes and rotation.
 * Labels are placed in canvas space so they stay upright. Seat chips are drawn by the canvas on top.
 * Uses the `lift` shadow filter defined in the canvas `<defs>`. The print map draws it without a pointer handler.
 */
export function SeatableShape({ s, used, tone, onPointerDown }: { s: Seatable; used: number; tone: Tone; onPointerDown?: (e: PointerEvent) => void }) {
  const { w, h } = footprint(s)
  const stroke = tone ? `${STROKE[tone]} [stroke-width:2.5]` : 'stroke-[#d5d8e2] [stroke-width:1.5]'
  const fill = tone === 'drop' ? 'fill-wine-soft' : 'fill-white'
  const body = `${fill} ${stroke} ${tone === 'drop' ? '[stroke-dasharray:6_4]' : ''}`
  const capTone = used > s.seats || tone === 'hard' ? 'fill-hard' : tone === 'soft' ? 'fill-soft' : 'fill-dim'
  const cap = `${used}/${s.seats}${s.accessible ? ' ♿︎' : ''}`

  const shape = (() => {
    switch (s.kind) {
      case 'round':
        return <circle className={body} r={w / 2 - 20} filter="url(#lift)" />
      case 'rect':
        return <rect className={body} x={-w / 2} y={-(h - 24) / 2} width={w} height={h - 24} rx={6} filter="url(#lift)" />
      case 'booth':
        return (
          <>
            <rect className="fill-[#e3d3dc] stroke-[#cdb3c1]" x={-w / 2} y={-h / 2} width={10} height={h} rx={4} />
            <rect className="fill-[#e3d3dc] stroke-[#cdb3c1]" x={w / 2 - 10} y={-h / 2} width={10} height={h} rx={4} />
            <rect className={body} x={-16} y={-h / 2 + 2} width={32} height={h - 4} rx={4} filter="url(#lift)" />
          </>
        )
      case 'row':
        return <line className={tone ? stroke : 'stroke-[#c4c8d4] [stroke-width:3]'} strokeLinecap="round" x1={-w / 2 + 6} x2={w / 2 - 6} y1={10} y2={10} />
      case 'bar':
        return <rect className={body} x={-w / 2} y={4} width={w} height={12} rx={6} filter="url(#lift)" />
      case 'zone':
        return <rect className={`${tone === 'drop' ? 'fill-wine-soft' : 'fill-white/50'} ${tone ? stroke : 'stroke-[#b9bdca] [stroke-width:1.5]'} [stroke-dasharray:6_5]`} x={-w / 2} y={-h / 2} width={w} height={h} rx={12} />
    }
  })()

  const twoLine = s.kind === 'round' || s.kind === 'booth'
  const labelAt = toCanvas(
    s,
    twoLine ? { x: 0, y: -1 } : s.kind === 'rect' ? { x: 0, y: 4 } : s.kind === 'bar' ? { x: 0, y: 12 } : s.kind === 'row' ? { x: 0, y: 26 } : { x: 0, y: -h / 2 - 6 },
  )

  return (
    <g className="cursor-move" onPointerDown={onPointerDown}>
      <g transform={`translate(${s.x} ${s.y}) rotate(${s.rotation})`}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="transparent" />
        {shape}
      </g>
      <text x={labelAt.x} y={labelAt.y} textAnchor="middle" className="pointer-events-none fill-ink font-display text-[11px] font-bold select-none">
        {s.label}
        {!twoLine && <tspan className={`font-sans text-[9.5px] font-medium ${capTone}`}> {cap}</tspan>}
      </text>
      {twoLine && (
        <text x={labelAt.x} y={labelAt.y + 12} textAnchor="middle" className={`pointer-events-none text-[9.5px] font-medium select-none ${capTone}`}>
          {cap}
        </text>
      )}
    </g>
  )
}
