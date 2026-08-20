import type { Station } from '../common/types'
import { LtaDataMallService, OneMapService } from '../integrations'
import { StationsService } from '../stations/stations.service'
import { RecommendationsService } from './recommendations.service'

const stationsFixture: Station[] = [
  {
    id: 'lta-test-ccs',
    name: 'Test CCS Station',
    address: '1 Test Road',
    postalCode: '123456',
    latitude: 1.3048,
    longitude: 103.8318,
    operator: 'Test Operator',
    connectors: [{ type: 'CCS2', powerKw: 120, total: 4, available: 2, status: 'available' }],
    pricePerKwh: null,
    source: 'LTA DataMall',
    lastUpdated: '2026-08-19T12:00:00.000Z',
  },
  {
    id: 'lta-test-chademo',
    name: 'Test CHAdeMO Station',
    address: '2 Test Road',
    postalCode: '123457',
    latitude: 1.305,
    longitude: 103.832,
    operator: 'Test Operator',
    connectors: [{ type: 'CHAdeMO', powerKw: 50, total: 2, available: 1, status: 'available' }],
    pricePerKwh: 0.55,
    source: 'LTA DataMall',
    lastUpdated: '2026-08-19T12:00:00.000Z',
  },
]

describe('RecommendationsService', () => {
  const lta = {
    isConfigured: () => true,
    getAllStations: jest.fn().mockResolvedValue(stationsFixture),
    status: () => ({ state: 'available', lastSuccessfulFetch: '2026-08-19T12:00:00.000Z' }),
  } as unknown as LtaDataMallService
  const drivingRoute = jest.fn().mockRejectedValue(new Error('Routing unavailable'))
  const oneMap = {
    drivingRoute,
    status: () => ({ state: 'error' }),
  } as unknown as OneMapService
  const stations = new StationsService(lta, oneMap)
  const service = new RecommendationsService(stations, oneMap)

  it('never ranks an incompatible connector', async () => {
    const result = await service.recommend({
      latitude: 1.3048,
      longitude: 103.8318,
      connector: 'CHAdeMO',
      radiusKm: 30,
    })
    expect(result.ranked).toHaveLength(1)
    result.ranked.forEach((station) => {
      expect(station.connectors.some((connector) => connector.type === 'CHAdeMO')).toBe(true)
    })
  })

  it('ranks every station by its best connector when Any is selected', async () => {
    const result = await service.recommend({
      latitude: 1.3048,
      longitude: 103.8318,
      connector: 'Any',
      radiusKm: 30,
    })
    expect(result.ranked).toHaveLength(2)
    expect(result.ranked.map((station) => station.selectedConnector).sort()).toEqual(['CCS2', 'CHAdeMO'])
    result.ranked.forEach((station) => {
      expect(station.connectors.some((connector) => connector.type === station.selectedConnector)).toBe(true)
    })
  })

  it('queries OneMap road times before returning the station list', async () => {
    drivingRoute.mockClear()
    drivingRoute.mockResolvedValue({
      travelMinutes: 7,
      distanceKm: 2.1,
      coordinates: [
        [1.3048, 103.8318],
        [1.305, 103.832],
      ],
      source: 'OneMap',
    })

    const result = await service.recommend({
      latitude: 1.3048,
      longitude: 103.8318,
      connector: 'Any',
      radiusKm: 30,
    })

    expect(drivingRoute).toHaveBeenCalledTimes(stationsFixture.length)
    expect(result.ranked.every((station) => station.travelSource === 'OneMap')).toBe(true)
    expect(result.ranked.every((station) => station.travelMinutes === 7)).toBe(true)
    drivingRoute.mockRejectedValue(new Error('Routing unavailable'))
  })

  it('uses the supplied current location as the OneMap route origin', async () => {
    drivingRoute.mockClear()
    drivingRoute.mockResolvedValue({
      travelMinutes: 5,
      distanceKm: 1.4,
      coordinates: [
        [1.31, 103.84],
        [1.3048, 103.8318],
      ],
      source: 'OneMap',
    })

    await service.recommend({
      latitude: 1.3048,
      longitude: 103.8318,
      routeOriginLatitude: 1.31,
      routeOriginLongitude: 103.84,
      connector: 'Any',
      radiusKm: 30,
    })

    expect(drivingRoute).toHaveBeenCalledWith(
      { latitude: 1.31, longitude: 103.84 },
      expect.objectContaining({ id: stationsFixture[0].id }),
    )
    drivingRoute.mockRejectedValue(new Error('Routing unavailable'))
  })

  it('compares stations using each station’s selected connector in Any mode', async () => {
    const result = await service.compare({
      stationIds: stationsFixture.map((station) => station.id),
      connector: 'Any',
      energyKwh: 35,
      latitude: 1.3048,
      longitude: 103.8318,
    })
    expect(result.connector).toBe('Any')
    expect(result.options.map((option) => option.connector).sort()).toEqual(['CCS2', 'CHAdeMO'])
  })

  it('redistributes the missing price weight instead of inventing a price', () => {
    const ranked = service.rankStation(
      { ...stationsFixture[0], distanceKm: 1 },
      {
        latitude: 1.3048,
        longitude: 103.8318,
        connector: 'CCS2',
      },
    )
    expect(ranked.estimatedCost).toBeNull()
    expect(ranked.scoreBreakdown.price).toBeNull()
    expect(ranked.reasons).toContain('Price is unknown and was excluded from scoring')
  })

  it('treats a zero-dollar station price as unknown during ranking', () => {
    const ranked = service.rankStation(
      { ...stationsFixture[0], pricePerKwh: 0, distanceKm: 1 },
      {
        latitude: 1.3048,
        longitude: 103.8318,
        connector: 'CCS2',
      },
    )
    expect(ranked.pricePerKwh).toBeNull()
    expect(ranked.estimatedCost).toBeNull()
    expect(ranked.scoreBreakdown.price).toBeNull()
  })
})
