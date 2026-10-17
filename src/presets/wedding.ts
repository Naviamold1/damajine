import { Chart } from '@/domain/types'
import { guest } from './build'

const bride = 'Bride family'
const groom = 'Groom family'
const brideFriends = 'Bride friends'
const groomFriends = 'Groom friends'
const work = 'Groom colleagues'

/**
 * Nino and Giorgi's wedding: 8 round tables plus a head table, ~60 seats of guests.
 * Two tables sit by the dance floor (zone `near-dancefloor`), Table 5 is step-free.
 * There are deliberately two Ninos, two Levans and two Iraklis to demo the ask-back flow.
 */
export const wedding = Chart.parse({
  kind: 'wedding',
  name: 'Nino & Giorgi, Tbilisi',
  guests: [
    guest('Nino Beridze', { group: bride, tags: ['bride'] }),
    guest('Giorgi Kapanadze', { group: groom, tags: ['groom'] }),
    guest('Ana Beridze', { group: bride, tags: ['maid-of-honor', 'sister'] }),
    guest('Levan Kapanadze', { group: groom, tags: ['best-man', 'brother'] }),

    guest('Tamar Beridze', { group: bride, tags: ['parent', 'mother'] }),
    guest('Davit Beridze', { group: bride, tags: ['parent', 'father'] }),
    guest('Eteri Beridze', { group: bride, tags: ['grandparent'], needs: ['wheelchair'] }),
    guest('Zurab Beridze', { group: bride, tags: ['uncle', '+1'], size: 2 }),
    guest('Irakli Beridze', { group: bride, tags: ['cousin'] }),
    guest('Salome Beridze', { group: bride, tags: ['cousin'], needs: ['vegetarian'] }),
    guest('Lasha Beridze', { group: bride, tags: ['cousin'], needs: ['kid'] }),
    guest('Keti Beridze', { group: bride, tags: ['aunt'] }),
    guest('Nana Gogoladze', { group: bride, tags: ['aunt'] }),
    guest('Vakhtang Gogoladze', { group: bride, tags: ['uncle'] }),
    guest('Tinatin Gogoladze', { group: bride, tags: ['cousin'], needs: ['vegan'] }),
    guest('Sopho Beridze', { group: bride, tags: ['cousin'] }),

    guest('Maia Kapanadze', { group: groom, tags: ['parent', 'mother'] }),
    guest('Gocha Kapanadze', { group: groom, tags: ['parent', 'father'] }),
    guest('Otar Kapanadze', { group: groom, tags: ['grandparent'], needs: ['wheelchair'] }),
    guest('Dato Kapanadze', { group: groom, tags: ['uncle'] }),
    guest('Nato Kapanadze', { group: groom, tags: ['aunt'] }),
    guest('Tornike Kapanadze', { group: groom, tags: ['cousin'] }),
    guest('Luka Kapanadze', { group: groom, tags: ['cousin'] }),
    guest('Elene Kapanadze', { group: groom, tags: ['cousin'] }),
    guest('Gia Kapanadze', { group: groom, tags: ['uncle', '+1'], size: 2 }),
    guest('Rusudan Kvaratskhelia', { group: groom, tags: ['aunt'] }),
    guest('Beka Kvaratskhelia', { group: groom, tags: ['cousin'] }),
    guest('Natia Kvaratskhelia', { group: groom, tags: ['cousin'], needs: ['allergy'] }),

    guest('Nino Tsiklauri', { group: brideFriends, tags: ['school'] }),
    guest('Mariam Javakhishvili', { group: brideFriends, tags: ['school'] }),
    guest('Ketevan Lomidze', { group: brideFriends, tags: ['school'] }),
    guest('Anano Chkheidze', { group: brideFriends, tags: ['work'] }),
    guest('Sophie Turner', { group: brideFriends, tags: ['erasmus', '+1'], size: 2 }),
    guest('Emily Clarke', { group: brideFriends, tags: ['erasmus'], needs: ['vegetarian'] }),
    guest('Tamuna Abashidze', { group: brideFriends, tags: ['work', '+1'], size: 2 }),
    guest('Lika Gelashvili', { group: brideFriends, tags: ['school'] }),
    guest('Eka Mchedlishvili', { group: brideFriends, tags: ['work'] }),
    guest('Natalia Bakradze', { group: brideFriends, tags: ['school'] }),

    guest('Levan Gelashvili', { group: groomFriends, tags: ['university'] }),
    guest('Irakli Tsereteli', { group: groomFriends, tags: ['university'] }),
    guest('Nika Japaridze', { group: groomFriends, tags: ['university'] }),
    guest('Saba Dolidze', { group: groomFriends, tags: ['university'] }),
    guest('Archil Mamaladze', { group: groomFriends, tags: ['university'] }),
    guest('James Wilson', { group: groomFriends, tags: ['university', '+1'], size: 2 }),
    guest('Oliver Bennett', { group: groomFriends, tags: ['football'] }),
    guest('Giga Kobakhidze', { group: groomFriends, tags: ['football', '+1'], size: 2 }),
    guest('Sandro Kipiani', { group: groomFriends, tags: ['football'] }),
    guest('Data Lortkipanidze', { group: groomFriends, tags: ['football'] }),

    guest('Mikheil Shengelia', { group: work }),
    guest('Teona Sulakvelidze', { group: work, needs: ['vegetarian'] }),
    guest('David Miller', { group: work }),
    guest('Guram Tskitishvili', { group: work }),
    guest('Maka Zhvania', { group: work }),
    guest('Rati Chanturia', { group: work }),
  ],
  seatables: [
    { id: 'head', kind: 'rect', label: 'Head table', seats: 10, x: 600, y: 90 },
    { id: 't1', kind: 'round', label: 'Table 1', seats: 10, x: 150, y: 300 },
    { id: 't2', kind: 'round', label: 'Table 2', seats: 10, x: 390, y: 300, zone: 'near-dancefloor' },
    { id: 't3', kind: 'round', label: 'Table 3', seats: 10, x: 810, y: 300, zone: 'near-dancefloor' },
    { id: 't4', kind: 'round', label: 'Table 4', seats: 10, x: 1050, y: 300 },
    { id: 't5', kind: 'round', label: 'Table 5', seats: 8, x: 210, y: 560, accessible: true },
    { id: 't6', kind: 'round', label: 'Table 6', seats: 8, x: 470, y: 560 },
    { id: 't7', kind: 'round', label: 'Table 7', seats: 8, x: 730, y: 560 },
    { id: 't8', kind: 'round', label: 'Table 8', seats: 8, x: 990, y: 560 },
  ],
  rules: [
    { id: 'apart:davit-beridze,tamar-beridze', type: 'apart', guestIds: ['tamar-beridze', 'davit-beridze'] },
    { id: 'accessible:eteri-beridze', type: 'accessible', guestIds: ['eteri-beridze'] },
  ],
  assignments: [
    { guestId: 'nino-beridze', seatableId: 'head', pinned: true },
    { guestId: 'giorgi-kapanadze', seatableId: 'head', pinned: true },
    { guestId: 'ana-beridze', seatableId: 'head' },
    { guestId: 'levan-kapanadze', seatableId: 'head' },
  ],
})

export const weddingRuleTemplates = [
  'Keep Tornike and Luka apart',
  'Seat Nino with Mariam',
  'Otar Kapanadze needs wheelchair access',
  'Put Sophie Turner near the dance floor',
  "Put the Kapanadze cousins near the dance floor",
  "Seat the groom's university friends together",
]
