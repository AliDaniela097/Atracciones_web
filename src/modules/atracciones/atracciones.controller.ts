import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Res,
  ParseUUIDPipe, HttpCode, HttpStatus, Header, UseGuards, Headers,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AtraccionesService } from './atracciones.service';
import { CreateAtraccionDto } from './dto/create-atraccion.dto';
import { UpdateAtraccionDto } from './dto/update-atraccion.dto';
import { AtraccionResponseDto } from './dto/atraccion-response.dto';
import { ListAtraccionesQueryDto } from './dto/list-atracciones-query.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { SearchAtraccionesDto } from './dto/search-atracciones.dto';
import { SearchAtraccionesResponseDto } from './dto/search-response.dto';
import { DetailsRequestDto } from './dto/details-request.dto';
import { AvailabilityResponseDto } from './dto/availability.dto';
import { ReservationRequestDto, ReservationResponseDto, CancelReservationRequestDto } from './dto/reservation.dto';
import { IdempotencyKeyGuard } from '../../common/guards/idempotency-key.guard';
import { Throttle } from '@nestjs/throttler';

/** Reservar y cancelar: máximo 10 por minuto por IP (evita abuso y reservas masivas). */
const LIMITE_TRANSACCIONAL = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('Atracciones')
@Controller('atracciones')
export class AtraccionesController {
  constructor(private readonly atraccionesService: AtraccionesService) {}

  // ===================== RUTAS FIJAS (van primero) =====================
  // Deben declararse ANTES de las rutas con :id, porque si no Nest
  // confunde "health" o "reservations" con un id.

  @Get('health')
  @ApiOperation({ summary: 'Healthcheck del microservicio' })
  @ApiResponse({ status: 200, description: 'Servicio de atracciones operativo.' })
  checkHealth() {
    return { status: 'UP', timestamp: new Date().toISOString() };
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Búsqueda de atracciones' })
  @ApiResponse({ status: 200, description: 'Resultados de la búsqueda.', type: SearchAtraccionesResponseDto })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  search(@Body() searchDto: SearchAtraccionesDto) {
    return this.atraccionesService.search(searchDto);
  }

  @Post('details')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener detalles de múltiples atracciones (Batch)' })
  @ApiResponse({ status: 200, description: 'Detalles de atracciones.', type: SearchAtraccionesResponseDto })
  getDetailsBatch(@Body() dto: DetailsRequestDto) {
    return this.atraccionesService.getDetailsBatch(dto);
  }

  @Get('reservations')
  @ApiOperation({ summary: 'Historial de reservas (paginado con limit y offset; el total va en la cabecera X-Total-Count)' })
  @ApiResponse({ status: 200, description: 'Listado de reservas.', type: [ReservationResponseDto] })
  async getReservations(
    @Query() query: ListAtraccionesQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReservationResponseDto[]> {
    const { data, total } = await this.atraccionesService.getReservations(query.limit, query.offset);
    res.setHeader('X-Total-Count', String(total));
    return data;
  }

  @Get('reservations/:reservationId')
  @ApiOperation({ summary: 'Obtener detalle de una reserva' })
  @ApiParam({ name: 'reservationId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Detalle de la reserva.', type: ReservationResponseDto })
  @ApiResponse({ status: 404, description: 'Reserva no encontrada.' })
  getReservationById(@Param('reservationId', ParseUUIDPipe) reservationId: string): Promise<ReservationResponseDto> {
    return this.atraccionesService.getReservationById(reservationId);
  }

  @Post('reservations/:reservationId/cancel')
  @HttpCode(HttpStatus.OK)
  @Throttle(LIMITE_TRANSACCIONAL)
  @UseGuards(IdempotencyKeyGuard)
  @ApiOperation({ summary: 'Cancelar una reserva (requiere cabecera idempotency-key con un UUID)' })
  @ApiParam({ name: 'reservationId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Cancelación procesada.', type: ReservationResponseDto })
  @ApiResponse({ status: 404, description: 'Reserva no encontrada.' })
  @ApiResponse({ status: 409, description: 'Conflicto o error de idempotencia.' })
  cancelReservation(
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @Body() dto: CancelReservationRequestDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ): Promise<ReservationResponseDto> {
    return this.atraccionesService.cancelReservation(reservationId, dto, idempotencyKey);
  }

  // ===================== COLECCIÓN =====================

  @Get()
  @Header('X-API-Deprecation-Date', '2027-12-31')
  @Header('Cache-Control', 'max-age=300')
  @ApiOperation({ summary: 'Obtener el listado paginado de atracciones' })
  @ApiResponse({ status: 200, description: 'Listado recuperado exitosamente.', type: PaginatedResponseDto })
  findAll(@Query() query: ListAtraccionesQueryDto) {
    return this.atraccionesService.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar una nueva atracción' })
  @ApiResponse({ status: 201, description: 'Atracción creada. Devuelve cabecera Location.', type: AtraccionResponseDto })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  async create(
    @Body() createAtraccionDto: CreateAtraccionDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AtraccionResponseDto> {
    const atraccion = await this.atraccionesService.create(createAtraccionDto);
    res.setHeader('Location', `/api/v1/atracciones/${atraccion.id}`);
    return atraccion;
  }

  // ===================== RUTAS CON :id (van al final) =====================

  @Get(':id')
  @Header('X-API-Deprecation-Date', '2027-12-31')
  @Header('Cache-Control', 'max-age=300')
  @ApiOperation({ summary: 'Obtener el detalle de una atracción' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Detalle de la atracción.', type: AtraccionResponseDto })
  @ApiResponse({ status: 404, description: 'La atracción no existe.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<AtraccionResponseDto> {
    return this.atraccionesService.findOne(id);
  }

  @Put(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reemplazar datos completos de una atracción' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Reemplazo exitoso sin contenido.' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 404, description: 'La atracción no existe.' })
  replace(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateAtraccionDto): Promise<void> {
    return this.atraccionesService.replace(id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar parcialmente una atracción' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Actualización exitosa.', type: AtraccionResponseDto })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 404, description: 'La atracción no existe.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAtraccionDto): Promise<AtraccionResponseDto> {
    return this.atraccionesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una atracción' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Eliminación exitosa sin contenido.' })
  @ApiResponse({ status: 404, description: 'La atracción no existe.' })
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.atraccionesService.delete(id);
  }

  @Get(':id/availability')
  @ApiOperation({ summary: 'Consultar disponibilidad de cupos' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({ name: 'date', required: true, example: '2026-10-10' })
  @ApiResponse({ status: 200, description: 'Disponibilidad recuperada.', type: AvailabilityResponseDto })
  @ApiResponse({ status: 404, description: 'La atracción no existe.' })
  getAvailability(@Param('id', ParseUUIDPipe) id: string, @Query('date') date: string): Promise<AvailabilityResponseDto> {
    return this.atraccionesService.getAvailability(id, date);
  }

  @Post(':id/reservations')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(LIMITE_TRANSACCIONAL)
  @UseGuards(IdempotencyKeyGuard)
  @ApiOperation({ summary: 'Crear una reserva (requiere cabecera idempotency-key con un UUID)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Reserva confirmada.', type: ReservationResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 404, description: 'La atracción no existe.' })
  @ApiResponse({ status: 409, description: 'Conflicto o error de idempotencia.' })
  reserve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() reservationDto: ReservationRequestDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ): Promise<ReservationResponseDto> {
    return this.atraccionesService.reserve(id, reservationDto, idempotencyKey);
  }
}