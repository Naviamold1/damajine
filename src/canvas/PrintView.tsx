import type { Guest } from '@/domain/types'
import { useChart } from '@/store/chart'
import { CHIP } from './Canvas'
import { DecorShape } from './DecorShape'
import { groupTint, guestTags, initials } from './derived'
import { chartBounds, layoutSlots, seatOffsets, toCanvas } from './layout'
import { SeatableShape } from './SeatableShape'

/**
 * Print-only chart (hidden on screen, shown by `print:block`): event name, guests per table
 * in columns, an alphabetical "find your seat" index, then the seating map on its own last page.
 * Header "Print" calls window.print().
 */
export function PrintView() {
  const chart = useChart((s) => s.chart)
  const attending = chart.guests.filter((g) => g.attending)
  const label = new Map(chart.seatables.map((s) => [s.id, s.label]))
  const seatOf = new Map(chart.assignments.filter((a) => label.has(a.seatableId)).map((a) => [a.guestId, a.seatableId]))
  const seats = (gs: Guest[]) => gs.reduce((n, g) => n + g.size, 0)
  const unseated = attending.filter((g) => !seatOf.has(g.id))
  const index = [...attending].sort((a, b) => a.name.localeCompare(b.name))

  const names = (gs: Guest[]) => (
    <ul>
      {gs.map((g) => (
        <li key={g.id}>
          {g.name} <span className="text-[11px]">{guestTags(g)}</span>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="hidden bg-white p-6 text-[12px] text-black print:block">
      <h1 className="mb-3 text-[20px] font-bold">{chart.name}</h1>
      <div className="columns-3 gap-6">
        {chart.seatables.map((s) => {
          const here = attending.filter((g) => seatOf.get(g.id) === s.id)
          return (
            <section key={s.id} className="mb-3 break-inside-avoid">
              <h2 className="flex justify-between border-b border-black font-bold">
                {s.label}
                <span className="font-normal tabular-nums">
                  {seats(here)}/{s.seats}
                </span>
              </h2>
              {names(here)}
            </section>
          )
        })}
        {unseated.length > 0 && (
          <section className="mb-3 break-inside-avoid">
            <h2 className="border-b border-black font-bold">Unseated</h2>
            {names(unseated)}
          </section>
        )}
      </div>
      <h2 className="mt-4 mb-1 break-before-page text-[16px] font-bold">Find your seat</h2>
      <ol className="columns-3 gap-6">
        {index.map((g) => (
          <li key={g.id} className="flex justify-between gap-2 break-inside-avoid border-b border-[#ccc]">
            <span>{g.name}</span>
            <span className="font-semibold">{label.get(seatOf.get(g.id) ?? '') ?? '-'}</span>
          </li>
        ))}
      </ol>
      <PrintMap />
    </div>
  )
}

/** Room padding around the map, in canvas units. */
const MAP_PAD = 24

/**
 * Last print page: the room as drawn on the canvas (decor, tables, seat chips with initials), scaled to fit
 * the page in either orientation without distortion (viewBox keeps the aspect ratio; height follows the
 * page orientation). Plain chart only: no violations, selection or proposal.
 */
function PrintMap() {
  const chart = useChart((s) => s.chart)
  const bounds = chartBounds(chart)
  if (!bounds) return null
  const slots = layoutSlots(chart, chart.assignments)
  const used = (id: string) => (slots.get(id) ?? []).filter(Boolean).length
  const { minX, minY, maxX, maxY } = bounds
  const viewBox = `${minX - MAP_PAD} ${minY - MAP_PAD} ${maxX - minX + MAP_PAD * 2} ${maxY - minY + MAP_PAD * 2}`

  return (
    <section className="break-before-page">
      <h2 className="mb-1 text-[16px] font-bold">Seating map</h2>
      {/* CSS filter:none overrides the canvas drop shadow (filter attribute), which prints poorly. */}
      <svg viewBox={viewBox} className="block h-[165mm] w-full portrait:h-[225mm] [&_*]:[filter:none]">
        {chart.decor.map((d) => (
          <DecorShape key={d.id} d={d} />
        ))}
        {chart.seatables.map((s) => (
          <SeatableShape key={s.id} s={s} used={used(s.id)} tone={null} />
        ))}
        {chart.seatables.map((s) =>
          seatOffsets(s).map((off, i) => {
            const p = toCanvas(s, off)
            const slot = slots.get(s.id)?.[i]
            if (!slot) return <circle key={`${s.id}-${i}`} cx={p.x} cy={p.y} r={CHIP - 1} className="fill-white stroke-[#c4c8d4] [stroke-dasharray:3_3] [stroke-width:1.2]" />
            return (
              <g key={`${s.id}-${i}`}>
                <circle cx={p.x} cy={p.y} r={CHIP} className="stroke-ink/25" style={{ fill: groupTint(slot.guest.group) }} />
                <text x={p.x} y={p.y + 3.2} textAnchor="middle" className={`fill-ink font-display text-[9px] font-bold ${slot.first ? '' : 'opacity-40'}`}>
                  {slot.first ? initials(slot.guest.name) : '+'}
                </text>
              </g>
            )
          }),
        )}
      </svg>
    </section>
  )
}
