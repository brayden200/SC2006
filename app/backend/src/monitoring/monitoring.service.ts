import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { ConnectorType } from '../common/types'
import { RecommendationsService } from '../recommendations/recommendations.service'
import { StationsService } from '../stations/stations.service'
import { AcceptAlternativeDto, AlternativeQueryDto, CreateMonitorDto } from './dto/monitoring.dto'
import { MonitorRepository } from './monitoring.repository'

export interface MonitorEvent {
  id: string
  type: 'started' | 'availability_changed' | 'alternative_accepted' | 'stale_warning'
  message: string
  timestamp: string
}

export interface Monitor {
  id: string
  stationId: string
  connector: ConnectorType
  createdAt: string
  expiresAt: string
  lastCheckedAt: string
  lastKnownAvailability: number | null
  status: 'active' | 'expired' | 'stopped'
  events: MonitorEvent[]
}

@Injectable()
export class MonitoringService {
  private monitors: Monitor[] = []

  constructor(
    private readonly stationsService: StationsService,
    private readonly recommendationsService: RecommendationsService,
    @Optional() private readonly repository?: MonitorRepository,
  ) {
    this.monitors = repository?.getAll() ?? []
  }

  create(dto: CreateMonitorDto) {
    const station = this.stationsService.findById(dto.stationId)
    const connector = station.connectors.find((item) => item.type === dto.connector)
    if (!connector) throw new BadRequestException('This station does not support the selected connector')

    const existing = this.monitors.find(
      (item) =>
        item.stationId === dto.stationId && item.connector === dto.connector && item.status === 'active',
    )
    if (existing) return this.enrich(existing)

    const now = new Date()
    const monitor: Monitor = {
      id: `watch-${Date.now()}`,
      stationId: dto.stationId,
      connector: dto.connector,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + (dto.durationMinutes ?? 90) * 60_000).toISOString(),
      lastCheckedAt: now.toISOString(),
      lastKnownAvailability: connector.available,
      status: 'active',
      events: [this.event('started', `Monitoring started for ${station.name}.`)],
    }
    this.monitors = [monitor, ...this.monitors]
    this.persist()
    return this.enrich(monitor)
  }

  list() {
    this.expireMonitors()
    return { monitors: this.monitors.map((item) => this.enrich(item)) }
  }

  stop(id: string) {
    const monitor = this.find(id)
    monitor.status = 'stopped'
    this.persist()
    return this.enrich(monitor)
  }

  async check(id: string) {
    const monitor = this.find(id)
    if (monitor.status !== 'active') throw new BadRequestException('This monitor is no longer active')
    const refreshed = await this.stationsService.refreshFromProvider(true)
    if (!refreshed) {
      throw new ServiceUnavailableException('Could not refresh live availability. Please try again shortly.')
    }
    return this.checkOne(monitor)
  }

  async alternatives(id: string, query: AlternativeQueryDto) {
    const monitor = this.find(id)
    const current = this.stationsService.findById(monitor.stationId)
    const result = await this.recommendationsService.recommend({
      latitude: query.latitude,
      longitude: query.longitude,
      connector: monitor.connector,
      radiusKm: query.radiusKm ?? 12,
      availabilityWeight: 40,
      travelWeight: 30,
      speedWeight: 15,
      priceWeight: 10,
      preferenceWeight: 5,
      availableOnly: true,
    })
    const ranked = result.ranked.filter((item) => {
      const connector = item.connectors.find((candidate) => candidate.type === monitor.connector)
      return (
        item.id !== monitor.stationId && (connector?.available ?? 0) > 0 && connector?.status === 'available'
      )
    })
    const currentDistance = this.stationsService.distanceKm(query, current)
    const currentTravelMinutes = Math.max(2, Math.round((currentDistance / 25) * 60))
    const alternatives = ranked.slice(0, 3).map((item) => ({
      ...item,
      additionalTravelMinutes: Math.max(0, (item.travelMinutes ?? 0) - currentTravelMinutes),
    }))
    return {
      currentStation: current,
      recommended: alternatives[0] ?? null,
      alternatives,
      message: alternatives.length
        ? 'Alternatives are ranked from your latest known location.'
        : 'No available alternative found. Try expanding the search radius or wait for the current station.',
    }
  }

  acceptAlternative(id: string, dto: AcceptAlternativeDto) {
    const monitor = this.find(id)
    const station = this.stationsService.findById(dto.stationId)
    const connector = station.connectors.find((item) => item.type === monitor.connector)
    if (!connector || connector.status !== 'available' || (connector.available ?? 0) < 1) {
      throw new BadRequestException('The alternative is no longer available or compatible')
    }
    monitor.stationId = station.id
    monitor.lastKnownAvailability = connector.available
    monitor.lastCheckedAt = new Date().toISOString()
    monitor.events.unshift(this.event('alternative_accepted', `Switched monitoring to ${station.name}.`))
    this.persist()
    return this.enrich(monitor)
  }

  @Interval(30_000)
  async checkActiveMonitors() {
    this.expireMonitors()
    const refreshed = await this.stationsService.refreshFromProvider()
    if (!refreshed) return
    this.monitors.filter((item) => item.status === 'active').forEach((item) => this.checkOne(item))
  }

  private checkOne(monitor: Monitor) {
    const station = this.stationsService.findById(monitor.stationId)
    const connector = station.connectors.find((item) => item.type === monitor.connector)!
    if (connector.available !== monitor.lastKnownAvailability) {
      const message =
        connector.available === 0
          ? `${station.name} is now fully occupied. Consider an alternative.`
          : `${station.name} now has ${connector.available ?? 'unknown'} compatible charger${connector.available === 1 ? '' : 's'} available.`
      monitor.events.unshift(this.event('availability_changed', message))
      monitor.lastKnownAvailability = connector.available
      this.persist()
    }
    monitor.lastCheckedAt = new Date().toISOString()
    this.persist()
    return this.enrich(monitor)
  }

  private expireMonitors() {
    const now = Date.now()
    let changed = false
    this.monitors.forEach((item) => {
      if (item.status === 'active' && new Date(item.expiresAt).getTime() <= now) {
        item.status = 'expired'
        changed = true
      }
    })
    if (changed) this.persist()
  }

  private find(id: string) {
    const monitor = this.monitors.find((item) => item.id === id)
    if (!monitor) throw new NotFoundException(`Monitor ${id} was not found`)
    return monitor
  }

  private enrich(monitor: Monitor) {
    return { ...structuredClone(monitor), station: this.stationsService.findById(monitor.stationId) }
  }

  private event(type: MonitorEvent['type'], message: string): MonitorEvent {
    return {
      id: `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      message,
      timestamp: new Date().toISOString(),
    }
  }

  private persist() {
    this.repository?.save(this.monitors)
  }
}
