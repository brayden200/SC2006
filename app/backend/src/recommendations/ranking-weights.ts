import type { RankingPriority } from './dto/recommendation.dto'

export const RANKING_FACTORS = ['distance', 'availability', 'speed', 'savings'] as const
export type RankingFactor = (typeof RANKING_FACTORS)[number]
export type RankingImportance = 0 | 1 | 2 | 4 | 8
export type RankingWeightSource = 'preset' | 'inferred preferences' | 'explicit percentages'

export type RankingWeights = Record<RankingFactor, number>

export interface RankingPreferencesInput {
  importance?: Partial<Record<RankingFactor, number | null>>
  percentages?: Partial<Record<RankingFactor, number | null>>
  excluded?: RankingFactor[]
}

export interface RankingPolicy {
  weights: RankingWeights
  source: RankingWeightSource
}

export interface RankingWeightResolution extends RankingPolicy {
  requiresClarification: boolean
  clarificationQuestion?: string
}

export const distanceScaleKm = 3
export const DISTANCE_SCALE_KM = distanceScaleKm

const PRESET_WEIGHTS: Record<RankingPriority, RankingWeights> = {
  Balanced: { distance: 0, availability: 40, speed: 30, savings: 30 },
  Availability: { distance: 0, availability: 60, speed: 25, savings: 15 },
  Speed: { distance: 0, availability: 25, speed: 60, savings: 15 },
  Savings: { distance: 0, availability: 25, speed: 15, savings: 60 },
}

const IMPORTANCE_LEVELS: RankingImportance[] = [0, 1, 2, 4, 8]
const EXPLICIT_TOLERANCE = 0.01

export function presetRankingWeights(priority: unknown): RankingWeights {
  const selected = isRankingPriority(priority) ? priority : 'Balanced'
  return { ...PRESET_WEIGHTS[selected] }
}

export function resolveRankingWeights(input: unknown, priority: unknown): RankingWeightResolution {
  const fallback = (): RankingWeightResolution => ({
    weights: presetRankingWeights(priority),
    source: 'preset',
    requiresClarification: false,
  })

  if (input === undefined || input === null) return fallback()
  if (!isRecord(input)) return fallback()

  const excludedResult = readExcluded(input.excluded)
  if (!excludedResult.valid) return fallback()
  const excluded = excludedResult.value

  const percentages = readPercentages(input.percentages)
  if (percentages.kind === 'clarification') {
    return {
      weights: presetRankingWeights(priority),
      source: 'preset',
      requiresClarification: true,
      clarificationQuestion: percentages.question,
    }
  }
  if (percentages.kind === 'valid') {
    return {
      weights: percentages.value,
      source: 'explicit percentages',
      requiresClarification: false,
    }
  }
  if (percentages.kind === 'malformed') return fallback()

  const importance = readImportance(input.importance)
  if (!importance.valid) return fallback()
  const positiveImportance = RANKING_FACTORS.reduce(
    (sum, factor) => sum + (excluded.includes(factor) ? 0 : importance.value[factor]),
    0,
  )

  if (positiveImportance > 0) {
    return {
      weights: normalizeWeights(
        Object.fromEntries(
          RANKING_FACTORS.map((factor) => [factor, excluded.includes(factor) ? 0 : importance.value[factor]]),
        ) as RankingWeights,
      ),
      source: 'inferred preferences',
      requiresClarification: false,
    }
  }

  // An exclusion-only preference is meaningful even though it has no positive
  // importance level. Start from the selected preset and remove those factors.
  if (excluded.length) {
    const remaining = presetRankingWeights(priority)
    excluded.forEach((factor) => {
      remaining[factor] = 0
    })
    const total = sumWeights(remaining)
    if (total > 0) {
      return {
        weights: normalizeWeights(remaining),
        source: 'inferred preferences',
        requiresClarification: false,
      }
    }
    return fallback()
  }

  return fallback()
}

