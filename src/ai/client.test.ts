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

it('toGeminiSchema turns a discriminated union into anyOf instead of dropping it', () => {
  const schema = z.discriminatedUnion('type', [z.object({ type: z.literal('a') }), z.object({ type: z.literal('b'), n: z.number() })])
  expect(toGeminiSchema(schema)).toEqual({
    anyOf: [
      { type: 'object', properties: { type: { type: 'string', enum: ['a'] } }, required: ['type'] },
      { type: 'object', properties: { type: { type: 'string', enum: ['b'] }, n: { type: 'number' } }, required: ['type', 'n'] },
    ],
  })
})
