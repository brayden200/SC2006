import { Injectable } from '@nestjs/common'
import { StationsService } from '../stations/stations.service'
import { CreateSessionDto } from './dto/create-session.dto'

export interface ChargingSession extends CreateSessionDto {
  id: string
  stationName: string
  createdAt: string
  dataSource: 'User submitted'
}

@Injectable()
export class SessionsService {
  private sessions: ChargingSession[] = []

  constructor(private readonly stationsService: StationsService) {}

  create(dto: CreateSessionDto) {
    const station = this.stationsService.findById(dto.stationId)
    const session: ChargingSession = {
      ...dto,
      id: `session-${Date.now()}`,
      stationName: station.name,
      createdAt: new Date().toISOString(),
      dataSource: 'User submitted',
    }
    this.sessions = [session, ...this.sessions]
    return session
  }

  list() {
    const currentMonth = new Date().toISOString().slice(0, 7)
    const monthly = this.sessions.filter((item) => item.startedAt.startsWith(currentMonth))
    const frequency = this.sessions.reduce<Record<string, number>>((acc, item) => {
      acc[item.stationName] = (acc[item.stationName] ?? 0) + 1
      return acc
    }, {})
    const favourite = Object.entries(frequency).sort((a, b) => b[1] - a[1])[0]
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
        frequentlyUsedStation: favourite ? { name: favourite[0], visits: favourite[1] } : null,
      },
    }
  }
}
