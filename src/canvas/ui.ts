import { create } from 'zustand'

/** Transient view state shared by canvas, sidebar and command bar. Not persisted, not undoable. */
type UiState = {
  /** Guest whose seat is highlighted and explained. */
  guestId: string | null
  /** Seatable highlighted on the canvas (selected directly, or the selected guest's table). */
  seatableId: string | null
  /** Room feature selected for moving, resizing, rotating. Selecting a guest or seatable clears it. */
  decorId: string | null
  commandOpen: boolean
  importOpen: boolean
  newOpen: boolean
  selectGuest: (guestId: string | null, seatableId?: string | null) => void
  selectSeatable: (seatableId: string | null) => void
  selectDecor: (decorId: string | null) => void
  setCommandOpen: (open: boolean) => void
  setImportOpen: (open: boolean) => void
  setNewOpen: (open: boolean) => void
}

export const useUi = create<UiState>()((set) => ({
  guestId: null,
  seatableId: null,
  decorId: null,
  commandOpen: false,
  importOpen: false,
  newOpen: false,
  selectGuest: (guestId, seatableId = null) => set({ guestId, seatableId, decorId: null }),
  selectSeatable: (seatableId) => set({ seatableId, guestId: null, decorId: null }),
  selectDecor: (decorId) => set({ decorId, guestId: null, seatableId: null }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setImportOpen: (importOpen) => set({ importOpen, commandOpen: false }),
  setNewOpen: (newOpen) => set({ newOpen, commandOpen: false }),
}))

/** Command bar shortcut label for this platform. */
export const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'

/** MIME type for dragging a guest from the sidebar onto the canvas. */
export const GUEST_DRAG = 'application/x-damajine-guest'

/** True when typing in a field, so global shortcuts stay out of the way. */
export const isTyping = () => {
  const el = document.activeElement
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable)
}
