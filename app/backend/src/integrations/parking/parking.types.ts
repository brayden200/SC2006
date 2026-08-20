import type { ParkingProviderName } from '../../common/types'

export type ParkingDay = 'weekday' | 'saturday' | 'sunday' | 'public_holiday'
export type ParkingBillingUnit = 'per_unit' | 'per_entry'

export interface ParkingTariffRule {
  days: ParkingDay[]
  startMinute: number
  endMinute: number
  rate: number
  billingUnitMinutes: number
  billing: ParkingBillingUnit
  cap?: number
}

export interface ParkingRecord {
  carParkId: string
  name: string
  provider: ParkingProviderName
  address: string
  postalCode: string
  latitude: number
  longitude: number
  publishedRateText: string
  sourceName: string
  sourceUrl: string
  lastUpdated: string
  tariffRules: ParkingTariffRule[]
}

export interface ParkingProviderStatus {
  configured: boolean
  state: 'available' | 'error' | 'not_checked' | 'not_configured'
  lastSuccessfulFetch: string | null
  lastError: string | null
  cacheExpiresAt: string | null
  tokenMode?: 'provided_token' | 'daily_token' | 'none'
}

export interface ParkingProvider {
  readonly name: ParkingProviderName
  isConfigured(): boolean
  status(): ParkingProviderStatus
  getCarParks(force?: boolean): Promise<ParkingRecord[]>
}

export interface ParkingMatch {
  record: ParkingRecord
  method: 'explicit' | 'postal_or_address' | 'name_and_proximity' | 'nearest_proximity'
  confidence: 'high' | 'medium' | 'low'
  distanceKm: number
}
