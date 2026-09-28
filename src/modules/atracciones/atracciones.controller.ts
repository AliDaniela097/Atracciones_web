import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Res,
  ParseUUIDPipe, HttpCode, HttpStatus, Header, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { AtraccionesService } from './atracciones.service';
import { CreateAtraccionDto } from './dto/create-atraccion.dto';
import { UpdateAtraccionDto } from './dto/update-atraccion.dto';
import { AtraccionResponseDto } from './dto/atraccion-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { SearchAtraccionesDto } from './dto/search-atracciones.dto';
import { SearchAtraccionesResponseDto } from './dto/search-response.dto';
import { DetailsRequestDto } from './dto/details-request.dto';
import { AvailabilityResponseDto } from './dto/availability.dto';
import { ReservationRequestDto, ReservationResponseDto, CancelReservationRequestDto } from './dto/reservation.dto';
import { IdempotencyKeyGuard } from '../../common/guards/idempotency-key.guard';

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
  @ApiOperation({ summary: 'Historial de reservas' })
  @ApiResponse({ status: 200, description: 'Listado de reservas.', type: [ReservationResponseDto] })
  getReservations(): ReservationResponseDto[] {
    return this.atraccionesService.getReservations();
  }

  @Get('reservations/:reservationId')
  @ApiOperation({ summary: 'Obtener detalle de una reserva' })
  @ApiParam({ name: 'reservationId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Detalle de la reserva.', type: ReservationResponseDto })
  @ApiResponse({ status: 404, description: 'Reserva no encontrada.' })
  getReservationById(@Param('reservationId', ParseUUIDPipe) reservationId: string): ReservationResponseDto {
    return this.atraccionesService.getReservationById(reservationId);
  }

  @Post('reservations/:reservationId/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(IdempotencyKeyGuard)
  @ApiOperation({ summary: 'Cancelar una reserva' })
  @ApiParam({ name: 'reservationId', format: 'uuid' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'UUID v4' })
  @ApiResponse({ status: 200, description: 'Cancelación procesada.', type: ReservationResponseDto })
  @ApiResponse({ status: 404, description: 'Reserva no encontrada.' })
  @ApiResponse({ status: 409, description: 'Conflicto o error de idempotencia.' })
  cancelReservation(
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @Body() dto: CancelReservationRequestDto,
  ): ReservationResponseDto {
    return this.atraccionesService.cancelReservation(reservationId, dto, '');
  }

  // ===================== COLECCIÓN =====================

  @Get()
  @Header('X-API-Deprecation-Date', '2027-12-31')
  @Header('Cache-Control', 'max-age=300')
  @ApiOperation({ summary: 'Obtener el listado paginado de atracciones' })
  @ApiResponse({ status: 200, description: 'Listado recuperado exitosamente.', type: PaginatedResponseDto })
  findAll(@Query() query: PaginationQueryDto) {
    return this.atraccionesService.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar una nueva atracción' })
  @ApiResponse({ status: 201, description: 'Atracción creada. Devuelve cabecera Location.', type: AtraccionResponseDto })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  create(
    @Body() createAtraccionDto: CreateAtraccionDto,
    @Res({ passthrough: true }) res: Response,
  ): AtraccionResponseDto {
    const atraccion = this.atraccionesService.create(createAtraccionDto);
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
  findOne(@Param('id', ParseUUIDPipe) id: string): AtraccionResponseDto {
    return this.atraccionesService.findOne(id);
  }

  @Put(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reemplazar datos completos de una atracción' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Reemplazo exitoso sin contenido.' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 404, description: 'La atracción no existe.' })
  replace(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateAtraccionDto): void {
    this.atraccionesService.replace(id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar parcialmente una atracción' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Actualización exitosa.', type: AtraccionResponseDto })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 404, description: 'La atracción no existe.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAtraccionDto): AtraccionResponseDto {
    return this.atraccionesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una atracción' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Eliminación exitosa sin contenido.' })
  @ApiResponse({ status: 404, description: 'La atracción no existe.' })
  delete(@Param('id', ParseUUIDPipe) id: string): void {
    this.atraccionesService.delete(id);
  }

  @Get(':id/availability')
  @ApiOperation({ summary: 'Consultar disponibilidad de cupos' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({ name: 'date', required: true, example: '2026-10-10' })
  @ApiResponse({ status: 200, description: 'Disponibilidad recuperada.', type: AvailabilityResponseDto })
  @ApiResponse({ status: 404, description: 'La atracción no existe.' })
  getAvailability(@Param('id', ParseUUIDPipe) id: string, @Query('date') date: string): AvailabilityResponseDto {
    return this.atraccionesService.getAvailability(id, date);
  }

  @Post(':id/reservations')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(IdempotencyKeyGuard)
  @ApiOperation({ summary: 'Crear una reserva de la atracción' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'UUID v4' })
  @ApiResponse({ status: 201, description: 'Reserva confirmada.', type: ReservationResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 404, description: 'La atracción no existe.' })
  @ApiResponse({ status: 409, description: 'Conflicto o error de idempotencia.' })
  reserve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() reservationDto: ReservationRequestDto,
  ): ReservationResponseDto {
    return this.atraccionesService.reserve(id, reservationDto, '');
  }
}