import type { Station } from '../../common/types'
import { ParkingService } from './parking.service'
import type { ParkingProvider } from './parking.types'

const station: Station = {
  id: 'lta-station',
  name: 'Station',
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

describe('ParkingService', () => {
  it('keeps charger data usable when a parking provider fails', async () => {
    const failedProvider: ParkingProvider = {
      name: 'HDB',
      isConfigured: () => true,
      status: () => ({
        configured: true,
        state: 'error',
        lastSuccessfulFetch: null,
        lastError: 'offline',
        cacheExpiresAt: null,
      }),
      getCarParks: jest.fn().mockRejectedValue(new Error('offline')),
    }
    const service = new ParkingService(undefined, failedProvider as never)
    await expect(service.enrichStations([station])).resolves.toEqual([{ ...station, parking: null }])
  })
})
