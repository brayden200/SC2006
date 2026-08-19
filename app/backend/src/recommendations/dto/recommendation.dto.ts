import { Type } from 'class-transformer'
import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator'

export class RecommendationDto {
  @Type(() => Number) @IsNumber() latitude!: number
  @Type(() => Number) @IsNumber() longitude!: number
  @IsOptional() @IsString() locationLabel?: string
  @IsIn(['Any', 'CCS2', 'Type 2', 'CHAdeMO']) connector!: 'Any' | 'CCS2' | 'Type 2' | 'CHAdeMO'
  @IsOptional() @Type(() => Number) @Min(1) @Max(50) radiusKm?: number = 8
  @IsOptional() @Type(() => Number) @Min(1) @Max(150) energyKwh?: number = 35
  @IsOptional() @Type(() => Number) @Min(0) maxPrice?: number
  @IsOptional() @Type(() => Number) @Min(0) minPowerKw?: number
  @IsOptional() @IsBoolean() availableOnly?: boolean
  @IsOptional() @IsBoolean() includeUnknown?: boolean
  @IsOptional() @IsString() operator?: string
  @IsOptional() @IsString() preferredOperator?: string
  @IsOptional() @Type(() => Number) @Min(0) @Max(100) availabilityWeight?: number = 30
  @IsOptional() @Type(() => Number) @Min(0) @Max(100) travelWeight?: number = 25
  @IsOptional() @Type(() => Number) @Min(0) @Max(100) speedWeight?: number = 20
  @IsOptional() @Type(() => Number) @Min(0) @Max(100) priceWeight?: number = 15
  @IsOptional() @Type(() => Number) @Min(0) @Max(100) preferenceWeight?: number = 10
}

export class CompareStationsDto {
  @IsArray() @IsString({ each: true }) stationIds!: string[]
  @IsIn(['Any', 'CCS2', 'Type 2', 'CHAdeMO']) connector!: 'Any' | 'CCS2' | 'Type 2' | 'CHAdeMO'
  @IsOptional() @Type(() => Number) @Min(1) @Max(150) energyKwh?: number = 35
  @IsOptional() @Type(() => Number) @IsNumber() latitude?: number = 1.3048
  @IsOptional() @Type(() => Number) @IsNumber() longitude?: number = 103.8318
}
