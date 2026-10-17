import { afterEach, describe, expect, it, vi } from 'vitest'
import { footprint } from '@/domain/geometry'
import { presets } from '@/presets'
import { applyActions, parseRequest, planProposal, type ActionDraft } from './actions'

const wedding = presets.wedding.chart
const seatOf = (chart: typeof wedding, guestId: string) => chart.assignments.find((a) => a.guestId === guestId)?.seatableId

/** Apply drafts to the wedding and build the proposal, as the command bar does. */
const propose = (drafts: ActionDraft[]) => {
  const plan = applyActions(wedding, drafts)
  return { plan, proposal: planProposal(wedding, plan, '') }
}

describe('applyActions', () => {
  it('adds a table next to a room feature without overlapping anything', () => {
    const { plan } = propose([{ type: 'addTable', kind: 'round', seats: 10, near: 'dj' }])
    const added = plan.chart.seatables.at(-1)
    // Follows the room's own numbering (Table 1..8).
    expect(added).toMatchObject({ kind: 'round', seats: 10, label: 'Table 9' })
    const { w } = footprint({ kind: 'round', seats: 10 })
    for (const s of wedding.seatables) expect(Math.hypot(s.x - (added?.x ?? 0), s.y - (added?.y ?? 0))).toBeGreaterThan(w)
    expect(plan.changes).toEqual(['Add round table Table 9 (10 seats) near Stage / DJ'])
  })

  it('accepts names and labels instead of ids', () => {
    const { plan } = propose([{ type: 'seat', guestIds: ['Otar Kapanadze'], tableId: 'Table 4' }])
    expect(seatOf(plan.chart, 'otar-kapanadze')).toBe('t4')
  })

  it('skips an action with a bad reference and still applies the rest', () => {
    const { plan } = propose([
      { type: 'removeTable', tableIds: ['Table 99'] },
      { type: 'updateTable', tableIds: ['t4'], seats: 12 },
    ])
    expect(plan.skipped).toEqual(['removeTable: no table "Table 99"'])
    expect(plan.chart.seatables.find((s) => s.id === 't4')?.seats).toBe(12)
  })

  it('removing a guest drops them from rules too', () => {
    const { plan } = propose([{ type: 'removeGuest', guestIds: ['tamar-beridze'] }])
    expect(plan.chart.guests.some((g) => g.id === 'tamar-beridze')).toBe(false)
    expect(plan.chart.rules.some((r) => r.type === 'apart')).toBe(false)
  })
})

describe('planProposal', () => {
  it('keeps directly seated guests where the plan put them, even against a rule', () => {
    // Tamar and Davit must sit apart; seating Tamar at Davit's table is an explicit override.
    const davit = seatOf(wedding, 'davit-beridze')
    const { proposal } = propose([{ type: 'seat', guestIds: ['tamar-beridze'], tableId: davit }])
    expect(seatOf(proposal.chart, 'tamar-beridze')).toBe(davit)
    expect(proposal.chart.assignments.find((a) => a.guestId === 'tamar-beridze')?.pinned).toBe(false)
  })

  it('leaves unseated guests off the floor', () => {
    const { proposal } = propose([{ type: 'unseat', guestIds: ['sophie-turner'] }])
    expect(seatOf(proposal.chart, 'sophie-turner')).toBeUndefined()
    expect(proposal.moved).toContain('sophie-turner')
  })

  it('cancelled guests free their seats, and the next arrival can use them', () => {
    const { proposal } = propose([
      { type: 'updateGuest', guestIds: ['gia-kapanadze'], attending: false },
      { type: 'addGuest', name: 'Tiko Gelashvili', tableId: seatOf(wedding, 'gia-kapanadze') },
    ])
    expect(seatOf(proposal.chart, 'gia-kapanadze')).toBeUndefined()
    expect(seatOf(proposal.chart, 'tiko-gelashvili')).toBe(seatOf(wedding, 'gia-kapanadze'))
  })

  it('balance evens out the room without moving pinned guests', () => {
    const { proposal } = propose([{ type: 'balance' }])
    expect(proposal.violations.filter((v) => v.kind === 'balance')).toEqual([])
    expect(['nino-beridze', 'giorgi-kapanadze'].map((id) => seatOf(proposal.chart, id))).toEqual(['head', 'head'])
  })
})

describe('parseRequest offline demo', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('resolves every preset rule template from the cache or the offline parser', async () => {
    vi.stubEnv('VITE_AI_OFFLINE', '1')
    for (const { chart, ruleTemplates } of Object.values(presets)) {
      for (const text of ruleTemplates) {
        const res = await parseRequest(text, chart)
        expect(res.kind, text).toBe(text === 'Seat Nino with Mariam' ? 'ask' : 'plan')
        if (res.kind === 'plan') expect(res.plan.skipped, text).toEqual([])
      }
    }
  })
})
