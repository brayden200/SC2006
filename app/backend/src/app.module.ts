import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { HealthController } from './health.controller'
import { StationsModule } from './stations/stations.module'
import { RecommendationsModule } from './recommendations/recommendations.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    StationsModule,
    RecommendationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
