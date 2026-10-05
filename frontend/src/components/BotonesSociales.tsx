import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import type { ProveedoresSociales, Usuario } from '../types';
import Icono from './Icono';
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
    FB?: {
      init: (o: { appId: string; version: string; cookie?: boolean; xfbml?: boolean }) => void;
      login: (cb: (r: { authResponse?: { accessToken: string } | null; status: string }) => void, o: { scope: string }) => void;
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
 * Botones "Continuar con Google / Facebook".
 * Solo aparecen si el backend tiene configurado cada proveedor (GET /auth/proveedores).
 * El navegador obtiene un token del proveedor y el BACKEND lo verifica antes de crear la sesión.
 */
export default function BotonesSociales({ alEntrar }: { alEntrar: (u: Usuario) => void }) {
  const { conGoogle, conFacebook } = useAuth();
  const [prov, setProv] = useState<ProveedoresSociales | null>(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const cajaGoogle = useRef<HTMLDivElement>(null);
  const alEntrarRef = useRef(alEntrar);
  alEntrarRef.current = alEntrar;

  useEffect(() => {
    cacheProveedores ??= api.proveedores().catch(() => ({ google: null, facebook: null }));
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
          text: 'continue_with',
          locale: 'es',
          width: Math.min(cajaGoogle.current.offsetWidth || 320, 400),
        });
      })
      .catch((e: Error) => vigente && setError(`Google no está disponible ahora (${e.message}).`));
    return () => {
      vigente = false;
    };
  }, [prov, conGoogle]);

  // Facebook SDK: se inicializa cuando hay App ID
  useEffect(() => {
    const appId = prov?.facebook?.appId;
    if (!appId) return;
    cargarScript('https://connect.facebook.net/es_LA/sdk.js')
      .then(() => window.FB?.init({ appId, version: 'v19.0', cookie: false, xfbml: false }))
      .catch((e: Error) => setError(`Facebook no está disponible ahora (${e.message}).`));
  }, [prov]);

  const entrarFacebook = () => {
    setError('');
    if (!window.FB) {
      setError('Facebook todavía no terminó de cargar. Intenta de nuevo en unos segundos.');
      return;
    }
    setOcupado(true);
    window.FB.login(
      (r) => {
        const token = r.authResponse?.accessToken;
        if (!token) {
          setOcupado(false);
          setError('No se completó el ingreso con Facebook.');
          return;
        }
        conFacebook(token)
          .then((u) => alEntrarRef.current(u))
          .catch((e: Error) => {
            setError(e.message);
            setOcupado(false);
          });
      },
      { scope: 'public_profile,email' },
    );
  };

  if (!prov || (!prov.google && !prov.facebook)) return null;

  return (
    <div className="sociales" aria-busy={ocupado}>
      <p className="separador-o">
        <span>o continúa con</span>
      </p>
      {prov.google && <div ref={cajaGoogle} className="boton-google" />}
      {prov.facebook && (
        <button type="button" className="btn btn--bloque btn--facebook" onClick={entrarFacebook} disabled={ocupado}>
          <Icono nombre="facebook" tamano={18} />
          Continuar con Facebook
        </button>
      )}
      {ocupado && (
        <p className="nota" role="status">
          Verificando tu cuenta…
        </p>
      )}
      {error && <MensajeError>{error}</MensajeError>}
      <p className="nota sociales-nota">Al continuar con Google o Facebook se crea una cuenta de cliente con tu nombre y correo.</p>
    </div>
  );
}
