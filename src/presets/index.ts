import type { Chart } from '@/domain/types'
import { seeded } from './build'
import { auditorium, auditoriumRuleTemplates } from './auditorium'
import { corporate, corporateRuleTemplates } from './corporate'
import { hackathon, hackathonRuleTemplates } from './hackathon'
import { restaurant, restaurantRuleTemplates } from './restaurant'
import { wedding, weddingRuleTemplates } from './wedding'

export type PresetId = 'wedding' | 'corporate' | 'restaurant' | 'hackathon' | 'auditorium'

/**
 * Demo presets for the preset switcher, in display order. Charts start seated except late arrivals (restaurant is hand-seated).
 * `ruleTemplates` are example prompts for the rule box (cached for offline demos).
 */
export const presets: Record<PresetId, { label: string; chart: Chart; ruleTemplates: string[] }> = {
  wedding: { label: 'Wedding', chart: seeded(wedding), ruleTemplates: weddingRuleTemplates },
  corporate: { label: 'Corporate', chart: seeded(corporate), ruleTemplates: corporateRuleTemplates },
  restaurant: { label: 'Restaurant', chart: restaurant, ruleTemplates: restaurantRuleTemplates },
  hackathon: { label: 'Hackathon', chart: seeded(hackathon), ruleTemplates: hackathonRuleTemplates },
  auditorium: { label: 'Auditorium', chart: seeded(auditorium), ruleTemplates: auditoriumRuleTemplates },
}
