import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { presets } from './presets'
import { useChart } from './store/chart'

// First visit (nothing persisted, so the default empty "Untitled" chart): start on the wedding preset, without an undo step back to empty.
// Events made with "New event" are named, so an empty one survives a reload.
const { chart } = useChart.getState()
if (chart.name === 'Untitled' && chart.seatables.length === 0 && chart.guests.length === 0) useChart.setState({ chart: presets.wedding.chart })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
