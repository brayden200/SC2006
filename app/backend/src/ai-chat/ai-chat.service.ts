import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RecommendationDto } from '../recommendations/dto/recommendation.dto'
import { RecommendationsService } from '../recommendations/recommendations.service'
import { RANKING_FACTORS, resolveRankingWeights } from '../recommendations/ranking-weights'
import type { RankingImportance, RankingPreferencesInput } from '../recommendations/ranking-weights'
import { StationsService } from '../stations/stations.service'
import { AiChatDto } from './dto/ai-chat.dto'
import { AiStructuredResponse } from './ai-chat.types'

const CONNECTORS = ['Any', 'CCS2', 'Type 2', 'CHAdeMO'] as const
const PRIORITIES = ['Balanced', 'Availability', 'Speed', 'Savings'] as const
const INTENTS = ['search', 'clarification', 'explanation'] as const
const DEFAULT_MODEL = 'gpt-5-mini'
const REQUEST_TIMEOUT_MS = 15_000

@Injectable()
export class AiChatService {
  constructor(
    private readonly config: ConfigService,
    private readonly recommendations: RecommendationsService,
    private readonly stations: StationsService,
  ) {}

  async chat(dto: AiChatDto) {
    const stationFacts = this.getSelectedStationFacts(dto.context?.selectedStationIds ?? [])
    const structured = await this.requestStructuredResponse(dto, stationFacts)
    const filters = this.sanitizeFilters(structured.filters)
    const rankingPreferences = this.sanitizeRankingPreferences(structured.rankingPreferences)
    const rankingResolution = resolveRankingWeights(structured.rankingPreferences, filters.rankingPriority)
    const hasCoordinates = dto.context?.latitude !== undefined && dto.context.longitude !== undefined
    const missingSearchLocation = structured.intent === 'search' && !filters.query && !hasCoordinates
    const needsClarification =
      structured.needsClarification ||
      structured.intent === 'clarification' ||
      missingSearchLocation ||
      (structured.intent === 'search' && rankingResolution.requiresClarification)

    if (structured.intent !== 'search' || needsClarification) {
      const clarifyingQuestion = missingSearchLocation
        ? 'Where in Singapore would you like to charge?'
        : rankingResolution.clarificationQuestion || structured.clarifyingQuestion
      return {
        reply: clarifyingQuestion || structured.reply,
        intent: needsClarification ? 'clarification' : structured.intent,
        recommendation: null,
        filters,
        rankingPreferences,
        needsClarification,
        ...(clarifyingQuestion ? { clarifyingQuestion } : {}),
      }
    }

    const recommendation = await this.recommendations.recommend({
      ...filters,
      // Only pass a custom payload through when the shared resolver accepted
      // it. A malformed AI payload must not become custom merely because
      // sanitization dropped its invalid fields.
      rankingPreferences: rankingResolution.source === 'preset' ? undefined : rankingPreferences,
      // An explicit location extracted from the latest prompt must override
      // the browser's fallback coordinates. Otherwise resolveLocation treats
      // the two inputs as a GPS search and silently ignores the new query.
      latitude: filters.query ? undefined : dto.context?.latitude,
      longitude: filters.query ? undefined : dto.context?.longitude,
    })
    const reply = recommendation.ranked.length
      ? structured.reply
      : 'I could not find a compatible charger for those filters. Try a wider radius or fewer constraints.'

    return {
      reply,
      intent: structured.intent,
      recommendation,
      filters,
      rankingPreferences,
      needsClarification: false,
    }
  }

