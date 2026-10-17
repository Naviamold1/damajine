import { describe, expect, it } from 'vitest'
import { Guest } from '@/domain/types'
import { parseGuestsOffline } from './import'

describe('parseGuestsOffline', () => {
  const list = `
Bride family:
- Nino Beridze +1, veg
- Beridze family of 4 (one in a wheelchair)
2. Ana & Luka Kapanadze, vegan
Friends:
* Sophie Turner plus one
* Giorgi Abashidze x3, kids, nut-free

`

  it('parses names, sizes, needs and group headers', () => {
    const guests = parseGuestsOffline(list)
    expect(guests.map(({ name, size, group, needs }) => ({ name, size, group, needs }))).toEqual([
      { name: 'Nino Beridze', size: 2, group: 'Bride family', needs: ['vegetarian'] },
      { name: 'Beridze', size: 4, group: 'Bride family', needs: ['wheelchair'] },
      { name: 'Ana & Luka Kapanadze', size: 2, group: 'Bride family', needs: ['vegan'] },
      { name: 'Sophie Turner', size: 2, group: 'Friends', needs: [] },
      { name: 'Giorgi Abashidze', size: 3, group: 'Friends', needs: ['allergy', 'kid'] },
    ])
  })

  it('gives unique ids that avoid existing guests', () => {
    const existing = [Guest.parse({ id: 'nino-beridze', name: 'Nino Beridze' })]
    expect(parseGuestsOffline('Nino Beridze\nNino Beridze', existing).map((g) => g.id)).toEqual([
      'nino-beridze-2',
      'nino-beridze-3',
    ])
  })
})
