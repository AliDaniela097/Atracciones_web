import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository, SelectQueryBuilder } from 'typeorm';
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
import { BuscarAtraccionesQueryDto } from './dto/list-atracciones-query.dto';
import { SearchAtraccionesDto } from './dto/search-atracciones.dto';
import { DetailsRequestDto } from './dto/details-request.dto';
import { AvailabilityResponseDto } from './dto/availability.dto';
import {
  CancelReservationRequestDto, ReservationRequestDto, ReservationResponseDto, ReservationStatus,
} from './dto/reservation.dto';
import { LocationDto, PhotoDto } from './dto/nested-types.dto';
import { toAtraccionResponse, toReservationResponse } from './atraccion.mapper';
import { esOperador, type UsuarioToken } from '../auth/roles';

/** Letras con tilde que se igualan a su versión simple al buscar (mayúsculas y minúsculas). */
const TILDES_ORIGEN = 'áéíóúüñÁÉÍÓÚÜÑ';
const TILDES_DESTINO = 'aeiouunaeiouun';

/** Ciudades de las islas Galápagos (ids del seed de ciudades GPS y SCY): su hora es UTC-6, una menos que el continente. */
const CIUDADES_GALAPAGOS = [8, 9];
/** Minutos antes del inicio en que se deja de vender un horario del día de hoy. */
const MINUTOS_CIERRE_VENTA = 30;

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
  async findAll(query: BuscarAtraccionesQueryDto) {
    const limit = query.limit ?? 10;
    const offset = query.offset ?? 0;

    // Sin texto se lista todo el catálogo; con texto (?q=) solo lo que coincide.
    const filtro = this.aplicarBusquedaTexto(this.atracciones.createQueryBuilder('a'), query.q);
    const total = await filtro.getCount();
    const pagina = await filtro
      .clone()
      .select('a.id', 'id')
      .orderBy('a.nombre', 'ASC')
      .addOrderBy('a.id', 'ASC')
      .offset(offset)
      .limit(limit)
      .getRawMany<{ id: string }>();

    // Solo se cargan completas (fotos, ubicaciones, operador) las filas de la página
    const cargadas = pagina.length ? await this.atracciones.find({ where: { id: In(pagina.map((p) => p.id)) } }) : [];
    const porId = new Map(cargadas.map((f) => [f.id, f]));
    const filas = pagina.map((p) => porId.get(p.id)).filter((f): f is Atraccion => !!f);

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

  /**
   * Filtra por texto libre: cada palabra debe aparecer en el nombre, la descripción, las categorías o la dirección,
   * sin distinguir mayúsculas ni tildes. Sin texto no filtra nada. Se usa en GET /atracciones y en POST /atracciones/search.
   */
  private aplicarBusquedaTexto(qb: SelectQueryBuilder<Atraccion>, texto?: string): SelectQueryBuilder<Atraccion> {
    this.palabrasDeBusqueda(texto).forEach((palabra, i) => {
      const sinTildes = (expr: string) => `translate(lower(${expr}), '${TILDES_ORIGEN}', '${TILDES_DESTINO}')`;
      const campos = sinTildes("a.nombre || ' ' || a.descripcion || ' ' || array_to_string(a.categorias, ' ')");
      const direccion = sinTildes('ub.direccion');
      qb.andWhere(
        `(${campos} LIKE :palabra${i} ESCAPE '\\' OR EXISTS ` +
        `(SELECT 1 FROM ubicaciones_atraccion ub WHERE ub."atraccionId" = a.id AND ${direccion} LIKE :palabra${i} ESCAPE '\\'))`,
        { [`palabra${i}`]: `%${palabra}%` },
      );
    });
    return qb;
  }

  /**
   * Convierte el texto libre en palabras listas para LIKE: sin tildes, en minúsculas,
   * con los comodines de LIKE (% _ \\) escapados, máximo 5 palabras de hasta 50 letras.
   */
  private palabrasDeBusqueda(query?: string): string[] {
    if (!query) return [];
    return query
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 5)
      .map((p) => p.slice(0, 50).replace(/[\\%_]/g, (c) => `\\${c}`));
  }

  /** POST /atracciones/search */
  async search(dto: SearchAtraccionesDto) {
    if (dto.dates && dto.dates.start_date > dto.dates.end_date) {
      throw new BadRequestException('start_date no puede ser posterior a end_date');
    }

    const offset = this.leerTokenPagina(dto.next_page);
    const rows = dto.rows > 0 ? Math.min(dto.rows, 100) : 20;
    const orden = this.columnaOrden(dto.sort?.by);

    // Subconsulta: ids de atracciones que tienen alguna ubicación que cumple el filtro.
    // Así una atracción con 2 ubicaciones no sale repetida.
    const filtro = this.atracciones
      .createQueryBuilder('a')
      .where((qb) => {
        const sub = qb.subQuery().select('u.atraccionId').from(UbicacionAtraccion, 'u');
        if (dto.cities?.length) sub.andWhere('u.ciudadId IN (:...cities)');
        if (dto.countries?.length) sub.andWhere('u.pais IN (:...countries)');
        return 'a.id IN ' + sub.getQuery();
      })
      .setParameters({ cities: dto.cities ?? [], countries: (dto.countries ?? []).map((c) => c.toLowerCase()) });

    this.aplicarBusquedaTexto(filtro, dto.query);

    const rating = dto.filters?.rating;
    if (rating?.minimum_review_score !== undefined) {
      filtro.andWhere('a.puntuacion >= :score', { score: rating.minimum_review_score });
    }
    if (rating?.minimum_review_count !== undefined) {
      filtro.andWhere('a.numeroResenas >= :count', { count: rating.minimum_review_count });
    }

    // La paginación y el orden se hacen en la base de datos: solo se traen las filas de la página.
    const total = await filtro.getCount();
    const pagina = await filtro
      .clone()
      .select('a.id', 'id')
      .orderBy(orden.columna, orden.direccion, 'NULLS LAST')
      .addOrderBy('a.id', 'ASC')
      .offset(offset)
      .limit(rows)
      .getRawMany<{ id: string }>();

    let data: ReturnType<typeof toAtraccionResponse>[] = [];
    if (pagina.length) {
      const filas = await this.atracciones.find({ where: { id: In(pagina.map((p) => p.id)) } });
      const porId = new Map(filas.map((f) => [f.id, f]));
      data = pagina.map((p) => porId.get(p.id)).filter((f): f is Atraccion => !!f).map(toAtraccionResponse);
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
    // Solo se ofrecen los horarios que todavía se pueden comprar (hora local de la atracción).
    const ahora = this.ahoraLocal(await this.husoHorario(this.dataSource.manager, id));
    const horarios = atraccion.horarios ?? [];
    const vigentes = this.horariosVigentes(horarios, date, ahora);
    // Si la atracción tiene horarios y ya cerraron todos (o la fecha pasó), no hay nada que vender.
    const cerrado = date < ahora.fecha || (horarios.length > 0 && vigentes.length === 0);
    return {
      date,
      available_spots: cerrado ? 0 : Math.max(atraccion.cupoDiario - vendidas, 0),
      times: vigentes,
    };
  }

  // =====================================================================
  // RESERVAS
  // =====================================================================

  /** POST /atracciones/:id/reservations  (requiere token con attractions:book e Idempotency-Key) */
  async reserve(
    id: string,
    dto: ReservationRequestDto,
    idempotencyKey: string,
    usuario: UsuarioToken,
  ): Promise<ReservationResponseDto> {
    // La clave de idempotencia se asocia también al usuario: nadie puede reutilizar la clave de otro
    return this.conIdempotencia(idempotencyKey, `POST /atracciones/${id}/reservations|${usuario.id}`, 201, async (m) => {
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

      // Hora local de la atracción (Galápagos tiene una hora menos que el continente)
      const ahora = this.ahoraLocal(await this.husoHorario(m, id));
      if (dto.date < ahora.fecha) throw new BadRequestException('La fecha de la reserva ya pasó');
      if (dto.date === ahora.fecha && atraccion.horarios.length > 0 && !dto.time) {
        throw new BadRequestException('Elige un horario para reservar hoy');
      }
      if (dto.time && this.horariosVigentes([dto.time], dto.date, ahora).length === 0) {
        throw new BadRequestException(
          `El horario ${dto.time} ya no está disponible. La venta se cierra ${MINUTOS_CIERRE_VENTA} minutos antes de cada horario.`,
        );
      }

      const vendidas = await this.ticketsVendidos(m, id, dto.date);
      const disponibles = atraccion.cupoDiario - vendidas;
      if (dto.ticket_count > disponibles) {
        throw new ConflictException(`Solo quedan ${Math.max(disponibles, 0)} cupos para ${dto.date}`);
      }

      const reserva = await m.save(
        m.create(Reserva, {
          atraccionId: id,
          usuarioId: usuario.id,
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

  /** POST /atracciones/reservations/:reservationId/cancel  (requiere token con attractions:cancel e Idempotency-Key) */
  async cancelReservation(
    reservationId: string,
    dto: CancelReservationRequestDto,
    idempotencyKey: string,
    usuario: UsuarioToken,
  ): Promise<ReservationResponseDto> {
    return this.conIdempotencia(idempotencyKey, `POST /atracciones/reservations/${reservationId}/cancel|${usuario.id}`, 200, async (m) => {
      const reserva = await m.findOne(Reserva, { where: { id: reservationId } });
      // Un cliente solo puede cancelar sus propias reservas (si no es suya, se responde como si no existiera)
      if (!reserva || !this.puedeVer(reserva, usuario)) throw new NotFoundException(`La reserva ${reservationId} no existe`);
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

  /**
   * GET /atracciones/reservations?limit=&offset=  (paginado; el total va en la cabecera X-Total-Count)
   * El cliente ve solo su historial; el operador ve todas las reservas.
   */
  async getReservations(
    usuario: UsuarioToken,
    limit = 10,
    offset = 0,
  ): Promise<{ data: ReservationResponseDto[]; total: number }> {
    const [filas, total] = await this.reservas.findAndCount({
      where: esOperador(usuario) ? {} : { usuarioId: usuario.id },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data: filas.map(toReservationResponse), total };
  }

  /** GET /atracciones/reservations/:reservationId  (el cliente solo ve las suyas) */
  async getReservationById(reservationId: string, usuario: UsuarioToken): Promise<ReservationResponseDto> {
    const reserva = await this.reservas.findOne({ where: { id: reservationId } });
    if (!reserva || !this.puedeVer(reserva, usuario)) throw new NotFoundException(`La reserva ${reservationId} no existe`);
    return toReservationResponse(reserva);
  }

  /** El operador ve todas las reservas; el cliente, solo las que hizo con su cuenta */
  private puedeVer(reserva: Reserva, usuario: UsuarioToken) {
    return esOperador(usuario) || reserva.usuarioId === usuario.id;
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

  /** Huso horario de la atracción en horas respecto a UTC: -6 si está en Galápagos, -5 en el resto del Ecuador. */
  private async husoHorario(m: EntityManager, atraccionId: string): Promise<number> {
    const enGalapagos = await m
      .getRepository(UbicacionAtraccion)
      .createQueryBuilder('u')
      .where('u.atraccionId = :atraccionId', { atraccionId })
      .andWhere('u.ciudadId IN (:...ciudades)', { ciudades: CIUDADES_GALAPAGOS })
      .getCount();
    return enGalapagos > 0 ? -6 : -5;
  }

  /** Fecha (YYYY-MM-DD) y minutos transcurridos del día en el huso indicado. */
  private ahoraLocal(huso: number): { fecha: string; minutos: number } {
    const d = new Date(Date.now() + huso * 60 * 60 * 1000);
    return { fecha: d.toISOString().slice(0, 10), minutos: d.getUTCHours() * 60 + d.getUTCMinutes() };
  }

  /**
   * Horarios que todavía se pueden comprar para una fecha: un día futuro conserva todos, un día pasado ninguno
   * y hoy solo los que empiezan más de MINUTOS_CIERRE_VENTA minutos después de la hora actual.
   */
  private horariosVigentes(horarios: string[], fecha: string, ahora: { fecha: string; minutos: number }): string[] {
    if (fecha > ahora.fecha) return horarios;
    if (fecha < ahora.fecha) return [];
    return horarios.filter((h) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(h);
      if (!m) return true; // un horario con formato raro no se puede comparar: lo valida el catálogo
      return Number(m[1]) * 60 + Number(m[2]) - MINUTOS_CIERRE_VENTA > ahora.minutos;
    });
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

  /** Columna de la base por la que se ordena la búsqueda (sort.by del contrato). */
  private columnaOrden(criterio?: string): { columna: string; direccion: 'ASC' | 'DESC' } {
    switch (criterio) {
      case 'price_asc':
        return { columna: 'a.precioTicket', direccion: 'ASC' };
      case 'price_desc':
        return { columna: 'a.precioTicket', direccion: 'DESC' };
      case 'top_rated':
        return { columna: 'a.puntuacion', direccion: 'DESC' };
      case 'most_popular':
      default:
        return { columna: 'a.numeroResenas', direccion: 'DESC' };
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