import { Module } from '@nestjs/common';
import { StationsModule } from '../stations/stations.module';
import { PredictionsController } from './predictions.controller';
import { PredictionsService } from './predictions.service';

@Module({
  imports: [StationsModule],
  providers: [PredictionsService],
  controllers: [PredictionsController],
})
export class PredictionsModule {}
