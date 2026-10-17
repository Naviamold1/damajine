import type { ReactNode } from 'react'
import { SeatableKind } from '@/domain/types'
import { useChart } from '@/store/chart'
import type { Point } from './layout'
import { useUi } from './ui'

const SEATS: Record<SeatableKind, number> = { round: 8, rect: 8, booth: 4, row: 8, bar: 6, zone: 6 }
const PREFIX: Record<SeatableKind, string> = { round: 'T', rect: 'T', booth: 'B', row: 'Row ', bar: 'Bar ', zone: 'Zone ' }
const NAME: Record<SeatableKind, string> = { round: 'Round', rect: 'Long', booth: 'Booth', row: 'Row', bar: 'Bar', zone: 'Zone' }

const seat = (cx: number, cy: number) => <circle cx={cx} cy={cy} r={2.4} className="fill-[#a0d2ff] stroke-ink/40" strokeWidth={0.8} />
const body = 'fill-white stroke-ink/50'

/** Tiny drawing of each kind for the dock buttons. 28x20 viewBox. */
const GLYPH: Record<SeatableKind, ReactNode> = {
  round: (
    <>
      <circle cx={14} cy={10} r={5} className={body} />
      {[0, 1, 2, 3, 4, 5].map((i) => <g key={i}>{seat(14 + Math.cos((i * Math.PI) / 3) * 8.5, 10 + Math.sin((i * Math.PI) / 3) * 8.5)}</g>)}
    </>
  ),
  rect: (
    <>
      <rect x={4} y={7.5} width={20} height={5} rx={1} className={body} />
      {[8, 14, 20].map((x) => <g key={x}>{seat(x, 3.5)}{seat(x, 16.5)}</g>)}
    </>
  ),
  booth: (
    <>
      <rect x={3} y={3} width={3} height={14} rx={1} className="fill-[#e3d3dc]" />
      <rect x={22} y={3} width={3} height={14} rx={1} className="fill-[#e3d3dc]" />
      <rect x={11.5} y={4} width={5} height={12} rx={1} className={body} />
      {seat(8.5, 7)}{seat(8.5, 13)}{seat(19.5, 7)}{seat(19.5, 13)}
    </>
  ),
  row: (
    <>
      <line x1={3} x2={25} y1={15} y2={15} className="stroke-ink/40" strokeWidth={1.5} strokeLinecap="round" />
      {[6, 11, 17, 22].map((x) => <g key={x}>{seat(x, 9)}</g>)}
    </>
  ),
  bar: (
    <>
      <rect x={3} y={11} width={22} height={4} rx={2} className={body} />
      {[7, 14, 21].map((x) => <g key={x}>{seat(x, 6)}</g>)}
    </>
  ),
  zone: (
    <>
      <rect x={3} y={3} width={22} height={14} rx={3} className="fill-none stroke-ink/40" strokeDasharray="2 2" />
      {[9, 14, 19].map((x) => <g key={x}>{seat(x, 10)}</g>)}
    </>
  ),
}

/** Add-a-table dock, top right of the canvas. New tables land at the view center, selected. */
export function Palette({ center }: { center: () => Point }) {
  const add = (kind: SeatableKind) => {
    const { chart, addSeatable } = useChart.getState()
    const n = chart.seatables.filter((s) => PREFIX[s.kind] === PREFIX[kind]).length + 1
    const c = center()
    const id = `${kind}-${crypto.randomUUID().slice(0, 8)}`
    addSeatable({ id, kind, label: `${PREFIX[kind]}${n}`, seats: SEATS[kind], x: Math.round(c.x), y: Math.round(c.y), rotation: 0, accessible: false })
    useUi.getState().selectSeatable(id)
  }
  return (
    <div className="absolute top-4 right-4 flex items-center gap-0.5 rounded-xl bg-white p-1 shadow-island">
      <span className="px-2 text-[12px] font-medium text-dim">Add</span>
      {SeatableKind.options.map((k) => (
        <button key={k} title={`Add a ${NAME[k].toLowerCase()} ${k === 'zone' ? '' : 'table'}`.trim()} className="flex flex-col items-center rounded-lg px-1.5 pt-1 pb-0.5 text-[11px] text-dim hover:bg-floor hover:text-ink" onClick={() => add(k)}>
          <svg viewBox="0 0 28 20" width={28} height={20} aria-hidden>
            {GLYPH[k]}
          </svg>
          {NAME[k]}
        </button>
      ))}
    </div>
  )
}
