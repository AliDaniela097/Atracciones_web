import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useCarrito } from '../carrito';
import BuscadorDestino from './BuscadorDestino';
import Icono, { type NombreIcono } from './Icono';

interface Seccion {
  ruta: string;
  texto: string;
  icono: NombreIcono;
  exacta?: boolean;
  /** Página HTML independiente (fuera de React): se abre con recarga completa */
  externa?: boolean;
}

/** Logotipo: un sol dorado cruzado por la línea ecuatorial (Ecuador = latitud 0) */
function Marca({ destino, conNombre = false }: { destino: string; conNombre?: boolean }) {
  return (
    <NavLink to={destino} end className={conNombre ? 'marca marca--nombre' : 'marca'} aria-label="Atracciones Ecuador, inicio">
      <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
        <circle cx="16" cy="16" r="11" fill="none" stroke="var(--oro)" strokeWidth="1.6" />
        <circle cx="16" cy="16" r="5.5" fill="var(--oro)" />
        <path d="M1 16h30" stroke="var(--oro)" strokeWidth="1.6" />
      </svg>
      {conNombre && (
        <span className="marca-texto">
          Atracciones <span>Ecuador</span>
        </span>
      )}
    </NavLink>
  );
}

function Navegacion({ secciones, clase, etiqueta }: { secciones: Seccion[]; clase: string; etiqueta: string }) {
  return (
    <nav className={clase} aria-label={etiqueta}>
      {secciones.map((s) =>
        s.externa ? (
          <a key={s.ruta} href={s.ruta} className="nav-item">
            <Icono nombre={s.icono} tamano={22} />
            <span>{s.texto}</span>
          </a>
        ) : (
          <NavLink key={s.ruta} to={s.ruta} end={s.exacta} className="nav-item">
            <Icono nombre={s.icono} tamano={22} />
            <span>{s.texto}</span>
          </NavLink>
        ),
      )}
    </nav>
  );
}

/** Botón del carrito con la cantidad de entradas */
function BotonCarrito() {
  const { cantidadTotal } = useCarrito();
  const { esOperador } = useAuth();
  if (esOperador) return null; // el operador no compra
  return (
    <NavLink
      to="/carrito"
      className="carrito-boton"
      aria-label={cantidadTotal ? `Carrito, ${cantidadTotal} ${cantidadTotal === 1 ? 'entrada' : 'entradas'}` : 'Carrito vacío'}
    >
      <Icono nombre="carrito" tamano={22} />
      {cantidadTotal > 0 && (
        <span className="carrito-contador" aria-hidden="true">
          {cantidadTotal > 99 ? '99+' : cantidadTotal}
        </span>
      )}
    </NavLink>
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
        {!esOperador && (
          <Link to="/mis-reservas" className="btn-texto">
            <Icono nombre="ticket" tamano={18} />
            Mis reservas
          </Link>
        )}
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
  const { esOperador } = useAuth();
  // El operador puede mirar el sitio público, pero sin la sección de compras
  const secciones = esOperador ? SECCIONES_CLIENTE.filter((s) => s.ruta !== '/mis-reservas') : SECCIONES_CLIENTE;
  return (
    <div className="app app--cliente">
      <a href="#contenido" className="saltar">
        Saltar al contenido
      </a>

      <div className="app-cuerpo">
        <header className="superior superior--cliente">
          <Marca destino="/" conNombre />
          <nav className="nav-superior" aria-label="Navegación principal">
            {secciones.map((s) => (
              <NavLink key={s.ruta} to={s.ruta} end={s.exacta}>
                {s.texto}
              </NavLink>
            ))}
          </nav>
          <BuscadorDestino />
          <BotonCarrito />
          <MenuCuenta />
        </header>
        {esOperador && (
          <p className="aviso-operador" role="note">
            Estás viendo el sitio como operador: puedes revisar el catálogo, pero las compras son solo para clientes.{' '}
            <Link to="/admin">Volver al panel</Link>
          </p>
        )}
        <main id="contenido" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="pie">
          <p>
            Atracciones Ecuador: entradas y tours cerca de los aeropuertos con vuelos comerciales del país. Proyecto
            académico, Integración de Sistemas (PUCE).
          </p>
          <p>
            Fotografías de{' '}
            <a href="https://commons.wikimedia.org" target="_blank" rel="noreferrer">
              Wikimedia Commons
            </a>{' '}
            con licencias libres (CC0, CC BY y CC BY-SA); autores y licencias de cada foto en el archivo CREDITOS_Y_FUENTES.md
            del repositorio.
          </p>
        </footer>
      </div>

      <Navegacion secciones={secciones} clase="nav-inferior" etiqueta="Navegación principal" />
    </div>
  );
}

const SECCIONES_OPERADOR: Seccion[] = [
  { ruta: '/admin', texto: 'Atracciones', icono: 'panel', exacta: true },
  { ruta: '/admin/reservas', texto: 'Reservas', icono: 'historial' },
  { ruta: '/admin/reportes', texto: 'Reportes', icono: 'reporte' },
  { ruta: '/admin/verificar', texto: 'Verificar', icono: 'qr' },
  { ruta: '/admin/observabilidad.html', texto: 'Observa­bilidad', icono: 'pulso', externa: true },
  { ruta: '/', texto: 'Ver sitio', icono: 'sitio', exacta: true },
];

/** Solo el administrador principal ve la sección para crear y eliminar administradores */
const SECCION_ADMINISTRADORES: Seccion = { ruta: '/admin/administradores', texto: 'Admins', icono: 'usuario' };

/** Vista del operador: administra el catálogo y ve todas las reservas */
export function LayoutOperador() {
  const { usuario, esPrincipal, salir } = useAuth();
  const navigate = useNavigate();
  const secciones = esPrincipal
    ? [...SECCIONES_OPERADOR.slice(0, 4), SECCION_ADMINISTRADORES, ...SECCIONES_OPERADOR.slice(4)]
    : SECCIONES_OPERADOR;

  return (
    <div className="app app--operador">
      <a href="#contenido" className="saltar">
        Saltar al contenido
      </a>
      <aside className="lateral">
        <Marca destino="/admin" />
        <Navegacion secciones={secciones} clase="nav-lateral" etiqueta="Panel del operador" />
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

      <Navegacion secciones={secciones} clase="nav-inferior" etiqueta="Panel del operador" />
    </div>
  );
}
