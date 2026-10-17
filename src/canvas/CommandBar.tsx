import { useState } from 'react'
import { useChart } from '@/store/chart'
import { presetOf } from './derived'
import { FlowResult } from './FlowResult'
import { Icon } from './icons'
import { MOD, useUi } from './ui'
import { resolveName, useRuleFlow } from './useRuleFlow'

/**
 * Ctrl/Cmd+K overlay (also opened by the canvas AskPill): type a rule, Enter previews the parsed rules and moves, Enter again proposes it.
 * Shows "Import guests" and the current preset's rule templates while empty; "/import" opens the import panel too.
 * Esc or a click outside closes it.
 */
export function CommandBar() {
  const open = useUi((s) => s.commandOpen)
  if (!open) return null
  return <CommandBarOpen />
}

function CommandBarOpen() {
  const chart = useChart((s) => s.chart)
  const close = () => useUi.getState().setCommandOpen(false)
  const [text, setText] = useState('')
  const { flow, ranText, run } = useRuleFlow()
  const templates = presetOf(chart)?.ruleTemplates ?? []
  const ready = flow.status === 'ready' && text === ranText

  const go = (t: string) => {
    if (!t.trim()) return
    if (t.trim() === '/import') return useUi.getState().setImportOpen(true)
    if (flow.status === 'ready' && t === ranText) {
      useChart.getState().propose(flow.proposal)
      close()
    } else {
      setText(t)
      run(t)
    }
  }

  return (
    <div className="fixed inset-0 z-10 bg-ink/25" onPointerDown={close}>
      <div className="absolute top-20 left-1/2 w-[600px] max-w-[calc(100%-32px)] -translate-x-1/2 animate-pop overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-ink/10" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Icon name="sparkle" className="flex-none text-[20px] text-wine" />
          <input
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-faint"
            placeholder="Who should sit where?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Keep Enter/Esc from reaching the global proposal shortcuts after the bar closes.
              if (e.key === 'Enter' || e.key === 'Escape') e.stopPropagation()
              if (e.key === 'Enter') go(text)
              if (e.key === 'Escape') close()
            }}
          />
          <kbd className="rounded-md bg-floor px-1.5 py-0.5 font-sans text-[11px] font-medium text-dim">{MOD}</kbd>
        </div>
        {flow.status !== 'idle' && (
          <div className="border-t border-line px-4 py-3">
            <FlowResult flow={flow} moves onPick={(name, guest) => go(resolveName(text, name, guest))} />
          </div>
        )}
        {flow.status === 'idle' && (
          <ul className="border-t border-line p-2">
            <li className="px-2 pt-1 pb-1.5 text-[12px] font-medium text-faint">Try one</li>
            {templates.map((t) => (
              <li key={t}>
                <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-dim hover:bg-wine-soft hover:text-ink" onClick={() => go(t)}>
                  <span className="text-faint">“</span>
                  {t}
                </button>
              </li>
            ))}
            <li className="mt-1 border-t border-line pt-1">
              <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-floor" onClick={() => useUi.getState().setImportOpen(true)}>
                <Icon name="import" className="text-dim" />
                Import guests
                <span className="ml-auto text-[12px] text-faint">/import</span>
              </button>
            </li>
          </ul>
        )}
        <div className="flex items-center gap-4 bg-floor px-4 py-2 text-[12px] text-dim">
          <span>
            <kbd className="font-semibold text-ink">Enter</kbd> {ready ? 'to preview on the canvas' : 'to read the rule'}
          </span>
          <span>
            <kbd className="font-semibold text-ink">Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  )
}
