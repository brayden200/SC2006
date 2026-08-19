import { SessionsService } from './sessions.service'
import { StationsService } from '../stations/stations.service'

const station = { id: 'station-1', name: 'Backend Station' }
const stations = {
  findById: jest.fn(() => station),
} as unknown as StationsService

describe('SessionsService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-19T12:00:00.000Z'))
  })

  afterEach(() => jest.useRealTimers())

  it('uses the current time when the session date is omitted', () => {
    const session = new SessionsService(stations).create({
      stationId: station.id,
      energyKwh: 24.5,
      totalCost: 13.2,
    })

    expect(session).toEqual({
      id: expect.stringMatching(/^session-/),
      stationId: station.id,
      stationName: station.name,
      startedAt: '2026-08-19T12:00:00.000Z',
      energyKwh: 24.5,
      totalCost: 13.2,
      createdAt: '2026-08-19T12:00:00.000Z',
    })
  })

  it('summarises the current user-entered sessions', () => {
    const service = new SessionsService(stations)
    service.create({
      stationId: station.id,
      startedAt: '2026-08-01T10:00:00.000Z',
      energyKwh: 20,
      totalCost: 10,
    })
    service.create({
      stationId: station.id,
      startedAt: '2026-08-10T10:00:00.000Z',
      energyKwh: 30,
      totalCost: 18,
    })

    expect(service.list().summary).toEqual({
      monthlyCost: 28,
      monthlyEnergyKwh: 50,
      monthlySessions: 2,
      averageCostPerKwh: 0.56,
    })
  })
})
