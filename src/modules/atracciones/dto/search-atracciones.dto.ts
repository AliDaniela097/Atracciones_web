import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsDateString, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DatesFilterDto {
  @ApiProperty({ description: 'Fecha de inicio', example: '2025-12-18' })
  @IsDateString()
  start_date: string;

  @ApiProperty({ description: 'Fecha de fin', example: '2025-12-20' })
  @IsDateString()
  end_date: string;
}

export class RatingFilterDto {
  @ApiProperty({ description: 'Puntuación mínima', example: 4.2, required: false })
  @IsNumber()
  @IsOptional()
  minimum_review_score?: number;

  @ApiProperty({ description: 'Cantidad mínima de reseñas', example: 100, required: false })
  @IsInt()
  @IsOptional()
  minimum_review_count?: number;
}

export class FiltersDto {
  @ApiProperty({ description: 'Filtros de calificación', type: RatingFilterDto, required: false })
  @ValidateNested()
  @Type(() => RatingFilterDto)
  @IsOptional()
  rating?: RatingFilterDto;
}

export class SortDto {
  @ApiProperty({ description: 'Criterio de ordenamiento', example: 'most_popular' })
  @IsString()
  by: string;
}

export class SearchAtraccionesDto {
  @ApiProperty({ description: 'Moneda solicitada', example: 'USD', required: false })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ description: 'IDs de ciudades', example: [1], required: false })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  cities?: number[];

  @ApiProperty({ description: 'Códigos de países ISO', example: ['ec'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  countries?: string[];

  @ApiProperty({ description: 'Rango de fechas', type: DatesFilterDto, required: false })
  @ValidateNested()
  @Type(() => DatesFilterDto)
  @IsOptional()
  dates?: DatesFilterDto;

  @ApiProperty({ description: 'Filtros adicionales', type: FiltersDto, required: false })
  @ValidateNested()
  @Type(() => FiltersDto)
  @IsOptional()
  filters?: FiltersDto;

  @ApiProperty({ description: 'Token opaco de paginación', example: 'eyJwYWdlIjoyfQ==', required: false })
  @IsString()
  @IsOptional()
  next_page?: string;

  @ApiProperty({ description: 'Cantidad de filas a retornar (1 a 100)', example: 20, required: false })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  rows?: number;

  @ApiProperty({ description: 'Ordenamiento: most_popular, top_rated, price_asc, price_desc', type: SortDto, required: false })
  @ValidateNested()
  @Type(() => SortDto)
  @IsOptional()
  sort?: SortDto;
}
