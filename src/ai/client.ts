import { z } from 'zod'
import { demoCache, demoKey } from './demoCache'

export type AiTask = 'rules' | 'import' | 'explain'

/** Keys Gemini's `responseSchema` (an OpenAPI subset) accepts. Everything else from z.toJSONSchema is dropped. */
const GEMINI_KEYS = new Set([
  'type', 'format', 'description', 'nullable', 'enum', 'items', 'properties', 'required', 'minItems', 'maxItems', 'anyOf',
])

type JsonSchema = { [key: string]: unknown }

/** Strip a JSON Schema down to what Gemini accepts. `const` becomes a one-value `enum`. */
function geminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(geminiSchema)
  if (!node || typeof node !== 'object') return node
  const out: JsonSchema = {}
  for (const [key, value] of Object.entries(node)) {
    if (key === 'const') out.enum = [value]
    else if (key === 'properties' && value && typeof value === 'object')
      out.properties = Object.fromEntries(Object.entries(value).map(([name, s]) => [name, geminiSchema(s)]))
    else if (GEMINI_KEYS.has(key)) out[key] = geminiSchema(value)
  }
  return out
}

/** Gemini-compatible response schema for a Zod schema. Exported for tests and the proxy contract. */
export const toGeminiSchema = (schema: z.ZodType): unknown => geminiSchema(z.toJSONSchema(schema))

const ProxyResponse = z.object({ data: z.unknown() })

/**
 * Ask Gemini (via /api/gemini) for JSON matching `schema`, and validate it.
 * `cacheText` is the user's own words (not the full prompt); it keys the demo cache, which answers
 * first when VITE_AI_OFFLINE=1 and as a fallback when the network call fails. Throws if neither works,
 * so callers can fall back to their deterministic parser.
 */
export async function callGemini<S extends z.ZodType>(
  task: AiTask,
  prompt: string,
  schema: S,
  cacheText = prompt,
): Promise<z.output<S>> {
  const cached = demoCache.get(demoKey(task, cacheText))
  if (import.meta.env.VITE_AI_OFFLINE === '1') {
    if (cached === undefined) throw new Error('AI is offline and this prompt is not cached')
    return schema.parse(cached)
  }
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task, prompt, schema: toGeminiSchema(schema) }),
    })
    if (!res.ok) throw new Error(`Gemini proxy returned ${res.status}`)
    return schema.parse(ProxyResponse.parse(await res.json()).data)
  } catch (error) {
    if (cached !== undefined) return schema.parse(cached)
    throw error
  }
}
