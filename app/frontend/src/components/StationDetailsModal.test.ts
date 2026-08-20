import { describe, expect, it } from 'vitest'
import { buildGoogleMapsDrivingUrl } from './StationDetailsModal'

describe('buildGoogleMapsDrivingUrl', () => {
  it('creates a driving URL from the search origin and station coordinates', () => {
    expect(
      buildGoogleMapsDrivingUrl(
        { latitude: 1.3048, longitude: 103.8318 },
        { latitude: 1.32, longitude: 103.84 },
      ),
    ).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=1.3048%2C103.8318&destination=1.32%2C103.84&travelmode=driving',
    )
  })
})
