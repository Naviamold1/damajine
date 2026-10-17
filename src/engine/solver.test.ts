import { describe, expect, it } from 'vitest'
import type { Chart } from '@/domain/types'
import { repair, solve } from './solver'
import { makeChart, seats } from './testChart'

describe('solve', () => {
  it('satisfies together and apart on a small feasible case', () => {
    const chart = makeChart({
      guests: ['a', 'b', 'c', 'd', 'e', 'f'],
      tables: [{ id: 't1', seats: 4 }, { id: 't2', seats: 2 }],
      rules: [
        { id: 'tog', type: 'together', guestIds: ['a', 'b', 'c'] },
        { id: 'apart', type: 'apart', guestIds: ['a', 'd'] },
        { id: 'apart2', type: 'apart', guestIds: ['d', 'e'] },
      ],
    })
    const res = solve(chart)
    expect(res.unseated).toEqual([])
    expect(res.violations).toEqual([])
    const s = seats(res.assignments)
    // Only one layout works: the block plus e on t1, d and f on t2.
    expect(['a', 'b', 'c', 'e'].map((id) => s.get(id))).toEqual(['t1', 't1', 't1', 't1'])
    expect(['d', 'f'].map((id) => s.get(id))).toEqual(['t2', 't2'])
  })

  it('never puts a party at a seatable smaller than it', () => {
    const chart = makeChart({
      guests: [{ id: 'party', size: 4 }, 'x', 'y'],
      tables: [{ id: 'small', seats: 2 }, { id: 'big', seats: 4 }],
    })
    const res = solve(chart)
    expect(seats(res.assignments).get('party')).toBe('big')
    expect(res.unseated).toEqual([])
    expect(res.violations).toEqual([])
  })

  it('keeps pins, seats wheelchair users accessibly, drops non-attending guests', () => {
    const chart = makeChart({
      guests: ['p', { id: 'w', needs: ['wheelchair'] }, { id: 'gone', attending: false }],
      tables: [{ id: 't1', seats: 2 }, { id: 't2', seats: 2, accessible: true }],
      assignments: [{ guestId: 'p', seatableId: 't1', pinned: true }, { guestId: 'gone', seatableId: 't1' }],
    })
    const res = solve(chart)
    expect(res.assignments).toEqual([
      { guestId: 'p', seatableId: 't1', pinned: true },
      { guestId: 'w', seatableId: 't2', pinned: false },
    ])
  })

  it('is deterministic', () => {
    const chart = bigChart()
    expect(solve(chart)).toEqual(solve(structuredClone(chart)))
  })

  it('handles ~200 guests and 25 tables quickly with no hard violations', () => {
    const chart = bigChart()
    const start = performance.now()
    const res = solve(chart)
    expect(performance.now() - start).toBeLessThan(200)
    expect(res.unseated).toEqual([])
    expect(res.violations.filter((v) => v.hard)).toEqual([])
  })
})

describe('repair', () => {
  const base = () =>
    makeChart({
      guests: ['a', 'b', 'c', { id: 'big', size: 3 }, 'late'],
      tables: [{ id: 't1', seats: 4 }, { id: 't2', seats: 4 }],
      assignments: [
        { guestId: 'a', seatableId: 't1', pinned: true },
        { guestId: 'b', seatableId: 't1' },
        { guestId: 'c', seatableId: 't2' },
        { guestId: 'big', seatableId: 't2' },
      ],
    })

  it('seats a late arrival without moving anyone else', () => {
    const res = repair(base())
    expect(res.moved).toEqual(['late'])
    expect(seats(res.assignments).get('late')).toBe('t1')
    expect(res.violations).toEqual([])
  })

  it('fixes an apart violation by moving one unpinned guest', () => {
    const chart: Chart = { ...base(), rules: [{ id: 'r', type: 'apart', guestIds: ['a', 'b'], hard: true }] }
    chart.guests = chart.guests.filter((g) => g.id !== 'late')
    chart.seatables[1].seats = 5
    const res = repair(chart)
    expect(res.moved).toEqual(['b'])
    expect(seats(res.assignments).get('a')).toBe('t1')
    expect(seats(res.assignments).get('b')).toBe('t2')
    expect(res.violations).toEqual([])
  })

  it('prefers moving the smaller party out of an overfull seatable', () => {
    const chart = base()
    chart.guests = chart.guests.filter((g) => g.id !== 'late')
    chart.assignments.push({ guestId: 'x', seatableId: 't2', pinned: false })
    chart.guests.push({ id: 'x', name: 'x', size: 1, tags: [], needs: [], attending: true })
    const res = repair(chart)
    expect(res.moved).toHaveLength(1)
    expect(['c', 'x']).toContain(res.moved[0])
    expect(seats(res.assignments).get('big')).toBe('t2')
    expect(res.violations).toEqual([])
  })

  it('never moves pinned guests, even when they are in a violation', () => {
    const chart = makeChart({
      guests: ['a', 'b'],
      tables: [{ id: 't1', seats: 2 }, { id: 't2', seats: 2 }],
      rules: [{ id: 'r', type: 'apart', guestIds: ['a', 'b'] }],
      assignments: [{ guestId: 'a', seatableId: 't1', pinned: true }, { guestId: 'b', seatableId: 't1', pinned: true }],
    })
    const res = repair(chart)
    expect(res.moved).toEqual([])
    expect(res.violations).toHaveLength(1)
  })
})

/** 200 guests (some parties, groups, needs) at 25 tables of 10, with a handful of rules. */
function bigChart() {
  const guests = Array.from({ length: 200 }, (_, i) => ({
    id: `g${String(i).padStart(3, '0')}`,
    size: i % 17 === 0 ? 2 : 1,
    group: `fam${i % 20}`,
    needs: i % 50 === 0 ? ['wheelchair' as const] : [],
  }))
  const tables = Array.from({ length: 25 }, (_, i) => ({ id: `t${String(i).padStart(2, '0')}`, seats: 10, accessible: i < 3, zone: i < 5 ? 'stage' : undefined }))
  const id = (i: number) => guests[i].id
  return makeChart({
    guests,
    tables,
    assignments: [{ guestId: id(5), seatableId: 't10', pinned: true }],
    rules: [
      ...Array.from({ length: 10 }, (_, i) => ({ id: `tog${i}`, type: 'together' as const, guestIds: [id(i * 7), id(i * 7 + 1), id(i * 7 + 2)] })),
      ...Array.from({ length: 10 }, (_, i) => ({ id: `ap${i}`, type: 'apart' as const, guestIds: [id(100 + i), id(150 + i)] })),
      { id: 'z', type: 'zone' as const, guestIds: [id(30), id(31)], zone: 'stage' },
    ],
  })
}
