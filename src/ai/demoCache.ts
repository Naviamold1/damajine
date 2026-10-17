import type { AiTask } from './client'
import { normalize } from './match'

/** Cache key for a user prompt: task plus the normalized words the user typed. */
export const demoKey = (task: AiTask, text: string) => `${task}:${normalize(text)}`

const rules = (text: string, response: { rules: object[]; explanation: string }) =>
  [demoKey('rules', text), { ambiguous: [], ...response }] as const

/**
 * Canned Gemini responses for the presets' ruleTemplates, in the same shape Gemini returns
 * (rules reference preset guest ids). Lets the demo run with no network. Validated by callers like live output.
 */
export const demoCache = new Map<string, unknown>([
  // Wedding
  rules('Keep Tornike and Luka apart', {
    rules: [{ type: 'apart', guestIds: ['tornike-kapanadze', 'luka-kapanadze'], hard: true }],
    explanation: 'Tornike and Luka Kapanadze will sit at different tables.',
  }),
  rules('Otar Kapanadze needs wheelchair access', {
    rules: [{ type: 'accessible', guestIds: ['otar-kapanadze'] }],
    explanation: 'Otar Kapanadze gets a step-free table.',
  }),
  rules('Put Sophie Turner near the dance floor', {
    rules: [{ type: 'zone', guestIds: ['sophie-turner'], zone: 'near-dancefloor', hard: false }],
    explanation: 'Sophie Turner prefers a table by the dance floor.',
  }),
  rules('Put the Kapanadze cousins near the dance floor', {
    rules: [
      {
        type: 'zone',
        guestIds: ['tornike-kapanadze', 'luka-kapanadze', 'elene-kapanadze'],
        zone: 'near-dancefloor',
        hard: false,
      },
    ],
    explanation: 'The three Kapanadze cousins (Tornike, Luka, Elene) prefer tables by the dance floor.',
  }),
  rules("Seat the groom's university friends together", {
    rules: [
      {
        type: 'together',
        guestIds: ['levan-gelashvili', 'irakli-tsereteli', 'nika-japaridze', 'saba-dolidze', 'archil-mamaladze', 'james-wilson'],
        hard: true,
      },
    ],
    explanation: "Giorgi's six university friends (7 seats with James's +1) share one table.",
  }),

  // Corporate
  rules('Put the leadership team near the stage', {
    rules: [
      {
        type: 'zone',
        guestIds: ['irina-kiknadze', 'zviad-jorbenadze', 'rebecca-hughes', 'paata-gabunia'],
        zone: 'near-stage',
        hard: false,
      },
    ],
    explanation: 'The four leaders sit in the front rows.',
  }),
  rules('Seat each new hire with their mentor', {
    rules: [
      { type: 'together', guestIds: ['ani-lobjanidze', 'mari-tsiklauri'], hard: true },
      { type: 'together', guestIds: ['gvantsa-svanidze', 'ketevan-abuladze'], hard: true },
      { type: 'together', guestIds: ['nutsa-gogichaishvili', 'mariam-tsintsadze'], hard: true },
    ],
    explanation:
      'Ani, Gvantsa and Nutsa sit with a mentor from their team. Tsotne already has a rule; Marketing has no mentor for Eliso.',
  }),
  rules('Spread the sales team across tables', {
    rules: [
      {
        type: 'apart',
        guestIds: [
          'ketevan-abuladze', 'shota-rukhadze', 'medea-getsadze', 'tom-fletcher',
          'gvantsa-svanidze', 'irakli-basilaia', 'natela-gurgenidze', 'aleko-papava',
        ],
        hard: false,
      },
    ],
    explanation: 'Sales is spread across tables where possible (soft rule).',
  }),
  rules('Keep Shota and Tom apart', {
    rules: [{ type: 'apart', guestIds: ['shota-rukhadze', 'tom-fletcher'], hard: true }],
    explanation: 'Shota Rukhadze and Tom Fletcher sit at different tables.',
  }),
  rules('Seat Hannah Reid with Lily Evans', {
    rules: [{ type: 'together', guestIds: ['hannah-reid', 'lily-evans'], hard: true }],
    explanation: 'Hannah Reid and Lily Evans share a table.',
  }),

  // Restaurant
  rules('Seat the Gelashvili party on the terrace', {
    rules: [{ type: 'zone', guestIds: ['gelashvili'], zone: 'terrace', hard: false }],
    explanation: 'The Gelashvili party goes to the terrace.',
  }),
  rules('The Japaridze party needs wheelchair access', {
    rules: [{ type: 'accessible', guestIds: ['japaridze'] }],
    explanation: 'The Japaridze party gets the step-free table.',
  }),
  rules('Keep the Lomidze and Abashidze parties apart', {
    rules: [{ type: 'apart', guestIds: ['lomidze', 'abashidze'], hard: true }],
    explanation: 'The Lomidze and Abashidze parties sit at different tables.',
  }),
  rules('Seat the Chen party with the Smiths', {
    rules: [{ type: 'together', guestIds: ['chen', 'smith'], hard: true }],
    explanation: 'The Chen party joins the Smiths.',
  }),
])
