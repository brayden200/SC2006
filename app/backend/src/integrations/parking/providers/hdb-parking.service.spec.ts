import { ConfigService } from '@nestjs/config'
import { HdbParkingService } from './hdb-parking.service'

describe('HdbParkingService', () => {
  it('normalizes data.gov.sg SVY21 metadata with published HDB short-term rules', () => {
    const service = new HdbParkingService(new ConfigService({}))
    const records = service.normalizeResponse({
      success: true,
      result: {
        records: [
          {
            'Car Park No': 'A0001',
            Address: '1 Test Road Singapore 123456',
            'X Coord': '28001.642',
            'Y Coord': '38744.572',
            'Short Term Parking': 'YES',
            'Free Parking': 'SUN & PH',
          },
        ],
      },
    })
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ carParkId: 'A0001', provider: 'HDB', postalCode: '123456' })
    expect(records[0].publishedRateText).toContain('S$0.60')
    expect(records[0].tariffRules).toEqual(
      expect.arrayContaining([expect.objectContaining({ days: ['sunday', 'public_holiday'], rate: 0 })]),
    )
  })
})
