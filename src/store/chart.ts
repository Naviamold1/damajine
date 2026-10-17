import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { removeGuests, removeSeatables } from '@/domain/edits'
import { emptyChart, type Assignment, type Chart, type Decor, type Guest, type Proposal, type Rule, type Seatable } from '@/domain/types'

/** An event made with "New event": a chart that always has an `id`. */
export type SavedEvent = Chart & { id: string }

type ChartState = {
  chart: Chart
  /** The user's own events, in creation order. Kept in sync with `chart` while one is open. */
  events: SavedEvent[]
  past: Chart[]
  future: Chart[]
  /** Pending solver/AI change shown as an overlay. Not part of undo history until kept. */
  proposal: Proposal | null
  /** Apply a change and record it for undo. Every edit (human or AI) goes through here. */
  commit: (update: (chart: Chart) => Chart) => void
  undo: () => void
  redo: () => void

  /** Replace the whole chart (preset switch, saved event switch). Undoable. */
  loadChart: (chart: Chart) => void
  /** Open a brand new event and add it to `events`. Undoable; undo goes back but the event stays saved. */
  createEvent: (chart: SavedEvent) => void
  /** Rename the open chart. Undoable, and synced into `events` like any edit. */
  renameChart: (name: string) => void
  /** Forget a saved event. Not undoable; the header confirms first and switches away if it is open. */
  deleteEvent: (id: string) => void
  addGuest: (guest: Guest) => void
  /** Add many guests as one undo step (import). */
  addGuests: (guests: Guest[]) => void
  removeGuest: (guestId: string) => void
  /** Seat a guest at a seatable, or unseat with `null`. Keeps the pin flag if already seated. */
  moveGuest: (guestId: string, seatableId: string | null) => void
  pinGuest: (guestId: string, pinned: boolean) => void
  addSeatable: (seatable: Seatable) => void
  removeSeatable: (seatableId: string) => void
  moveSeatable: (seatableId: string, x: number, y: number) => void
  /** Change a seatable's seats, rotation, etc. */
  updateSeatable: (seatableId: string, patch: Partial<Omit<Seatable, 'id'>>) => void
  /** Move, resize or rotate a room feature. */
  updateDecor: (decorId: string, patch: Partial<Omit<Decor, 'id'>>) => void
  removeDecor: (decorId: string) => void
  addRule: (rule: Rule) => void
  removeRule: (ruleId: string) => void
  applyAssignments: (assignments: Assignment[]) => void

  propose: (proposal: Proposal) => void
  /** Commit the proposal's chart as one undo step. */
  keepProposal: () => void
  revertProposal: () => void
}

const HISTORY_LIMIT = 100

/** Write the open chart back into its saved event, if it is one, so switching away and back keeps every edit. */
function synced(events: SavedEvent[], chart: Chart): SavedEvent[] {
  const { id } = chart
  return id ? events.map((e) => (e.id === id ? { ...chart, id } : e)) : events
}

export const useChart = create<ChartState>()(
  persist(
    (set, get) => {
      // Any edit makes a pending proposal stale (it was computed against the old chart), so drop it.
      const commit: ChartState['commit'] = (update) =>
        set((s) => {
          const chart = update(s.chart)
          return { chart, events: synced(s.events, chart), past: [...s.past, s.chart].slice(-HISTORY_LIMIT), future: [], proposal: null }
        })

      return {
        chart: emptyChart(),
        events: [],
        past: [],
        future: [],
        proposal: null,
        commit,
        undo: () =>
          set((s) => {
            const prev = s.past.at(-1)
            return prev ? { chart: prev, events: synced(s.events, prev), past: s.past.slice(0, -1), future: [s.chart, ...s.future], proposal: null } : s
          }),
        redo: () =>
          set((s) => {
            const [next, ...rest] = s.future
            return next ? { chart: next, events: synced(s.events, next), past: [...s.past, s.chart], future: rest, proposal: null } : s
          }),

        loadChart: (chart) => commit(() => chart),
        createEvent: (chart) => {
          set((s) => ({ events: [...s.events, chart] }))
          commit(() => chart)
        },
        renameChart: (name) => commit((c) => ({ ...c, name })),
        deleteEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
        addGuest: (guest) => commit((c) => ({ ...c, guests: [...c.guests, guest] })),
        addGuests: (guests) => commit((c) => ({ ...c, guests: [...c.guests, ...guests] })),
        removeGuest: (guestId) => commit((c) => removeGuests(c, new Set([guestId]))),
        moveGuest: (guestId, seatableId) =>
          commit((c) => {
            const rest = c.assignments.filter((a) => a.guestId !== guestId)
            if (seatableId === null) return { ...c, assignments: rest }
            const pinned = c.assignments.find((a) => a.guestId === guestId)?.pinned ?? false
            return { ...c, assignments: [...rest, { guestId, seatableId, pinned }] }
          }),
        pinGuest: (guestId, pinned) =>
          commit((c) => ({
            ...c,
            assignments: c.assignments.map((a) => (a.guestId === guestId ? { ...a, pinned } : a)),
          })),
        addSeatable: (seatable) => commit((c) => ({ ...c, seatables: [...c.seatables, seatable] })),
        removeSeatable: (seatableId) => commit((c) => removeSeatables(c, new Set([seatableId]))),
        moveSeatable: (seatableId, x, y) =>
          commit((c) => ({ ...c, seatables: c.seatables.map((s) => (s.id === seatableId ? { ...s, x, y } : s)) })),
        updateSeatable: (seatableId, patch) =>
          commit((c) => ({ ...c, seatables: c.seatables.map((s) => (s.id === seatableId ? { ...s, ...patch } : s)) })),
        updateDecor: (decorId, patch) => commit((c) => ({ ...c, decor: c.decor.map((d) => (d.id === decorId ? { ...d, ...patch } : d)) })),
        removeDecor: (decorId) => commit((c) => ({ ...c, decor: c.decor.filter((d) => d.id !== decorId) })),
        addRule: (rule) => commit((c) => ({ ...c, rules: [...c.rules, rule] })),
        removeRule: (ruleId) => commit((c) => ({ ...c, rules: c.rules.filter((r) => r.id !== ruleId) })),
        applyAssignments: (assignments) => commit((c) => ({ ...c, assignments })),

        propose: (proposal) => set({ proposal }),
        keepProposal: () => {
          const { proposal } = get()
          if (!proposal) return
          commit(() => proposal.chart)
          set({ proposal: null })
        },
        revertProposal: () => set({ proposal: null }),
      }
    },
    { name: 'damajine-chart', partialize: (s) => ({ chart: s.chart, events: s.events }) },
  ),
)
