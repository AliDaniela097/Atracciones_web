import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CIUDADES_ECUADOR } from '../seeds/ciudades.seed';

const DIA_MS = 24 * 60 * 60 * 1000;
const MAX_DIAS = 366;

function isoDia(d: Date) {
  return d.toISOString().slice(0, 10);
}

const num = (v: unknown) => Number(v ?? 0);

/**
 * Reporte de ventas para el operador. Todo se calcula en PostgreSQL (SUM/COUNT/GROUP BY),
 * así el reporte es correcto aunque haya miles de reservas (no depende de la paginación).
 * Los ingresos cuentan solo reservas CONFIRMADAS; las canceladas se reportan aparte.
 */
@Injectable()
export class ReportesService {
  constructor(private readonly db: DataSource) {}

  async ventas(desdeTxt?: string, hastaTxt?: string) {
    const hoy = new Date();
    const hasta = hastaTxt ? new Date(`${hastaTxt}T00:00:00Z`) : new Date(`${isoDia(hoy)}T00:00:00Z`);
    const desde = desdeTxt ? new Date(`${desdeTxt}T00:00:00Z`) : new Date(hasta.getTime() - 29 * DIA_MS);
    if (desde > hasta) throw new BadRequestException('"desde" no puede ser posterior a "hasta".');
    if ((hasta.getTime() - desde.getTime()) / DIA_MS > MAX_DIAS) {
      throw new BadRequestException(`El rango máximo es de ${MAX_DIAS} días.`);
    }
    const hastaExclusivo = new Date(hasta.getTime() + DIA_MS);
    const p = [desde.toISOString(), hastaExclusivo.toISOString()];
    const rango = `r."createdAt" >= $1 AND r."createdAt" < $2`;
    const ciudadDe = `(SELECT MIN(u."ciudadId") FROM ubicaciones_atraccion u WHERE u."atraccionId" = a.id)`;

    const [resumen] = await this.db.query(
      `SELECT
         COUNT(*)                                                             AS reservas,
         COUNT(*) FILTER (WHERE r.estado = 'CONFIRMED')                        AS confirmadas,
         COUNT(*) FILTER (WHERE r.estado = 'CANCELLED')                        AS canceladas,
         COALESCE(SUM(r."cantidadTickets") FILTER (WHERE r.estado = 'CONFIRMED'), 0) AS entradas,
         COALESCE(SUM(r."precioTotal") FILTER (WHERE r.estado = 'CONFIRMED'), 0)     AS ingresos,
         COALESCE(SUM(r."precioTotal") FILTER (WHERE r.estado = 'CANCELLED'), 0)     AS "montoCancelado",
         COUNT(DISTINCT COALESCE(r."usuarioId"::text, r."emailCliente", r."nombreCliente")) AS clientes
       FROM reservas r WHERE ${rango}`,
      p,
    );

    const porAtraccion = await this.db.query(
      `SELECT a.id, a.nombre, ${ciudadDe} AS "ciudadId",
              COUNT(*) FILTER (WHERE r.estado = 'CONFIRMED') AS reservas,
              COALESCE(SUM(r."cantidadTickets") FILTER (WHERE r.estado = 'CONFIRMED'), 0) AS entradas,
              COALESCE(SUM(r."precioTotal") FILTER (WHERE r.estado = 'CONFIRMED'), 0) AS ingresos,
              COUNT(*) FILTER (WHERE r.estado = 'CANCELLED') AS canceladas
       FROM reservas r JOIN atracciones a ON a.id = r."atraccionId"
       WHERE ${rango}
       GROUP BY a.id, a.nombre
       ORDER BY ingresos DESC, entradas DESC, a.nombre`,
      p,
    );

    const porDia = await this.db.query(
      `SELECT to_char(date_trunc('day', r."createdAt"), 'YYYY-MM-DD') AS fecha,
              COUNT(*) FILTER (WHERE r.estado = 'CONFIRMED') AS reservas,
              COALESCE(SUM(r."cantidadTickets") FILTER (WHERE r.estado = 'CONFIRMED'), 0) AS entradas,
              COALESCE(SUM(r."precioTotal") FILTER (WHERE r.estado = 'CONFIRMED'), 0) AS ingresos
       FROM reservas r WHERE ${rango}
       GROUP BY 1 ORDER BY 1`,
      p,
    );

    const ultimas = await this.db.query(
      `SELECT r.id, r."createdAt" AS "fechaCompra", to_char(r.fecha, 'YYYY-MM-DD') AS "fechaVisita", r.hora,
              a.nombre AS atraccion, r."cantidadTickets" AS entradas, r."precioTotal" AS total,
              r.moneda, r.estado, r."nombreCliente" AS cliente, r."emailCliente" AS email
       FROM reservas r JOIN atracciones a ON a.id = r."atraccionId"
       WHERE ${rango}
       ORDER BY r."createdAt" DESC LIMIT 20`,
      p,
    );

    // Por aeropuerto: se agrupa en memoria a partir de porAtraccion (pocas filas)
    const ciudades = new Map<number, { ciudadId: number; nombre: string; iata: string; reservas: number; entradas: number; ingresos: number }>();
    for (const fila of porAtraccion) {
      const id = num(fila.ciudadId);
      const c = CIUDADES_ECUADOR.find((x) => x.id === id);
      const acc = ciudades.get(id) ?? { ciudadId: id, nombre: c?.nombre ?? 'Sin ciudad', iata: c?.codigoIata ?? '—', reservas: 0, entradas: 0, ingresos: 0 };
      acc.reservas += num(fila.reservas);
      acc.entradas += num(fila.entradas);
      acc.ingresos += num(fila.ingresos);
      ciudades.set(id, acc);
    }

    const ingresos = num(resumen.ingresos);
    const confirmadas = num(resumen.confirmadas);
    return {
      moneda: 'USD',
      periodo: { desde: isoDia(desde), hasta: isoDia(hasta) },
      generadoEn: new Date().toISOString(),
      resumen: {
        reservas: num(resumen.reservas),
        confirmadas,
        canceladas: num(resumen.canceladas),
        entradasVendidas: num(resumen.entradas),
        ingresos,
        montoCancelado: num(resumen.montoCancelado),
        ticketPromedio: confirmadas ? Math.round((ingresos / confirmadas) * 100) / 100 : 0,
        clientes: num(resumen.clientes),
      },
      porAtraccion: porAtraccion.map((f: Record<string, unknown>) => ({
        id: f.id,
        nombre: f.nombre,
        ciudadId: f.ciudadId == null ? null : num(f.ciudadId),
        reservas: num(f.reservas),
        entradas: num(f.entradas),
        ingresos: num(f.ingresos),
        canceladas: num(f.canceladas),
      })),
      porAeropuerto: [...ciudades.values()].sort((a, b) => b.ingresos - a.ingresos),
      porDia: porDia.map((f: Record<string, unknown>) => ({
        fecha: f.fecha,
        reservas: num(f.reservas),
        entradas: num(f.entradas),
        ingresos: num(f.ingresos),
      })),
      ultimas: ultimas.map((f: Record<string, unknown>) => ({ ...f, entradas: num(f.entradas), total: num(f.total) })),
    };
  }

