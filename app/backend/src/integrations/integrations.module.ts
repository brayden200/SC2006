import { Module } from '@nestjs/common'
import { IntegrationsController } from './integrations.controller'
import { RoutesController } from './onemap/routes.controller'
import { LtaDataMallService } from './lta/lta-datamall.service'
import { OneMapService } from './onemap/onemap.service'
import { ParkingService } from './parking/parking.service'
import { HdbParkingService } from './parking/providers/hdb-parking.service'
import { UraParkingService } from './parking/providers/ura-parking.service'

@Module({
  providers: [LtaDataMallService, OneMapService, UraParkingService, HdbParkingService, ParkingService],
  controllers: [IntegrationsController, RoutesController],
  exports: [LtaDataMallService, OneMapService, ParkingService],
})
export class IntegrationsModule {}
