import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { emptyChart, type Assignment, type Chart, type Guest, type Proposal, type Rule, type Seatable } from '@/domain/types'

type ChartState = {
  chart: Chart
  past: Chart[]
  future: Chart[]
  /** Pending solver/AI change shown as an overlay. Not part of undo history until kept. */
  proposal: Proposal | null
  /** Apply a change and record it for undo. Every edit (human or AI) goes through here. */
  commit: (update: (chart: Chart) => Chart) => void
  undo: () => void
  redo: () => void

  /** Replace the whole chart (preset switch, import). Undoable. */
  loadChart: (chart: Chart) => void
  addGuest: (guest: Guest) => void
  removeGuest: (guestId: string) => void
  /** Seat a guest at a seatable, or unseat with `null`. Keeps the pin flag if already seated. */
  moveGuest: (guestId: string, seatableId: string | null) => void
  pinGuest: (guestId: string, pinned: boolean) => void
  addSeatable: (seatable: Seatable) => void
  removeSeatable: (seatableId: string) => void
  moveSeatable: (seatableId: string, x: number, y: number) => void
  addRule: (rule: Rule) => void
  removeRule: (ruleId: string) => void
  applyAssignments: (assignments: Assignment[]) => void

  propose: (proposal: Proposal) => void
  /** Commit the proposal's rules and assignments as one undo step. */
  keepProposal: () => void
  revertProposal: () => void
}

const HISTORY_LIMIT = 100

export const useChart = create<ChartState>()(
  persist(
    (set, get) => {
      const commit: ChartState['commit'] = (update) =>
        set((s) => ({ chart: update(s.chart), past: [...s.past, s.chart].slice(-HISTORY_LIMIT), future: [] }))

      return {
        chart: emptyChart(),
        past: [],
        future: [],
        proposal: null,
        commit,
        undo: () =>
          set((s) => {
            const prev = s.past.at(-1)
            return prev ? { chart: prev, past: s.past.slice(0, -1), future: [s.chart, ...s.future], proposal: null } : s
          }),
        redo: () =>
          set((s) => {
            const [next, ...rest] = s.future
            return next ? { chart: next, past: [...s.past, s.chart], future: rest, proposal: null } : s
          }),

        loadChart: (chart) => commit(() => chart),
        addGuest: (guest) => commit((c) => ({ ...c, guests: [...c.guests, guest] })),
        removeGuest: (guestId) =>
          commit((c) => ({
            ...c,
            guests: c.guests.filter((g) => g.id !== guestId),
            assignments: c.assignments.filter((a) => a.guestId !== guestId),
            rules: c.rules
              .map((r) => ({ ...r, guestIds: r.guestIds.filter((id) => id !== guestId) }))
              .filter((r) => r.guestIds.length >= (r.type === 'apart' || r.type === 'together' ? 2 : 1)),
          })),
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
        removeSeatable: (seatableId) =>
          commit((c) => ({
            ...c,
            seatables: c.seatables.filter((s) => s.id !== seatableId),
            assignments: c.assignments.filter((a) => a.seatableId !== seatableId),
          })),
        moveSeatable: (seatableId, x, y) =>
          commit((c) => ({ ...c, seatables: c.seatables.map((s) => (s.id === seatableId ? { ...s, x, y } : s)) })),
        addRule: (rule) => commit((c) => ({ ...c, rules: [...c.rules, rule] })),
        removeRule: (ruleId) => commit((c) => ({ ...c, rules: c.rules.filter((r) => r.id !== ruleId) })),
        applyAssignments: (assignments) => commit((c) => ({ ...c, assignments })),

        propose: (proposal) => set({ proposal }),
        keepProposal: () => {
          const { proposal } = get()
          if (!proposal) return
          commit((c) => ({ ...c, rules: [...c.rules, ...proposal.rules], assignments: proposal.assignments }))
          set({ proposal: null })
        },
        revertProposal: () => set({ proposal: null }),
      }
    },
    { name: 'damajine-chart', partialize: (s) => ({ chart: s.chart }) },
  ),
)
