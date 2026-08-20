import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator'

const toBoolean = ({ value }: { value: unknown }) => value === 'true' || value === true

export class SearchStationsDto {
  @IsOptional() @IsString() query?: string
  @IsOptional() @Type(() => Number) @IsNumber() latitude?: number
  @IsOptional() @Type(() => Number) @IsNumber() longitude?: number
  @IsOptional() @Type(() => Number) @Min(1) @Max(50) radiusKm?: number = 8
  @IsOptional() @Type(() => Number) @Min(1) @Max(50) limit?: number = 50
  @IsOptional() @IsIn(['Any', 'CCS2', 'Type 2', 'CHAdeMO']) connector?: 'Any' | 'CCS2' | 'Type 2' | 'CHAdeMO'
  @IsOptional() @Type(() => Number) @Min(0) minPowerKw?: number
  @IsOptional() @Type(() => Number) @Min(0) maxPrice?: number
  @IsOptional() @IsString() operator?: string
  @IsOptional() @Transform(toBoolean) @IsBoolean() availableOnly?: boolean = false
  @IsOptional() @Transform(toBoolean) @IsBoolean() includeUnknown?: boolean = false
}
