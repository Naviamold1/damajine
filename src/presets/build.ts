import type { z } from 'zod'
import type { Guest } from '@/domain/types'

type GuestInput = z.input<typeof Guest>

/** Stable id from a name: "Nino Beridze" -> "nino-beridze". Preset ids are referenced by the demo cache. */
export const slug = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Preset guest shorthand: `guest('Nino Beridze', { group: 'Bride family' })`. */
export const guest = (name: string, rest: Omit<GuestInput, 'id' | 'name'> = {}): GuestInput => ({
  id: slug(name),
  name,
  ...rest,
})
