import { BadRequestException } from '@nestjs/common'
import { RoutesController } from './routes.controller'

describe('RoutesController', () => {
  it('returns the cached-compatible OneMap route contract', async () => {
    const route = {
      distanceKm: 4.2,
      travelMinutes: 10,
      coordinates: [
        [1.3, 103.8],
        [1.31, 103.82],
      ] as [number, number][],
      source: 'OneMap' as const,
    }
    const oneMap = { drivingRoute: jest.fn().mockResolvedValue(route) }
    const controller = new RoutesController(oneMap as never)

    await expect(
      controller.driving({ startLat: 1.3, startLng: 103.8, endLat: 1.32, endLng: 103.84 }),
    ).resolves.toEqual(route)
    expect(oneMap.drivingRoute).toHaveBeenCalledWith(
      { latitude: 1.3, longitude: 103.8 },
      { latitude: 1.32, longitude: 103.84 },
    )
  })

  it('rejects requests without all four coordinates', async () => {
    const controller = new RoutesController({ drivingRoute: jest.fn() } as never)

    await expect(controller.driving({ startLat: 1.3, startLng: 103.8 })).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })
})
