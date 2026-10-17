import { Chart } from '@/domain/types'
import { ruleId } from '@/ai/rules'
import { guest, slug } from './build'

/** Teams and their members. The first member is the captain. */
const teams: Record<string, string[]> = {
  Khachapuri: ['Mariam Kvaratskhelia', 'Saba Jgerenaia', 'Ella Watson', 'Tornike Chkhaidze'],
  Churchkhela: ['Nikoloz Bregvadze', 'Elene Kobiashvili', 'Dimitri Tsaava', 'Jack Morrison'],
  Tamada: ['Lado Gamkrelidze', 'Nutsa Kharaishvili', 'Gurami Kvachadze', 'Sofia Berishvili', 'Ben Carter'],
  'Supra Stack': ['Davit Sulaberidze', 'Keti Mamulashvili', 'Rezo Kvinikadze', 'Priya Shah'],
  'Null Pointers': ['Teo Burduli', 'Vakho Sikharulidze', 'Leo Fischer'],
  'Kartuli Bytes': ['Anuki Datunashvili', 'Giorgi Machavariani', 'Lizi Kezerashvili', 'Tazo Pkhakadze', 'Omar Haddad'],
  'Rustaveli Robots': ['Irakli Gvenetadze', 'Barbare Jorjadze', 'Zuka Lomtadze', 'Chloe Martin'],
  'Mtkvari Flow': ['Nodar Tsiklauri', 'Tamta Esakia', 'Shota Kandelaki', 'Noah Price'],
  'Lari Labs': ['Elisabed Nadareishvili', 'Archil Japaridze', 'Natia Tsertsvadze', 'Sam Brooks'],
  'Svaneti Signal': ['Gela Dadiani', 'Ketino Gvasalia', 'Mike Turner'],
  Badrijani: ['Giga Kobakhidze', 'Lika Gabelia', 'Temo Kipshidze', 'Hannah Lee'],
}

const ids = (team: string) => teams[team].map(slug)

/** Team members as guests: captains tagged `captain`, Lari Labs is at its first hackathon. */
const participants = Object.entries(teams).flatMap(([team, members]) =>
  members.map((name, i) =>
    guest(name, {
      group: team,
      tags: [...(i === 0 ? ['captain'] : []), ...(team === 'Lari Labs' ? ['first-hackathon'] : [])],
      needs: name === 'Barbare Jorjadze' ? ['wheelchair'] : [],
    }),
  ),
)

/** Pin every member of a team to one table. */
const pinTeam = (team: string, seatableId: string) => ids(team).map((guestId) => ({ guestId, seatableId, pinned: true }))

/**
 * HACKTOBERFEST Georgia 2026 in a library reading room in Tbilisi: 11 teams of 3-5 at twelve 6-seat tables,
 * plus mentors, judges and organizers. Front row tables face the stage (zone `near-stage`), the left column
 * sits by the shelves (`quiet-corner`), the right column by the wall sockets (`near-power`). T10 is step-free.
 * Tamada and Null Pointers have already claimed tables (pinned). Ana joined Svaneti Signal this morning,
 * so the team rule does not include her yet (demo: "Seat Ana with her team").
 */
