import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import type { AtraccionInput, ProductType } from '../../types';
import { CIUDADES, TIPOS_PRODUCTO } from '../../ciudades';
import Icono from '../../components/Icono';
import { MensajeError } from '../../components/Estados';

/** Estado del formulario (todo como texto para manejar los inputs fácilmente) */
const VACIO = {
  name: '',
  long_description: '',
  horas: '2',
  precio: '',
  operadorId: '',
  operadorNombre: '',
  product_type: 'GUIDED_TOUR' as ProductType,
  includes: '',
  categories: '',
  badges: '',
  idiomas: 'es',
  free_cancellation: true,
  direccion: '',
  ciudad: '1',
  latitud: '',
  longitud: '',
  fotos: '',
};

/** "a, b, c" -> ["a","b","c"] */
const lista = (texto: string, separador: string | RegExp = ',') =>
  texto.split(separador).map((s) => s.trim()).filter(Boolean);

export default function AtraccionForm() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navigate = useNavigate();
  const [f, setF] = useState(VACIO);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(editando);

  // Si estamos editando, se cargan los datos actuales (GET /atracciones/:id)
  useEffect(() => {
    if (!id) return;
    api
      .obtener(id)
      .then((a) => {
        const u = a.locations[0];
        const horas = /^PT(\d+(?:\.\d+)?)H/.exec(a.duration)?.[1] ?? '';
        setF({
          name: a.name,
          long_description: a.long_description,
          horas,
          precio: String(a.price.total),
          operadorId: String(a.operator.id),
          operadorNombre: a.operator.name,
          product_type: a.product_type,
          includes: a.includes.join(', '),
          categories: a.categories.join(', '),
          badges: a.badges.join(', '),
          idiomas: a.supported_languages.join(', '),
          free_cancellation: a.free_cancellation,
          direccion: u?.address ?? '',
          ciudad: String(u?.city ?? 1),
          latitud: String(u?.coordinates.latitude ?? ''),
          longitud: String(u?.coordinates.longitude ?? ''),
          fotos: a.photos.map((p) => p.url).join('\n'),
        });
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setCargando(false));
  }, [id]);

  const cambiar = (campo: keyof typeof VACIO, valor: string | boolean) => setF((prev) => ({ ...prev, [campo]: valor }));

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setGuardando(true);

    // Se arma el JSON EXACTO del contrato (CreateAtraccionRequest)
    const data: AtraccionInput = {
      name: f.name,
      long_description: f.long_description,
      duration: `PT${f.horas}H`,
      price: { currency: 'USD', total: Number(f.precio) },
      operator: { id: Number(f.operadorId), name: f.operadorNombre },
      product_type: f.product_type,
      includes: lista(f.includes),
      categories: lista(f.categories),
      badges: lista(f.badges),
      locations: [
        {
          address: f.direccion,
          city: Number(f.ciudad),
          country: 'ec',
          coordinates: { latitude: Number(f.latitud), longitude: Number(f.longitud) },
          type: 'attraction',
        },
      ],
      photos: lista(f.fotos, /\n/).map((url) => ({ url })),
      supported_languages: lista(f.idiomas),
      free_cancellation: f.free_cancellation,
    };

    try {
      if (editando && id) await api.reemplazar(id, data); // PUT /atracciones/:id
      else await api.crear(data); // POST /atracciones
      navigate('/admin');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="angosto" aria-labelledby="titulo-form">
      <button type="button" className="btn-texto volver" onClick={() => navigate('/admin')}>
        <Icono nombre="atras" tamano={18} />
        Volver al catálogo
      </button>
      <header className="encabezado-pagina">
        <div>
          <h1 id="titulo-form">{editando ? 'Editar atracción' : 'Nueva atracción'}</h1>
          <p>Los campos se envían tal como pide el contrato de la API.</p>
        </div>
      </header>

      <form onSubmit={guardar} className="formulario tarjeta" aria-busy={cargando}>
        <label className="campo">Nombre
          <input value={f.name} onChange={(e) => cambiar('name', e.target.value)} required minLength={3} />
        </label>
        <label className="campo">Descripción
          <textarea rows={4} value={f.long_description} onChange={(e) => cambiar('long_description', e.target.value)} required minLength={10} />
        </label>

        <div className="fila">
          <label className="campo">Tipo
            <select value={f.product_type} onChange={(e) => cambiar('product_type', e.target.value)}>
              {Object.entries(TIPOS_PRODUCTO).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
            </select>
          </label>
          <label className="campo">Duración (horas)
            <input type="number" min={1} value={f.horas} onChange={(e) => cambiar('horas', e.target.value)} required />
          </label>
          <label className="campo"><span>Precio por persona (USD) <small>0 si es gratis</small></span>
            <input type="number" min={0} step={0.01} value={f.precio} onChange={(e) => cambiar('precio', e.target.value)} required />
          </label>
        </div>

        <fieldset>
          <legend>Operador</legend>
          <div className="fila">
            <label className="campo"><span>Id del operador <small>número</small></span>
              <input type="number" min={1} value={f.operadorId} onChange={(e) => cambiar('operadorId', e.target.value)} required />
            </label>
            <label className="campo">Nombre de la empresa
              <input value={f.operadorNombre} onChange={(e) => cambiar('operadorNombre', e.target.value)} required />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Ubicación</legend>
          <label className="campo">Aeropuerto
            <select value={f.ciudad} onChange={(e) => cambiar('ciudad', e.target.value)}>
              {CIUDADES.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({c.iata})</option>)}
            </select>
          </label>
          <label className="campo">Dirección
            <input value={f.direccion} onChange={(e) => cambiar('direccion', e.target.value)} required />
          </label>
          <div className="fila">
            <label className="campo">Latitud
              <input type="number" step="any" min={-90} max={90} value={f.latitud} onChange={(e) => cambiar('latitud', e.target.value)} required />
            </label>
            <label className="campo">Longitud
              <input type="number" step="any" min={-180} max={180} value={f.longitud} onChange={(e) => cambiar('longitud', e.target.value)} required />
            </label>
          </div>
        </fieldset>

        <label className="campo"><span>Qué incluye <small>separado por comas</small></span>
          <input value={f.includes} onChange={(e) => cambiar('includes', e.target.value)} placeholder="Guía, Transporte" />
        </label>
        <label className="campo"><span>Categorías <small>separadas por comas</small></span>
          <input value={f.categories} onChange={(e) => cambiar('categories', e.target.value)} placeholder="naturaleza, cultura" />
        </label>
        <label className="campo"><span>Insignias <small>opcional, separadas por comas</small></span>
          <input value={f.badges} onChange={(e) => cambiar('badges', e.target.value)} placeholder="best_seller" />
        </label>
        <label className="campo"><span>Idiomas <small>códigos separados por comas, ej.: es, en</small></span>
          <input value={f.idiomas} onChange={(e) => cambiar('idiomas', e.target.value)} placeholder="es, en" />
        </label>
        <label className="campo"><span>Fotos <small>una dirección (URL) por línea</small></span>
          <textarea rows={3} value={f.fotos} onChange={(e) => cambiar('fotos', e.target.value)} />
        </label>
        <label className="campo-check">
          <input type="checkbox" checked={f.free_cancellation} onChange={(e) => cambiar('free_cancellation', e.target.checked)} />
          Permite cancelación gratuita
        </label>

        {error && <MensajeError>{error}</MensajeError>}
        <div className="acciones">
          <button type="button" className="btn btn--suave" onClick={() => navigate('/admin')}>Cancelar</button>
          <button className="btn" disabled={guardando || cargando}>{guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear atracción'}</button>
        </div>
      </form>
    </section>
  );
}