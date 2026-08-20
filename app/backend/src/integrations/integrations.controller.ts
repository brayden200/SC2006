import { Controller, Get } from '@nestjs/common'
import { LtaDataMallService } from './lta/lta-datamall.service'
import { OneMapService } from './onemap/onemap.service'
import { ParkingService } from './parking/parking.service'

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly lta: LtaDataMallService,
    private readonly oneMap: OneMapService,
    private readonly parking: ParkingService,
  ) {}

  @Get('status')
  status() {
    return { ltaDataMall: this.lta.status(), oneMap: this.oneMap.status(), parking: this.parking.status() }
  }
}
