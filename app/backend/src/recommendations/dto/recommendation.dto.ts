import { Type } from 'class-transformer'
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator'

export class RecommendationDto {
  @IsOptional() @IsString() query?: string
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number
  @IsOptional() @IsIn(['Balanced', 'Availability', 'Speed', 'Savings']) rankingPriority?:
    'Balanced' | 'Availability' | 'Speed' | 'Savings' = 'Balanced'
  @IsOptional() @IsBoolean() routeFromCurrentLocation?: boolean
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) routeOriginLatitude?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) routeOriginLongitude?: number
  @IsOptional()
  @IsIn(['Any', 'CCS2', 'Type 2', 'CHAdeMO'])
  connector: 'Any' | 'CCS2' | 'Type 2' | 'CHAdeMO' = 'Any'
  @IsOptional() @Type(() => Number) @Min(1) @Max(50) radiusKm?: number = 8
}
