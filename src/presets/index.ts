import type { Chart } from '@/domain/types'
import { corporate, corporateRuleTemplates } from './corporate'
import { restaurant, restaurantRuleTemplates } from './restaurant'
import { wedding, weddingRuleTemplates } from './wedding'

export type PresetId = 'wedding' | 'corporate' | 'restaurant'

/** Demo presets for the preset switcher. `ruleTemplates` are example prompts for the rule box (cached for offline demos). */
export const presets: Record<PresetId, { label: string; chart: Chart; ruleTemplates: string[] }> = {
  wedding: { label: 'Wedding', chart: wedding, ruleTemplates: weddingRuleTemplates },
  corporate: { label: 'Corporate', chart: corporate, ruleTemplates: corporateRuleTemplates },
  restaurant: { label: 'Restaurant', chart: restaurant, ruleTemplates: restaurantRuleTemplates },
}
