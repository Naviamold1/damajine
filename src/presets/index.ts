import type { Chart } from '@/domain/types'
import { auditorium, auditoriumRuleTemplates } from './auditorium'
import { corporate, corporateRuleTemplates } from './corporate'
import { hackathon, hackathonRuleTemplates } from './hackathon'
import { restaurant, restaurantRuleTemplates } from './restaurant'
import { wedding, weddingRuleTemplates } from './wedding'

export type PresetId = 'wedding' | 'corporate' | 'restaurant' | 'hackathon' | 'auditorium'

/** Demo presets for the preset switcher, in display order. `ruleTemplates` are example prompts for the rule box (cached for offline demos). */
export const presets: Record<PresetId, { label: string; chart: Chart; ruleTemplates: string[] }> = {
  wedding: { label: 'Wedding', chart: wedding, ruleTemplates: weddingRuleTemplates },
  corporate: { label: 'Corporate', chart: corporate, ruleTemplates: corporateRuleTemplates },
  restaurant: { label: 'Restaurant', chart: restaurant, ruleTemplates: restaurantRuleTemplates },
  hackathon: { label: 'Hackathon', chart: hackathon, ruleTemplates: hackathonRuleTemplates },
  auditorium: { label: 'Auditorium', chart: auditorium, ruleTemplates: auditoriumRuleTemplates },
}