  private async requestStructuredResponse(dto: AiChatDto, stationFacts: unknown[]) {
    const apiKey = this.config.get<string>('AI_API_KEY')?.trim()
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Ask ChargeWise is unavailable because the AI service is not configured.',
      )
    }

    const baseUrl = (
      this.config.get<string>('AI_API_BASE_URL')?.trim() || 'https://api.openai.com/v1'
    ).replace(/\/$/, '')
    const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`
    const messages = [
      { role: 'system', content: this.systemPrompt(stationFacts, dto) },
      ...(dto.conversation ?? []).map(({ role, content }) => ({ role, content })),
      { role: 'user', content: dto.message },
    ]

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.get<string>('AI_MODEL')?.trim() || DEFAULT_MODEL,
          messages,
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'chargewise_intent', strict: true, schema: structuredOutputSchema },
          },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!response.ok) throw new Error(`AI provider returned ${response.status}`)
      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>
      }
      const content = body.choices?.[0]?.message?.content
      const text = typeof content === 'string' ? content : content?.find((part) => part.type === 'text')?.text
      if (!text) throw new Error('AI provider returned no structured response')
      return this.parseStructuredResponse(text)
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error
      const timedOut =
        error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
      throw new ServiceUnavailableException(
        timedOut
          ? 'Ask ChargeWise timed out. Use the normal search while the AI service recovers.'
          : 'Ask ChargeWise is temporarily unavailable. Use the normal search instead.',
      )
    }
  }

  private parseStructuredResponse(value: string): AiStructuredResponse {
    let parsed: unknown
    try {
      parsed = JSON.parse(value)
    } catch {
      throw new ServiceUnavailableException('Ask ChargeWise returned an invalid response. Please try again.')
    }
    if (!isRecord(parsed)) {
      throw new ServiceUnavailableException('Ask ChargeWise returned an invalid response. Please try again.')
    }
    const intent = INTENTS.includes(parsed.intent as (typeof INTENTS)[number])
      ? (parsed.intent as AiStructuredResponse['intent'])
      : null
    if (
      !intent ||
      typeof parsed.reply !== 'string' ||
      typeof parsed.needsClarification !== 'boolean' ||
      !isRecord(parsed.filters) ||
      !isRecord(parsed.rankingPreferences) ||
      (parsed.clarifyingQuestion !== undefined &&
        parsed.clarifyingQuestion !== null &&
        typeof parsed.clarifyingQuestion !== 'string')
    ) {
      throw new ServiceUnavailableException('Ask ChargeWise returned an invalid response. Please try again.')
    }
    return {
      intent,
      reply: parsed.reply.slice(0, 500),
      needsClarification: parsed.needsClarification,
      clarifyingQuestion:
        typeof parsed.clarifyingQuestion === 'string' ? parsed.clarifyingQuestion.slice(0, 500) : undefined,
      filters: parsed.filters as RecommendationDto,
      rankingPreferences: parsed.rankingPreferences as RankingPreferencesInput,
    }
  }

  private sanitizeFilters(input: unknown) {
    const value = isRecord(input) ? input : {}
    const number = (key: string, minimum: number, maximum: number) =>
      typeof value[key] === 'number' && Number.isFinite(value[key])
        ? Math.min(maximum, Math.max(minimum, value[key] as number))
        : undefined
    const text = (key: string) =>
      typeof value[key] === 'string' && (value[key] as string).trim()
        ? (value[key] as string).trim().slice(0, 200)
        : undefined
    const connector = CONNECTORS.includes(value.connector as (typeof CONNECTORS)[number])
      ? (value.connector as (typeof CONNECTORS)[number])
      : 'Any'
    const rankingPriority = PRIORITIES.includes(value.rankingPriority as (typeof PRIORITIES)[number])
      ? (value.rankingPriority as (typeof PRIORITIES)[number])
      : 'Balanced'
    const evaluationAt = text('evaluationAt')

    return {
      query: text('query'),
      connector,
      rankingPriority,
      radiusKm: number('radiusKm', 1, 50) ?? 8,
      energyKwh: number('energyKwh', 0.1, 500) ?? 35,
      maxPrice: number('maxPrice', 0, 100),
      minPowerKw: number('minPowerKw', 0, 1000),
      availableOnly: typeof value.availableOnly === 'boolean' ? value.availableOnly : undefined,
      operator: text('operator'),
      evaluationAt:
        evaluationAt && !Number.isNaN(new Date(evaluationAt).getTime()) ? evaluationAt : undefined,
    }
  }

  private sanitizeRankingPreferences(input: unknown): RankingPreferencesInput | undefined {
    if (!isRecord(input)) return undefined
    const preferences: RankingPreferencesInput = {}
    if (isRecord(input.importance)) {
      const importance: Partial<Record<(typeof RANKING_FACTORS)[number], RankingImportance>> = {}
      for (const factor of RANKING_FACTORS) {
        const value = input.importance[factor]
        if (typeof value === 'number' && [0, 1, 2, 4, 8].includes(value)) {
          importance[factor] = value as RankingImportance
        }
      }
      preferences.importance = importance
    }
    if (isRecord(input.percentages)) {
      const percentages: Partial<Record<(typeof RANKING_FACTORS)[number], number | null>> = {}
      for (const factor of RANKING_FACTORS) {
        const value = input.percentages[factor]
        if (value === null || (typeof value === 'number' && Number.isFinite(value))) {
          percentages[factor] = value
        }
      }
      preferences.percentages = percentages
    }
    if (
      Array.isArray(input.excluded) &&
      input.excluded.every((factor) => RANKING_FACTORS.includes(factor as (typeof RANKING_FACTORS)[number]))
    ) {
      preferences.excluded = [...new Set(input.excluded)] as (typeof RANKING_FACTORS)[number][]
    }
    return Object.keys(preferences).length ? preferences : undefined
  }

  private getSelectedStationFacts(ids: string[]) {
    return ids.flatMap((id) => {
      try {
        const station = this.stations.findById(id)
        return [
          {
            id: station.id,
            name: station.name,
            operator: station.operator || null,
            address: station.address || null,
            pricePerKwh: station.pricePerKwh,
            parking: station.parking?.publishedRateText ?? null,
            connectors: station.connectors.map(({ type, powerKw, available, total, status }) => ({
              type,
              powerKw: powerKw > 0 ? powerKw : null,
              available,
              total,
              status,
            })),
            lastUpdated: station.lastUpdated,
          },
        ]
      } catch {
        return []
      }
    })
  }

  private systemPrompt(stationFacts: unknown[], dto: AiChatDto) {
    const coordinates =
      dto.context?.latitude !== undefined && dto.context.longitude !== undefined
        ? { latitude: dto.context.latitude, longitude: dto.context.longitude }
        : null
    const previousFilters = dto.context?.previousFilters
      ? this.sanitizeFilters(dto.context.previousFilters)
      : null
    const previousRankingPreferences = dto.context?.previousRankingPreferences
      ? this.sanitizeRankingPreferences(dto.context.previousRankingPreferences)
      : null
    return `You are Ask ChargeWise for Singapore EV charging. Return only JSON matching the supplied schema.