export const hackathon = Chart.parse({
  kind: 'hackathon',
  name: 'HACKTOBERFEST Georgia 2026',
  guests: [
    ...participants,
    guest('Ana Gelovani', { group: 'Svaneti Signal', tags: ['late'] }),

    guest('Nana Lordkipanidze', { group: 'Mentors', tags: ['mentor'] }),
    guest('Tom Bradley', { group: 'Mentors', tags: ['mentor'] }),
    guest('Zura Kiknadze', { group: 'Mentors', tags: ['mentor'] }),
    guest('Tinatin Mgeladze', { group: 'Mentors', tags: ['mentor'], needs: ['vegetarian'] }),

    guest('Rusudan Kurtsikidze', { group: 'Judges', tags: ['judge'] }),
    guest('Levan Ramishvili', { group: 'Judges', tags: ['judge'] }),
    guest('Sarah Mitchell', { group: 'Judges', tags: ['judge'] }),

    guest('Eka Chikvaidze', { group: 'Organizers', tags: ['organizer'] }),
    guest('Beka Tsulukidze', { group: 'Organizers', tags: ['organizer'] }),
    guest('Maka Gorgadze', { group: 'Organizers', tags: ['organizer'] }),
  ],
  seatables: [
    { id: 'judges', kind: 'rect', label: 'Judges', seats: 4, x: 600, y: 160, zone: 'near-stage' },
    { id: 't1', kind: 'rect', label: 'T1', seats: 6, x: 240, y: 270, zone: 'near-stage' },
    { id: 't2', kind: 'rect', label: 'T2', seats: 6, x: 480, y: 270, zone: 'near-stage' },
    { id: 't3', kind: 'rect', label: 'T3', seats: 6, x: 720, y: 270, zone: 'near-stage' },
    { id: 't4', kind: 'rect', label: 'T4', seats: 6, x: 960, y: 270, zone: 'near-stage' },
    { id: 't5', kind: 'rect', label: 'T5', seats: 6, x: 240, y: 420, zone: 'quiet-corner' },
    { id: 't6', kind: 'rect', label: 'T6', seats: 6, x: 480, y: 420 },
    { id: 't7', kind: 'rect', label: 'T7', seats: 6, x: 720, y: 420 },
    { id: 't8', kind: 'rect', label: 'T8', seats: 6, x: 960, y: 420, zone: 'near-power' },
    { id: 't9', kind: 'rect', label: 'T9', seats: 6, x: 240, y: 570, zone: 'quiet-corner' },
    { id: 't10', kind: 'rect', label: 'T10', seats: 6, x: 480, y: 570, accessible: true },
    { id: 't11', kind: 'rect', label: 'T11', seats: 6, x: 720, y: 570 },
    { id: 't12', kind: 'rect', label: 'T12', seats: 6, x: 960, y: 570, zone: 'near-power' },
    { id: 'mentors', kind: 'rect', label: 'Mentors', seats: 6, x: 360, y: 710 },
    { id: 'organizers', kind: 'rect', label: 'Organizers', seats: 4, x: 840, y: 710 },
  ],
  decor: [
    { id: 'screen', label: 'Demo screen', x: 600, y: 15, w: 280, h: 14 },
    { id: 'stage', label: 'Stage', x: 600, y: 65, w: 400, h: 70 },
    { id: 'shelves-left', label: 'Bookshelves', x: 25, y: 420, w: 30, h: 640 },
    { id: 'shelves-top-left', label: 'Bookshelves', x: 200, y: 25, w: 240, h: 30 },
    { id: 'shelves-top-right', label: 'Bookshelves', x: 1000, y: 25, w: 240, h: 30 },
    { id: 'coffee', label: 'Coffee', x: 1145, y: 420, w: 70, h: 140 },
    { id: 'entrance', label: 'Entrance', x: 600, y: 780, w: 140, h: 30 },
  ],
  rules: [
    ...Object.keys(teams).map((team) => ({ id: ruleId({ type: 'together', guestIds: ids(team) }), type: 'together', guestIds: ids(team) })),
    {
      id: 'apart:mariam-kvaratskhelia,nikoloz-bregvadze',
      type: 'apart',
      guestIds: ['mariam-kvaratskhelia', 'nikoloz-bregvadze'],
    },
    { id: 'together:elisabed-nadareishvili,tom-bradley', type: 'together', guestIds: ['tom-bradley', 'elisabed-nadareishvili'] },
    { id: 'accessible:barbare-jorjadze', type: 'accessible', guestIds: ['barbare-jorjadze'] },
  ],
  assignments: [
    ...pinTeam('Tamada', 't6'),
    ...pinTeam('Null Pointers', 't9'),
    { guestId: 'rusudan-kurtsikidze', seatableId: 'judges', pinned: true },
    { guestId: 'levan-ramishvili', seatableId: 'judges', pinned: true },
    { guestId: 'sarah-mitchell', seatableId: 'judges', pinned: true },
  ],
})

export const hackathonRuleTemplates = [
  'Put team Khachapuri near the stage',
  'Seat Ana with her team',
  'Keep the Supra Stack and Tamada teams apart',
  'Put Giga near power',
]
