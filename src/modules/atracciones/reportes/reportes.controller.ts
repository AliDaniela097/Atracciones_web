import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequiereScopes } from '../../auth/requiere-scopes.decorator';
import { SCOPES } from '../../auth/roles';
import { ReportesService } from './reportes.service';
import { ReporteVentasQueryDto } from './reportes.dto';

/**
 * Endpoint INTERNO del panel del operador (no forma parte del contrato del grupo).
 * Solo lo puede usar quien tenga el scope attractions:write (el operador).
 */
@ApiTags('Reportes (operador)')
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Get('ventas')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Reporte de ventas: ingresos, entradas y reservas por atracción, aeropuerto y día' })
  @ApiResponse({ status: 200, description: 'Reporte del periodo (por defecto, últimos 30 días).' })
  @ApiResponse({ status: 400, description: 'Fechas inválidas o rango mayor a 366 días.' })
  @RequiereScopes(SCOPES.ESCRIBIR)
  ventas(@Query() q: ReporteVentasQueryDto) {
    return this.reportes.ventas(q.desde, q.hasta);
  }

  @Get('reservas/:codigo')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Verificar una entrada por su código (completo o corto de 8 caracteres), por ejemplo al escanear el QR' })
  @ApiParam({ name: 'codigo', example: '75E3-667B' })
  @ApiResponse({ status: 200, description: 'Datos de la reserva y si es válida para entrar hoy o más adelante.' })
  @ApiResponse({ status: 404, description: 'No existe una reserva con ese código.' })
  @RequiereScopes(SCOPES.ESCRIBIR)
  verificar(@Param('codigo') codigo: string) {
    return this.reportes.verificar(codigo);
  }
}
