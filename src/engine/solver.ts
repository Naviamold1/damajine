import type { Chart, Violation } from '@/domain/types'

export type SolveResult = {
  assignments: Chart['assignments']
  /** Attending guest ids that could not be seated. */
  unseated: string[]
  /** Violations remaining after the solve. */
  violations: Violation[]
}

/** Rules currently broken by the chart's assignments, plus overfull seatables. Pure; used by UI and tests. */
export function findViolations(_chart: Chart): Violation[] {
  throw new Error('not implemented')
}

/** Seat every attending guest from scratch. Keeps pinned assignments; honors hard rules where possible. */
export function solve(_chart: Chart): SolveResult {
  throw new Error('not implemented')
}

/**
 * Fix broken rules or seat late arrivals while moving as few guests as possible.
 * Returns the new assignments plus the guest ids that moved.
 */
export function repair(_chart: Chart): SolveResult & { moved: string[] } {
  throw new Error('not implemented')
}
