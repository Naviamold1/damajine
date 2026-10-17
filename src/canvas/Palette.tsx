import { SeatableKind } from '@/domain/types'
import { useChart } from '@/store/chart'
import type { Point } from './layout'
import { useUi } from './ui'

const SEATS: Record<SeatableKind, number> = { round: 8, rect: 8, booth: 4, row: 8, bar: 6, zone: 6 }
const PREFIX: Record<SeatableKind, string> = { round: 'T', rect: 'T', booth: 'B', row: 'Row ', bar: 'Bar ', zone: 'Zone ' }

/** Add-a-table buttons, top right of the canvas. New tables land at the view center, selected. */
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
    <div className="absolute top-2.5 right-3 flex gap-3 text-[11px] text-dim">
      <span>add</span>
      {SeatableKind.options.map((k) => (
        <button key={k} className="hover:text-white" onClick={() => add(k)}>
          {k}
        </button>
      ))}
    </div>
  )
}
