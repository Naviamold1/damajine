import { Chart } from '@/domain/types'
import { guest } from './build'

/**
 * Saturday night floor: 14 seatables (booths, 2-tops, 4-tops, bar, terrace).
 * Each guest is a party with `size`; some are already eating (pinned), the rest are walk-ins to seat.
 * F3 is step-free; terrace tables carry zone `terrace`. The kitchen is next to the bar.
 */
export const restaurant = Chart.parse({
  kind: 'restaurant',
  name: 'Sakhli, Saturday 20:00',
  guests: [
    guest('Beridze', { size: 4, tags: ['seated'] }),
    guest('Kapanadze', { size: 2, tags: ['seated'] }),
    guest('Smith', { size: 2, tags: ['seated', 'tourists'] }),
    guest('Dolidze', { size: 1, tags: ['seated'] }),
    guest('Lomidze', { size: 3, tags: ['walk-in'] }),
    guest('Abashidze', { size: 2, tags: ['walk-in'] }),
    guest('Gelashvili', { size: 4, tags: ['walk-in', 'birthday'] }),
    guest('Tsereteli', { size: 2, tags: ['walk-in'] }),
    guest('Japaridze', { size: 4, tags: ['walk-in'], needs: ['wheelchair'] }),
    guest('Chen', { size: 2, tags: ['walk-in', 'tourists'], needs: ['vegetarian'] }),
    guest('Kobakhidze', { size: 4, tags: ['walk-in'], needs: ['kid'] }),
    guest('Mchedlishvili', { size: 2, tags: ['walk-in'] }),
    guest('Brown', { size: 1, tags: ['walk-in'] }),
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
    { guestId: 'beridze', seatableId: 'b1', pinned: true },
    { guestId: 'kapanadze', seatableId: 't1', pinned: true },
    { guestId: 'smith', seatableId: 'p1', pinned: true },
    { guestId: 'dolidze', seatableId: 'bar', pinned: true },
  ],
})

export const restaurantRuleTemplates = [
  'Seat the Gelashvili party on the terrace',
  'The Japaridze party needs wheelchair access',
  'Keep the Lomidze and Abashidze parties apart',
  'Seat the Chen party with the Smiths',
]
