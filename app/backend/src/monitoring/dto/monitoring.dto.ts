import { Type } from 'class-transformer'
import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator'

export class CreateMonitorDto {
  @IsString() stationId!: string
  @IsIn(['CCS2', 'Type 2', 'CHAdeMO']) connector!: 'CCS2' | 'Type 2' | 'CHAdeMO'
  @IsOptional() @Type(() => Number) @Min(15) @Max(240) durationMinutes?: number = 90
}

export class AlternativeQueryDto {
  @Type(() => Number) @IsNumber() latitude!: number
  @Type(() => Number) @IsNumber() longitude!: number
  @IsOptional() @Type(() => Number) @Min(1) @Max(50) radiusKm?: number = 12
}

export class AcceptAlternativeDto {
  @IsString() stationId!: string
}
