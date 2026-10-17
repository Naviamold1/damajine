import { create } from 'zustand'

/** Transient view state shared by canvas, sidebar and command bar. Not persisted, not undoable. */
type UiState = {
  /** Guest whose seat is highlighted and explained. */
  guestId: string | null
  /** Seatable highlighted on the canvas (selected directly, or the selected guest's table). */
  seatableId: string | null
  commandOpen: boolean
  selectGuest: (guestId: string | null, seatableId?: string | null) => void
  selectSeatable: (seatableId: string | null) => void
  setCommandOpen: (open: boolean) => void
}

export const useUi = create<UiState>()((set) => ({
  guestId: null,
  seatableId: null,
  commandOpen: false,
  selectGuest: (guestId, seatableId = null) => set({ guestId, seatableId }),
  selectSeatable: (seatableId) => set({ seatableId, guestId: null }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
}))

/** MIME type for dragging a guest from the sidebar onto the canvas. */
export const GUEST_DRAG = 'application/x-damajine-guest'

/** True when typing in a field, so global shortcuts stay out of the way. */
export const isTyping = () => {
  const el = document.activeElement
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable)
}
