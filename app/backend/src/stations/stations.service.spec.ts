import type { Station } from '../common/types'
import { LtaDataMallService } from '../integrations/lta-datamall.service'
import { OneMapService } from '../integrations/onemap.service'
import { StationsService } from './stations.service'

const duplicateStation: Station = {
  id: 'lta-duplicate-station',
  name: 'Duplicate Test Station',
  address: '1 Test Road Singapore 123456',
  postalCode: '123456',
  latitude: 1.35,
  longitude: 103.75,
  operator: 'Test Operator',
  connectors: [{ type: 'CCS2', powerKw: 50, total: 2, available: 1, status: 'available' }],
  pricePerKwh: 0.55,
  source: 'LTA DataMall',
  lastUpdated: '2026-08-19T12:00:00.000Z',
}

describe('StationsService options', () => {
  it('returns each canonical station ID only once', async () => {
    const lta = {
      isConfigured: () => true,
      getAllStations: jest.fn().mockResolvedValue([duplicateStation, structuredClone(duplicateStation)]),
      status: () => ({ state: 'available' }),
    } as unknown as LtaDataMallService
    const oneMap = { status: () => ({ state: 'not_checked' }) } as unknown as OneMapService
    const service = new StationsService(lta, oneMap)

    const result = await service.options('duplicate')

    expect(result.stations).toEqual([
      {
        id: duplicateStation.id,
        name: duplicateStation.name,
        address: duplicateStation.address,
      },
    ])
  })
})
