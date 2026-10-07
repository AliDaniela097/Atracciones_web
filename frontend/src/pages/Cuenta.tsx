import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { MensajeError } from '../components/Estados';
import BotonesSociales from '../components/BotonesSociales';

/** A dónde volver después de ingresar (solo rutas internas, para evitar redirecciones a otros sitios) */
function useDestino(porDefecto: string) {
  const [params] = useSearchParams();
  const volver = params.get('volver') ?? '';
  return volver.startsWith('/') && !volver.startsWith('//') ? volver : porDefecto;
}

export function Ingresar() {
  const { usuario, ingresar } = useAuth();
  const navigate = useNavigate();
  const destino = useDestino('');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to={destino || (usuario.role === 'OPERADOR' ? '/admin' : '/')} replace />;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const u = await ingresar(email, clave);
      // El operador va a su panel; el cliente vuelve a donde estaba
      navigate(destino || (u.role === 'OPERADOR' ? '/admin' : '/'), { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
    }
  };

  return (
    <section className="acceso" aria-labelledby="titulo-ingresar">
      <div className="tarjeta acceso-tarjeta">
        <h1 id="titulo-ingresar">Ingresar</h1>
        <p className="nota">Usa tu cuenta para reservar y ver tus reservas.</p>
        <BotonesSociales modo="ingresar" alEntrar={(u) => navigate(destino || (u.role === 'OPERADOR' ? '/admin' : '/'), { replace: true })} />
        <form onSubmit={enviar} className="formulario">
          <label className="campo">
            Correo
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label className="campo">
            Contraseña
            <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" required />
          </label>
          {error && <MensajeError>{error}</MensajeError>}
          <button className="btn btn--bloque" disabled={enviando}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
        <p className="acceso-pie">
          ¿No tienes cuenta?{' '}
          <Link to={`/registro${destino ? `?volver=${encodeURIComponent(destino)}` : ''}`}>Crea una gratis</Link>
        </p>
      </div>
    </section>
  );
}

export function Registro() {
  const { usuario, registrar } = useAuth();
  const navigate = useNavigate();
  const destino = useDestino('/');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to={destino} replace />;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await registrar(nombre.trim(), email, clave);
      navigate(destino, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
    }
  };

  return (
    <section className="acceso" aria-labelledby="titulo-registro">
      <div className="tarjeta acceso-tarjeta">
        <h1 id="titulo-registro">Crear cuenta</h1>
        <p className="nota">Con tu cuenta reservas entradas y tours, y las consultas cuando quieras.</p>
        <BotonesSociales modo="registro" alEntrar={() => navigate(destino, { replace: true })} />
        <form onSubmit={enviar} className="formulario">
          <label className="campo">
            Nombre completo
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" required minLength={3} maxLength={150} />
          </label>
          <label className="campo">
            Correo
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label className="campo">
            <span>
              Contraseña <small>mínimo 8 caracteres</small>
            </span>
            <input
              type="password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
            />
          </label>
          {error && <MensajeError>{error}</MensajeError>}
          <button className="btn btn--bloque" disabled={enviando}>
            {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>
        <p className="acceso-pie">
          ¿Ya tienes cuenta? <Link to={`/ingresar${destino !== '/' ? `?volver=${encodeURIComponent(destino)}` : ''}`}>Ingresa</Link>
        </p>
      </div>
    </section>
  );
}
