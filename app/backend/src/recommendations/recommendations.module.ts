import { Module } from '@nestjs/common'
import { StationsModule } from '../stations/stations.module'
import { RecommendationsController } from './recommendations.controller'
import { RecommendationsService } from './recommendations.service'
import { IntegrationsModule } from '../integrations/integrations.module'

@Module({
  imports: [StationsModule, IntegrationsModule],
  providers: [RecommendationsService],
  controllers: [RecommendationsController],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
