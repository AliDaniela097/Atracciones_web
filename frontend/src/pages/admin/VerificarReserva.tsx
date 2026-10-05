import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, fechaMasDias } from '../../api';
import type { VerificacionReserva } from '../../types';
import { dinero, fechaLarga } from '../../carrito';
import { nombreCiudad } from '../../ciudades';
import { codigoCorto } from '../../reservas';
import Icono from '../../components/Icono';
import { MensajeError } from '../../components/Estados';

/** Resultado de la verificación en palabras claras (nunca solo color) */
function veredicto(r: VerificacionReserva) {
  const hoy = fechaMasDias(0);
  if (r.estado === 'CANCELLED') return { clase: 'veredicto--no', titulo: 'Reserva cancelada', texto: 'No permitir el ingreso.' };
  if (r.estado !== 'CONFIRMED') return { clase: 'veredicto--aviso', titulo: 'Reserva pendiente', texto: 'El pago aún no está confirmado.' };
  if (r.vencida) return { clase: 'veredicto--no', titulo: 'Fecha vencida', texto: `La visita era el ${fechaLarga(r.fechaVisita)}.` };
  if (r.fechaVisita !== hoy) return { clase: 'veredicto--aviso', titulo: 'Válida para otro día', texto: `La visita es el ${fechaLarga(r.fechaVisita)}, no hoy.` };
  return { clase: 'veredicto--si', titulo: 'Entrada válida', texto: 'Puede ingresar hoy.' };
}

/**
 * Verificación de entradas para el operador. Se abre al escanear el QR del comprobante
 * (/admin/verificar/{código}) o escribiendo el código corto a mano.
 */
export default function VerificarReserva() {
  const { codigo = '' } = useParams();
  const navigate = useNavigate();
  const [texto, setTexto] = useState(codigo ? codigoCorto(codigo) : '');
  const [r, setR] = useState<VerificacionReserva | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!codigo) {
      setR(null);
      setError('');
      return;
    }
    let vigente = true;
    setCargando(true);
    setError('');
    setR(null);
    api
      .verificarReserva(codigo)
      .then((v) => vigente && setR(v))
      .catch((e: Error) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [codigo]);

  const buscar = (e: FormEvent) => {
    e.preventDefault();
    const limpio = texto.trim();
    if (limpio) navigate(`/admin/verificar/${encodeURIComponent(limpio)}`);
  };

  const v = r ? veredicto(r) : null;

  return (
    <section aria-labelledby="titulo-verificar" className="verificar">
      <header className="encabezado-pagina">
        <div>
          <h1 id="titulo-verificar">Verificar entrada</h1>
          <p>Escanea el QR del comprobante con la cámara del celular o escribe el código de reserva.</p>
        </div>
      </header>

      <form className="fila-busqueda" onSubmit={buscar} role="search" aria-label="Buscar reserva por código">
        <label className="sr-only" htmlFor="codigo-verificar">
          Código de reserva
        </label>
        <input
          id="codigo-verificar"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ej. 75E3-667B"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
        />
        <button className="btn" disabled={cargando}>
          {cargando ? 'Buscando…' : 'Verificar'}
        </button>
      </form>

      <div aria-live="polite">
        {error && <MensajeError>{error}</MensajeError>}

        {r && v && (
          <article className={`tarjeta veredicto ${v.clase}`} aria-labelledby="titulo-veredicto">
            <div className="veredicto-cabecera">
              <Icono nombre={v.clase === 'veredicto--si' ? 'check' : 'ticket'} tamano={28} />
              <div>
                <h2 id="titulo-veredicto">{v.titulo}</h2>
                <p>{v.texto}</p>
              </div>
            </div>
            <dl className="pase-datos veredicto-datos">
              <div>
                <dt>Código</dt>
                <dd>{codigoCorto(r.id)}</dd>
              </div>
              <div>
                <dt>Titular</dt>
                <dd>{r.cliente}</dd>
              </div>
              <div>
                <dt>Atracción</dt>
                <dd>{r.atraccion}</dd>
              </div>
              <div>
                <dt>Aeropuerto</dt>
                <dd>{r.ciudadId ? nombreCiudad(r.ciudadId) : 'Sin ciudad'}</dd>
              </div>
              <div>
                <dt>Visita</dt>
                <dd>
                  {fechaLarga(r.fechaVisita)}
                  {r.hora ? `, ${r.hora}` : ''}
                </dd>
              </div>
              <div>
                <dt>Entradas</dt>
                <dd>{r.entradas}</dd>
              </div>
              <div>
                <dt>Pagado</dt>
                <dd>{dinero(r.total)}</dd>
              </div>
              {r.motivoCancelacion && (
                <div>
                  <dt>Motivo de cancelación</dt>
                  <dd>{r.motivoCancelacion}</dd>
                </div>
              )}
            </dl>
          </article>
        )}
      </div>
    </section>
  );
}
