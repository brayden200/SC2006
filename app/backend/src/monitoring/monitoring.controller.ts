import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { AcceptAlternativeDto, AlternativeQueryDto, CreateMonitorDto } from './dto/monitoring.dto'
import { MonitoringService } from './monitoring.service'

@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get()
  list() {
    return this.monitoringService.list()
  }

  @Post()
  create(@Body() dto: CreateMonitorDto) {
    return this.monitoringService.create(dto)
  }

  @Delete(':id')
  stop(@Param('id') id: string) {
    return this.monitoringService.stop(id)
  }

  @Post(':id/check')
  check(@Param('id') id: string) {
    return this.monitoringService.check(id)
  }

  @Get(':id/alternatives')
  alternatives(@Param('id') id: string, @Query() query: AlternativeQueryDto) {
    return this.monitoringService.alternatives(id, query)
  }

  @Post(':id/accept-alternative')
  acceptAlternative(@Param('id') id: string, @Body() dto: AcceptAlternativeDto) {
    return this.monitoringService.acceptAlternative(id, dto)
  }
}
