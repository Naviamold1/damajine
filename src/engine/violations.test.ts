import { describe, expect, it } from 'vitest'
import { findViolations } from './violations'
import { makeChart } from './testChart'

const tables = [
  { id: 't1', seats: 4, zone: 'stage', accessible: true },
  { id: 't2', seats: 4 },
]

describe('findViolations', () => {
  it('flags apart guests sharing a seatable', () => {
    const chart = makeChart({
      guests: ['a', 'b', 'c'],
      tables,
      rules: [{ id: 'r', type: 'apart', guestIds: ['a', 'b', 'c'] }],
      assignments: [
        { guestId: 'a', seatableId: 't1' },
        { guestId: 'b', seatableId: 't1' },
        { guestId: 'c', seatableId: 't2' },
      ],
    })
    expect(findViolations(chart)).toEqual([expect.objectContaining({ ruleId: 'r', kind: 'apart', hard: true, guestIds: ['a', 'b'], seatableIds: ['t1'] })])
  })

  it('flags together guests split across seatables, ignoring unseated members', () => {
    const rules = [{ id: 'r', type: 'together' as const, guestIds: ['a', 'b', 'c'] }]
    const split = makeChart({ guests: ['a', 'b', 'c'], tables, rules, assignments: [{ guestId: 'a', seatableId: 't1' }, { guestId: 'b', seatableId: 't2' }] })
    expect(findViolations(split)).toEqual([expect.objectContaining({ kind: 'together', guestIds: ['a', 'b'], seatableIds: ['t1', 't2'] })])

    const unseated = makeChart({ guests: ['a', 'b', 'c'], tables, rules })
    expect(findViolations(unseated)).toEqual([])
  })

  it('flags zone and accessible rules only for seated guests', () => {
    const chart = makeChart({
      guests: ['a', 'b', 'c'],
      tables,
      rules: [
        { id: 'z', type: 'zone', guestIds: ['a', 'c'], zone: 'stage' },
        { id: 'x', type: 'accessible', guestIds: ['b', 'c'] },
      ],
      assignments: [{ guestId: 'a', seatableId: 't2' }, { guestId: 'b', seatableId: 't2' }],
    })
    expect(findViolations(chart)).toEqual([
      expect.objectContaining({ ruleId: 'z', kind: 'zone', hard: false, guestIds: ['a'], seatableIds: ['t2'] }),
      expect.objectContaining({ ruleId: 'x', kind: 'accessible', hard: true, guestIds: ['b'], seatableIds: ['t2'] }),
    ])
  })

  it('flags capacity by party size and ignores non-attending guests', () => {
    const chart = makeChart({
      guests: [{ id: 'a', size: 3 }, { id: 'b', size: 2 }, { id: 'c', attending: false }],
      tables,
      rules: [{ id: 'r', type: 'apart', guestIds: ['a', 'c'] }],
      assignments: [{ guestId: 'a', seatableId: 't1' }, { guestId: 'b', seatableId: 't1' }, { guestId: 'c', seatableId: 't1' }],
    })
    expect(findViolations(chart)).toEqual([
      { ruleId: null, kind: 'capacity', hard: true, guestIds: ['a', 'b'], seatableIds: ['t1'], message: 't1 is over capacity (5/4)' },
    ])
  })
  it('flags wheelchair users at inaccessible seats without an explicit rule', () => {
    const chart = makeChart({
      guests: [{ id: 'w', needs: ['wheelchair'] }, { id: 'v', needs: ['wheelchair'] }],
      tables,
      assignments: [{ guestId: 'w', seatableId: 't2' }, { guestId: 'v', seatableId: 't1' }],
    })
    expect(findViolations(chart)).toEqual([expect.objectContaining({ ruleId: null, kind: 'accessible', guestIds: ['w'], seatableIds: ['t2'] })])
  })
})
