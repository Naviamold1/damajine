import type { SVGProps } from 'react'

const PATHS = {
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'm15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  print: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  import: 'M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  sparkle: 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 3-4.3-4.3',
  pin: 'M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  shuffle: 'M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
  close: 'M6 6l12 12M18 6 6 18',
  rotateLeft: 'M3 12a9 9 0 1 0 2.64-6.36L3 8M3 3v5h5',
  rotateRight: 'M21 12a9 9 0 1 1-2.64-6.36L21 8M21 3v5h-5',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
  image: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm4 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm12 4-5-5L5 21',
} as const

/** Stroke icon from the set above, sized by font size (1em). */
export function Icon({ name, ...props }: { name: keyof typeof PATHS } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d={PATHS[name]} />
    </svg>
  )
}

/** Wordmark glyph: a round table with guests of three families around it. */
export function Logo({ size = 26 }: { size?: number }) {
  const dots = ['#ffad9e', '#a0d2ff', '#a8e6cf', '#ffad9e', '#a0d2ff', '#a8e6cf']
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      <circle cx={16} cy={16} r={7.5} fill="#8e1b4f" />
      {dots.map((c, i) => {
        const a = (i / dots.length) * Math.PI * 2 - Math.PI / 2
        return <circle key={i} cx={16 + Math.cos(a) * 12.5} cy={16 + Math.sin(a) * 12.5} r={3.2} fill={c} stroke="#17151f" strokeWidth={1.2} />
      })}
    </svg>
  )
}
