import { BadRequestException, Injectable, Optional } from '@nestjs/common'
import { ConnectorPreference, RankedStation, Station } from '../common/types'
import { OneMapService, ParkingService, RouteResult } from '../integrations'
import { StationsService } from '../stations/stations.service'
import { CompareStationsDto, RecommendationDto } from './dto/recommendation.dto'

const ROUTE_CONCURRENCY = 4

type RankingPriority = 'Balanced' | 'Availability' | 'Speed' | 'Savings'

const rankingWeights: Record<RankingPriority, { availability: number; speed: number; savings: number }> = {
  Balanced: { availability: 40, speed: 30, savings: 30 },
  Availability: { availability: 60, speed: 25, savings: 15 },
  Speed: { availability: 25, speed: 60, savings: 15 },
  Savings: { availability: 25, speed: 15, savings: 60 },
}

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly stationsService: StationsService,
    private readonly oneMap: OneMapService,
    @Optional() private readonly parking?: ParkingService,
  ) {}

  async recommend(dto: RecommendationDto) {
    const search = await this.stationsService.search({
      query: dto.query,
      latitude: dto.latitude,
      longitude: dto.longitude,
      radiusKm: dto.radiusKm ?? 8,
      connector: dto.connector === 'Any' ? undefined : dto.connector,
      includeUnknown: true,
    })
    const routeOrigin =
      dto.routeOriginLatitude !== undefined && dto.routeOriginLongitude !== undefined
        ? { latitude: dto.routeOriginLatitude, longitude: dto.routeOriginLongitude }
        : dto.routeFromCurrentLocation
          ? null
          : dto.latitude !== undefined && dto.longitude !== undefined
            ? { latitude: dto.latitude, longitude: dto.longitude }
            : null
    const routes = new Map<string, RouteResult | null>()
    if (!routeOrigin) {
      search.stations.forEach((station) => routes.set(station.id, null))
    } else {
      const workerCount = Math.min(ROUTE_CONCURRENCY, search.stations.length)
      await Promise.all(
        Array.from({ length: workerCount }, async (_, workerIndex) => {
          for (let index = workerIndex; index < search.stations.length; index += workerCount) {
            const station = search.stations[index]
            try {
              routes.set(station.id, await this.oneMap.drivingRoute(routeOrigin, station))
            } catch {
              routes.set(station.id, null)
            }
          }
        }),
      )
    }
    const ranked = search.stations
      .map((station) => this.rankStation(station, dto, routes.get(station.id) ?? null))
      .sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm)

    return {
      recommended: ranked[0] ?? null,
      alternatives: ranked.slice(1, 3),
      ranked,
      search: {
        totalMatches: search.totalMatches,
        location: search.location,
        dataStatus: search.dataStatus,
        operators: search.operators,
        suggestions: search.suggestions,
      },
    }
  }

  rankStation(
    station: Station & { distanceKm?: number },
    dto: RecommendationDto,
    route: RouteResult | null = null,
  ): RankedStation {
    const connector = this.selectConnector(station, dto.connector, dto)
    if (!connector) throw new BadRequestException('Incompatible station was sent for ranking')

    const distanceKm =
      route?.distanceKm ??
      station.distanceKm ??
      this.stationsService.distanceKm(
        { latitude: dto.latitude ?? 1.2903, longitude: dto.longitude ?? 103.8519 },
        station,
      )
    const availability =
      connector.status === 'unknown' || connector.available === null
        ? null
        : (connector.available / Math.max(connector.total, 1)) * 100
    const powerKw = connector.powerKw > 0 ? connector.powerKw : null
    const pricePerKwh = station.pricePerKwh !== null && station.pricePerKwh > 0 ? station.pricePerKwh : null
    const travelMinutes = route?.travelMinutes ?? Math.max(2, Math.round((distanceKm / 25) * 60))
    const estimatedChargeMinutes =
      powerKw === null ? null : Math.max(10, Math.round(((dto.energyKwh ?? 35) / powerKw) * 60 * 1.12))
    const estimatedCost =
      pricePerKwh === null ? null : Number((pricePerKwh * (dto.energyKwh ?? 35)).toFixed(2))
    const arrivalTime = addMinutes(dto.evaluationAt ?? new Date().toISOString(), travelMinutes)
    const parkingEstimate = this.parking?.estimate(station, arrivalTime, estimatedChargeMinutes) ?? {
      estimatedParkingCost: null,
      parkingEstimateStatus: station.parking ? ('rate_only' as const) : ('unavailable' as const),
    }
    const estimatedTotalCost =
      estimatedCost !== null && parkingEstimate.estimatedParkingCost !== null
        ? Number((estimatedCost + parkingEstimate.estimatedParkingCost).toFixed(2))
        : null
    // Savings is based on the charging cost. Unknown values contribute zero,
    // which deliberately puts incomplete data below stations with known data.
    const savings =
      estimatedCost === null
        ? null
        : Math.max(0, Math.min(100, 100 - (estimatedCost / Math.max((dto.energyKwh ?? 35) * 1.5, 1)) * 100))
    const speed = powerKw === null ? null : Math.min(100, (powerKw / 200) * 100)
    const weights = rankingWeights[dto.rankingPriority ?? 'Balanced']
    const score =
      ((availability ?? 0) * weights.availability +
        (speed ?? 0) * weights.speed +
        (savings ?? 0) * weights.savings) /
      100

    const reasons: string[] = []
    if (pricePerKwh === null) reasons.push('Savings data is unknown and ranked lower')
    if (parkingEstimate.parkingEstimateStatus === 'unavailable')
      reasons.push('Parking cost unavailable and excluded from scoring')
    if (parkingEstimate.parkingEstimateStatus === 'rate_only')
      reasons.push('Parking rate available, but total could not be calculated')
    if (parkingEstimate.estimatedParkingCost !== null)
      reasons.push(
        `Estimated S$${parkingEstimate.estimatedParkingCost.toFixed(2)} parking for the charging period`,
      )
    if (availability === null) reasons.push('Availability is unknown and ranked lower')
    if (speed === null) reasons.push('Charging speed is unknown and ranked lower')
    if ((connector.available ?? 0) > 0)
      reasons.push(
        `${connector.available} compatible charger${connector.available === 1 ? '' : 's'} available now`,
      )
    if ((powerKw ?? 0) >= 100) reasons.push(`Fast ${powerKw} kW charging`)
    if (distanceKm < 3) reasons.push(`Only ${travelMinutes} minutes away`)
    if (pricePerKwh !== null && pricePerKwh <= 0.55)
      reasons.push(`Competitive rate of $${pricePerKwh.toFixed(2)}/kWh`)
    if (dto.connector === 'Any') reasons.unshift(`${connector.type} selected as the best connector`)

    return {
      ...structuredClone(station),
      selectedConnector: connector.type,
      pricePerKwh,
      score: Math.round(score),
      distanceKm,
      travelMinutes,
      travelSource: route ? 'OneMap' : 'Straight-line estimate',
      estimatedCost,
      estimatedChargeMinutes,
      estimatedParkingCost: parkingEstimate.estimatedParkingCost,
      estimatedTotalCost,
      parkingEstimateStatus: parkingEstimate.parkingEstimateStatus,
      reasons: reasons.slice(0, 3),
    }
  }

  async compare(dto: CompareStationsDto) {
    if (dto.stationIds.length < 2 || dto.stationIds.length > 4) {
      throw new BadRequestException('Choose between two and four stations to compare')
    }
    const stations = dto.stationIds.map((id) => this.stationsService.findById(id))
    const origin = { latitude: dto.latitude ?? 1.3048, longitude: dto.longitude ?? 103.8318 }
    const options = await Promise.all(
      stations.map(async (station) => {
        const connector = this.selectConnector(station, dto.connector)
        const powerKw = connector && connector.powerKw > 0 ? connector.powerKw : null
        const pricePerKwh =
          station.pricePerKwh !== null && station.pricePerKwh > 0 ? station.pricePerKwh : null
        let route: RouteResult | null = null
        try {
          route = await this.oneMap.drivingRoute(origin, station)
        } catch {
          route = null
        }
        const distanceKm = route?.distanceKm ?? this.stationsService.distanceKm(origin, station)
        const travelMinutes = route?.travelMinutes ?? Math.max(2, Math.round((distanceKm / 25) * 60))
        const estimatedChargeMinutes =
          powerKw === null ? null : Math.max(10, Math.round(((dto.energyKwh ?? 35) / powerKw) * 60 * 1.12))
        const estimatedCost =
          pricePerKwh === null ? null : Number((pricePerKwh * (dto.energyKwh ?? 35)).toFixed(2))
        const arrivalTime = addMinutes(dto.evaluationAt ?? new Date().toISOString(), travelMinutes)
        const parkingEstimate = this.parking?.estimate(station, arrivalTime, estimatedChargeMinutes) ?? {
          estimatedParkingCost: null,
          parkingEstimateStatus: station.parking ? ('rate_only' as const) : ('unavailable' as const),
        }
        const estimatedTotalCost =
          estimatedCost !== null && parkingEstimate.estimatedParkingCost !== null
            ? Number((estimatedCost + parkingEstimate.estimatedParkingCost).toFixed(2))
            : null
        return {
          id: station.id,
          name: station.name,
          operator: station.operator,
          connector: connector?.type ?? null,
          availability: connector?.available ?? null,
          powerKw,
          estimatedChargeMinutes,
          pricePerKwh,
          estimatedCost,
          parkingRateText: station.parking?.publishedRateText ?? null,
          estimatedParkingCost: parkingEstimate.estimatedParkingCost,
          estimatedTotalCost,
          parkingEstimateStatus: parkingEstimate.parkingEstimateStatus,
          travelMinutes,
          travelSource: route ? 'OneMap' : 'Straight-line estimate',
        }
      }),
    )

    const known = (key: keyof (typeof options)[number]) =>
      options.filter((item) => typeof item[key] === 'number')
    const highlights: Record<string, { best: string[]; weakest: string[] }> = {}
    const directions: Array<{ key: keyof (typeof options)[number]; direction: 'max' | 'min' }> = [
      { key: 'availability', direction: 'max' },
      { key: 'powerKw', direction: 'max' },
      { key: 'estimatedChargeMinutes', direction: 'min' },
      { key: 'pricePerKwh', direction: 'min' },
      { key: 'estimatedCost', direction: 'min' },
      { key: 'estimatedParkingCost', direction: 'min' },
      { key: 'estimatedTotalCost', direction: 'min' },
      { key: 'travelMinutes', direction: 'min' },
    ]
    directions.forEach(({ key, direction }) => {
      const values = known(key)
      if (!values.length) return
      const nums = values.map((item) => item[key] as number)
      const bestValue = direction === 'max' ? Math.max(...nums) : Math.min(...nums)
      const weakestValue = direction === 'max' ? Math.min(...nums) : Math.max(...nums)
      highlights[key as string] = {
        best: values.filter((item) => item[key] === bestValue).map((item) => item.id),
        weakest: values.filter((item) => item[key] === weakestValue).map((item) => item.id),
      }
    })

    return { connector: dto.connector, energyKwh: dto.energyKwh ?? 35, options, highlights }
  }

  private selectConnector(
    station: Station,
    preference: ConnectorPreference,
    filters?: Pick<RecommendationDto, 'availableOnly' | 'includeUnknown' | 'minPowerKw' | 'rankingPriority'>,
  ) {
    if (preference !== 'Any') return station.connectors.find((connector) => connector.type === preference)

    const eligible = station.connectors.filter(
      (connector) =>
        (!filters?.availableOnly || (connector.status === 'available' && (connector.available ?? 0) > 0)) &&
        (filters?.includeUnknown || connector.status !== 'unknown') &&
        (filters?.minPowerKw === undefined || connector.powerKw >= filters.minPowerKw),
    )
    const candidates = eligible.length ? eligible : station.connectors
    const weights = rankingWeights[filters?.rankingPriority ?? 'Balanced']
    return [...candidates].sort((a, b) => {
      const score = (connector: (typeof candidates)[number]) => {
        const availability =
          connector.status === 'unknown' || connector.available === null
            ? 0
            : (connector.available / Math.max(connector.total, 1)) * 100
        const speed = connector.powerKw > 0 ? Math.min(100, (connector.powerKw / 200) * 100) : 0
        return availability * weights.availability + speed * weights.speed
      }
      return score(b) - score(a)
    })[0]
  }
}

function addMinutes(value: Date | string, minutes: number) {
  const date = value instanceof Date ? new Date(value) : new Date(value)
  if (Number.isNaN(date.getTime())) return new Date()
  return new Date(date.getTime() + minutes * 60_000)
}
