import { BadRequestException, Controller, Get, Query, ServiceUnavailableException } from '@nestjs/common'
import { OneMapService } from './onemap.service'
import { DrivingRouteQueryDto } from './routes.dto'

@Controller('routes')
export class RoutesController {
  constructor(private readonly oneMap: OneMapService) {}

  @Get('driving')
  async driving(@Query() query: DrivingRouteQueryDto) {
    const start = readCoordinate(
      query.startLat ?? query.originLatitude ?? query.startLatitude,
      'start latitude',
    )
    const startLongitude = readCoordinate(
      query.startLng ?? query.originLongitude ?? query.startLongitude,
      'start longitude',
    )
    const end = readCoordinate(query.endLat ?? query.destinationLatitude ?? query.endLatitude, 'end latitude')
    const endLongitude = readCoordinate(
      query.endLng ?? query.destinationLongitude ?? query.endLongitude,
      'end longitude',
    )
    try {
      const route = await this.oneMap.drivingRoute(
        { latitude: start, longitude: startLongitude },
        { latitude: end, longitude: endLongitude },
      )
      if (!route || route.coordinates.length < 2) {
        throw new ServiceUnavailableException('OneMap returned no road geometry')
      }
      return route
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error
      throw new ServiceUnavailableException('OneMap driving route is unavailable')
    }
  }
}

function readCoordinate(value: number | undefined, label: string) {
  if (value === undefined || !Number.isFinite(value)) {
    throw new BadRequestException(`A valid ${label} is required`)
  }
  return value
}
