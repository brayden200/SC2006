import { calculateParkingCost } from './parking-tariff.util'
import type { ParkingTariffRule } from './parking.types'

const weekday: ParkingTariffRule = {
  days: ['weekday'],
  startMinute: 7 * 60,
  endMinute: 17 * 60,
  rate: 0.5,
  billingUnitMinutes: 30,
  billing: 'per_unit',
}

describe('calculateParkingCost', () => {
  it('evaluates weekday, Saturday, Sunday and public-holiday rules in Singapore time', () => {
    const rules: ParkingTariffRule[] = [
      weekday,
      { ...weekday, days: ['saturday'], rate: 0.6 },
      { ...weekday, days: ['sunday'], rate: 0.7 },
      { ...weekday, days: ['public_holiday'], rate: 0.2 },
    ]
    expect(calculateParkingCost(rules, '2026-08-20T08:00:00+08:00', 60).cost).toBe(1)
    expect(calculateParkingCost(rules, '2026-08-22T08:00:00+08:00', 60).cost).toBe(1.2)
    expect(calculateParkingCost(rules, '2026-08-23T08:00:00+08:00', 60).cost).toBe(1.4)
    expect(calculateParkingCost(rules, '2026-08-20T08:00:00+08:00', 60, { isPublicHoliday: true }).cost).toBe(
      0.4,
    )
  })

  it('crosses time bands deterministically using the next billing unit', () => {
    const rules: ParkingTariffRule[] = [
      weekday,
      { ...weekday, startMinute: 17 * 60, endMinute: 22 * 60, rate: 1 },
    ]
    expect(calculateParkingCost(rules, '2026-08-20T16:45:00+08:00', 45)).toEqual({
      cost: 1.5,
      status: 'calculated',
    })
  })

  it('supports per-entry tariffs and rejects ambiguous or uncovered tariffs', () => {
    const entry: ParkingTariffRule = {
      days: ['weekday'],
      startMinute: 0,
      endMinute: 0,
      rate: 2,
      billingUnitMinutes: 1,
      billing: 'per_entry',
    }
    expect(calculateParkingCost([entry], '2026-08-20T08:00:00+08:00', 180).cost).toBe(2)
    expect(calculateParkingCost([], '2026-08-20T08:00:00+08:00', 30).cost).toBeNull()
    expect(calculateParkingCost([entry, { ...entry, rate: 3 }], '2026-08-20T08:00:00+08:00', 30).status).toBe(
      'rate_only',
    )
  })
})
