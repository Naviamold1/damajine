import { useState } from 'react'
import { useChart } from '@/store/chart'
import { presetOf } from './derived'
import { FlowResult } from './FlowResult'
import { useUi } from './ui'
import { resolveName, useRuleFlow } from './useRuleFlow'

const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'

/**
 * Ctrl/Cmd+K overlay: type a rule, Enter previews the parsed rules and moves, Enter again proposes it.
 * Shows the current preset's rule templates while empty. Esc or a click outside closes it.
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

  const go = (t: string) => {
    if (!t.trim()) return
    if (flow.status === 'ready' && t === ranText) {
      useChart.getState().propose(flow.proposal)
      close()
    } else {
      setText(t)
      run(t)
    }
  }

  return (
    <div className="fixed inset-0 z-10 bg-black/60" onPointerDown={close}>
      <div className="absolute top-16 left-1/2 w-[520px] max-w-[calc(100%-32px)] -translate-x-1/2 border border-[#555] bg-black" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-2.5 py-2 text-[14px]">
          <span className="text-dim">›</span>
          <input
            autoFocus
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-dim"
            placeholder="Describe a seating rule"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Keep Enter/Esc from reaching the global proposal shortcuts after the bar closes.
              if (e.key === 'Enter' || e.key === 'Escape') e.stopPropagation()
              if (e.key === 'Enter') go(text)
              if (e.key === 'Escape') close()
            }}
          />
          <span className="text-[11px] text-dim">{MOD}</span>
        </div>
        {flow.status !== 'idle' && (
          <div className="border-t border-line px-2.5 py-1.5">
            <FlowResult flow={flow} moves onPick={(name, guest) => go(resolveName(text, name, guest))} />
          </div>
        )}
        {flow.status === 'idle' && templates.length > 0 && (
          <ul className="border-t border-line py-1">
            {templates.map((t) => (
              <li key={t}>
                <button className="w-full px-2.5 py-0.5 text-left text-dim hover:bg-[#141414] hover:text-white" onClick={() => go(t)}>
                  {t}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-3 border-t border-line px-2.5 py-1.5 text-[11px] text-dim">
          <span>{flow.status === 'ready' && text === ranText ? 'Enter to propose' : 'Enter to parse'}</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  )
}
