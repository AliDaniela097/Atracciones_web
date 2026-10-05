import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, fechaMasDias } from '../../api';
import type { ReporteVentas } from '../../types';
import { dinero } from '../../carrito';
import { EstadoError } from '../../components/Estados';
import EstadoReserva from '../../components/EstadoReserva';
import Icono from '../../components/Icono';

const RANGOS = [
  { dias: 7, texto: 'Últimos 7 días' },
  { dias: 30, texto: 'Últimos 30 días' },
  { dias: 90, texto: 'Últimos 90 días' },
];

/** Todos los días del periodo, con 0 en los días sin ventas (para que el gráfico no se salte días) */
function diasCompletos(r: ReporteVentas) {
  const mapa = new Map(r.porDia.map((d) => [d.fecha, d]));
  const dias = [];
  const fin = new Date(`${r.periodo.hasta}T00:00:00Z`);
  for (let d = new Date(`${r.periodo.desde}T00:00:00Z`); d <= fin; d.setUTCDate(d.getUTCDate() + 1)) {
    const f = d.toISOString().slice(0, 10);
    dias.push(mapa.get(f) ?? { fecha: f, reservas: 0, entradas: 0, ingresos: 0 });
  }
  return dias;
}

function fechaCorta(iso: string) {
  const [, m, d] = iso.split('-');
  return `${Number(d)}/${Number(m)}`;
}