function readImportance(value: unknown): {
  valid: boolean
  value: Record<RankingFactor, RankingImportance>
} {
  const result = Object.fromEntries(RANKING_FACTORS.map((factor) => [factor, 0])) as Record<
    RankingFactor,
    RankingImportance
  >
  if (value === undefined || value === null) return { valid: true, value: result }
  if (!isRecord(value) || hasUnsupportedKeys(value)) return { valid: false, value: result }

  for (const factor of RANKING_FACTORS) {
    const item = value[factor]
    if (item === undefined || item === null) continue
    if (!isImportance(item)) return { valid: false, value: result }
    result[factor] = item
  }
  return { valid: true, value: result }
}

function readExcluded(value: unknown): { valid: boolean; value: RankingFactor[] } {
  if (value === undefined || value === null) return { valid: true, value: [] }
  if (!Array.isArray(value) || value.some((item) => !isRankingFactor(item))) {
    return { valid: false, value: [] }
  }
  const unique = [...new Set(value)]
  return { valid: unique.length === value.length, value: unique }
}

function readPercentages(
  value: unknown,
):
  | { kind: 'none' }
  | { kind: 'malformed' }
  | { kind: 'valid'; value: RankingWeights }
  | { kind: 'clarification'; question: string } {
  if (value === undefined || value === null) return { kind: 'none' }
  if (!isRecord(value) || hasUnsupportedKeys(value)) return { kind: 'malformed' }
  const supplied = RANKING_FACTORS.filter((factor) => value[factor] !== undefined && value[factor] !== null)
  if (!supplied.length) return { kind: 'none' }
  if (supplied.length !== RANKING_FACTORS.length) {
    return {
      kind: 'clarification',
      question:
        'Which percentages should I use for distance, availability, speed, and savings? They must total 100%.',
    }
  }

  const numbers = RANKING_FACTORS.map((factor) => value[factor])
  if (numbers.some((item) => typeof item !== 'number' || !Number.isFinite(item) || item < 0)) {
    return {
      kind: 'clarification',
      question:
        'Please provide non-negative percentages for distance, availability, speed, and savings that total 100%.',
    }
  }
  const total = numbers.reduce<number>((sum, item) => sum + (item as number), 0)
  if (total <= 0 || Math.abs(total - 100) > EXPLICIT_TOLERANCE) {
    return {
      kind: 'clarification',
      question:
        'Please adjust the percentages for distance, availability, speed, and savings so they total 100%.',
    }
  }
  return {
    kind: 'valid',
    value: normalizeWeights(
      Object.fromEntries(RANKING_FACTORS.map((factor, index) => [factor, numbers[index]])) as RankingWeights,
    ),
  }
}

function normalizeWeights(value: RankingWeights): RankingWeights {
  const total = sumWeights(value)
  if (!Number.isFinite(total) || total <= 0) return presetRankingWeights('Balanced')
  const normalized = {} as RankingWeights
  let normalizedTotal = 0
  RANKING_FACTORS.slice(0, -1).forEach((factor) => {
    normalized[factor] = (value[factor] / total) * 100
    normalizedTotal += normalized[factor]
  })
  const lastFactor = RANKING_FACTORS[RANKING_FACTORS.length - 1]
  normalized[lastFactor] = 100 - normalizedTotal
  return normalized
}

function sumWeights(value: RankingWeights) {
  return RANKING_FACTORS.reduce((sum, factor) => sum + value[factor], 0)
}

function hasUnsupportedKeys(value: Record<string, unknown>) {
  return Object.keys(value).some((key) => !RANKING_FACTORS.includes(key as RankingFactor))
}

function isImportance(value: unknown): value is RankingImportance {
  return typeof value === 'number' && IMPORTANCE_LEVELS.includes(value as RankingImportance)
}

function isRankingFactor(value: unknown): value is RankingFactor {
  return typeof value === 'string' && RANKING_FACTORS.includes(value as RankingFactor)
}

function isRankingPriority(value: unknown): value is RankingPriority {
  return value === 'Balanced' || value === 'Availability' || value === 'Speed' || value === 'Savings'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
