import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { parseBillingMinutes, parseRate, parseTime } from '../parking-tariff.util'
import type {
  ParkingProvider,
  ParkingProviderStatus,
  ParkingRecord,
  ParkingTariffRule,
} from '../parking.types'
import { svy21ToWgs84 } from '../svy21.util'

const URA_DETAILS_URL = 'https://eservice.ura.gov.sg/uraDataService/invokeUraDS/v1?service=Car_Park_Details'

@Injectable()
export class UraParkingService implements ParkingProvider {
  readonly name = 'URA' as const
  private readonly baseUrl: string
  private cache: { records: ParkingRecord[]; fetchedAt: string; expiresAt: number } | null = null
  private lastError: string | null = null
  private failureRetryAt = 0
  private token: { value: string; expiresAt: number } | null = null

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get('URA_BASE_URL') ?? 'https://eservice.ura.gov.sg/uraDataService'
  }

  isConfigured() {
    return Boolean(this.config.get<string>('URA_ACCESS_KEY'))
  }

  status(): ParkingProviderStatus {
    return {
      configured: this.isConfigured(),
      state: this.lastError
        ? 'error'
        : this.cache
          ? 'available'
          : this.isConfigured()
            ? 'not_checked'
            : 'not_configured',
      lastSuccessfulFetch: this.cache?.fetchedAt ?? null,
      lastError: this.lastError,
      cacheExpiresAt: this.cache ? new Date(this.cache.expiresAt).toISOString() : null,
      tokenMode: this.config.get('URA_TOKEN')
        ? 'provided_token'
        : this.isConfigured()
          ? 'daily_token'
          : 'none',
    }
  }

  async getCarParks(force = false) {
    if (!this.isConfigured()) throw new Error('URA_ACCESS_KEY is not configured')
    if (!force && this.cache && this.cache.expiresAt > Date.now()) return structuredClone(this.cache.records)
    if (!force && !this.cache && this.lastError && this.failureRetryAt > Date.now())
      throw new Error(this.lastError)
    try {
      const token = await this.getToken()
      const response = await fetch(`${this.baseUrl}/invokeUraDS/v1?service=Car_Park_Details`, {
        headers: {
          AccessKey: this.config.get<string>('URA_ACCESS_KEY')!,
          Token: token,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(20_000),
      })
      if (!response.ok) throw new Error(`URA car-park request failed with HTTP ${response.status}`)
      const payload = await response.json()
      const fetchedAt = new Date().toISOString()
      const records = this.normalizeResponse(payload, fetchedAt)
      if (!records.length) throw new Error('URA car-park response contained no usable car parks')
      this.cache = { records, fetchedAt, expiresAt: Date.now() + 24 * 60 * 60_000 }
      this.lastError = null
      this.failureRetryAt = 0
      return structuredClone(records)
    } catch (error) {
      this.lastError = safeError(error)
      this.failureRetryAt = Date.now() + 60_000
      if (this.cache) return structuredClone(this.cache.records)
      throw error
    }
  }

  normalizeResponse(payload: unknown, fetchedAt = new Date().toISOString()): ParkingRecord[] {
    const result = record(payload) && Array.isArray(payload.Result) ? payload.Result.filter(record) : []
    const grouped = new Map<string, ParkingRecord>()
    result.forEach((item) => {
      if (this.string(item.vehCat).toLowerCase() && this.string(item.vehCat).toLowerCase() !== 'car') return
      const carParkId = this.string(item.ppCode)
      const name = this.string(item.ppName)
      const geometry = this.firstGeometry(item.geometries)
      if (!carParkId || !name || !geometry) return
      const coordinates = svy21ToWgs84(geometry[0], geometry[1])
      if (!coordinates) return
      const existing = grouped.get(carParkId)
      const rules = this.rulesFor(item)
      const rateText = this.rateText(item)
      if (existing) {
        existing.tariffRules.push(...rules)
        if (rateText && !existing.publishedRateText.includes(rateText))
          existing.publishedRateText += `; ${rateText}`
        return
      }
      grouped.set(carParkId, {
        carParkId,
        name: name.trim(),
        provider: 'URA',
        address: name.trim(),
        postalCode: '',
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        publishedRateText: rateText,
        sourceName: 'URA Car Park Details',
        sourceUrl: URA_DETAILS_URL,
        lastUpdated: fetchedAt,
        tariffRules: rules,
      })
    })
    return [...grouped.values()]
  }

  private async getToken() {
    const provided = this.config.get<string>('URA_TOKEN')
    if (provided) return provided
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value
    const response = await fetch(`${this.baseUrl}/insertNewToken/v1`, {
      headers: { AccessKey: this.config.get<string>('URA_ACCESS_KEY')!, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) throw new Error(`URA token request failed with HTTP ${response.status}`)
    const payload = (await response.json()) as { Result?: string }
    if (!payload.Result) throw new Error('URA token response contained no token')
    this.token = { value: payload.Result, expiresAt: Date.now() + 20 * 60 * 60_000 }
    return payload.Result
  }

  private rulesFor(item: Record<string, unknown>): ParkingTariffRule[] {
    const startMinute = parseTime(item.startTime) ?? 0
    const endMinute = parseTime(item.endTime) ?? 1440
    const unit = parseBillingMinutes(item.weekdayMin ?? item.satdayMin ?? item.sunPHMin)
    if (!unit) return []
    const entries: Array<{ days: ParkingTariffRule['days']; rate: unknown; min: unknown }> = [
      { days: ['weekday'], rate: item.weekdayRate, min: item.weekdayMin },
      { days: ['saturday'], rate: item.satdayRate, min: item.satdayMin },
      { days: ['sunday', 'public_holiday'], rate: item.sunPHRate, min: item.sunPHMin },
    ]
    return entries.flatMap(({ days, rate, min }) => {
      const parsedRate = parseRate(rate)
      const parsedUnit = parseBillingMinutes(min) ?? unit
      return parsedRate === null || !parsedUnit
        ? []
        : [
            {
              days,
              startMinute,
              endMinute,
              rate: parsedRate,
              billingUnitMinutes: parsedUnit,
              billing: 'per_unit' as const,
            },
          ]
    })
  }

  private rateText(item: Record<string, unknown>) {
    const parts = [
      this.string(item.weekdayRate) &&
        `Weekday ${this.string(item.weekdayRate)} per ${this.string(item.weekdayMin) || 'published unit'}`,
      this.string(item.satdayRate) &&
        `Saturday ${this.string(item.satdayRate)} per ${this.string(item.satdayMin) || 'published unit'}`,
      this.string(item.sunPHRate) &&
        `Sunday/public holiday ${this.string(item.sunPHRate)} per ${this.string(item.sunPHMin) || 'published unit'}`,
    ].filter(Boolean)
    return parts.join('; ') || 'Published rate is unavailable for calculation.'
  }

  private firstGeometry(value: unknown): [number, number] | null {
    if (!Array.isArray(value)) return null
    for (const item of value) {
      if (!record(item)) continue
      const raw = this.string(item.coordinates)
      const values = raw.split(',').map(Number)
      if (values.length >= 2 && values.every(Number.isFinite)) return [values[0], values[1]]
    }
    return null
  }

  private string(value: unknown) {
    return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function safeError(error: unknown) {
  return error instanceof Error
    ? error.message.replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]')
    : 'Unknown URA error'
}
