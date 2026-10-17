import { Chart } from '@/domain/types'
import { ruleId } from '@/ai/rules'
import { guest } from './build'

const fanIds = ['giorgi-tsereteli', 'levan-maisuradze', 'beka-shengelaia', 'rati-kvaratskhelia']
const officeIds = ['irakli-japaridze', 'tamta-bakuradze', 'oliver-grant', 'nestan-kiknadze', 'gela-mamaladze', 'sara-lindqvist']
const schoolIds = ['nana-chikovani', 'zviad-kharabadze', 'luka-bitsadze', 'elene-gogoladze', 'saba-mchedlidze', 'ana-kurdadze', 'dachi-basilaia', 'lizi-tsintsadze', 'nika-zhvania', 'tekla-kharshiladze', 'gio-sanikidze', 'mari-khurtsidze']

/** Soft zone rule for a group of guests. */
const softZone = (guestIds: string[], zone: string) => ({ id: ruleId({ type: 'zone', guestIds, zone }), type: 'zone' as const, guestIds, zone, hard: false })

const business = 'Kavkaz Logistics'
const school = 'School 51 trip'
const fans = 'Dinamo Batumi fans'
const gelashvili = 'Gelashvili family'

/** One coach: two lines of facing bays either side of the aisle, `n` bays per line, prefixed by coach letter. */
const coach = (letter: string, y: number, n: number, seats: number, gap: number, zone: (i: number) => string | undefined) =>
  [y, y + 100].flatMap((rowY, side) =>
    Array.from({ length: n }, (_, i) => ({
      id: `${letter.toLowerCase()}${side * n + i + 1}`,
      kind: 'booth' as const,
      label: `${letter}${side * n + i + 1}`,
      seats,
      x: 200 + i * gap,
      y: rowY,
      zone: zone(i),
    })),
  )

/**
 * Tbilisi to Batumi express: coach A is business (12 two-seat bays, zone `business`) with a wheelchair space,
 * coach B is economy (14 four-seat bays, zone `economy`, the last four `quiet-coach`). Bays are booths: seats face each other.
 * Soft zone rules keep the office team in business and the school trip in economy; the fans ride as one booth (together rule). The Gelashvili family boards late at Gori and starts unseated.
 */
export const train = Chart.parse({
  kind: 'train',
  name: 'Tbilisi to Batumi express',
  guests: [
    guest('Irakli Japaridze', { group: business, tags: ['manager'] }),
    guest('Tamta Bakuradze', { group: business }),
    guest('Oliver Grant', { group: business, needs: ['vegetarian'] }),
    guest('Nestan Kiknadze', { group: business }),
    guest('Gela Mamaladze', { group: business }),
    guest('Sara Lindqvist', { group: business, needs: ['allergy'] }),

    guest('Mariam Lomidze', { group: 'Honeymooners', tags: ['+1', 'honeymoon'], size: 2 }),
    guest('Ketevan Abuladze', { needs: ['wheelchair'] }),

    guest('Nana Chikovani', { group: school, tags: ['teacher'] }),
    guest('Zviad Kharabadze', { group: school, tags: ['teacher'] }),
    ...['Luka Bitsadze', 'Elene Gogoladze', 'Saba Mchedlidze', 'Ana Kurdadze', 'Dachi Basilaia', 'Lizi Tsintsadze', 'Nika Zhvania', 'Tekla Kharshiladze', 'Gio Sanikidze', 'Mari Khurtsidze'].map((name) =>
      guest(name, { group: school, needs: ['kid'] }),
    ),

    guest('Giorgi Tsereteli', { group: fans, tags: ['fan'] }),
    guest('Levan Maisuradze', { group: fans, tags: ['fan'] }),
    guest('Beka Shengelaia', { group: fans, tags: ['fan'] }),
    guest('Rati Kvaratskhelia', { group: fans, tags: ['fan'] }),

    guest('Hans Müller', { group: 'Müller family', tags: ['tourist', 'family'], size: 4, needs: ['kid'] }),
    guest('Tinatin Kapanadze', { group: 'Kapanadze family', tags: ['family'], size: 3, needs: ['kid'] }),
    guest('Emma Rossi', { group: 'Rossi couple', tags: ['tourist', '+1'], size: 2, needs: ['vegan'] }),

    guest('Davit Jorbenadze'),
    guest('Salome Akhvlediani', { needs: ['vegetarian'] }),
    guest('Paata Gugava'),
    guest('Eka Lortkipanidze'),
    guest('Tom Becker'),
    guest('Medea Gvinjilia'),
    guest('Zurab Chanturia'),
    guest('Nino Tavartkiladze'),
    guest('Yuki Tanaka'),
    guest('Mamuka Kipiani'),
    guest('Lela Sujashvili'),
    guest('Aleksandre Kobalia'),

    guest('Ana Gelashvili', { group: gelashvili, tags: ['late', 'boards at Gori'], size: 3, needs: ['kid'] }),
    guest('Nika Gelashvili', { group: gelashvili, tags: ['late', 'boards at Gori'] }),
  ],
  seatables: [
    ...coach('A', 130, 6, 2, 150, () => 'business'),
    { id: 'wheelchair-space', kind: 'zone', label: 'Wheelchair space', seats: 2, x: 1090, y: 180, zone: 'business', accessible: true },
    ...coach('B', 410, 7, 4, 130, (i) => (i >= 5 ? 'quiet-coach' : 'economy')),
  ],
  decor: [
    { id: 'coach-a', label: 'Coach A · Business', x: 600, y: 50, w: 320, h: 34 },
    { id: 'doors-a', label: 'Doors', x: 90, y: 180, w: 60, h: 160 },
    { id: 'coach-b', label: 'Coach B · Economy', x: 600, y: 330, w: 320, h: 34 },
    { id: 'doors-b', label: 'Doors', x: 90, y: 460, w: 60, h: 160 },
    { id: 'toilet', label: 'WC', x: 1110, y: 460, w: 60, h: 100 },
    { id: 'cafe', label: 'Café car', x: 600, y: 690, w: 900, h: 90 },
  ],
  rules: [
    { id: ruleId({ type: 'together', guestIds: fanIds }), type: 'together', guestIds: fanIds },
    softZone(['mariam-lomidze', ...officeIds], 'business'),
    softZone(schoolIds, 'economy'),
  ],
  assignments: [],
})

export const trainRuleTemplates = [
  'Seat Nika Gelashvili with Ana Gelashvili',
  'Put Hans Müller in the quiet coach',
  'Keep Tamta Bakuradze and Aleksandre Kobalia apart',
]
