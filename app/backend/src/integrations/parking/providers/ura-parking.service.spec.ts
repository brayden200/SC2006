import { ConfigService } from '@nestjs/config'
import { calculateParkingCost } from '../parking-tariff.util'
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
    expect(records[0].publishedRateText).toContain(
      'Weekdays, Saturdays, and Sundays/public holidays 8:30 AM–5:00 PM: $0.50 per 30 minutes',
    )
  })

  it('keeps URA free-rate bands so costs can be calculated across them', () => {
    const service = new UraParkingService(new ConfigService({}))
    const records = service.normalizeResponse({
      Status: 'Success',
      Result: [
        {
          ppCode: 'A0004',
          ppName: 'ALIWAL STREET',
          vehCat: 'Car',
          startTime: '07.00 AM',
          endTime: '08.30 AM',
          weekdayRate: '$0.00',
          weekdayMin: '0 mins',
          satdayRate: '$0.00',
          satdayMin: '0 mins',
          sunPHRate: '$0.00',
          sunPHMin: '0 mins',
          geometries: [{ coordinates: '31045.6165, 31694.0055' }],
        },
        {
          ppCode: 'A0004',
          ppName: 'ALIWAL STREET',
          vehCat: 'Car',
          startTime: '08.30 AM',
          endTime: '10.00 PM',
          weekdayRate: '$0.60',
          weekdayMin: '30 mins',
          satdayRate: '$0.60',
          satdayMin: '30 mins',
          sunPHRate: '$0.60',
          sunPHMin: '30 mins',
          geometries: [{ coordinates: '31045.6165, 31694.0055' }],
        },
      ],
    })

    expect(records[0].tariffRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rate: 0, billingUnitMinutes: 30 }),
        expect.objectContaining({ rate: 0.6, billingUnitMinutes: 30 }),
      ]),
    )
    expect(records[0].publishedRateText).toContain(
      'Weekdays, Saturdays, and Sundays/public holidays 7:00 AM–8:30 AM: Free',
    )
    expect(records[0].publishedRateText).not.toContain('per 0 mins')
    expect(calculateParkingCost(records[0].tariffRules, '2026-08-20T08:00:00+08:00', 60)).toEqual({
      cost: 0.6,
      status: 'calculated',
    })
  })
})
