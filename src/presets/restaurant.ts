import { Chart } from '@/domain/types'
import { guest } from './build'

/** A party named after whoever booked it; its own group, so each party gets its own chip color. */
const party = (name: string, size: number, rest: Omit<NonNullable<Parameters<typeof guest>[1]>, 'size' | 'group'> = {}) =>
  guest(name, { size, group: `${name.split(' ').at(-1)} party`, ...rest })

/**
 * Saturday night floor: 14 seatables (booths, 2-tops, 4-tops, bar, terrace).
 * Each guest is a party with `size`. Eight parties are already eating (pinned), four walk-ins wait for a table.
 * F3 is step-free; terrace tables carry zone `terrace`. The kitchen is next to the bar.
 * Inside tables are left free so the "close the terrace" demo can move the terrace diners indoors.
 */
export const restaurant = Chart.parse({
  kind: 'restaurant',
  name: 'Sakhli, Saturday 20:00',
  guests: [
    party('Nino Beridze', 4, { tags: ['eating'] }),
    party('Giorgi Kapanadze', 2, { tags: ['eating'] }),
    party('Tamar Lomidze', 3, { tags: ['eating'] }),
    party('Levan Abashidze', 2, { tags: ['eating'] }),
    party('Emma Smith', 2, { tags: ['eating', 'tourists'] }),
    party('Davit Mchedlishvili', 2, { tags: ['eating'] }),
    party('Zura Dolidze', 1, { tags: ['eating'] }),
    party('James Brown', 1, { tags: ['eating', 'tourists'] }),
    party('Lasha Japaridze', 4, { tags: ['walk-in'], needs: ['wheelchair'] }),
    party('Ana Gelashvili', 4, { tags: ['walk-in', 'birthday'] }),
    party('Wei Chen', 2, { tags: ['walk-in', 'tourists'], needs: ['vegetarian'] }),
    party('Irakli Kobakhidze', 4, { tags: ['walk-in'], needs: ['kid'] }),
  ],
  seatables: [
    { id: 'b1', kind: 'booth', label: 'B1', seats: 4, x: 110, y: 160 },
    { id: 'b2', kind: 'booth', label: 'B2', seats: 4, x: 110, y: 320 },
    { id: 'b3', kind: 'booth', label: 'B3', seats: 4, x: 110, y: 480 },
    { id: 't1', kind: 'round', label: 'T1', seats: 2, x: 300, y: 160 },
    { id: 't2', kind: 'round', label: 'T2', seats: 2, x: 460, y: 160 },
    { id: 't3', kind: 'round', label: 'T3', seats: 2, x: 300, y: 320 },
    { id: 't4', kind: 'round', label: 'T4', seats: 2, x: 460, y: 320 },
    { id: 'f1', kind: 'rect', label: 'F1', seats: 4, x: 300, y: 480 },
    { id: 'f2', kind: 'rect', label: 'F2', seats: 4, x: 480, y: 480 },
    { id: 'f3', kind: 'rect', label: 'F3', seats: 4, x: 660, y: 480, accessible: true },
    { id: 'bar', kind: 'bar', label: 'Bar', seats: 8, x: 420, y: 680 },
    { id: 'p1', kind: 'round', label: 'P1', seats: 4, x: 900, y: 200, zone: 'terrace' },
    { id: 'p2', kind: 'round', label: 'P2', seats: 4, x: 1060, y: 200, zone: 'terrace' },
    { id: 'p3', kind: 'round', label: 'P3', seats: 4, x: 980, y: 380, zone: 'terrace' },
  ],
  decor: [
    { id: 'kitchen', label: 'Kitchen', x: 760, y: 680, w: 240, h: 120 },
    { id: 'entrance', label: 'Entrance', x: 110, y: 700, w: 120, h: 40 },
    { id: 'terrace', label: 'Terrace', x: 980, y: 70, w: 320, h: 36 },
  ],
  rules: [],
  assignments: [
    { guestId: 'nino-beridze', seatableId: 'b1', pinned: true },
    { guestId: 'giorgi-kapanadze', seatableId: 't1', pinned: true },
    { guestId: 'tamar-lomidze', seatableId: 'f1', pinned: true },
    { guestId: 'levan-abashidze', seatableId: 't2', pinned: true },
    { guestId: 'emma-smith', seatableId: 'p1', pinned: true },
    { guestId: 'davit-mchedlishvili', seatableId: 'p2', pinned: true },
    { guestId: 'zura-dolidze', seatableId: 'bar', pinned: true },
    { guestId: 'james-brown', seatableId: 'bar', pinned: true },
  ],
})

export const restaurantRuleTemplates = [
  'The Japaridze party needs wheelchair access',
  'The Gelashvili party is celebrating a birthday, give them a table on the terrace',
  "It's raining, close the terrace",
  'The Beridze party paid and left',
  'Keep the Lomidze and Abashidze parties apart',
  'Put the Chen party on the terrace',
]
