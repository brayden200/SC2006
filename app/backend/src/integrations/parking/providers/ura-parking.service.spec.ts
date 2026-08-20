import { ConfigService } from '@nestjs/config'
import { UraParkingService } from './ura-parking.service'

describe('UraParkingService', () => {
  it('normalizes official SVY21 car-park details and tariff bands', () => {
    const service = new UraParkingService(new ConfigService({}))
    const records = service.normalizeResponse({
      Status: 'Success',
      Result: [
        {
          ppCode: 'A0004',
          ppName: 'ALIWAL STREET',
          vehCat: 'Car',
          startTime: '08.30 AM',
          endTime: '05.00 PM',
          weekdayRate: '$0.50',
          weekdayMin: '30mins',
          satdayRate: '$0.50',
          satdayMin: '30 mins',
          sunPHRate: '$0.50',
          sunPHMin: '30 mins',
          geometries: [{ coordinates: '31045.6165, 31694.0055' }],
        },
      ],
    })
    expect(records[0]).toMatchObject({ carParkId: 'A0004', provider: 'URA', name: 'ALIWAL STREET' })
    expect(records[0].latitude).toBeGreaterThan(1.2)
    expect(records[0].longitude).toBeGreaterThan(103.6)
    expect(records[0].tariffRules).toHaveLength(3)
    expect(records[0].publishedRateText).toContain('Weekday $0.50')
  })
})
