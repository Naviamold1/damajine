import { Canvas } from './canvas/Canvas'
import { CommandBar } from './canvas/CommandBar'
import { Header } from './canvas/Header'
import { Sidebar } from './canvas/Sidebar'
import { useShortcuts } from './canvas/useShortcuts'

/** App shell: header, guest sidebar on the left, canvas on the right, command bar overlay. */
export default function App() {
  useShortcuts()
  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <Canvas />
      </div>
      <CommandBar />
    </div>
  )
}
