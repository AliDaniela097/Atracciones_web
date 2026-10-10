import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Paginación del contrato: GET /atracciones?limit=10&offset=0 */
export class ListAtraccionesQueryDto {
  @ApiPropertyOptional({ description: 'Cantidad de elementos por página', default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Cuántos elementos saltar desde el inicio', default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

/** Listado del catálogo con búsqueda: GET /atracciones?limit=10&offset=0&q=playa (extensión de la aplicación) */
export class BuscarAtraccionesQueryDto extends ListAtraccionesQueryDto {
  @ApiPropertyOptional({
    description:
      'Texto libre (extensión del contrato). Busca en nombre, descripción, categorías y dirección, sin distinguir mayúsculas ni tildes. '
      + 'Si trae varias palabras, todas deben aparecer.',
    example: 'playa',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
