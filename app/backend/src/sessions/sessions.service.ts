import { Injectable } from '@nestjs/common'
import { StationsService } from '../stations/stations.service'
import { CreateSessionDto } from './dto/create-session.dto'

export interface ChargingSession {
  id: string
  stationId: string
  stationName: string
  startedAt: string
  energyKwh: number
  totalCost: number
  createdAt: string
}

@Injectable()
export class SessionsService {
  private sessions: ChargingSession[] = []

  constructor(private readonly stationsService: StationsService) {}

  create(dto: CreateSessionDto) {
    const now = new Date().toISOString()
    const station = this.stationsService.findById(dto.stationId)
    const session: ChargingSession = {
      id: `session-${Date.now()}`,
      stationId: station.id,
      stationName: station.name,
      startedAt: dto.startedAt ?? now,
      energyKwh: dto.energyKwh,
      totalCost: dto.totalCost,
      createdAt: now,
    }
    this.sessions = [session, ...this.sessions]
    return session
  }

  list() {
    const currentMonth = new Date().toISOString().slice(0, 7)
    const monthly = this.sessions.filter((item) => item.startedAt.startsWith(currentMonth))
    return {
      sessions: this.sessions,
      summary: {
        monthlyCost: Number(monthly.reduce((sum, item) => sum + item.totalCost, 0).toFixed(2)),
        monthlyEnergyKwh: Number(monthly.reduce((sum, item) => sum + item.energyKwh, 0).toFixed(1)),
        monthlySessions: monthly.length,
        averageCostPerKwh: monthly.length
          ? Number(
              (
                monthly.reduce((sum, item) => sum + item.totalCost, 0) /
                monthly.reduce((sum, item) => sum + item.energyKwh, 0)
              ).toFixed(2),
            )
          : 0,
      },
    }
  }
}
