import { BadRequestException, Injectable, Optional } from '@nestjs/common'
import { ConnectorPreference, RankedStation, Station } from '../common/types'
import { OneMapService, ParkingService, RouteResult } from '../integrations'
import { StationsService } from '../stations/stations.service'
import { RecommendationDto } from './dto/recommendation.dto'

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
    const connectorPreference = dto.connector ?? 'Any'
    const search = await this.stationsService.search({
      query: dto.query,
      latitude: dto.latitude,
      longitude: dto.longitude,
      radiusKm: dto.radiusKm ?? 8,
      connector: connectorPreference === 'Any' ? undefined : connectorPreference,
      minPowerKw: dto.minPowerKw,
      maxPrice: dto.maxPrice,
      availableOnly: dto.availableOnly,
      operator: dto.operator,
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
      .map((station) =>
        this.rankStation(station, { ...dto, connector: connectorPreference }, routes.get(station.id) ?? null),
      )
      .sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm)

    return {
      recommended: ranked[0] ?? null,
      ranked,
      search: {
        totalMatches: search.totalMatches,
        location: search.location,
        dataStatus: search.dataStatus,
      },
    }
  }

  rankStation(
    station: Station & { distanceKm?: number },
    dto: RecommendationDto,
    route: RouteResult | null = null,
  ): RankedStation {
    const connectorPreference = dto.connector ?? 'Any'
    const connector = this.selectConnector(station, connectorPreference, dto.rankingPriority ?? 'Balanced')
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
    const chargingHourlyCost =
      pricePerKwh === null || powerKw === null ? null : Number((pricePerKwh * powerKw).toFixed(2))
    const arrivalTime = addMinutes(dto.evaluationAt ?? new Date().toISOString(), travelMinutes)
    const parkingEstimate = this.parking?.estimate(station, arrivalTime, 60)
    const parkingHourlyCost = parkingEstimate?.estimatedParkingCost ?? null
    const hourlyCostIncludesParking = chargingHourlyCost !== null && parkingHourlyCost !== null
    const estimatedHourlyCost =
      chargingHourlyCost === null
        ? null
        : hourlyCostIncludesParking
          ? Number((chargingHourlyCost + parkingHourlyCost).toFixed(2))
          : chargingHourlyCost
    // Savings is based on the estimated cost per hour, including one hour of
    // parking when an official tariff can be calculated.
    const savings =
      estimatedHourlyCost === null ? null : Math.max(0, Math.min(100, 100 - estimatedHourlyCost))
    const speed = powerKw === null ? null : Math.min(100, (powerKw / 200) * 100)
    const weights = rankingWeights[dto.rankingPriority ?? 'Balanced']
    const score =
      ((availability ?? 0) * weights.availability +
        (speed ?? 0) * weights.speed +
        (savings ?? 0) * weights.savings) /
      100

    const reasons: string[] = []
    if (estimatedHourlyCost === null) reasons.push('Charging cost per hour is unknown and ranked lower')
    if (availability === null) reasons.push('Availability is unknown and ranked lower')
    if (speed === null) reasons.push('Charging speed is unknown and ranked lower')
    if ((connector.available ?? 0) > 0)
      reasons.push(
        `${connector.available} compatible charger${connector.available === 1 ? '' : 's'} available now`,
      )
    if ((powerKw ?? 0) >= 100) reasons.push(`Fast ${powerKw} kW charging`)
    if (distanceKm < 3) reasons.push(`Only ${travelMinutes} minutes away`)
    if (estimatedHourlyCost !== null && estimatedHourlyCost <= 55)
      reasons.push(`Competitive charging rate of $${estimatedHourlyCost.toFixed(2)}/hour`)
    if (connectorPreference === 'Any') reasons.unshift(`${connector.type} selected as the best connector`)

    return {
      ...structuredClone(station),
      selectedConnector: connector.type,
      pricePerKwh,
      score: Math.round(score),
      distanceKm,
      travelMinutes,
      travelSource: route ? 'OneMap' : 'Straight-line estimate',
      estimatedHourlyCost,
      hourlyCostIncludesParking,
      reasons: reasons.slice(0, 3),
    }
  }

  private selectConnector(
    station: Station,
    preference: ConnectorPreference,
    rankingPriority: RankingPriority,
  ) {
    if (preference !== 'Any') return station.connectors.find((connector) => connector.type === preference)

    const eligible = station.connectors.filter((connector) => connector.status !== 'unknown')
    const candidates = eligible.length ? eligible : station.connectors
    const weights = rankingWeights[rankingPriority]
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
