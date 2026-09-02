import { Body, Controller, Post } from '@nestjs/common'
import { AiChatService } from './ai-chat.service'
import { AiChatDto } from './dto/ai-chat.dto'

@Controller('ai')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post('chat')
  chat(@Body() dto: AiChatDto) {
    return this.aiChatService.chat(dto)
  }
}
