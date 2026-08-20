import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type {
  ParkingProvider,
  ParkingProviderStatus,
  ParkingRecord,
  ParkingTariffRule,
} from '../parking.types'
import { svy21ToWgs84 } from '../svy21.util'

const HDB_DATASET_ID = 'd_23f946fa557947f93a8043bbef41dd09'
const HDB_SOURCE_URL =
  'https://www.hdb.gov.sg/parking/other-parking-matters/shortterm-parking/shortterm-parking-charges'
const HDB_DATA_URL = `https://data.gov.sg/api/action/datastore_search?resource_id=${HDB_DATASET_ID}&limit=5000`

const CENTRAL_CAR_PARKS = new Set([
  'ACB',
  'BBB',
  'BRB1',
  'CY',
  'DUXM',
  'HLM',
  'KAB',
  'KAM',
  'KAS',
  'PRM',
  'SLS',
  'SR1',
  'SR2',
  'TPM',
  'UCS',
  'WCB',
])

@Injectable()
export class HdbParkingService implements ParkingProvider {
  readonly name = 'HDB' as const
  private readonly dataUrl: string
  private cache: { records: ParkingRecord[]; fetchedAt: string; expiresAt: number } | null = null
  private lastError: string | null = null
  private failureRetryAt = 0

  constructor(private readonly config: ConfigService) {
    this.dataUrl = this.config.get('HDB_CARPARK_DATA_URL') ?? HDB_DATA_URL
  }

  isConfigured() {
    return true
  }

  status(): ParkingProviderStatus {
    return {
      configured: true,
      state: this.lastError ? 'error' : this.cache ? 'available' : 'not_checked',
      lastSuccessfulFetch: this.cache?.fetchedAt ?? null,
      lastError: this.lastError,
      cacheExpiresAt: this.cache ? new Date(this.cache.expiresAt).toISOString() : null,
      tokenMode: 'none',
    }
  }

  async getCarParks(force = false) {
    if (!force && this.cache && this.cache.expiresAt > Date.now()) return structuredClone(this.cache.records)
    if (!force && !this.cache && this.lastError && this.failureRetryAt > Date.now())
      throw new Error(this.lastError)
    try {
      const response = await fetch(this.dataUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      })
      if (!response.ok) throw new Error(`HDB car-park request failed with HTTP ${response.status}`)
      const payload = await response.json()
      const fetchedAt = new Date().toISOString()
      const records = this.normalizeResponse(payload, fetchedAt)
      if (!records.length) throw new Error('HDB car-park response contained no usable car parks')
      this.cache = { records, fetchedAt, expiresAt: Date.now() + 24 * 60 * 60_000 }
      this.lastError = null
      this.failureRetryAt = 0
      return structuredClone(records)
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown HDB error'
      this.failureRetryAt = Date.now() + 60_000
      if (this.cache) return structuredClone(this.cache.records)
      throw error
    }
  }

  normalizeResponse(payload: unknown, fetchedAt = new Date().toISOString()): ParkingRecord[] {
    const records = this.extractRecords(payload)
    return records.flatMap((item) => {
      const carParkId = this.string(item['Car Park No'] ?? item.car_park_no ?? item.carparkNo)
      const address = this.string(item.Address ?? item.address)
      const easting = Number(item['X Coord'] ?? item.x_coord ?? item.xCoord)
      const northing = Number(item['Y Coord'] ?? item.y_coord ?? item.yCoord)
      if (!carParkId || !Number.isFinite(easting) || !Number.isFinite(northing)) return []
      const coordinates = svy21ToWgs84(easting, northing)
      if (!coordinates) return []
      const shortTerm = this.string(item['Short Term Parking'] ?? item.short_term_parking).toUpperCase()
      const freeParking = this.string(item['Free Parking'] ?? item.free_parking).toUpperCase()
      const rules = this.rulesFor(carParkId, shortTerm, freeParking)
      return [
        {
          carParkId,
          name: address || `HDB car park ${carParkId}`,
          provider: 'HDB' as const,
          address,
          postalCode: address.match(/\b\d{6}\b/)?.[0] ?? '',
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          publishedRateText: this.rateText(carParkId, shortTerm, freeParking),
          sourceName: 'HDB short-term parking charges',
          sourceUrl: HDB_SOURCE_URL,
          lastUpdated: fetchedAt,
          tariffRules: rules,
        },
      ]
    })
  }

  private rulesFor(carParkId: string, shortTerm: string, freeParking: string): ParkingTariffRule[] {
    if (!shortTerm || /^(NO|N|NOT AVAILABLE)/.test(shortTerm)) return []
    const central = CENTRAL_CAR_PARKS.has(carParkId.toUpperCase())
    const freeOnSundayAndHoliday = /SUN|PH|PUBLIC/.test(freeParking)
    const rules: ParkingTariffRule[] = []
    if (freeOnSundayAndHoliday) {
      rules.push({
        days: ['sunday', 'public_holiday'],
        startMinute: 0,
        endMinute: 0,
        rate: 0,
        billingUnitMinutes: 1,
        billing: 'per_entry',
      })
    }
    if (central) {
      rules.push({
        days: ['weekday'],
        startMinute: 7 * 60,
        endMinute: 17 * 60,
        rate: 1.2,
        billingUnitMinutes: 30,
        billing: 'per_unit',
      })
      rules.push({
        days: ['weekday'],
        startMinute: 17 * 60,
        endMinute: 7 * 60,
        rate: 0.6,
        billingUnitMinutes: 30,
        billing: 'per_unit',
      })
      rules.push({
        days: freeOnSundayAndHoliday ? ['saturday'] : ['saturday', 'sunday', 'public_holiday'],
        startMinute: 0,
        endMinute: 0,
        rate: 0.6,
        billingUnitMinutes: 30,
        billing: 'per_unit',
      })
    } else {
      rules.push({
        days: freeOnSundayAndHoliday
          ? ['weekday', 'saturday']
          : ['weekday', 'saturday', 'sunday', 'public_holiday'],
        startMinute: 0,
        endMinute: 0,
        rate: 0.6,
        billingUnitMinutes: 30,
        billing: 'per_unit',
      })
    }
    return rules
  }

  private rateText(carParkId: string, shortTerm: string, freeParking: string) {
    if (!shortTerm || /^(NO|N|NOT AVAILABLE)/.test(shortTerm))
      return 'Short-term parking is not listed by HDB.'
    const area = CENTRAL_CAR_PARKS.has(carParkId.toUpperCase())
      ? 'S$1.20 per half-hour in the Central Area on weekdays 7:00am–5:00pm; S$0.60 at other times'
      : 'S$0.60 per half-hour outside the Central Area'
    return freeParking && !/^(NO|N|NONE)/.test(freeParking)
      ? `${area}; free parking indication: ${freeParking}`
      : area
  }

  private extractRecords(payload: unknown): Array<Record<string, unknown>> {
    if (!record(payload)) return []
    const result = payload.result
    if (record(result) && Array.isArray(result.records)) return result.records.filter(record)
    if (Array.isArray(payload.records)) return payload.records.filter(record)
    return []
  }

  private string(value: unknown) {
    return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
