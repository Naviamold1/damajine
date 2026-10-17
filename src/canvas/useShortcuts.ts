import { useEffect } from 'react'
import { useChart } from '@/store/chart'
import { isTyping, useUi } from './ui'

/**
 * Global keys: Ctrl/Cmd+K command bar, Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z (or Ctrl+Y) redo,
 * Enter keeps / Esc reverts a proposal, Delete removes the selected table. Ignored while typing.
 */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      const ui = useUi.getState()
      if (mod && key === 'k' && !ui.importOpen && !ui.newOpen) {
        e.preventDefault()
        ui.setCommandOpen(!ui.commandOpen)
        return
      }
      if (isTyping() || ui.commandOpen || ui.importOpen || ui.newOpen) return
      const chart = useChart.getState()
      if (mod && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) chart.redo()
        else chart.undo()
      } else if (mod && key === 'y') {
        e.preventDefault()
        chart.redo()
      } else if (chart.proposal && e.key === 'Enter') {
        chart.keepProposal()
      } else if (chart.proposal && e.key === 'Escape') {
        chart.revertProposal()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && ui.seatableId && !ui.guestId) {
        chart.removeSeatable(ui.seatableId)
        ui.selectSeatable(null)
      } else if (e.key === 'Escape') {
        ui.selectGuest(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
