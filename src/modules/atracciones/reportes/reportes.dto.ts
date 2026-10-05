import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

/** Rango de fechas de COMPRA (createdAt de la reserva). Si no se envía, últimos 30 días. */
export class ReporteVentasQueryDto {
  @ApiPropertyOptional({ description: 'Desde (incluido), formato YYYY-MM-DD', example: '2026-10-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  desde?: string;

  @ApiPropertyOptional({ description: 'Hasta (incluido), formato YYYY-MM-DD', example: '2026-10-31' })
  @IsOptional()
  @IsDateString({ strict: true })
  hasta?: string;
}
