import { Module } from '@nestjs/common'
import { RecommendationsModule } from '../recommendations/recommendations.module'
import { StationsModule } from '../stations/stations.module'
import { MonitoringController } from './monitoring.controller'
import { MonitoringService } from './monitoring.service'

@Module({
  imports: [StationsModule, RecommendationsModule],
  providers: [MonitoringService],
  controllers: [MonitoringController],
})
export class MonitoringModule {}
