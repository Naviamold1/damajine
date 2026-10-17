import type { Guest } from '@/domain/types'
import { useChart } from '@/store/chart'
import { guestTags } from './derived'

/**
 * Print-only chart (hidden on screen, shown by `print:block`): event name, guests per table
 * in columns, then an alphabetical "find your seat" index. Header "Print" calls window.print().
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
    </div>
  )
}