Extract intent, mandatory filters, and ranking preferences as separate fields. Use these defaults when absent: connector Any, rankingPriority Balanced, energyKwh 35, radiusKm 8.
Request context coordinates: ${JSON.stringify(coordinates)}. They are a fallback location only. If the latest user message names or clearly describes a different location, it overrides these coordinates and must be placed in filters.query. Ask one concise clarification question only when a search has no usable location in the user message or conversation and these coordinates are null, or when the request is genuinely ambiguous. Leave query null only when using the fallback coordinates.
Filters are eligibility constraints, never ranking preferences: connector type, provider, radius, minimum power, maximum price, and available-only requirements only remove candidates. A minimum power request is not a speed preference unless the user also says fast or otherwise prefers speed. Connector and provider mentions must never appear in ranking importance or exclusions.
Ranking factors are distance, availability, speed, and savings. Set importance independently for each factor using only 0 (unmentioned/excluded), 1 (mild), 2 (normal), 4 (strong), or 8 (dominant). Equal emphasis is equal importance; “mostly”, “above all”, and “matters most” increase importance; “would be nice” is mild; “I don’t care about price” excludes savings. A single preferred factor gets 100% after backend conversion. For complete explicit percentages, put all four numeric values in percentages; for incomplete or contradictory explicit allocations, preserve the values mentioned and use null for the rest, set needsClarification true, and ask for a concise allocation totalling 100%. If there is no custom preference, use zero importance for all factors and an empty exclusions list. Never invent percentages.
For a follow-up, use the previous applied filters and ranking preferences below when the user refers to the prior search, such as “actually, speed matters more”. Latest explicit instructions override earlier ones. A clearly new search replaces unrelated old constraints.
Previous applied filters: ${JSON.stringify(previousFilters)}. Previous applied ranking preferences: ${JSON.stringify(previousRankingPreferences)}.
Never invent station names, availability, charging prices, parking rates, routes, costs, or ranking scores. Never calculate them yourself. Missing values are unknown, never zero or free. Charging price, parking cost, and total visit cost are distinct. For search, keep reply concise and mention only constraints explicitly present in the latest user message or explicitly carried by a follow-up reference. Do not mention default radius, energy, or other filters merely because they were applied by the backend. Do not mention scoring formulas, internal fields, or percentages in the reply. Do not claim results or live availability; the deterministic backend will calculate results after your response. Recommendations are the best among the returned candidates, not a claim about every station in Singapore. Do not create, stop, or imply monitoring actions.
For explanation intent, use only these selected station facts: ${JSON.stringify(stationFacts)}. If facts are empty or a field is null, say it is unknown. Do not use claims from conversation as station facts.`
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] }
const nullableNumber = { anyOf: [{ type: 'number' }, { type: 'null' }] }
const nullableBoolean = { anyOf: [{ type: 'boolean' }, { type: 'null' }] }

const structuredOutputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['intent', 'reply', 'needsClarification', 'clarifyingQuestion', 'filters', 'rankingPreferences'],
  properties: {
    intent: { type: 'string', enum: INTENTS },
    reply: { type: 'string' },
    needsClarification: { type: 'boolean' },
    clarifyingQuestion: nullableString,
    filters: {
      type: 'object',
      additionalProperties: false,
      required: [
        'query',
        'connector',
        'rankingPriority',
        'radiusKm',
        'energyKwh',
        'maxPrice',
        'minPowerKw',
        'availableOnly',
        'operator',
        'evaluationAt',
      ],
      properties: {
        query: nullableString,
        connector: { type: 'string', enum: CONNECTORS },
        rankingPriority: { type: 'string', enum: PRIORITIES },
        radiusKm: nullableNumber,
        energyKwh: nullableNumber,
        maxPrice: nullableNumber,
        minPowerKw: nullableNumber,
        availableOnly: nullableBoolean,
        operator: nullableString,
        evaluationAt: nullableString,
      },
    },
    rankingPreferences: {
      type: 'object',
      additionalProperties: false,
      required: ['importance', 'percentages', 'excluded'],
      properties: {
        importance: {
          type: 'object',
          additionalProperties: false,
          required: RANKING_FACTORS,
          properties: Object.fromEntries(
            RANKING_FACTORS.map((factor) => [factor, { type: 'number', enum: [0, 1, 2, 4, 8] }]),
          ),
        },
        percentages: {
          type: 'object',
          additionalProperties: false,
          required: RANKING_FACTORS,
          properties: Object.fromEntries(RANKING_FACTORS.map((factor) => [factor, nullableNumber])),
        },
        excluded: { type: 'array', items: { type: 'string', enum: RANKING_FACTORS }, maxItems: 4 },
      },
    },
  },
}
