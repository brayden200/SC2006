import { IsDateString, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator'

export class CreateSessionDto {
  @IsString() stationId!: string
  @IsOptional() @IsDateString() startedAt?: string
  @IsNumber() @Min(0.1) @Max(200) energyKwh!: number
  @IsNumber() @Min(0) @Max(1000) totalCost!: number
}
