import { afterEach, describe, expect, it, vi } from 'vitest'
import { Guest, type Chart } from '@/domain/types'
import { wedding } from '@/presets/wedding'
import { presets } from '@/presets'
import { matchGuest } from './match'
import { parseRules, parseRulesOffline, validateRules } from './rules'

const guests = ['Nino Beridze', 'Nino Tsiklauri', 'Giorgi Kapanadze', 'Ēteri Beridze', 'Smith'].map((name, i) =>
  Guest.parse({ id: `g${i}`, name }),
)

describe('matchGuest', () => {
  it('matches an exact full name', () => {
    expect(matchGuest('Nino Beridze', guests)).toEqual({ kind: 'match', guest: guests[0] })
  })

  it('ignores case, diacritics and descriptive words', () => {
    expect(matchGuest('grandma eteri', guests)).toEqual({ kind: 'match', guest: guests[3] })
    expect(matchGuest('GIORGI', guests)).toEqual({ kind: 'match', guest: guests[2] })
  })

  it('tolerates one typo and plurals', () => {
    expect(matchGuest('Giorgy', guests)).toEqual({ kind: 'match', guest: guests[2] })
    expect(matchGuest('the Smiths', guests)).toEqual({ kind: 'match', guest: guests[4] })
  })

  it('reports ambiguity instead of guessing', () => {
    expect(matchGuest('Nino', guests)).toEqual({ kind: 'ambiguous', guests: [guests[0], guests[1]] })
  })

  it('returns none for unknown names', () => {
    expect(matchGuest('Zaza', guests)).toEqual({ kind: 'none' })
  })
})

const only = (text: string, chart: Chart = wedding) => {
  const res = parseRulesOffline(text, chart)
  if (res.kind !== 'rules') throw new Error(`expected rules, got: ${res.question}`)
  return res.rules
}

describe('parseRulesOffline', () => {
  it('keep A and B apart', () => {
    expect(only('Keep Tornike and Luka apart')).toEqual([
      { id: 'apart:luka-kapanadze,tornike-kapanadze', type: 'apart', guestIds: ['tornike-kapanadze', 'luka-kapanadze'], hard: true },
    ])
  })

  it('seat A with B', () => {
    expect(only('Seat Mariam Javakhishvili with Ketevan Lomidze')).toMatchObject([
      { type: 'together', guestIds: ['mariam-javakhishvili', 'ketevan-lomidze'], hard: true },
    ])
  })

  it('A needs wheelchair access', () => {
    expect(only('Otar Kapanadze needs wheelchair access')).toMatchObject([{ type: 'accessible', guestIds: ['otar-kapanadze'] }])
  })

  it('put A near a zone, as a soft rule', () => {
    expect(only('Put Sophie Turner near the dance floor')).toMatchObject([
      { type: 'zone', guestIds: ['sophie-turner'], zone: 'near-dancefloor', hard: false },
    ])
  })

  it('handles several sentences', () => {
    expect(only('Keep Tornike and Luka apart. Otar Kapanadze needs wheelchair access').map((r) => r.type)).toEqual([
      'apart',
      'accessible',
    ])
  })

  it('asks back on an ambiguous name', () => {
    const res = parseRulesOffline('Seat Nino with Mariam', wedding)
    expect(res.kind).toBe('ask')
    if (res.kind === 'ask') expect(res.candidates[0].guests.map((g) => g.id)).toEqual(['nino-beridze', 'nino-tsiklauri'])
  })

  it('asks back on an unknown name', () => {
    expect(parseRulesOffline('Keep Zaza and Luka apart', wedding).kind).toBe('ask')
  })
})

describe('validateRules', () => {
  it('rejects unknown guest ids', () => {
    expect(() => validateRules([{ type: 'apart', guestIds: ['tornike-kapanadze', 'ghost'] }], wedding)).toThrow(/ghost/)
  })

  it('rejects unknown zones', () => {
    expect(() => validateRules([{ type: 'zone', guestIds: ['otar-kapanadze'], zone: 'moon' }], wedding)).toThrow(/moon/)
  })

  it('applies schema defaults and a content-based id', () => {
    const [rule] = validateRules([{ type: 'together', guestIds: ['b', 'a', 'a'] }], {
      ...wedding,
      guests: [Guest.parse({ id: 'a', name: 'A' }), Guest.parse({ id: 'b', name: 'B' })],
    })
    expect(rule).toEqual({ id: 'together:a,b', type: 'together', guestIds: ['b', 'a'], hard: true })
  })
})

describe('parseRules offline demo', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('resolves every preset rule template from the cache or the offline parser', async () => {
    vi.stubEnv('VITE_AI_OFFLINE', '1')
    for (const { chart, ruleTemplates } of Object.values(presets)) {
      for (const text of ruleTemplates) {
        const res = await parseRules(text, chart)
        expect(res.kind, text).toBe(text === 'Seat Nino with Mariam' ? 'ask' : 'rules')
      }
    }
  })
})
