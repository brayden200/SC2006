import { Body, Controller, Post } from '@nestjs/common'
import { CompareStationsDto, RecommendationDto } from './dto/recommendation.dto'
import { RecommendationsService } from './recommendations.service'

@Controller()
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Post('recommendations')
  recommend(@Body() dto: RecommendationDto) {
    return this.recommendationsService.recommend(dto)
  }

  @Post('compare')
  compare(@Body() dto: CompareStationsDto) {
    return this.recommendationsService.compare(dto)
  }
}
