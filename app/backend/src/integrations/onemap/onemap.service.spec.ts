import { ConfigService } from '@nestjs/config'
import { decodeRouteGeometry, OneMapService } from './onemap.service'

describe('OneMapService', () => {
  const originalFetch = global.fetch
  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('geocodes with the documented token header and caches the result', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ SEARCHVAL: 'ORCHARD ROAD', LATITUDE: '1.3048', LONGITUDE: '103.8318' }],
      }),
    })
    global.fetch = fetchMock as typeof fetch
    const service = new OneMapService(new ConfigService({ ONEMAP_TOKEN: 'test-token' }))

    await expect(service.searchAddress('Orchard Road')).resolves.toEqual({
      latitude: 1.3048,
      longitude: 103.8318,
      label: 'ORCHARD ROAD',
    })
    await service.searchAddress('Orchard Road')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('test-token')
  })

  it('normalizes OneMap route summary seconds and metres', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 0,
        route_geometry: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
        route_summary: { total_time: 615, total_distance: 4200 },
      }),
    }) as unknown as typeof fetch
    const service = new OneMapService(new ConfigService({ ONEMAP_TOKEN: 'test-token' }))
    await expect(
      service.drivingRoute({ latitude: 1.3, longitude: 103.8 }, { latitude: 1.32, longitude: 103.84 }),
    ).resolves.toEqual({
      travelMinutes: 10,
      distanceKm: 4.2,
      coordinates: [
        [38.5, -120.2],
        [40.7, -120.95],
        [43.252, -126.453],
      ],
      source: 'OneMap',
    })
    await service.drivingRoute({ latitude: 1.3, longitude: 103.8 }, { latitude: 1.32, longitude: 103.84 })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('refreshes through configured credentials after a token returns 401', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'refreshed-token',
          expiry_timestamp: `${Date.now() / 1000 + 3600}`,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 0,
          route_geometry: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
          route_summary: { total_time: 60, total_distance: 1000 },
        }),
      })
    global.fetch = fetchMock as unknown as typeof fetch
    const service = new OneMapService(
      new ConfigService({
        ONEMAP_TOKEN: 'expired-token',
        ONEMAP_EMAIL: 'driver@example.com',
        ONEMAP_PASSWORD: 'password',
      }),
    )

    await expect(
      service.drivingRoute({ latitude: 1.3, longitude: 103.8 }, { latitude: 1.32, longitude: 103.84 }),
    ).resolves.toMatchObject({ travelMinutes: 1, distanceKm: 1, source: 'OneMap' })
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ email: 'driver@example.com', password: 'password' }),
    })
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('refreshed-token')
  })

  it('decodes OneMap route geometry into latitude/longitude pairs', () => {
    expect(decodeRouteGeometry('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ])
  })
})
