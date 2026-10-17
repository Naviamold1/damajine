import { z } from 'zod'

/**
 * POST /api/gemini: the only place the Gemini key lives.
 * Body `{ task, prompt, schema }`; returns `{ data }` (the model's JSON) or `{ error }`.
 * `schema` is a Gemini responseSchema (OpenAPI subset) built client-side by `toGeminiSchema`.
 */

const Body = z.object({
  task: z.enum(['rules', 'import', 'explain']),
  prompt: z.string().min(1).max(40_000),
  schema: z.record(z.string(), z.unknown()),
})

const SYSTEM: Record<z.infer<typeof Body>['task'], string> = {
  rules: 'You turn event seating requests into structured rules. Only reference guest ids you are given.',
  import: 'You extract a clean guest list from messy pasted text.',
  explain: 'You explain seating decisions briefly, using only the facts given.',
}

const GeminiReply = z.object({
  candidates: z.array(z.object({ content: z.object({ parts: z.array(z.object({ text: z.string().optional() })) }) })).min(1),
})

const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 120
/** Per-instance, best-effort cap. Resets on cold start, which is fine for a demo. Generous because a venue shares one IP. */
const hits = new Map<string, number[]>()

function rateLimited(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  // Rejected calls are not recorded, so retrying while limited does not extend the lockout.
  if (recent.length >= MAX_PER_WINDOW) return true
  hits.set(ip, [...recent, now])
  return false
}

const json = (body: unknown, status = 200) => Response.json(body, { status })

export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  if (rateLimited(ip)) return json({ error: 'Too many requests, try again in a few minutes.' }, 429)

  const key = process.env.GEMINI_API_KEY
  if (!key) return json({ error: 'GEMINI_API_KEY is not set' }, 500)
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'

  const body = Body.safeParse(await request.json().catch(() => null))
  if (!body.success) return json({ error: 'Invalid request body' }, 400)
  const { task, prompt, schema } = body.data

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM[task] }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2 },
      }),
    },
  ).catch(() => null)

  if (!res?.ok) {
    console.error(`gemini ${task} failed: ${res?.status ?? 'network error'} ${res ? (await res.text()).slice(0, 300) : ''}`)
    return json({ error: 'Gemini request failed' }, 502)
  }
  const reply = GeminiReply.safeParse(await res.json().catch(() => null))
  const text = reply.success ? reply.data.candidates[0].content.parts.map((p) => p.text ?? '').join('') : ''
  try {
    return json({ data: JSON.parse(text) })
  } catch {
    return json({ error: 'Gemini returned no JSON' }, 502)
  }
}
