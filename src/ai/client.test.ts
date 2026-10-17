import { expect, it } from 'vitest'
import { z } from 'zod'
import { toGeminiSchema } from './client'

it('toGeminiSchema keeps only keys Gemini responseSchema accepts', () => {
  const schema = z.object({ kind: z.literal('x'), size: z.number().int().min(1), note: z.string().optional() })
  expect(toGeminiSchema(schema)).toEqual({
    type: 'object',
    properties: { kind: { type: 'string', enum: ['x'] }, size: { type: 'integer' }, note: { type: 'string' } },
    required: ['kind', 'size'],
  })
})
