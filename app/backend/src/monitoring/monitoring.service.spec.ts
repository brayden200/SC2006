import type { Station } from '../common/types'
import { RecommendationsService } from '../recommendations/recommendations.service'
import { StationsService } from '../stations/stations.service'
import { MonitoringService } from './monitoring.service'

describe('MonitoringService', () => {
  it('suppresses duplicate availability-change events', async () => {
    let available = 1
    const station: Station = {
      id: 'station-1',
      name: 'Test station',
      address: '1 Test Road',
      postalCode: '123456',
      latitude: 1.3,
      longitude: 103.8,
      operator: 'Test',
      connectors: [{ type: 'CCS2', powerKw: 100, total: 2, available: 1, status: 'available' }],
      pricePerKwh: 0.5,
      parking: null,
      source: 'LTA DataMall',
      lastUpdated: '2026-08-20T00:00:00.000Z',
    }
    const stations = {
      findById: jest.fn(() => ({ ...station, connectors: [{ ...station.connectors[0], available }] })),
      refreshFromProvider: jest.fn().mockResolvedValue(true),
      distanceKm: jest.fn().mockReturnValue(1),
    } as unknown as StationsService
    const recommendations = {} as RecommendationsService
    const service = new MonitoringService(stations, recommendations)
    const created = service.create({ stationId: station.id, connector: 'CCS2', durationMinutes: 90 })
    available = 0
    const changed = await service.check(created.id)
    const monitor = service.list().monitors[0]
    const eventCount = monitor.events.filter((event) => event.type === 'availability_changed').length
    expect(changed.events.filter((event) => event.type === 'availability_changed')).toHaveLength(1)
    await service.check(monitor.id)
    expect(
      service.list().monitors[0].events.filter((event) => event.type === 'availability_changed'),
    ).toHaveLength(eventCount)
  })
})
