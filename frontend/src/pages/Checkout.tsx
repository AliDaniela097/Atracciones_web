import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { dinero, fechaLarga, useCarrito } from '../carrito';
import Icono from '../components/Icono';
import { MensajeError } from '../components/Estados';

/** Comprobante que se muestra al terminar la compra (se guarda en la sesión del navegador) */
export interface Comprobante {
  numero: string;
  fecha: string;
  titular: string;
  email: string;
  tarjeta: string; // solo los últimos 4 dígitos
  total: number;
  items: { nombre: string; fecha: string; hora?: string; cantidad: number; total: number; codigo: string }[];
  pendientes: number; // líneas que no se pudieron comprar y siguen en el carrito
}

export const LLAVE_COMPROBANTE = 'atracciones.ultimaCompra';

// ---------- Validaciones de la tarjeta (pago de prueba) ----------

/** Algoritmo de Luhn: el mismo que usan los bancos para detectar números de tarjeta mal escritos */
function luhnValido(numero: string) {
  const digitos = numero.replace(/\D/g, '');
  if (digitos.length < 13 || digitos.length > 19) return false;
  let suma = 0;
  for (let i = 0; i < digitos.length; i++) {
    let d = Number(digitos[digitos.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
  }
  return suma % 10 === 0;
}

function vencimientoValido(valor: string) {
  const m = /^(\d{2})\/(\d{2})$/.exec(valor);
  if (!m) return false;
  const mes = Number(m[1]);
  const anio = 2000 + Number(m[2]);
  if (mes < 1 || mes > 12) return false;
  const finDeMes = new Date(anio, mes, 0, 23, 59, 59);
  return finDeMes >= new Date();
}

const formatearTarjeta = (v: string) =>
  v
    .replace(/\D/g, '')
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, '$1 ');

const formatearVencimiento = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Checkout() {
  const { usuario } = useAuth();
  const { lineas, total, quitar, marcarError } = useCarrito();
  const navigate = useNavigate();

  const [titular, setTitular] = useState(usuario?.name ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [numero, setNumero] = useState('');
  const [nombreTarjeta, setNombreTarjeta] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [cvv, setCvv] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [procesando, setProcesando] = useState('');

  if (lineas.length === 0 && !procesando) return <Navigate to="/carrito" replace />;

  const validar = () => {
    const e: Record<string, string> = {};
    if (titular.trim().length < 3) e.titular = 'Escribe el nombre completo de quien usará las entradas.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Escribe un correo válido para enviarte el comprobante.';
    if (!luhnValido(numero)) e.numero = 'El número de tarjeta no es válido. Revisa los dígitos.';
    if (nombreTarjeta.trim().length < 3) e.nombreTarjeta = 'Escribe el nombre como aparece en la tarjeta.';
    if (!vencimientoValido(vencimiento)) e.vencimiento = 'Usa el formato MM/AA y una fecha que no haya pasado.';
    if (!/^\d{3,4}$/.test(cvv)) e.cvv = 'El código de seguridad tiene 3 o 4 dígitos.';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const pagar = async (ev: FormEvent) => {
    ev.preventDefault();
    setErrorGeneral('');
    if (!validar()) return;

    // 1) Pago simulado: no se envía la tarjeta a ningún servidor ni se guarda
    setProcesando('Procesando el pago…');
    await esperar(1200);

    // 2) Una reserva por cada línea del carrito: POST /atracciones/{id}/reservations (contrato)
    const compradas: Comprobante['items'] = [];
    let fallidas = 0;
    for (const [i, l] of lineas.entries()) {
      setProcesando(`Confirmando ${i + 1} de ${lineas.length}: ${l.nombre}…`);
      try {
        const r = await api.reservar(
          l.atraccionId,
          {
            date: l.fecha,
            ticket_count: l.cantidad,
            customer_name: titular.trim(),
            customer_email: email.trim(),
            ...(l.hora ? { time: l.hora } : {}),
          },
          l.claveIdempotencia, // misma clave si se reintenta: no se duplica la reserva
        );
        compradas.push({
          nombre: l.nombre,
          fecha: l.fecha,
          hora: l.hora,
          cantidad: r.ticket_count,
          total: r.total_price.total,
          codigo: r.reservation_id,
        });
        quitar(l.id);
      } catch (err) {
        fallidas++;
        marcarError(l.id, `No se pudo comprar: ${(err as Error).message}`);
      }
    }

    if (compradas.length === 0) {
      setProcesando('');
      setErrorGeneral('No se pudo completar ninguna compra. Revisa los avisos en tu carrito.');
      return;
    }

    const hoy = new Date();
    const comprobante: Comprobante = {
      numero: `ATR-${hoy.toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      fecha: hoy.toISOString(),
      titular: titular.trim(),
      email: email.trim(),
      tarjeta: numero.replace(/\D/g, '').slice(-4),
      total: Number(compradas.reduce((s, x) => s + x.total, 0).toFixed(2)),
      items: compradas,
      pendientes: fallidas,
    };
    try {
      sessionStorage.setItem(LLAVE_COMPROBANTE, JSON.stringify(comprobante));
    } catch {
      /* sin almacenamiento: el comprobante viaja en el estado de la navegación */
    }
    navigate('/compra/confirmada', { state: comprobante, replace: true });
  };

  const campo = (clave: string) => ({
    'aria-invalid': Boolean(errores[clave]) || undefined,
    'aria-describedby': errores[clave] ? `error-${clave}` : undefined,
  });
  const error = (clave: string) =>
    errores[clave] ? (
      <small id={`error-${clave}`} className="campo-error">
        {errores[clave]}
      </small>
    ) : null;

  return (
    <section aria-labelledby="titulo-pago">
      <Link to="/carrito" className="btn-texto volver">
        <Icono nombre="atras" tamano={18} />
        Volver al carrito
      </Link>
      <header className="encabezado-pagina">
        <div>
          <h1 id="titulo-pago">Pago</h1>
          <p>Revisa tus datos y confirma la compra.</p>
        </div>
      </header>

      <div className="compra">
        <form className="formulario tarjeta" onSubmit={pagar} noValidate aria-busy={Boolean(procesando)}>
          <fieldset disabled={Boolean(procesando)}>
            <legend>Datos de quien usará las entradas</legend>
            <label className="campo">
              Nombre completo
              <input value={titular} onChange={(e) => setTitular(e.target.value)} autoComplete="name" {...campo('titular')} />
              {error('titular')}
            </label>
            <label className="campo">
              Correo
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" {...campo('email')} />
              {error('email')}
            </label>
          </fieldset>

          <fieldset disabled={Boolean(procesando)}>
            <legend>Tarjeta</legend>
            <p className="aviso-prueba">
              <Icono nombre="tarjeta" tamano={18} />
              <span>
                <strong>Pago de prueba:</strong> no se cobra dinero y los datos de la tarjeta no se envían ni se guardan. Puedes usar{' '}
                <code>4111 1111 1111 1111</code>, cualquier fecha futura y el código <code>123</code>.
              </span>
            </p>
            <label className="campo">
              Número de tarjeta
              <input
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="0000 0000 0000 0000"
                value={numero}
                onChange={(e) => setNumero(formatearTarjeta(e.target.value))}
                {...campo('numero')}
              />
              {error('numero')}
            </label>
            <label className="campo">
              Nombre en la tarjeta
              <input value={nombreTarjeta} onChange={(e) => setNombreTarjeta(e.target.value)} autoComplete="cc-name" {...campo('nombreTarjeta')} />
              {error('nombreTarjeta')}
            </label>
            <div className="fila">
              <label className="campo">
                Vencimiento
                <input
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="MM/AA"
                  value={vencimiento}
                  onChange={(e) => setVencimiento(formatearVencimiento(e.target.value))}
                  {...campo('vencimiento')}
                />
                {error('vencimiento')}
              </label>
              <label className="campo">
                Código de seguridad
                <input
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  placeholder="123"
                  maxLength={4}
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  {...campo('cvv')}
                />
                {error('cvv')}
              </label>
            </div>
          </fieldset>

          {errorGeneral && <MensajeError>{errorGeneral}</MensajeError>}
          {procesando && (
            <p className="pase-cupos" role="status">
              {procesando}
            </p>
          )}
          <button className="btn btn--bloque" disabled={Boolean(procesando)}>
            <Icono nombre="candado" tamano={18} />
            {procesando ? 'Procesando…' : `Pagar ${dinero(total)}`}
          </button>
        </form>

        <aside className="pase resumen" aria-label="Resumen del pedido">
          <div className="pase-cuerpo">
            <h2>Tu pedido</h2>
            <ul className="resumen-lista">
              {lineas.map((l) => (
                <li key={l.id}>
                  <div>
                    <strong>{l.nombre}</strong>
                    <p className="nota">
                      {fechaLarga(l.fecha)}
                      {l.hora ? `, ${l.hora}` : ''}. {l.cantidad} {l.cantidad === 1 ? 'entrada' : 'entradas'}
                    </p>
                  </div>
                  <span>{dinero(l.cantidad * l.precioUnitario)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="pase-corte" aria-hidden="true" />
          <div className="pase-pie">
            <p className="resumen-total">
              Total
              <strong>{dinero(total)}</strong>
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
