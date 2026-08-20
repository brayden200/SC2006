import type { Station } from '../../common/types'
import { associateChargerToCarPark } from './parking-matcher.util'
import type { ParkingRecord } from './parking.types'

const station: Station = {
  id: 'lta-station',
  name: 'Orchard Hub',
  address: '1 Orchard Road Singapore 238823',
  postalCode: '238823',
  latitude: 1.3048,
  longitude: 103.8318,
  operator: 'Test',
  connectors: [{ type: 'CCS2', powerKw: 100, total: 2, available: 1, status: 'available' }],
  pricePerKwh: 0.5,
  parking: null,
  source: 'LTA DataMall',
  lastUpdated: '2026-08-20T00:00:00.000Z',
}

const record = (overrides: Partial<ParkingRecord> = {}): ParkingRecord => ({
  carParkId: 'CP1',
  name: 'Orchard Hub Car Park',
  provider: 'HDB',
  address: '1 Orchard Road Singapore 238823',
  postalCode: '238823',
  latitude: station.latitude,
  longitude: station.longitude,
  publishedRateText: 'S$0.60 per half-hour',
  sourceName: 'HDB',
  sourceUrl: 'https://www.hdb.gov.sg',
  lastUpdated: '2026-08-20T00:00:00.000Z',
  tariffRules: [],
  ...overrides,
})

describe('associateChargerToCarPark', () => {
  it('prefers postal/address evidence over a nearer unrelated car park', () => {
    const match = associateChargerToCarPark(station, [
      record({
        carParkId: 'near',
        name: 'Different Place',
        address: 'Different Road',
        postalCode: '',
        latitude: 1.30481,
        longitude: 103.83181,
      }),
      record({ carParkId: 'address-match', latitude: 1.305, longitude: 103.832 }),
    ])
    expect(match).toMatchObject({
      method: 'postal_or_address',
      confidence: 'high',
      record: { carParkId: 'address-match' },
    })
  })

  it('returns no association beyond the conservative nearest-only threshold', () => {
    expect(
      associateChargerToCarPark(station, [record({ latitude: 1.31, longitude: 103.84, address: 'Unknown' })]),
    ).toBeNull()
  })
})
