import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';

import { Atraccion } from './entities/atraccion.entity';
import { Ciudad } from './entities/ciudad.entity';
import { Operador } from './entities/operador.entity';
import { UbicacionAtraccion } from './entities/ubicacion-atraccion.entity';
import { FotoAtraccion } from './entities/foto-atraccion.entity';
import { Reserva } from './entities/reserva.entity';
import { ClaveIdempotencia } from './entities/clave-idempotencia.entity';

import { CreateAtraccionDto } from './dto/create-atraccion.dto';
import { UpdateAtraccionDto } from './dto/update-atraccion.dto';
import { ListAtraccionesQueryDto } from './dto/list-atracciones-query.dto';
import { SearchAtraccionesDto } from './dto/search-atracciones.dto';
import { DetailsRequestDto } from './dto/details-request.dto';
import { AvailabilityResponseDto } from './dto/availability.dto';
import {
  CancelReservationRequestDto, ReservationRequestDto, ReservationResponseDto, ReservationStatus,
} from './dto/reservation.dto';
import { LocationDto, PhotoDto } from './dto/nested-types.dto';
import { toAtraccionResponse, toReservationResponse } from './atraccion.mapper';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class AtraccionesService {
  constructor(
    @InjectRepository(Atraccion) private readonly atracciones: Repository<Atraccion>,
    @InjectRepository(Ciudad) private readonly ciudades: Repository<Ciudad>,
    @InjectRepository(Operador) private readonly operadores: Repository<Operador>,
    @InjectRepository(Reserva) private readonly reservas: Repository<Reserva>,
    @InjectRepository(ClaveIdempotencia) private readonly claves: Repository<ClaveIdempotencia>,
    private readonly dataSource: DataSource,
  ) {}

  // =====================================================================
  // CATÁLOGO
  // =====================================================================

  /** GET /atracciones?limit=&offset= */
  async findAll(query: ListAtraccionesQueryDto) {
    const limit = query.limit ?? 10;
    const offset = query.offset ?? 0;

    const [filas, total] = await this.atracciones.findAndCount({
      order: { nombre: 'ASC' },
      take: limit,
      skip: offset,
    });

    return {
      data: filas.map(toAtraccionResponse),
      meta: {
        totalItems: total,
        itemCount: filas.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: Math.floor(offset / limit) + 1,
      },
    };
  }

  /** GET /atracciones/:id */
  async findOne(id: string) {
    return toAtraccionResponse(await this.buscarAtraccion(id));
  }

  /** POST /atracciones */
  async create(dto: CreateAtraccionDto) {
    const id = await this.dataSource.transaction(async (m) => {
      await this.validarCiudades(m, dto.locations);
      const operador = await this.obtenerOperador(m, dto.operator.id, dto.operator.name);
      const atraccion = m.create(Atraccion, {
        ...this.camposDesdeDto(dto),
        operadorId: operador.id,
        ubicaciones: this.crearUbicaciones(m, dto.locations),
        fotos: this.crearFotos(m, dto.photos),
      });
      return (await m.save(atraccion)).id;
    });
    return this.findOne(id);
  }

  /** PUT /atracciones/:id  (reemplazo completo) */
  async replace(id: string, dto: CreateAtraccionDto): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      await this.buscarAtraccion(id, m);
      await this.validarCiudades(m, dto.locations);
      const operador = await this.obtenerOperador(m, dto.operator.id, dto.operator.name);

      await m.update(Atraccion, { id }, { ...this.camposDesdeDto(dto), operadorId: operador.id });
      await this.reemplazarUbicaciones(m, id, dto.locations);
      await this.reemplazarFotos(m, id, dto.photos);
    });
  }

  /** PATCH /atracciones/:id  (solo cambia lo que llega) */
  async update(id: string, dto: UpdateAtraccionDto) {
    await this.dataSource.transaction(async (m) => {
      await this.buscarAtraccion(id, m);
      const cambios: Partial<Atraccion> = {};

      if (dto.name !== undefined) cambios.nombre = dto.name;
      if (dto.long_description !== undefined) cambios.descripcion = dto.long_description;
      if (dto.duration !== undefined) cambios.duracion = dto.duration;
      if (dto.price !== undefined) {
        this.validarMoneda(dto.price.currency);
        cambios.precioTicket = dto.price.total;
        cambios.moneda = dto.price.currency;
      }
      if (dto.product_type !== undefined) cambios.tipoProducto = dto.product_type;
      if (dto.includes !== undefined) cambios.incluye = dto.includes;
      if (dto.categories !== undefined) cambios.categorias = dto.categories;
      if (dto.badges !== undefined) cambios.insignias = dto.badges;
      if (dto.supported_languages !== undefined) cambios.idiomas = dto.supported_languages;
      if (dto.free_cancellation !== undefined) cambios.cancelacionGratuita = dto.free_cancellation;
      if (dto.operator !== undefined) {
        cambios.operadorId = (await this.obtenerOperador(m, dto.operator.id, dto.operator.name)).id;
      }

      if (Object.keys(cambios).length > 0) await m.update(Atraccion, { id }, cambios);

      if (dto.locations !== undefined) {
        await this.validarCiudades(m, dto.locations);
        await this.reemplazarUbicaciones(m, id, dto.locations);
      }
      if (dto.photos !== undefined) await this.reemplazarFotos(m, id, dto.photos);
    });
    return this.findOne(id);
  }

  /** DELETE /atracciones/:id  (borrado suave: se marca deletedAt) */
  async delete(id: string): Promise<void> {
    await this.buscarAtraccion(id);
    await this.atracciones.softDelete(id);
  }

  /** POST /atracciones/search */
  async search(dto: SearchAtraccionesDto) {
    if (dto.dates && dto.dates.start_date > dto.dates.end_date) {
      throw new BadRequestException('start_date no puede ser posterior a end_date');
    }

    const offset = this.leerTokenPagina(dto.next_page);
    const rows = dto.rows > 0 ? Math.min(dto.rows, 100) : 20;

    const qb = this.atracciones
      .createQueryBuilder('a')
      .select('a.id', 'id')
      .innerJoin('a.ubicaciones', 'u');

    if (dto.cities?.length) qb.andWhere('u.ciudadId IN (:...cities)', { cities: dto.cities });
    if (dto.countries?.length) {
      qb.andWhere('u.pais IN (:...countries)', { countries: dto.countries.map((c) => c.toLowerCase()) });
    }
    const rating = dto.filters?.rating;
    if (rating?.minimum_review_score !== undefined) {
      qb.andWhere('a.puntuacion >= :score', { score: rating.minimum_review_score });
    }
    if (rating?.minimum_review_count !== undefined) {
      qb.andWhere('a.numeroResenas >= :count', { count: rating.minimum_review_count });
    }

    // Ids únicos (una atracción con 2 ubicaciones en la misma ciudad no debe salir 2 veces)
    const todos = await qb.distinct(true).getRawMany<{ id: string }>();
    const total = todos.length;

    let data: ReturnType<typeof toAtraccionResponse>[] = [];
    if (total > 0) {
      const filas = await this.atracciones.find({ where: { id: In(todos.map((t) => t.id)) } });
      filas.sort(this.ordenador(dto.sort?.by));
      data = filas.slice(offset, offset + rows).map(toAtraccionResponse);
    }

    const siguiente = offset + rows < total ? this.crearTokenPagina(offset + rows) : undefined;
    return {
      data,
      metadata: { total_results: total, ...(siguiente ? { next_page: siguiente } : {}) },
      request_id: randomUUID(),
    };
  }

  /** POST /atracciones/details  (varias atracciones en una sola llamada) */
  async getDetailsBatch(dto: DetailsRequestDto) {
    const ids = [...new Set(dto.attractions)].filter((id) => UUID_REGEX.test(id));
    const filas = ids.length ? await this.atracciones.find({ where: { id: In(ids) } }) : [];
    return { data: filas.map(toAtraccionResponse), request_id: randomUUID() };
  }

  /** GET /atracciones/:id/availability?date=YYYY-MM-DD */
  async getAvailability(id: string, date: string): Promise<AvailabilityResponseDto> {
    this.validarFecha(date);
    const atraccion = await this.buscarAtraccion(id);
    const vendidas = await this.ticketsVendidos(this.dataSource.manager, id, date);
    return {
      date,
      available_spots: Math.max(atraccion.cupoDiario - vendidas, 0),
      times: atraccion.horarios ?? [],
    };
  }

  // =====================================================================
  // RESERVAS
  // =====================================================================

  /** POST /atracciones/:id/reservations  (requiere Idempotency-Key) */
  async reserve(id: string, dto: ReservationRequestDto, idempotencyKey: string): Promise<ReservationResponseDto> {
    return this.conIdempotencia(idempotencyKey, `POST /atracciones/${id}/reservations`, 201, async (m) => {
      this.validarFecha(dto.date);
      if (dto.date < this.hoy()) throw new BadRequestException('La fecha de la reserva ya pasó');

      // Se bloquea la fila de la atracción para que dos compras al mismo
      // tiempo no vendan el mismo último cupo.
      const atraccion = await m
        .getRepository(Atraccion)
        .createQueryBuilder('a')
        .setLock('pessimistic_write')
        .where('a.id = :id', { id })
        .getOne();
      if (!atraccion) throw new NotFoundException(`La atracción ${id} no existe`);
      if (!atraccion.estaActivo) throw new ConflictException('La atracción no está disponible para reservas');

      if (dto.time && atraccion.horarios.length > 0 && !atraccion.horarios.includes(dto.time)) {
        throw new BadRequestException(`Horario no disponible. Horarios: ${atraccion.horarios.join(', ')}`);
      }

      const vendidas = await this.ticketsVendidos(m, id, dto.date);
      const disponibles = atraccion.cupoDiario - vendidas;
      if (dto.ticket_count > disponibles) {
        throw new ConflictException(`Solo quedan ${Math.max(disponibles, 0)} cupos para ${dto.date}`);
      }

      const reserva = await m.save(
        m.create(Reserva, {
          atraccionId: id,
          fecha: dto.date,
          hora: dto.time ?? null,
          cantidadTickets: dto.ticket_count,
          nombreCliente: dto.customer_name,
          emailCliente: dto.customer_email ?? null,
          precioTotal: Number((atraccion.precioTicket * dto.ticket_count).toFixed(2)),
          moneda: atraccion.moneda,
          estado: ReservationStatus.CONFIRMED,
        }),
      );
      return toReservationResponse(reserva);
    });
  }

  /** POST /atracciones/reservations/:reservationId/cancel  (requiere Idempotency-Key) */
  async cancelReservation(
    reservationId: string,
    dto: CancelReservationRequestDto,
    idempotencyKey: string,
  ): Promise<ReservationResponseDto> {
    return this.conIdempotencia(idempotencyKey, `POST /atracciones/reservations/${reservationId}/cancel`, 200, async (m) => {
      const reserva = await m.findOne(Reserva, { where: { id: reservationId } });
      if (!reserva) throw new NotFoundException(`La reserva ${reservationId} no existe`);
      if (reserva.estado === ReservationStatus.CANCELLED) {
        throw new ConflictException('La reserva ya estaba cancelada');
      }

      // Regla de negocio RN06: sin cancelación gratuita no se permite cancelar.
      const atraccion = await m.findOne(Atraccion, { where: { id: reserva.atraccionId }, withDeleted: true });
      if (atraccion && !atraccion.cancelacionGratuita) {
        throw new ConflictException('Esta atracción no tiene cancelación gratuita');
      }

      reserva.estado = ReservationStatus.CANCELLED;
      reserva.motivoCancelacion = dto.reason;
      return toReservationResponse(await m.save(reserva));
    });
  }

  /** GET /atracciones/reservations */
  async getReservations(): Promise<ReservationResponseDto[]> {
    const filas = await this.reservas.find({ order: { createdAt: 'DESC' } });
    return filas.map(toReservationResponse);
  }

  /** GET /atracciones/reservations/:reservationId */
  async getReservationById(reservationId: string): Promise<ReservationResponseDto> {
    const reserva = await this.reservas.findOne({ where: { id: reservationId } });
    if (!reserva) throw new NotFoundException(`La reserva ${reservationId} no existe`);
    return toReservationResponse(reserva);
  }

  // =====================================================================
  // AYUDANTES INTERNOS
  // =====================================================================

  private async buscarAtraccion(id: string, m: EntityManager = this.dataSource.manager) {
    const atraccion = await m.findOne(Atraccion, { where: { id } });
    if (!atraccion) throw new NotFoundException(`La atracción ${id} no existe`);
    return atraccion;
  }

  /** Convierte los campos simples del contrato (inglés) a columnas (español). */
  private camposDesdeDto(dto: CreateAtraccionDto) {
    this.validarMoneda(dto.price.currency);
    return {
      nombre: dto.name,
      descripcion: dto.long_description,
      duracion: dto.duration,
      precioTicket: dto.price.total,
      moneda: dto.price.currency,
      tipoProducto: dto.product_type,
      incluye: dto.includes,
      categorias: dto.categories,
      insignias: dto.badges ?? [],
      idiomas: dto.supported_languages,
      cancelacionGratuita: dto.free_cancellation,
    };
  }

  private validarMoneda(currency: string) {
    if (currency !== 'USD') throw new BadRequestException('La moneda debe ser USD (Ecuador)');
  }

  private validarFecha(fecha: string) {
    if (!fecha || !FECHA_REGEX.test(fecha) || isNaN(Date.parse(fecha))) {
      throw new BadRequestException('La fecha debe tener formato YYYY-MM-DD');
    }
  }

  private hoy() {
    // Fecha actual en Ecuador continental (UTC-5)
    return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  private async validarCiudades(m: EntityManager, locations: LocationDto[]) {
    if (!locations?.length) throw new BadRequestException('Debe enviar al menos una ubicación');
    const ids = [...new Set(locations.map((l) => l.city))];
    const existentes = await m.count(Ciudad, { where: { id: In(ids) } });
    if (existentes !== ids.length) {
      throw new BadRequestException(
        'Alguna ciudad (city) no existe. Solo se aceptan ciudades de Ecuador con aeropuerto registradas.',
      );
    }
    if (locations.some((l) => l.country.toLowerCase() !== 'ec')) {
      throw new BadRequestException('country debe ser "ec" (solo Ecuador)');
    }
  }

  /** Busca el operador por id; si no existe lo crea con ese id y nombre. */
  private async obtenerOperador(m: EntityManager, id: number, nombre: string) {
    let operador = await m.findOne(Operador, { where: { id } });
    if (!operador) {
      operador = await m.save(m.create(Operador, { id, nombre }));
    } else if (operador.nombre !== nombre) {
      operador.nombre = nombre;
      operador = await m.save(operador);
    }
    return operador;
  }

  private crearUbicaciones(m: EntityManager, locations: LocationDto[]) {
    return locations.map((l) =>
      m.create(UbicacionAtraccion, {
        direccion: l.address,
        ciudadId: l.city,
        pais: l.country.toLowerCase(),
        latitud: l.coordinates.latitude,
        longitud: l.coordinates.longitude,
        tipo: l.type ?? null,
      }),
    );
  }

  private crearFotos(m: EntityManager, photos: PhotoDto[]) {
    return (photos ?? []).map((p, i) => m.create(FotoAtraccion, { url: p.url, orden: i }));
  }

  private async reemplazarUbicaciones(m: EntityManager, id: string, locations: LocationDto[]) {
    await m.delete(UbicacionAtraccion, { atraccion: { id } });
    const nuevas = this.crearUbicaciones(m, locations).map((u) => ({ ...u, atraccion: { id } as Atraccion }));
    await m.save(UbicacionAtraccion, nuevas);
  }

  private async reemplazarFotos(m: EntityManager, id: string, photos: PhotoDto[]) {
    await m.delete(FotoAtraccion, { atraccion: { id } });
    const nuevas = this.crearFotos(m, photos).map((f) => ({ ...f, atraccion: { id } as Atraccion }));
    await m.save(FotoAtraccion, nuevas);
  }

  /** Suma los tickets ya vendidos (no cancelados) de una atracción en una fecha. */
  private async ticketsVendidos(m: EntityManager, atraccionId: string, fecha: string) {
    const r = await m
      .getRepository(Reserva)
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.cantidadTickets), 0)', 'total')
      .where('r.atraccionId = :atraccionId', { atraccionId })
      .andWhere('r.fecha = :fecha', { fecha })
      .andWhere('r.estado != :cancelada', { cancelada: ReservationStatus.CANCELLED })
      .getRawOne<{ total: string }>();
    return Number(r?.total ?? 0);
  }

  /**
   * Idempotencia: si la clave ya se usó en esta misma operación, se devuelve
   * la respuesta guardada; si se usó en otra operación, error 409.
   * La operación y el registro de la clave se guardan en la misma transacción.
   */
  private async conIdempotencia<T extends object>(
    clave: string,
    endpoint: string,
    codigoHttp: number,
    operacion: (m: EntityManager) => Promise<T>,
  ): Promise<T> {
    const previa = await this.claves.findOne({ where: { clave } });
    if (previa) {
      if (previa.endpoint !== endpoint) {
        throw new ConflictException('La Idempotency-Key ya se usó en otra operación');
      }
      return previa.respuesta as T;
    }

    try {
      return await this.dataSource.transaction(async (m) => {
        const resultado = await operacion(m);
        await m.insert(ClaveIdempotencia, {
          clave,
          endpoint,
          codigoHttp,
          respuesta: resultado as Record<string, unknown>,
        });
        return resultado;
      });
    } catch (error: any) {
      // Dos peticiones con la misma clave al mismo tiempo: la segunda choca con la llave primaria.
      if (error?.code === '23505') {
        const guardada = await this.claves.findOne({ where: { clave } });
        if (guardada && guardada.endpoint === endpoint) return guardada.respuesta as T;
        throw new ConflictException('Conflicto de idempotencia');
      }
      throw error;
    }
  }

  private ordenador(criterio?: string) {
    switch (criterio) {
      case 'price_asc':
        return (a: Atraccion, b: Atraccion) => a.precioTicket - b.precioTicket;
      case 'price_desc':
        return (a: Atraccion, b: Atraccion) => b.precioTicket - a.precioTicket;
      case 'top_rated':
        return (a: Atraccion, b: Atraccion) => (b.puntuacion ?? 0) - (a.puntuacion ?? 0);
      case 'most_popular':
      default:
        return (a: Atraccion, b: Atraccion) => b.numeroResenas - a.numeroResenas;
    }
  }

  private crearTokenPagina(offset: number) {
    return Buffer.from(JSON.stringify({ offset })).toString('base64');
  }

  private leerTokenPagina(token?: string) {
    if (!token) return 0;
    try {
      const { offset } = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
      if (Number.isInteger(offset) && offset >= 0) return offset;
    } catch {
      /* se lanza el error de abajo */
    }
    throw new BadRequestException('next_page inválido o expirado');
  }
}