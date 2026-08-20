import { describe, expect, it } from 'vitest'
import { getCardRoadTravel } from './StationCard'

describe('getCardRoadTravel', () => {
  it('does not expose straight-line values when OneMap is unavailable', () => {
    const travel = getCardRoadTravel({
      distanceKm: 0.8,
      travelMinutes: 2,
      travelSource: 'Straight-line estimate',
    })

    expect(travel).toEqual({
      distanceLabel: '',
      minutesLabel: '—',
      sourceLabel: 'Road route unavailable',
    })
    expect(JSON.stringify(travel)).not.toContain('straight-line')
  })

  it('shows only OneMap road distance and time when available', () => {
    expect(getCardRoadTravel({ distanceKm: 1.49, travelMinutes: 3, travelSource: 'OneMap' })).toEqual({
      distanceLabel: '1.5 km road',
      minutesLabel: '3 min',
      sourceLabel: 'OneMap road route',
    })
  })
})
