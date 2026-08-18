import { Controller, Get, Param, Query } from '@nestjs/common';
import { IsDateString } from 'class-validator';
import { PredictionsService } from './predictions.service';

class PredictionQueryDto {
  @IsDateString() arrivalTime!: string;
}

@Controller('predictions')
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Get(':stationId')
  predict(@Param('stationId') stationId: string, @Query() query: PredictionQueryDto) {
    return this.predictionsService.predict(stationId, query.arrivalTime);
  }
}
