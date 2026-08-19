import { Module } from '@nestjs/common'
import { IntegrationsController } from './integrations.controller'
import { LtaDataMallService } from './lta-datamall.service'
import { OneMapService } from './onemap.service'

@Module({
  providers: [LtaDataMallService, OneMapService],
  controllers: [IntegrationsController],
  exports: [LtaDataMallService, OneMapService],
})
export class IntegrationsModule {}
