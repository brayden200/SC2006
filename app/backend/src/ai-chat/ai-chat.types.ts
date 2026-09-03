import { RecommendationDto } from '../recommendations/dto/recommendation.dto'
import type { RankingPreferencesInput } from '../recommendations/ranking-weights'

export type AiChatIntent = 'search' | 'clarification' | 'explanation'

export interface AiStructuredResponse {
  intent: AiChatIntent
  reply: string
  needsClarification: boolean
  clarifyingQuestion?: string
  filters: RecommendationDto
  rankingPreferences: RankingPreferencesInput
}
