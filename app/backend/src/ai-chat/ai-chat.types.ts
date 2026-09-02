import { RecommendationDto } from '../recommendations/dto/recommendation.dto'

export type AiChatIntent = 'search' | 'clarification' | 'explanation'

export interface AiStructuredResponse {
  intent: AiChatIntent
  reply: string
  needsClarification: boolean
  clarifyingQuestion?: string
  filters: RecommendationDto
}
