import { Body, Controller, Post } from '@nestjs/common'
import { RecommendationDto } from './dto/recommendation.dto'
import { RecommendationsService } from './recommendations.service'

@Controller()
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Post('recommendations')
  recommend(@Body() dto: RecommendationDto) {
    return this.recommendationsService.recommend(dto)
  }
}
