import { footprint, rotatedSize } from '@/domain/geometry'
import { useChart } from '@/store/chart'
import { Icon } from './icons'
import { useUi } from './ui'
import type { View } from './useViewport'

const STEP = 15
const MAX_SEATS = 40
const BTN_BASE = 'grid size-7 place-items-center rounded-lg text-[15px] hover:bg-floor disabled:pointer-events-none disabled:text-line'
const BTN = `${BTN_BASE} hover:text-ink`

const turn = (deg: number | undefined, by: number) => (((deg ?? 0) + by) % 360 + 360) % 360

/**
 * Floating island above the selected table or room feature: seats -/+ (tables; their size follows seat count),
 * rotate 15 degrees either way, delete. Lives in screen space, placed from the canvas `view`; flips below the
 * selection when there is no room above. Hidden while the canvas is dragging. Every change is one undo step.
 */
export function SelectionBar({ view, hidden }: { view: View; hidden: boolean }) {
  const chart = useChart((s) => s.chart)
  const { guestId, seatableId, decorId } = useUi()
  // A selected guest also highlights their table; the bar is for the table itself.
  const s = !guestId && seatableId ? chart.seatables.find((x) => x.id === seatableId) : undefined
  const d = decorId ? chart.decor.find((x) => x.id === decorId) : undefined
  if (hidden || (!s && !d)) return null

  const { updateSeatable, updateDecor, removeSeatable, removeDecor } = useChart.getState()
  const ui = useUi.getState()
  const box = s ? { x: s.x, y: s.y, ...rotatedSize(footprint(s).w, footprint(s).h, s.rotation) } : d ? { x: d.x, y: d.y, ...rotatedSize(d.w, d.h, d.rotation) } : null
  if (!box) return null

  // Margin clears seat chips that sit just outside a table's footprint.
  const above = (box.y - box.h / 2 - 16) * view.k + view.y
  const below = (box.y + box.h / 2 + 16) * view.k + view.y
  const flip = above < 64
  const rotate = (by: number) => (s ? updateSeatable(s.id, { rotation: turn(s.rotation, by) }) : d && updateDecor(d.id, { rotation: turn(d.rotation, by) }))
  const remove = () => {
    if (s) {
      removeSeatable(s.id)
      ui.selectSeatable(null)
    } else if (d) {
      removeDecor(d.id)
      ui.selectDecor(null)
    }
  }

  return (
    <div
      className="absolute z-[1] flex items-center gap-0.5 rounded-xl bg-white p-1 text-dim shadow-island"
      style={{ left: box.x * view.k + view.x, top: flip ? below : above, transform: `translate(-50%, ${flip ? '0' : '-100%'})` }}
    >
      <span className="max-w-32 truncate px-2 font-display text-[13px] font-bold text-ink">{s?.label ?? d?.label}</span>
      {s && (
        <>
          <span className="h-5 border-l border-line" />
          <span className="pl-2 text-[12px] font-medium">Seats</span>
          <button className={BTN} title="Remove a seat" disabled={s.seats <= 1} onClick={() => updateSeatable(s.id, { seats: s.seats - 1 })}>
            <Icon name="minus" />
          </button>
          <span className="w-5 text-center font-semibold text-ink tabular-nums">{s.seats}</span>
          <button className={BTN} title="Add a seat" disabled={s.seats >= MAX_SEATS} onClick={() => updateSeatable(s.id, { seats: s.seats + 1 })}>
            <Icon name="plus" />
          </button>
        </>
      )}
      <span className="h-5 border-l border-line" />
      <button className={BTN} title={`Rotate left ${STEP}°`} onClick={() => rotate(-STEP)}>
        <Icon name="rotateLeft" />
      </button>
      <button className={BTN} title={`Rotate right ${STEP}°`} onClick={() => rotate(STEP)}>
        <Icon name="rotateRight" />
      </button>
      <span className="h-5 border-l border-line" />
      <button className={`${BTN_BASE} hover:text-hard`} title={s ? 'Delete table (Delete). Its guests become unseated.' : 'Delete (Delete)'} onClick={remove}>
        <Icon name="trash" />
      </button>
    </div>
  )
}
