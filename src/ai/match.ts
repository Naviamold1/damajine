import type { Guest } from '@/domain/types'

/** Lowercase, strip diacritics and punctuation, collapse spaces. Used for name matching and demo cache keys. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’']s\b/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Words that describe a guest without being part of their name ("the Beridze party", "Grandma Eteri"). */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'mr', 'mrs', 'ms', 'dr', 'party', 'parties', 'family', 'table', 'group', 'guest', 'guests',
  'grandma', 'grandpa', 'granny', 'aunt', 'auntie', 'uncle', 'cousin', 'little', 'old', 'our', 'my',
])

export const nameTokens = (text: string): string[] =>
  normalize(text)
    .split(/[\s-]+/)
    .filter((t) => t && !STOPWORDS.has(t))

/** Edit distance, capped early: we only care whether it is <= 1. */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

export type GuestMatch =
  | { kind: 'match'; guest: Guest }
  | { kind: 'ambiguous'; guests: Guest[] }
  | { kind: 'none' }

/**
 * Resolve a free-text name ("nino", "Grandma Eteri", "the Smiths") to one guest.
 * Every query token must match a name token; exact matches win over one-typo matches.
 * Used by the offline rule parser and to sanity-check Gemini's guest ids.
 */
export function matchGuest(name: string, guests: Guest[]): GuestMatch {
  const query = nameTokens(name)
  if (query.length === 0) return { kind: 'none' }

  const tokenized = guests.map((guest) => ({ guest, tokens: nameTokens(guest.name) }))
  const full = query.join(' ')
  const exactFull = tokenized.filter((t) => t.tokens.join(' ') === full)
  if (exactFull.length === 1) return { kind: 'match', guest: exactFull[0].guest }

  const pick = (fuzzy: boolean) =>
    tokenized
      .filter(({ tokens }) =>
        query.every((q) => tokens.some((t) => t === q || (fuzzy && q.length >= 4 && withinOneEdit(q, t)))),
      )
      .map((t) => t.guest)

  const exact = pick(false)
  const found = exact.length > 0 ? exact : pick(true)
  if (found.length === 1) return { kind: 'match', guest: found[0] }
  if (found.length > 1) return { kind: 'ambiguous', guests: found }
  return { kind: 'none' }
}

/**
 * First names mentioned in `text` that belong to several guests, with no surname to tell them apart.
 * parseRules asks back on these before calling Gemini, so "Nino" with two Ninos never guesses.
 */
export function findAmbiguousNames(text: string, guests: Guest[]): { name: string; guests: Guest[] }[] {
  const words = new Set(normalize(text).split(' '))
  const byFirst = new Map<string, Guest[]>()
  for (const guest of guests) {
    const [first] = nameTokens(guest.name)
    if (first) byFirst.set(first, [...(byFirst.get(first) ?? []), guest])
  }
  const out: { name: string; guests: Guest[] }[] = []
  for (const [first, same] of byFirst) {
    if (same.length < 2 || !words.has(first)) continue
    const named = same.filter((g) => nameTokens(g.name).slice(1).some((t) => words.has(t)))
    if (named.length === 0) out.push({ name: first[0].toUpperCase() + first.slice(1), guests: same })
  }
  return out
}
