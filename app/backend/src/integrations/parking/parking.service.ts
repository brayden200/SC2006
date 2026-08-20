import { Injectable, Logger, Optional } from '@nestjs/common'
import type { ParkingInfo, ParkingMatchConfidence, Station } from '../../common/types'
import { associateChargerToCarPark } from './parking-matcher.util'
import { calculateParkingCost } from './parking-tariff.util'
import type { ParkingProvider, ParkingProviderStatus, ParkingRecord } from './parking.types'
import { HdbParkingService } from './providers/hdb-parking.service'
import { UraParkingService } from './providers/ura-parking.service'

export interface ParkingEstimate {
  estimatedParkingCost: number | null
  parkingEstimateStatus: 'calculated' | 'rate_only' | 'unavailable'
}

@Injectable()
export class ParkingService {
  private readonly logger = new Logger(ParkingService.name)
  private readonly linkedRecords = new Map<string, ParkingRecord>()
  private readonly publicHolidayDates: string[]
  private readonly explicitMappings: Record<string, string>

  constructor(
    @Optional() private readonly ura?: UraParkingService,
    @Optional() private readonly hdb?: HdbParkingService,
  ) {
    this.publicHolidayDates = (process.env.SINGAPORE_PUBLIC_HOLIDAYS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
    try {
      const parsed = JSON.parse(process.env.CHARGEWISE_PARKING_MAPPINGS ?? '{}')
      this.explicitMappings = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      this.explicitMappings = {}
    }
  }

  async enrichStations(stations: Station[]) {
    const providers = [this.ura, this.hdb].filter(Boolean) as ParkingProvider[]
    const results = await Promise.all(
      providers.map(async (provider) => {
        if (!provider.isConfigured()) return []
        try {
          return await provider.getCarParks()
        } catch (error) {
          this.logger.warn(
            `${provider.name} parking data unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
          )
          return []
        }
      }),
    )
    const records = results.flat()
    this.linkedRecords.clear()
    return stations.map((station) => {
      const match = associateChargerToCarPark(station, records, this.explicitMappings[station.id])
      if (!match) return { ...structuredClone(station), parking: null }
      this.linkedRecords.set(station.id, match.record)
      return { ...structuredClone(station), parking: this.toPublicInfo(match) }
    })
  }

  estimate(station: Station, arrivalTime: Date | string, durationMinutes: number | null): ParkingEstimate {
    if (!station.parking) return { estimatedParkingCost: null, parkingEstimateStatus: 'unavailable' }
    if (!durationMinutes || durationMinutes <= 0)
      return { estimatedParkingCost: null, parkingEstimateStatus: 'rate_only' }
    const record = this.linkedRecords.get(station.id)
    if (!record?.tariffRules.length) return { estimatedParkingCost: null, parkingEstimateStatus: 'rate_only' }
    const result = calculateParkingCost(record.tariffRules, arrivalTime, durationMinutes, {
      publicHolidayDates: this.publicHolidayDates,
    })
    return {
      estimatedParkingCost: result.cost,
      parkingEstimateStatus: result.status,
    }
  }

  status() {
    return {
      ura: this.ura?.status() ?? unavailableStatus('URA'),
      hdb: this.hdb?.status() ?? unavailableStatus('HDB'),
    }
  }

  private toPublicInfo(match: { record: ParkingRecord; confidence: ParkingMatchConfidence }): ParkingInfo {
    return {
      carParkId: match.record.carParkId,
      name: match.record.name,
      provider: match.record.provider,
      publishedRateText: match.record.publishedRateText,
      sourceName: match.record.sourceName,
      sourceUrl: match.record.sourceUrl,
      lastUpdated: match.record.lastUpdated,
      matchConfidence: match.confidence,
      associationLabel:
        match.confidence === 'high'
          ? 'Matched to nearby official car park'
          : 'Likely nearby official car park',
    }
  }
}

function unavailableStatus(name: 'URA' | 'HDB'): ParkingProviderStatus {
  return {
    configured: false,
    state: 'not_configured',
    lastSuccessfulFetch: null,
    lastError: `${name} parking provider is unavailable.`,
    cacheExpiresAt: null,
    tokenMode: 'none',
  }
}
