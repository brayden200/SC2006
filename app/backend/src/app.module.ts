import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { HealthController } from './health.controller'
import { StationsModule } from './stations/stations.module'
import { RecommendationsModule } from './recommendations/recommendations.module'
import { MonitoringModule } from './monitoring/monitoring.module'
import { IntegrationsModule } from './integrations/integrations.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    ScheduleModule.forRoot(),
    StationsModule,
    RecommendationsModule,
    MonitoringModule,
    IntegrationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
