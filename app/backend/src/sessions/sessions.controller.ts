import { Body, Controller, Get, Post } from '@nestjs/common'
import { CreateSessionDto } from './dto/create-session.dto'
import { SessionsService } from './sessions.service'

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  list() {
    return this.sessionsService.list()
  }

  @Post()
  create(@Body() dto: CreateSessionDto) {
    return this.sessionsService.create(dto)
  }
}
