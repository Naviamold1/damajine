import { Canvas } from './canvas/Canvas'
import { CommandBar } from './canvas/CommandBar'
import { Header } from './canvas/Header'
import { ImportPanel } from './canvas/ImportPanel'
import { NewEventPanel } from './canvas/NewEventPanel'
import { PrintView } from './canvas/PrintView'
import { Sidebar } from './canvas/Sidebar'
import { useShortcuts } from './canvas/useShortcuts'

/** App shell: header, guest sidebar on the left, canvas on the right, command bar, import and new-event overlays. Print shows only PrintView. */
export default function App() {
  useShortcuts()
  return (
    <>
      <div className="flex h-full flex-col print:hidden">
        <Header />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <Canvas />
        </div>
        <CommandBar />
        <ImportPanel />
        <NewEventPanel />
      </div>
      <PrintView />
    </>
  )
}
