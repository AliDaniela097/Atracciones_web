import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import type { ProveedoresSociales, Usuario } from '../types';
import { MensajeError } from './Estados';

/* Tipos mínimos de los SDK oficiales que se cargan en el navegador */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void;
          renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const cargados = new Map<string, Promise<void>>();

/** Carga un script externo una sola vez */
function cargarScript(src: string) {
  if (!cargados.has(src)) {
    cargados.set(
      src,
      new Promise<void>((ok, falla) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.defer = true;
        s.onload = () => ok();
        s.onerror = () => {
          cargados.delete(src);
          falla(new Error(`No se pudo cargar ${new URL(src).hostname}`));
        };
        document.head.appendChild(s);
      }),
    );
  }
  return cargados.get(src)!;
}

let cacheProveedores: Promise<ProveedoresSociales> | null = null;

/**
 * Botón "Regístrate / Continúa con Google".
 * Usa el Client ID que entrega el backend (GET /auth/proveedores).
 * El navegador obtiene un ID token de Google y el BACKEND lo verifica antes de crear la sesión.
 */
export default function BotonesSociales({
  alEntrar,
  modo = 'ingresar',
}: {
  alEntrar: (u: Usuario) => void;
  /** Cambia los textos: "Regístrate con…" o "Ingresa con…" */
  modo?: 'ingresar' | 'registro';
}) {
  const { conGoogle } = useAuth();
  const [prov, setProv] = useState<ProveedoresSociales | null>(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const cajaGoogle = useRef<HTMLDivElement>(null);
  const alEntrarRef = useRef(alEntrar);
  alEntrarRef.current = alEntrar;

  useEffect(() => {
    cacheProveedores ??= api.proveedores().catch(() => ({ google: null }));
    let vigente = true;
    cacheProveedores.then((p) => vigente && setProv(p));
    return () => {
      vigente = false;
    };
  }, []);

  // Google Identity Services: dibuja el botón oficial de Google
  useEffect(() => {
    const clientId = prov?.google?.clientId;
    if (!clientId) return;
    let vigente = true;
    cargarScript('https://accounts.google.com/gsi/client')
      .then(() => {
        if (!vigente || !window.google || !cajaGoogle.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async ({ credential }) => {
            setError('');
            setOcupado(true);
            try {
              alEntrarRef.current(await conGoogle(credential));
            } catch (e) {
              setError((e as Error).message);
              setOcupado(false);
            }
          },
        });
        window.google.accounts.id.renderButton(cajaGoogle.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: modo === 'registro' ? 'signup_with' : 'continue_with',
          locale: 'es',
          width: Math.min(cajaGoogle.current.offsetWidth || 320, 400),
        });
      })
      .catch((e: Error) => vigente && setError(`Google no está disponible ahora (${e.message}).`));
    return () => {
      vigente = false;
    };
  }, [prov, conGoogle, modo]);

  const verbo = modo === 'registro' ? 'Regístrate' : 'Continúa';

  /** Si el proveedor no está configurado en el servidor, se explica en vez de no hacer nada */
  const noDisponible = () => {
    setError(
      `El ingreso con Google todavía no está activado en este sitio. Por ahora ${
        modo === 'registro' ? 'crea tu cuenta' : 'ingresa'
      } con tu correo y contraseña.`,
    );
  };

  return (
    <div className="sociales" aria-busy={ocupado}>
      <div className="sociales-botones">
        {prov?.google ? (
          // Botón oficial: lo dibuja Google con su propio logo
          <div ref={cajaGoogle} className="boton-google" />
        ) : (
          <button
            type="button"
            className="btn btn--suave btn--bloque btn--social"
            onClick={noDisponible}
            disabled={!prov}
            aria-describedby="nota-sociales"
          >
            {verbo} con Google
          </button>
        )}
      </div>
      {ocupado && (
        <p className="nota" role="status">
          Verificando tu cuenta…
        </p>
      )}
      {error && <MensajeError>{error}</MensajeError>}
      <p className="nota sociales-nota" id="nota-sociales">
        Con Google se crea una cuenta de cliente con tu nombre y correo, sin contraseña nueva.
      </p>
      <p className="separador-o">
        <span>o con tu correo</span>
      </p>
    </div>
  );
}
