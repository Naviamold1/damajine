import type { Seatable } from './types'

/**
 * Canvas footprint of a seatable in canvas units (unrotated). Shared by the canvas renderer
 * and the preset layout test so drawn sizes and overlap checks agree.
 */
export function footprint(s: Pick<Seatable, 'kind' | 'seats'>): { w: number; h: number } {
  switch (s.kind) {
    case 'round':
      return { w: 120, h: 120 }
    case 'rect':
      return { w: Math.max(120, s.seats * 25), h: 50 }
    case 'booth':
      return { w: 100, h: 60 }
    default:
      return { w: Math.max(40, s.seats * 30), h: 40 }
  }
}
