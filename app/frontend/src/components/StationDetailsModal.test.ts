import { describe, expect, it } from 'vitest'
import { getRouteButtonLabel } from './StationDetailsModal'

describe('getRouteButtonLabel', () => {
  it('asks the user to show a route before one is loaded', () => {
    expect(getRouteButtonLabel(false)).toBe('Show route')
  })

  it('offers to change the displayed route after one is loaded', () => {
    expect(getRouteButtonLabel(true)).toBe('Change route')
  })
})
