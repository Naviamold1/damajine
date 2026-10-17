import { z } from 'zod'
import { Guest, GuestNeed } from '@/domain/types'
import { slug } from '@/presets/build'
import { callGemini } from './client'

const GuestDraft = z.object({
  name: z.string(),
  size: z.number().int().min(1),
  group: z.string().optional(),
  tags: z.array(z.string()),
  needs: z.array(GuestNeed),
})
type GuestDraft = z.infer<typeof GuestDraft>

const ImportResponse = z.object({ guests: z.array(GuestDraft) })

/**
 * Pasted messy list -> new guests (not yet in the chart). Gemini first, deterministic line parser as fallback.
 * Ids are slugs of the name, de-duplicated against `existing` guests.
 */
export async function importGuests(text: string, existing: Guest[] = []): Promise<Guest[]> {
  try {
    const res = await callGemini('import', importPrompt(text), ImportResponse, text)
    if (res.guests.length) return toGuests(res.guests, existing)
  } catch {
    // Fall through to the offline parser.
  }
  return parseGuestsOffline(text, existing)
}

function importPrompt(text: string): string {
  return [
    'Extract guests from the pasted list below. One entry per invitation/party.',
    '- size: seats the entry needs ("+1" adds one, "family of 4" is 4, "Ana & Luka" is 2).',
    '- group: the section heading or relationship if given (e.g. "Bride family", "Sales").',
    `- needs: only from ${GuestNeed.options.join(', ')}. "veg" means vegetarian, kids/children means kid.`,
    '- tags: short lowercase extras like "plus-one", "vip". Skip anything that is not a guest.',
    '',
    text,
  ].join('\n')
}

/** Validate drafts through the Guest schema and give each a unique id. */
function toGuests(drafts: GuestDraft[], existing: Guest[]): Guest[] {
  const taken = new Set(existing.map((g) => g.id))
  return drafts.map((draft) => {
    const base = slug(draft.name) || 'guest'
    let id = base
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`
    taken.add(id)
    return Guest.parse({ ...draft, id, name: draft.name.trim() })
  })
}

const NUMBER_WORDS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }
const toNumber = (word: string): number => NUMBER_WORDS[word.toLowerCase()] ?? Number(word)

const NEED_PATTERNS: [GuestNeed, RegExp][] = [
  ['vegan', /\bvegan\b/i],
  ['vegetarian', /\bveg(?:gie|etarian)?\b/i],
  ['wheelchair', /\bwheel ?chair\b|\baccessible\b/i],
  ['allergy', /\ballerg(?:y|ic|ies)\b|\bgluten\b|\bnut[- ]free\b/i],
  ['kid', /\bkids?\b|\bchild(?:ren)?\b|\bbaby\b/i],
]

/** Where the name ends: first separator or size/need keyword. */
const NAME_END =
  /[,;(|:]|\s[-–]\s|\+\s?\d|\bplus one\b|\b(?:family|party|group) of\b|\bx\s?\d|\b(?:vegan|veg(?:gie|etarian)?|wheel ?chair|allerg\w*|kids?|child(?:ren)?)\b/i

/**
 * Deterministic parser: one guest per line. "Header:" lines set the group for following lines.
 * Understands "+1"/"+2", "plus one", "family/party of 4", "x3", "(4)", "A & B", and need keywords.
 */
export function parseGuestsOffline(text: string, existing: Guest[] = []): Guest[] {
  const drafts: GuestDraft[] = []
  let group: string | undefined

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()
    if (!line) continue
    if (/^[^,;(]+:$/.test(line)) {
      group = line.slice(0, -1).trim()
      continue
    }

    let size = 1
    const tags: string[] = []
    let m: RegExpMatchArray | null
    if ((m = line.match(/\b(?:family|party|group) of (\d+|\w+)\b/i)) || (m = line.match(/\bx\s?(\d+)\b/i)) || (m = line.match(/\((\d+)\)/)))
      size = toNumber(m[1]) || 1
    if ((m = line.match(/\+\s?(\d+)/))) {
      size += Number(m[1])
      tags.push('plus-one')
    } else if (/\bplus one\b/i.test(line)) {
      size += 1
      tags.push('plus-one')
    }

    const name = line.split(NAME_END)[0].trim().replace(/\s+/g, ' ')
    if (!name) continue
    size = Math.max(size, name.split(/\s*(?:&|\band\b)\s*/i).length)

    drafts.push({
      name,
      size,
      group,
      tags,
      needs: NEED_PATTERNS.filter(([, re]) => re.test(line)).map(([need]) => need),
    })
  }
  return toGuests(drafts, existing)
}
