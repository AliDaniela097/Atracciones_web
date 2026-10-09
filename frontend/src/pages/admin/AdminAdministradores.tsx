import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../auth';
import type { Administrador } from '../../types';
import { EstadoError, EstadoVacio, MensajeError } from '../../components/Estados';

const DOMINIO = 'atracciones.ec';

/** Quita tildes y deja solo a-z y 0-9 (igual que el servidor): "Ñandú" -> "nandu" */
function aCorreoSeguro(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Vista previa del correo: primer nombre + primer apellido. Si ya existe, el servidor agrega un número. */
function correoPrevisto(nombres: string, apellidos: string) {
  const n = aCorreoSeguro(nombres.trim().split(/\s+/)[0] ?? '');
  const a = aCorreoSeguro(apellidos.trim().split(/\s+/)[0] ?? '');
  return n && a ? `${n}.${a}@${DOMINIO}` : '';
}

function fechaTexto(iso: string) {
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Solo el administrador principal: crear y eliminar cuentas de administrador */
export default function AdminAdministradores() {
  const { esPrincipal } = useAuth();
  const [lista, setLista] = useState<Administrador[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [clave, setClave] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [creado, setCreado] = useState<Administrador | null>(null);
  // Al cambiar esta llave el formulario se vuelve a montar limpio (sin los bordes rojos de "campo vacío")
  const [formKey, setFormKey] = useState(0);

  const cargar = useCallback(() => {
    setCargando(true);
    setErrorCarga('');
    api
      .listarAdministradores()
      .then(setLista)
      .catch((e: Error) => setErrorCarga(e.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    if (esPrincipal) cargar();
  }, [esPrincipal, cargar]);

  const previsto = useMemo(() => correoPrevisto(nombres, apellidos), [nombres, apellidos]);

  if (!esPrincipal) {
    return (
      <EstadoVacio titulo="Solo el administrador principal puede gestionar administradores">
        <p>Tu cuenta es de administrador, pero crear y eliminar administradores es exclusivo de la cuenta principal.</p>
        <Link to="/admin" className="btn">
          Volver al panel
        </Link>
      </EstadoVacio>
    );
  }

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setCreado(null);
    setEnviando(true);
    try {
      const nuevo = await api.crearAdministrador(nombres.trim(), apellidos.trim(), clave);
      setCreado(nuevo);
      setNombres('');
      setApellidos('');
      setClave('');
      setFormKey((k) => k + 1);
      cargar();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const eliminar = async (a: Administrador) => {
    if (!window.confirm(`¿Eliminar a ${a.name} (${a.email})? Perderá el acceso de inmediato.`)) return;
    setError('');
    setCreado(null);
    try {
      await api.eliminarAdministrador(a.id);
      cargar();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section aria-labelledby="titulo-administradores">
      <header className="encabezado-pagina">
        <div>
          <h1 id="titulo-administradores">Administradores</h1>
          <p>Crea cuentas para otros administradores. Su correo se arma solo con el nombre y el apellido.</p>
        </div>
      </header>

      <div className="tarjeta">
        <h2>Nuevo administrador</h2>
        <form key={formKey} onSubmit={crear} className="formulario">
          <div className="fila">
            <label className="campo">
              Nombres
              <input
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                autoComplete="off"
                required
                minLength={2}
                maxLength={60}
              />
            </label>
            <label className="campo">
              Apellidos
              <input
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                autoComplete="off"
                required
                minLength={2}
                maxLength={60}
              />
            </label>
            <label className="campo">
              <span>
                Contraseña inicial <small>mínimo 8 caracteres</small>
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
          </div>

          <p className="nota" aria-live="polite">
            Correo de ingreso:{' '}
            <strong>{previsto || `nombre.apellido@${DOMINIO}`}</strong>
            {previsto && ' (si ya existe, se agrega un número al final)'}
          </p>

          {error && <MensajeError>{error}</MensajeError>}
          {creado && (
            <p className="aviso-ok" role="status">
              Administrador creado. Correo para ingresar: <strong>{creado.email}</strong>. Entrégale la contraseña que definiste.
            </p>
          )}

          <div>
            <button className="btn" disabled={enviando}>
              {enviando ? 'Creando…' : 'Crear administrador'}
            </button>
          </div>
        </form>
      </div>

      <h2 style={{ marginTop: 28 }}>Cuentas de administrador</h2>
      {errorCarga ? (
        <EstadoError mensaje={errorCarga} onReintentar={cargar} />
      ) : (
        <div className="tabla-contenedor">
          <table className="tabla" aria-busy={cargando}>
            <caption className="sr-only">Administradores</caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Correo</th>
                <th scope="col">Creado</th>
                <th scope="col">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cargando && lista.length === 0 && (
                <tr aria-hidden="true">
                  <td colSpan={4}>
                    <div className="fantasma fantasma--linea" style={{ margin: 0 }} />
                  </td>
                </tr>
              )}
              {lista.map((a) => (
                <tr key={a.id}>
                  <td data-etiqueta="Nombre">
                    {a.name}
                    {a.principal && <small> · principal</small>}
                  </td>
                  <td data-etiqueta="Correo">{a.email}</td>
                  <td data-etiqueta="Creado">{fechaTexto(a.created_at)}</td>
                  <td className="sin-etiqueta">
                    {!a.principal && (
                      <div className="acciones" style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn-texto btn-texto--peligro"
                          onClick={() => eliminar(a)}
                          aria-label={`Eliminar al administrador ${a.name}`}
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
