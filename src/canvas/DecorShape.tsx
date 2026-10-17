import type { PointerEvent } from 'react'
import type { Decor } from '@/domain/types'

/**
 * A room feature (stage, dance floor...): rounded box and label, rotated together around the center.
 * Drawn by the canvas (selectable, with `onPointerDown`) and by the print map (static).
 */
export function DecorShape({ d, selected = false, onPointerDown }: { d: Decor; selected?: boolean; onPointerDown?: (e: PointerEvent) => void }) {
  return (
    <g transform={`translate(${d.x} ${d.y}) rotate(${d.rotation ?? 0})`} className={onPointerDown ? (selected ? 'cursor-move' : 'cursor-pointer') : ''} onPointerDown={onPointerDown}>
      <rect
        x={-d.w / 2}
        y={-d.h / 2}
        width={d.w}
        height={d.h}
        rx={10}
        className={`fill-[#e2e5ed] ${selected ? 'stroke-wine [stroke-width:2.5]' : 'stroke-[#cfd3de] [stroke-width:1.5]'}`}
      />
      <text y={4} textAnchor="middle" className="pointer-events-none fill-faint font-display text-[12px] font-bold tracking-[0.12em] uppercase select-none">
        {d.label}
      </text>
    </g>
  )
}
