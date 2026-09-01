import type { Station } from '../common/types'
import { OneMapService, ParkingService } from '../integrations'
import { StationsService } from '../stations/stations.service'
import { RecommendationsService } from './recommendations.service'

const parking = {
  carParkId: 'CP1',
  name: 'Official Car Park',
  provider: 'HDB' as const,
  publishedRateText: 'S$0.60 per half-hour',
  sourceName: 'HDB',
  sourceUrl: 'https://www.hdb.gov.sg',
  lastUpdated: '2026-08-20T00:00:00.000Z',
  matchConfidence: 'high' as const,
  associationLabel: 'Matched to nearby official car park',
}

const stationsFixture: Station[] = [
  {
    id: 'a',
    name: 'A',
    address: '1 A Road',
    postalCode: '123456',
    latitude: 1.3,
    longitude: 103.8,
    operator: 'A',
    connectors: [{ type: 'CCS2', powerKw: 100, total: 2, available: 1, status: 'available' }],
    pricePerKwh: 0.5,
    parking,
    source: 'LTA DataMall',
    lastUpdated: '2026-08-20T00:00:00.000Z',
  },
  {
    id: 'b',
    name: 'B',
    address: '2 B Road',
    postalCode: '123457',
    latitude: 1.301,
    longitude: 103.801,
    operator: 'B',
    connectors: [{ type: 'CCS2', powerKw: 100, total: 2, available: 1, status: 'available' }],
    pricePerKwh: 0.5,
    parking: null,
    source: 'LTA DataMall',
    lastUpdated: '2026-08-20T00:00:00.000Z',
  },
]

describe('RecommendationsService hourly charging prices', () => {
  const stations = {
    distanceKm: () => 1,
    findById: (id: string) => structuredClone(stationsFixture.find((station) => station.id === id)!),
  } as unknown as StationsService
  const oneMap = {
    drivingRoute: jest.fn().mockRejectedValue(new Error('unavailable')),
  } as unknown as OneMapService
  const parkingService = {
    estimate: jest.fn((station: Station) =>
      station.id === 'a'
        ? { estimatedParkingCost: 2, parkingEstimateStatus: 'calculated' as const }
        : { estimatedParkingCost: null, parkingEstimateStatus: 'rate_only' as const },
    ),
  } as unknown as ParkingService
  const service = new RecommendationsService(stations, oneMap, parkingService)

  it('calculates the charging price per hour from the published rate and connector power', () => {
    const ranked = service.rankStation(stationsFixture[0], {
      latitude: 1.3,
      longitude: 103.8,
      connector: 'CCS2',
    })
    expect(ranked.estimatedHourlyCost).toBe(52)
    expect(ranked.hourlyCostIncludesParking).toBe(true)
  })

  it('leaves the hourly price unknown when the charging price is unavailable', () => {
    const ranked = service.rankStation(
      { ...stationsFixture[1], pricePerKwh: null },
      {
        latitude: 1.3,
        longitude: 103.8,
        connector: 'CCS2',
      },
    )
    expect(ranked.estimatedHourlyCost).toBeNull()
    expect(ranked.hourlyCostIncludesParking).toBe(false)
  })
})
