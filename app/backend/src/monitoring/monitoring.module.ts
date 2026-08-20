import { Module } from '@nestjs/common'
import { RecommendationsModule } from '../recommendations/recommendations.module'
import { StationsModule } from '../stations/stations.module'
import { MonitoringController } from './monitoring.controller'
import { MonitoringService } from './monitoring.service'
import { MonitorRepository } from './monitoring.repository'

@Module({
  imports: [StationsModule, RecommendationsModule],
  providers: [MonitoringService, MonitorRepository],
  controllers: [MonitoringController],
})
export class MonitoringModule {}
