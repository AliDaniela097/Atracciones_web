import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import BuscadorDestino from './BuscadorDestino';
import Icono, { type NombreIcono } from './Icono';

interface Seccion {
  ruta: string;
  texto: string;
  icono: NombreIcono;
  exacta?: boolean;
}

function Marca({ destino }: { destino: string }) {
  return (
    <NavLink to={destino} className="marca" aria-label="Atracciones Ecuador, inicio">
      <svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true">
        <rect width="32" height="32" rx="10" fill="var(--acento)" />
        <path d="M6 23 13.5 11l4 6 2.5-3.5L26 23H6Z" fill="#fff" />
        <circle cx="22.5" cy="9.5" r="2.5" fill="var(--oro)" />
      </svg>
    </NavLink>
  );
}

function Navegacion({ secciones, clase, etiqueta }: { secciones: Seccion[]; clase: string; etiqueta: string }) {
  return (
    <nav className={clase} aria-label={etiqueta}>
      {secciones.map((s) => (
        <NavLink key={s.ruta} to={s.ruta} end={s.exacta} className="nav-item">
          <Icono nombre={s.icono} tamano={22} />
          <span>{s.texto}</span>
        </NavLink>
      ))}
    </nav>
  );
}

/** Botones de cuenta de la barra superior */
function MenuCuenta() {
  const { usuario, esOperador, salir } = useAuth();
  const navigate = useNavigate();

  if (!usuario) {
    return (
      <div className="cuenta">
        <Link to="/ingresar" className="btn btn--suave">
          Ingresar
        </Link>
        <Link to="/registro" className="btn cuenta-registro">
          Crear cuenta
        </Link>
      </div>
    );
  }

  return (
    <details className="cuenta-menu">
      <summary aria-label={`Cuenta de ${usuario.name}`}>
        <span className="avatar" aria-hidden="true">
          {usuario.name.charAt(0).toUpperCase()}
        </span>
        <span className="cuenta-nombre">{usuario.name.split(' ')[0]}</span>
      </summary>
      <div className="cuenta-opciones">
        <p className="cuenta-correo">{usuario.email}</p>
        {esOperador && (
          <Link to="/admin" className="btn-texto">
            <Icono nombre="panel" tamano={18} />
            Panel del operador
          </Link>
        )}
        <Link to="/mis-reservas" className="btn-texto">
          <Icono nombre="ticket" tamano={18} />
          Mis reservas
        </Link>
        <button
          type="button"
          className="btn-texto btn-texto--peligro"
          onClick={() => {
            salir();
            navigate('/');
          }}
        >
          <Icono nombre="salir" tamano={18} />
          Cerrar sesión
        </button>
      </div>
    </details>
  );
}

const SECCIONES_CLIENTE: Seccion[] = [
  { ruta: '/', texto: 'Inicio', icono: 'inicio', exacta: true },
  { ruta: '/explorar', texto: 'Explorar', icono: 'explorar' },
  { ruta: '/mis-reservas', texto: 'Mis reservas', icono: 'ticket' },
];

/** Vista del turista: catálogo público, reserva con cuenta de cliente */
export function LayoutCliente() {
  return (
    <div className="app">
      <a href="#contenido" className="saltar">
        Saltar al contenido
      </a>
      <aside className="lateral">
        <Marca destino="/" />
        <Navegacion secciones={SECCIONES_CLIENTE} clase="nav-lateral" etiqueta="Navegación principal" />
      </aside>

      <div className="app-cuerpo">
        <header className="superior">
          <BuscadorDestino />
          <MenuCuenta />
        </header>
        <main id="contenido" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <Navegacion secciones={SECCIONES_CLIENTE} clase="nav-inferior" etiqueta="Navegación principal" />
    </div>
  );
}

const SECCIONES_OPERADOR: Seccion[] = [
  { ruta: '/admin', texto: 'Atracciones', icono: 'panel', exacta: true },
  { ruta: '/admin/reservas', texto: 'Reservas', icono: 'historial' },
  { ruta: '/', texto: 'Ver sitio', icono: 'sitio', exacta: true },
];

/** Vista del operador: administra el catálogo y ve todas las reservas */
export function LayoutOperador() {
  const { usuario, salir } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app app--operador">
      <a href="#contenido" className="saltar">
        Saltar al contenido
      </a>
      <aside className="lateral">
        <Marca destino="/admin" />
        <Navegacion secciones={SECCIONES_OPERADOR} clase="nav-lateral" etiqueta="Panel del operador" />
      </aside>

      <div className="app-cuerpo">
        <header className="superior superior--operador">
          <p className="superior-titulo">Panel del operador</p>
          <div className="cuenta">
            <span className="cuenta-nombre">
              <Icono nombre="usuario" tamano={18} />
              {usuario?.name}
            </span>
            <button
              type="button"
              className="btn btn--suave"
              onClick={() => {
                salir();
                navigate('/');
              }}
            >
              <Icono nombre="salir" tamano={18} />
              Salir
            </button>
          </div>
        </header>
        <main id="contenido" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <Navegacion secciones={SECCIONES_OPERADOR} clase="nav-inferior" etiqueta="Panel del operador" />
    </div>
  );
}
