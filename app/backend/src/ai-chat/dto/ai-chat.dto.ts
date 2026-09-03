import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'

export class ConversationMessageDto {
  @IsIn(['user', 'assistant']) role!: 'user' | 'assistant'
  @IsString() @MaxLength(4_000) content!: string
}

export class AiChatContextDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) selectedStationIds?: string[]
  @IsOptional() @IsObject() previousFilters?: Record<string, unknown>
  @IsOptional() @IsObject() previousRankingPreferences?: Record<string, unknown>
}

export class AiChatDto {
  @IsString() @MaxLength(4_000) message!: string
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ConversationMessageDto)
  conversation?: ConversationMessageDto[]
  @IsOptional() @ValidateNested() @Type(() => AiChatContextDto) context?: AiChatContextDto
}