  /**
   * Verificación de una entrada (lo que se abre al escanear el QR del comprobante).
   * Acepta el código completo (UUID) o el código corto que se imprime: los primeros 8 caracteres (ej. 75E3-667B).
   */
  async verificar(codigo: string) {
    const limpio = codigo.trim().toLowerCase().replace(/-/g, '');
    let condicion: string;
    let valor: string;
    if (/^[0-9a-f]{32}$/.test(limpio)) {
      condicion = 'r.id = $1::uuid';
      valor = limpio;
    } else if (/^[0-9a-f]{8}$/.test(limpio)) {
      condicion = 'r.id::text LIKE $1';
      valor = `${limpio}%`;
    } else {
      throw new BadRequestException('El código debe ser el código corto de 8 caracteres (ej. 75E3-667B) o el código completo.');
    }
    const filas = await this.db.query(
      `SELECT r.id, r.estado, r."cantidadTickets" AS entradas, r."precioTotal" AS total, r.moneda,
              to_char(r.fecha, 'YYYY-MM-DD') AS "fechaVisita", r.hora, r."createdAt" AS "fechaCompra",
              r."nombreCliente" AS cliente, r."motivoCancelacion" AS "motivoCancelacion",
              a.id AS "atraccionId", a.nombre AS atraccion,
              (SELECT MIN(u."ciudadId") FROM ubicaciones_atraccion u WHERE u."atraccionId" = a.id) AS "ciudadId"
       FROM reservas r JOIN atracciones a ON a.id = r."atraccionId"
       WHERE ${condicion}
       LIMIT 2`,
      [valor],
    );
    if (filas.length === 0) throw new NotFoundException('No existe una reserva con ese código.');
    if (filas.length > 1) throw new ConflictException('Hay más de una reserva con ese código corto. Usa el código completo.');
    const f = filas[0];
    // Fecha de hoy en Ecuador continental (UTC-5), no en UTC
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
    return {
      ...f,
      entradas: num(f.entradas),
      total: num(f.total),
      ciudadId: f.ciudadId == null ? null : num(f.ciudadId),
      // Válida para entrar: confirmada y la fecha de visita no ha pasado
      valida: f.estado === 'CONFIRMED' && f.fechaVisita >= hoy,
      vencida: f.fechaVisita < hoy,
    };
  }
}
