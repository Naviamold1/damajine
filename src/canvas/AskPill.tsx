import { useChart } from '@/store/chart'
import { presetOf } from './derived'
import { Icon } from './icons'
import { MOD, useUi } from './ui'

/** Floating prompt at the bottom of the canvas that opens the command bar. Shows one of the preset's example rules. */
export function AskPill() {
  const example = useChart((s) => presetOf(s.chart)?.ruleTemplates[0])
  return (
    <button
      className="group absolute bottom-4 left-1/2 flex w-[min(560px,calc(100%-260px))] -translate-x-1/2 items-center gap-3 rounded-2xl bg-white py-2.5 pr-2.5 pl-4 text-left shadow-island ring-1 ring-ink/5 hover:ring-wine/40"
      onClick={() => useUi.getState().setCommandOpen(true)}
    >
      <Icon name="sparkle" className="flex-none text-[18px] text-wine" />
      <span className="min-w-0 flex-1 truncate text-[15px] text-faint group-hover:text-dim">{example ? `Tell me a rule, like "${example}"` : 'Tell me a seating rule'}</span>
      <kbd className="flex-none rounded-md bg-floor px-1.5 py-0.5 font-sans text-[11px] font-medium text-dim">{MOD}</kbd>
    </button>
  )
}