/** CSV compatible con Excel (BOM UTF-8 para que se vean las tildes) */
function descargarCsv(r: ReporteVentas) {
  const celda = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lineas = [
    ['Reporte de ventas', `${r.periodo.desde} a ${r.periodo.hasta}`],
    [],
    ['Resumen'],
    ['Ingresos confirmados (USD)', r.resumen.ingresos.toFixed(2)],
    ['Entradas vendidas', r.resumen.entradasVendidas],
    ['Reservas confirmadas', r.resumen.confirmadas],
    ['Reservas canceladas', r.resumen.canceladas],
    ['Monto cancelado (USD)', r.resumen.montoCancelado.toFixed(2)],
    ['Ticket promedio (USD)', r.resumen.ticketPromedio.toFixed(2)],
    ['Clientes distintos', r.resumen.clientes],
    [],
    ['Por atracción'],
    ['Atracción', 'Reservas confirmadas', 'Entradas', 'Ingresos (USD)', 'Canceladas'],
    ...r.porAtraccion.map((a) => [a.nombre, a.reservas, a.entradas, a.ingresos.toFixed(2), a.canceladas]),
    [],
    ['Por aeropuerto'],
    ['Aeropuerto', 'Ciudad', 'Reservas confirmadas', 'Entradas', 'Ingresos (USD)'],
    ...r.porAeropuerto.map((c) => [c.iata, c.nombre, c.reservas, c.entradas, c.ingresos.toFixed(2)]),
    [],
    ['Por día'],
    ['Fecha', 'Reservas confirmadas', 'Entradas', 'Ingresos (USD)'],
    ...diasCompletos(r).map((d) => [d.fecha, d.reservas, d.entradas, d.ingresos.toFixed(2)]),
  ];
  const csv = '﻿' + lineas.map((l) => l.map(celda).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `reporte-ventas-${r.periodo.desde}_${r.periodo.hasta}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Reporte de ventas del operador: ingresos, entradas y reservas por atracción, aeropuerto y día.
 * Datos de GET /reportes/ventas (calculados en la base de datos, no en el navegador).
 */
export default function AdminReportes() {
  const [desde, setDesde] = useState(fechaMasDias(-29));
  const [hasta, setHasta] = useState(fechaMasDias(0));
  const [consulta, setConsulta] = useState({ desde: fechaMasDias(-29), hasta: fechaMasDias(0) });
  const [r, setR] = useState<ReporteVentas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    setCargando(true);
    setError('');
    api
      .reporteVentas(consulta.desde, consulta.hasta)
      .then(setR)
      .catch((e: Error) => setError(e.message))
      .finally(() => setCargando(false));
  }, [consulta]);

  useEffect(cargar, [cargar]);

  const aplicar = (e: FormEvent) => {
    e.preventDefault();
    setConsulta({ desde, hasta });
  };

  const rapido = (dias: number) => {
    const d = fechaMasDias(-(dias - 1));
    const h = fechaMasDias(0);
    setDesde(d);
    setHasta(h);
    setConsulta({ desde: d, hasta: h });
  };

  const dias = useMemo(() => (r ? diasCompletos(r) : []), [r]);
  const maxDia = Math.max(...dias.map((d) => d.ingresos), 0);
  const maxAtraccion = Math.max(...(r?.porAtraccion.map((a) => a.ingresos) ?? [0]), 0);

  return (
    <section aria-labelledby="titulo-reportes" className="reportes">
      <header className="encabezado-pagina">
        <div>
          <h1 id="titulo-reportes">Reportes de ventas</h1>
          <p>Ingresos confirmados, entradas vendidas y cancelaciones del periodo elegido.</p>
        </div>
        <div className="acciones">
          <button type="button" className="btn btn--suave" onClick={() => r && descargarCsv(r)} disabled={!r}>
            Descargar CSV
          </button>
          <button type="button" className="btn btn--suave" onClick={() => window.print()} disabled={!r}>
            <Icono nombre="imprimir" tamano={18} />
            Imprimir
          </button>
        </div>
      </header>

      <form className="filtros-reporte" onSubmit={aplicar} aria-label="Periodo del reporte">
        <div className="chips" role="group" aria-label="Periodos rápidos">
          {RANGOS.map((x) => (
            <button key={x.dias} type="button" className="chip" onClick={() => rapido(x.dias)}>
              {x.texto}
            </button>
          ))}
        </div>
        <label className="campo">
          Desde
          <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} required />
        </label>
        <label className="campo">
          Hasta
          <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} required />
        </label>
        <button className="btn">Ver reporte</button>
      </form>

      {error ? (
        <EstadoError mensaje={error} onReintentar={cargar} />
      ) : (
        <div aria-busy={cargando} className="reporte-cuerpo">
          <p className="sr-only" role="status">
            {cargando ? 'Cargando reporte…' : r ? `Reporte del ${r.periodo.desde} al ${r.periodo.hasta}` : ''}
          </p>

          <section className="resumen-operador" aria-label="Resumen del periodo">
            {r && !cargando
              ? [
                  { v: dinero(r.resumen.ingresos), t: 'ingresos confirmados' },
                  { v: String(r.resumen.entradasVendidas), t: 'entradas vendidas' },
                  { v: String(r.resumen.confirmadas), t: `reservas confirmadas (${r.resumen.canceladas} canceladas)` },
                  { v: dinero(r.resumen.ticketPromedio), t: `ticket promedio, ${r.resumen.clientes} clientes` },
                ].map((k) => (
                  <div key={k.t} className="kpi">
                    <p className="kpi-valor">{k.v}</p>
                    <p className="kpi-texto">{k.t}</p>
                  </div>
                ))
              : Array.from({ length: 4 }, (_, i) => <div key={i} className="kpi fantasma" />)}
          </section>

          {r && !cargando && (
            <>
              <section className="tarjeta reporte-bloque" aria-labelledby="titulo-por-dia">
                <h2 id="titulo-por-dia">Ingresos por día</h2>
                {r.resumen.confirmadas === 0 ? (
                  <p className="nota">No hubo ventas confirmadas en este periodo.</p>
                ) : (
                  <>
                    <div className="columnas-dia" aria-hidden="true">
                      {dias.map((d) => (
                        <div key={d.fecha} className="columna-dia" title={`${d.fecha}: ${dinero(d.ingresos)}`}>
                          <span className="columna-relleno" style={{ height: `${maxDia ? Math.max((d.ingresos / maxDia) * 100, d.ingresos ? 3 : 0) : 0}%` }} />
                        </div>
                      ))}
                    </div>
                    <div className="eje-dia" aria-hidden="true">
                      <span>{fechaCorta(r.periodo.desde)}</span>
                      <span>Máximo diario: {dinero(maxDia)}</span>
                      <span>{fechaCorta(r.periodo.hasta)}</span>
                    </div>
                    <details className="detalle-tabla">
                      <summary>Ver los datos por día en tabla</summary>
                      <div className="tabla-contenedor">
                        <table className="tabla">
                          <caption className="sr-only">Ingresos por día</caption>
                          <thead>
                            <tr>
                              <th scope="col">Fecha</th>
                              <th scope="col" className="num">Reservas</th>
                              <th scope="col" className="num">Entradas</th>
                              <th scope="col" className="num">Ingresos</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dias
                              .filter((d) => d.reservas > 0)
                              .map((d) => (
                                <tr key={d.fecha}>
                                  <td data-etiqueta="Fecha">{d.fecha}</td>
                                  <td data-etiqueta="Reservas" className="num">{d.reservas}</td>
                                  <td data-etiqueta="Entradas" className="num">{d.entradas}</td>
                                  <td data-etiqueta="Ingresos" className="num">{dinero(d.ingresos)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </>
                )}
              </section>

              <div className="reporte-columnas">
                <section className="tarjeta reporte-bloque" aria-labelledby="titulo-por-atraccion">
                  <h2 id="titulo-por-atraccion">Por atracción</h2>
                  {r.porAtraccion.length === 0 ? (
                    <p className="nota">Sin reservas en este periodo.</p>
                  ) : (
                    <ul className="ranking">
                      {r.porAtraccion.map((a) => (
                        <li key={a.id}>
                          <div className="ranking-fila">
                            <span className="ranking-nombre">{a.nombre}</span>
                            <strong>{dinero(a.ingresos)}</strong>
                          </div>
                          <span className="ranking-barra" aria-hidden="true">
                            <span style={{ width: `${maxAtraccion ? (a.ingresos / maxAtraccion) * 100 : 0}%` }} />
                          </span>
                          <span className="nota">
                            {a.entradas} {a.entradas === 1 ? 'entrada' : 'entradas'} en {a.reservas} {a.reservas === 1 ? 'reserva' : 'reservas'}
                            {a.canceladas > 0 && `, ${a.canceladas} cancelada${a.canceladas === 1 ? '' : 's'}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="tarjeta reporte-bloque" aria-labelledby="titulo-por-aeropuerto">
                  <h2 id="titulo-por-aeropuerto">Por aeropuerto</h2>
                  {r.porAeropuerto.length === 0 ? (
                    <p className="nota">Sin reservas en este periodo.</p>
                  ) : (
                    <div className="tabla-contenedor">
                      <table className="tabla">
                        <caption className="sr-only">Ventas por aeropuerto</caption>
                        <thead>
                          <tr>
                            <th scope="col">Aeropuerto</th>
                            <th scope="col" className="num">Entradas</th>
                            <th scope="col" className="num">Ingresos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.porAeropuerto.map((c) => (
                            <tr key={c.ciudadId}>
                              <td data-etiqueta="Aeropuerto">
                                <span className="codigo-iata">{c.iata}</span> {c.nombre}
                              </td>
                              <td data-etiqueta="Entradas" className="num">{c.entradas}</td>
                              <td data-etiqueta="Ingresos" className="num">{dinero(c.ingresos)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>

              <section className="tarjeta reporte-bloque" aria-labelledby="titulo-ultimas">
                <h2 id="titulo-ultimas">Últimas ventas del periodo</h2>
                {r.ultimas.length === 0 ? (
                  <p className="nota">Sin ventas en este periodo.</p>
                ) : (
                  <div className="tabla-contenedor">
                    <table className="tabla">
                      <caption className="sr-only">Las 20 ventas más recientes del periodo</caption>
                      <thead>
                        <tr>
                          <th scope="col">Compra</th>
                          <th scope="col">Cliente</th>
                          <th scope="col">Atracción</th>
                          <th scope="col">Visita</th>
                          <th scope="col" className="num">Entradas</th>
                          <th scope="col" className="num">Total</th>
                          <th scope="col">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.ultimas.map((u) => (
                          <tr key={u.id}>
                            <td data-etiqueta="Compra">{new Date(u.fechaCompra).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })}</td>
                            <td data-etiqueta="Cliente" className="celda-principal">{u.cliente}</td>
                            <td data-etiqueta="Atracción">{u.atraccion}</td>
                            <td data-etiqueta="Visita">
                              {u.fechaVisita}
                              {u.hora ? `, ${u.hora}` : ''}
                            </td>
                            <td data-etiqueta="Entradas" className="num">{u.entradas}</td>
                            <td data-etiqueta="Total" className="num">{dinero(u.total)}</td>
                            <td data-etiqueta="Estado">
                              <EstadoReserva estado={u.estado} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </section>
  );
}
