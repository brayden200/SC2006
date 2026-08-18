import { Controller, Get, Param, Query } from '@nestjs/common';
import { SearchStationsDto } from './dto/search-stations.dto';
import { StationsService } from './stations.service';

@Controller('stations')
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Get()
  search(@Query() query: SearchStationsDto) {
    return this.stationsService.search(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stationsService.findById(id);
  }
}
