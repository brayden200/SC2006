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
const ZERO_RATE_BILLING_UNIT_MINUTES = 30

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
    const unit = [item.weekdayMin, item.satdayMin, item.sunPHMin]
      .map(parseBillingMinutes)
      .find((value): value is number => value !== null)
    const entries: Array<{ days: ParkingTariffRule['days']; rate: unknown; min: unknown }> = [
      { days: ['weekday'], rate: item.weekdayRate, min: item.weekdayMin },
      { days: ['saturday'], rate: item.satdayRate, min: item.satdayMin },
      { days: ['sunday', 'public_holiday'], rate: item.sunPHRate, min: item.sunPHMin },
    ]
    return entries.flatMap(({ days, rate, min }) => {
      const parsedRate = parseRate(rate)
      const parsedUnit =
        parseBillingMinutes(min) ?? (parsedRate === 0 ? (unit ?? ZERO_RATE_BILLING_UNIT_MINUTES) : unit)
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
    const startMinute = parseTime(item.startTime)
    const endMinute = parseTime(item.endTime)
    const timeBand = formatTimeBand(startMinute, endMinute)
    const entries = [
      { day: 'Weekdays', rate: item.weekdayRate, min: item.weekdayMin },
      { day: 'Saturdays', rate: item.satdayRate, min: item.satdayMin },
      { day: 'Sundays/public holidays', rate: item.sunPHRate, min: item.sunPHMin },
    ]
      .map(({ day, rate, min }) => {
        const description = formatRateDescription(rate, min)
        return description ? { day, description } : null
      })
      .filter((entry): entry is { day: string; description: string } => entry !== null)

    const grouped = new Map<string, { days: string[]; description: string }>()
    entries.forEach(({ day, description }) => {
      const key = `${timeBand}|${description}`
      const existing = grouped.get(key)
      if (existing) existing.days.push(day)
      else grouped.set(key, { days: [day], description })
    })

    const parts = [...grouped.values()].map(
      ({ days, description }) => `${joinDayLabels(days)}${timeBand ? ` ${timeBand}` : ''}: ${description}`,
    )
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

function formatRateDescription(rate: unknown, min: unknown) {
  const rawRate = typeof rate === 'string' || typeof rate === 'number' ? String(rate).trim() : ''
  if (!rawRate) return ''
  const parsedRate = parseRate(rate)
  if (parsedRate === 0) return 'Free'
  const billingMinutes = parseBillingMinutes(min)
  if (billingMinutes) return `${rawRate} per ${formatDuration(billingMinutes)}`
  return `${rawRate} (published billing period unavailable)`
}

function formatDuration(minutes: number) {
  if (minutes % 60 === 0) {
    const hours = minutes / 60
    return `${hours} hour${hours === 1 ? '' : 's'}`
  }
  return `${minutes} minute${minutes === 1 ? '' : 's'}`
}

function formatTimeBand(startMinute: number | null, endMinute: number | null) {
  if (startMinute === null || endMinute === null) return ''
  if (startMinute === endMinute) return 'all day'
  return `${formatClock(startMinute)}–${formatClock(endMinute)}`
}

function formatClock(minuteOfDay: number) {
  const hour24 = Math.floor(minuteOfDay / 60) % 24
  const minute = minuteOfDay % 60
  const suffix = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 || 12
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`
}

function joinDayLabels(days: string[]) {
  if (days.length <= 1) return days[0] ?? ''
  if (days.length === 2) return `${days[0]} and ${days[1]}`
  return `${days.slice(0, -1).join(', ')}, and ${days[days.length - 1]}`
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function safeError(error: unknown) {
  return error instanceof Error
    ? error.message.replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]')
    : 'Unknown URA error'
}
