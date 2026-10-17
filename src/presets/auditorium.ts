import { Chart } from '@/domain/types'
import { guest } from './build'

const speakers = 'Speakers'
const sponsors = 'Sponsors'
const press = 'Press'
const students = 'TSU students'

/** Two blocks of 10-seat rows, A at the front. Row A is zone `front`, row B is `reserved`. */
const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].flatMap((letter, i) => {
  const zone = letter === 'A' ? 'front' : letter === 'B' ? 'reserved' : undefined
  const y = 170 + i * 65
  return [
    { id: `${letter.toLowerCase()}-left`, kind: 'row', label: `${letter} left`, seats: 10, x: 380, y, zone },
    { id: `${letter.toLowerCase()}-right`, kind: 'row', label: `${letter} right`, seats: 10, x: 820, y, zone },
  ]
})

/**
 * Keynote evening at a Tbilisi conference hall: 16 rows of 10 in two blocks with a central aisle,
 * plus a step-free wheelchair bay on each side of the front. ~90 seats of attendees, many in parties of 2-3.
 * Three keynote speakers are already seated in row A (pinned).
 */
export const auditorium = Chart.parse({
  kind: 'auditorium',
  name: 'Tbilisi Tech Summit keynote',
  guests: [
    guest('Nino Tskhadadze', { group: speakers, tags: ['speaker', 'keynote'] }),
    guest('Alex Morgan', { group: speakers, tags: ['speaker', 'keynote'] }),
    guest('Levan Chkonia', { group: speakers, tags: ['speaker', 'keynote'] }),
    guest('Maria Lopez', { group: speakers, tags: ['speaker'] }),
    guest('Tamar Khidasheli', { group: speakers, tags: ['speaker'], needs: ['vegan'] }),
    guest('Daniel Weiss', { group: speakers, tags: ['speaker'] }),

    guest('Zurab Zhgenti', { group: sponsors, tags: ['sponsor', 'vip', '+1'], size: 2 }),
    guest('Nana Kvirikadze', { group: sponsors, tags: ['sponsor', 'vip'] }),
    guest('Robert Hayes', { group: sponsors, tags: ['sponsor', 'vip', '+1'], size: 2 }),
    guest('Mzia Eristavi', { group: sponsors, tags: ['sponsor', 'vip'] }),

    guest('Lela Chanturia', { group: press, tags: ['press'] }),
    guest('Tom Spencer', { group: press, tags: ['press'] }),
    guest('Dato Kvirkvelia', { group: press, tags: ['press', 'camera'] }),
    guest('Anna Kowalski', { group: press, tags: ['press'] }),

    guest('Luka Natroshvili', { group: students }),
    guest('Mariam Gugushvili', { group: students }),
    guest('Saba Kenchadze', { group: students }),
    guest('Ani Tchelidze', { group: students }),
    guest('Nika Mosashvili', { group: students }),
    guest('Elene Shonia', { group: students }),

    guest('Giorgi Abashidze', { tags: ['+1'], size: 2, needs: ['wheelchair'] }),
    guest('Medea Jgharkava', { needs: ['wheelchair'] }),

    guest('Zaal Kvaratskhelia', { size: 2 }),
    guest('Irma Tabatadze', { size: 2 }),
    guest('Kakha Bolkvadze', { size: 3 }),
    guest('Rusudan Sharia', { size: 2 }),
    guest('John Miller', { size: 2 }),
    guest('Sophie Dubois', { size: 2, needs: ['vegetarian'] }),
    guest('Paata Mikadze', { size: 3, needs: ['kid'] }),
    guest('Marika Gogua', { size: 2 }),
    guest('Vakhtang Lomia', { size: 2 }),
    guest('Natela Tsomaia', { size: 2 }),
    guest('Goga Shubladze', { size: 3 }),
    guest('Inga Dvalishvili', { size: 2 }),
    guest('Michael Brown', { size: 2 }),
    guest('Tamriko Gvaramia', { size: 2 }),
    guest('Avtandil Kurtanidze', { size: 3 }),
    guest('Eliso Chkuaseli', { size: 2 }),
    guest('Revaz Margiani', { size: 2 }),
    guest('Lali Ghvinjilia', { size: 2 }),
    guest('Ramaz Kordzaia', { size: 3, needs: ['kid'] }),
    guest('Lucy Hall', { size: 2 }),

    guest('Archil Gvalia'),
    guest('Marina Gelovani'),
    guest('Teona Kalandia'),
    guest('Shalva Nozadze'),
    guest('Ia Papiashvili'),
    guest('Konstantine Tsulaia'),
    guest('Nanuka Gogichashvili'),
    guest('Emma Clarke'),
    guest('Tengo Mgaloblishvili'),
    guest('Ekaterine Abesadze'),
    guest('Lasha Topuria'),
    guest('Maia Chikhradze'),
    guest('Ruben Harutyunyan'),
    guest('Gocha Kezevadze'),
    guest('Salome Tsetskhladze'),
    guest('Chris Allen'),
    guest('Guranda Jibuti'),
    guest('Mamuka Darsalia'),
  ],
  seatables: [
    { id: 'bay-left', kind: 'zone', label: 'Wheelchair bay', seats: 3, x: 110, y: 170, accessible: true },
    { id: 'bay-right', kind: 'zone', label: 'Wheelchair bay', seats: 3, x: 1090, y: 170, accessible: true },
    ...rows,
  ],
  decor: [
    { id: 'screen', label: 'Screen', x: 600, y: 15, w: 360, h: 14 },
    { id: 'stage', label: 'Stage', x: 600, y: 70, w: 520, h: 80 },
    { id: 'sound-desk', label: 'Sound desk', x: 600, y: 720, w: 160, h: 50 },
    { id: 'doors-left', label: 'Doors', x: 200, y: 780, w: 120, h: 30 },
    { id: 'doors-right', label: 'Doors', x: 1000, y: 780, w: 120, h: 30 },
  ],
  rules: [
    {
      id: 'zone:alex-morgan,daniel-weiss,levan-chkonia,maria-lopez,nino-tskhadadze,tamar-khidasheli@front',
      type: 'zone',
      guestIds: ['nino-tskhadadze', 'alex-morgan', 'levan-chkonia', 'maria-lopez', 'tamar-khidasheli', 'daniel-weiss'],
      zone: 'front',
      hard: true,
    },
    { id: 'accessible:giorgi-abashidze', type: 'accessible', guestIds: ['giorgi-abashidze'] },
    {
      id: 'together:ani-tchelidze,elene-shonia,luka-natroshvili,mariam-gugushvili,nika-mosashvili,saba-kenchadze',
      type: 'together',
      guestIds: ['luka-natroshvili', 'mariam-gugushvili', 'saba-kenchadze', 'ani-tchelidze', 'nika-mosashvili', 'elene-shonia'],
    },
  ],
  assignments: [
    { guestId: 'nino-tskhadadze', seatableId: 'a-left', pinned: true },
    { guestId: 'alex-morgan', seatableId: 'a-left', pinned: true },
    { guestId: 'levan-chkonia', seatableId: 'a-left', pinned: true },
  ],
})

export const auditoriumRuleTemplates = [
  'Put the press in the reserved rows',
  'Put the sponsors in the front row',
  'Keep Archil and Marina apart',
  'Medea Jgharkava needs wheelchair access',
]
