import { Chart } from '@/domain/types'
import { guest } from './build'

const lead = 'Leadership'
const eng = 'Engineering'
const sales = 'Sales'
const mkt = 'Marketing'
const design = 'Design'
const ops = 'Operations'

/**
 * Year-end team dinner for 40 people. `group` is the team.
 * Two front rows face the stage and screen (zone `near-stage`); six 6-top rect tables behind them, Table F is step-free.
 * New hires are tagged `new-hire`, their mentors `mentor`.
 */
export const corporate = Chart.parse({
  kind: 'corporate',
  name: 'Mtatsminda Labs year-end dinner',
  guests: [
    guest('Irina Kiknadze', { group: lead, tags: ['ceo'] }),
    guest('Zviad Jorbenadze', { group: lead, tags: ['cto'] }),
    guest('Rebecca Hughes', { group: lead, tags: ['cfo'] }),
    guest('Paata Gabunia', { group: lead, tags: ['coo'] }),

    guest('Nika Chikovani', { group: eng, tags: ['lead', 'mentor'] }),
    guest('Giorgi Margvelashvili', { group: eng, tags: ['lead'] }),
    guest('Mari Tsiklauri', { group: eng, tags: ['mentor'] }),
    guest('Lasha Beradze', { group: eng }),
    guest('Tekla Baramidze', { group: eng, needs: ['vegan'] }),
    guest('Daniel Okafor', { group: eng }),
    guest('Revaz Nadiradze', { group: eng }),
    guest('Khatia Melikidze', { group: eng }),
    guest('Tsotne Gogia', { group: eng, tags: ['new-hire'] }),
    guest('Ani Lobjanidze', { group: eng, tags: ['new-hire'] }),
    guest('Sam Patel', { group: eng }),
    guest('Bachana Kurdadze', { group: eng }),

    guest('Ketevan Abuladze', { group: sales, tags: ['lead', 'mentor'] }),
    guest('Shota Rukhadze', { group: sales }),
    guest('Medea Getsadze', { group: sales }),
    guest('Tom Fletcher', { group: sales }),
    guest('Gvantsa Svanidze', { group: sales, tags: ['new-hire'] }),
    guest('Irakli Basilaia', { group: sales }),
    guest('Natela Gurgenidze', { group: sales }),
    guest('Aleko Papava', { group: sales }),

    guest('Salome Kandelaki', { group: mkt, tags: ['lead'] }),
    guest('Luka Topuria', { group: mkt }),
    guest('Hannah Reid', { group: mkt, needs: ['vegetarian'] }),
    guest('Dachi Sharashidze', { group: mkt }),
    guest('Eliso Kurtanidze', { group: mkt, tags: ['new-hire'] }),
    guest('Vato Chachua', { group: mkt }),

    guest('Mariam Tsintsadze', { group: design, tags: ['lead', 'mentor'] }),
    guest('Sandro Chikhladze', { group: design }),
    guest('Lily Evans', { group: design }),
    guest('Nutsa Gogichaishvili', { group: design, tags: ['new-hire'] }),
    guest('Beka Mumladze', { group: design }),

    guest('Tamar Kiladze', { group: ops, tags: ['lead'], needs: ['wheelchair'] }),
    guest('Gela Kvirikashvili', { group: ops }),
    guest('Sopiko Antadze', { group: ops, needs: ['allergy'] }),
    guest('Mark Davies', { group: ops }),
    guest('Rusiko Kalandadze', { group: ops }),
  ],
  seatables: [
    { id: 'row-a', kind: 'row', label: 'Row A', seats: 8, x: 600, y: 130, zone: 'near-stage' },
    { id: 'row-b', kind: 'row', label: 'Row B', seats: 8, x: 600, y: 210, zone: 'near-stage' },
    { id: 'table-a', kind: 'rect', label: 'Table A', seats: 6, x: 300, y: 400 },
    { id: 'table-b', kind: 'rect', label: 'Table B', seats: 6, x: 600, y: 400 },
    { id: 'table-c', kind: 'rect', label: 'Table C', seats: 6, x: 900, y: 400 },
    { id: 'table-d', kind: 'rect', label: 'Table D', seats: 6, x: 300, y: 600 },
    { id: 'table-e', kind: 'rect', label: 'Table E', seats: 6, x: 600, y: 600 },
    { id: 'table-f', kind: 'rect', label: 'Table F', seats: 6, x: 900, y: 600, accessible: true },
  ],
  decor: [
    { id: 'screen', label: 'Screen', x: 600, y: 12, w: 300, h: 12 },
    { id: 'stage', label: 'Stage', x: 600, y: 60, w: 400, h: 60 },
    { id: 'entrance', label: 'Entrance', x: 600, y: 760, w: 140, h: 40 },
  ],
  rules: [
    {
      id: 'apart:giorgi-margvelashvili,nika-chikovani',
      type: 'apart',
      guestIds: ['nika-chikovani', 'giorgi-margvelashvili'],
      hard: false,
    },
    { id: 'together:nika-chikovani,tsotne-gogia', type: 'together', guestIds: ['tsotne-gogia', 'nika-chikovani'] },
    { id: 'accessible:tamar-kiladze', type: 'accessible', guestIds: ['tamar-kiladze'] },
  ],
  assignments: [],
})

export const corporateRuleTemplates = [
  'Put the leadership team near the stage',
  'Seat each new hire with their mentor',
  'Spread the sales team across tables',
  'Keep Shota and Tom apart',
  'Seat Hannah Reid with Lily Evans',
  'Balance the tables',
]
