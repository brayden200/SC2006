import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator'

export class CreateSessionDto {
  @IsString() stationId!: string
  @IsDateString() startedAt!: string
  @IsNumber() @Min(0.1) @Max(200) energyKwh!: number
  @IsNumber() @Min(0) @Max(1000) totalCost!: number
  @IsNumber() @Min(1) @Max(1440) durationMinutes!: number
  @IsOptional() @IsBoolean() officialStatusAccurate?: boolean
  @IsOptional() @IsString() note?: string
}
