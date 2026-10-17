import { useState } from 'react'
import { emptyChart, type EventKind } from '@/domain/types'
import { useChart } from '@/store/chart'
import { Icon } from './icons'
import { useUi } from './ui'

const KINDS: { kind: EventKind; emoji: string; label: string }[] = [
  { kind: 'wedding', emoji: '💍', label: 'Wedding' },
  { kind: 'corporate', emoji: '💼', label: 'Corporate' },
  { kind: 'restaurant', emoji: '🍽️', label: 'Restaurant' },
  { kind: 'hackathon', emoji: '💻', label: 'Hackathon' },
  { kind: 'auditorium', emoji: '🎭', label: 'Auditorium' },
  { kind: 'train', emoji: '🚆', label: 'Train' },
  { kind: 'custom', emoji: '✨', label: 'Other' },
]

/**
 * "New event" dialog from the header: name and event kind (passed to the AI and the solver), starting from an empty room.
 * Creating is one undo step. "Create from image" is a placeholder with no logic yet.
 */
export function NewEventPanel() {
  const open = useUi((s) => s.newOpen)
  if (!open) return null
  return <NewEventPanelOpen />
}

function NewEventPanelOpen() {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<EventKind>('wedding')
  const close = () => useUi.getState().setNewOpen(false)

  const create = () => {
    useChart.getState().loadChart(emptyChart(kind, name.trim() || 'My event'))
    useUi.getState().selectGuest(null)
    close()
  }

  return (
    <div
      className="fixed inset-0 z-10 bg-ink/25"
      onPointerDown={close}
      onKeyDown={(e) => {
        // Esc closes the dialog without reaching the global shortcuts.
        if (e.key === 'Escape') {
          e.stopPropagation()
          close()
        }
      }}
    >
      <div className="absolute top-20 left-1/2 w-[620px] max-w-[calc(100%-32px)] -translate-x-1/2 animate-pop overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-ink/10" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-5 pt-5">
          <span className="font-display text-[22px] font-bold">New event</span>
          <span className="flex-1" />
          <button title="Close" className="grid size-7 place-items-center rounded-lg text-dim hover:bg-floor hover:text-ink" onClick={close}>
            <Icon name="close" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <input
            autoFocus
            className="w-full rounded-xl bg-floor px-3 py-2.5 text-[16px] outline-none placeholder:text-faint focus:ring-2 focus:ring-wine/30"
            placeholder="Name it, like Ana's 30th birthday"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation()
                create()
              }
            }}
          />
        </div>

        <div className="grid grid-cols-4 gap-2 px-5 pt-4">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left font-medium ring-1 ${kind === k.kind ? 'bg-wine-soft text-wine ring-wine' : 'ring-line hover:bg-floor'}`}
              onClick={() => setKind(k.kind)}
            >
              <span className="text-[18px]">{k.emoji}</span>
              {k.label}
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-2 bg-floor px-5 py-3">
          <button disabled title="Coming soon" className="flex items-center gap-2 rounded-lg px-3 py-1.5 font-medium text-faint">
            <Icon name="image" /> Create from image
            <span className="rounded-md bg-white px-1.5 text-[11px] text-dim">coming soon</span>
          </button>
          <span className="flex-1" />
          <button className="rounded-lg bg-ink px-4 py-1.5 font-semibold text-white hover:bg-wine" onClick={create}>
            Create event
          </button>
        </div>
      </div>
    </div>
  )
}
