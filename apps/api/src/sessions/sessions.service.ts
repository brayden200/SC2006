import { Injectable } from '@nestjs/common';
import { StationsService } from '../stations/stations.service';
import { CreateSessionDto } from './dto/create-session.dto';

export interface ChargingSession extends CreateSessionDto {
  id: string;
  stationName: string;
  createdAt: string;
  dataSource: 'User submitted';
}

@Injectable()
export class SessionsService {
  private sessions: ChargingSession[] = [
    {
      id: 'session-seed-1', stationId: 'cw-orchard-central', stationName: 'Orchard Central',
      startedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), energyKwh: 31.4,
      totalCost: 19.47, durationMinutes: 34, officialStatusAccurate: true,
      createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), dataSource: 'User submitted',
    },
    {
      id: 'session-seed-2', stationId: 'cw-plaza-singapura', stationName: 'Plaza Singapura',
      startedAt: new Date(Date.now() - 16 * 86_400_000).toISOString(), energyKwh: 24.8,
      totalCost: 13.64, durationMinutes: 47, officialStatusAccurate: false,
      createdAt: new Date(Date.now() - 16 * 86_400_000).toISOString(), dataSource: 'User submitted',
    },
    {
      id: 'session-seed-3', stationId: 'cw-marina-bay', stationName: 'Marina Bay Financial Centre',
      startedAt: new Date(Date.now() - 34 * 86_400_000).toISOString(), energyKwh: 38.1,
      totalCost: 22.1, durationMinutes: 29, officialStatusAccurate: true,
      createdAt: new Date(Date.now() - 34 * 86_400_000).toISOString(), dataSource: 'User submitted',
    },
  ];

  constructor(private readonly stationsService: StationsService) {}

  create(dto: CreateSessionDto) {
    const station = this.stationsService.findById(dto.stationId);
    const session: ChargingSession = {
      ...dto,
      id: `session-${Date.now()}`,
      stationName: station.name,
      createdAt: new Date().toISOString(),
      dataSource: 'User submitted',
    };
    this.sessions = [session, ...this.sessions];
    return session;
  }

  list() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthly = this.sessions.filter((item) => item.startedAt.startsWith(currentMonth));
    const frequency = this.sessions.reduce<Record<string, number>>((acc, item) => {
      acc[item.stationName] = (acc[item.stationName] ?? 0) + 1;
      return acc;
    }, {});
    const favourite = Object.entries(frequency).sort((a, b) => b[1] - a[1])[0];
    return {
      sessions: this.sessions,
      summary: {
        monthlyCost: Number(monthly.reduce((sum, item) => sum + item.totalCost, 0).toFixed(2)),
        monthlyEnergyKwh: Number(monthly.reduce((sum, item) => sum + item.energyKwh, 0).toFixed(1)),
        monthlySessions: monthly.length,
        averageCostPerKwh: monthly.length
          ? Number((monthly.reduce((sum, item) => sum + item.totalCost, 0) / monthly.reduce((sum, item) => sum + item.energyKwh, 0)).toFixed(2))
          : 0,
        frequentlyUsedStation: favourite ? { name: favourite[0], visits: favourite[1] } : null,
      },
    };
  }
}
