import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, establecerToken, EVENTO_SESION_VENCIDA } from './api';
import type { TokenResponse, Usuario } from './types';

interface Sesion {
  token: string;
  usuario: Usuario;
  vence: number; // milisegundos (Date.now())
}

interface ContextoAuth {
  usuario: Usuario | null;
  esOperador: boolean;
  ingresar: (email: string, clave: string) => Promise<Usuario>;
  registrar: (nombre: string, email: string, clave: string) => Promise<Usuario>;
  conGoogle: (credential: string) => Promise<Usuario>;
  conFacebook: (accessToken: string) => Promise<Usuario>;
  salir: () => void;
}

const AuthContext = createContext<ContextoAuth | null>(null);
const LLAVE = 'atracciones.sesion';

/**
 * La sesión se guarda en sessionStorage: se borra al cerrar la pestaña.
 * Si el navegador no permite guardarla (modo privado), la app sigue funcionando en memoria.
 */
function leerSesion(): Sesion | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(LLAVE) ?? 'null') as Sesion | null;
    return s && s.vence > Date.now() ? s : null;
  } catch {
    return null;
  }
}

function guardarSesion(s: Sesion | null) {
  try {
    if (s) sessionStorage.setItem(LLAVE, JSON.stringify(s));
    else sessionStorage.removeItem(LLAVE);
  } catch {
    /* sin almacenamiento: solo en memoria */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(() => {
    const s = leerSesion();
    establecerToken(s?.token ?? null);
    return s;
  });

  const aplicar = useCallback((s: Sesion | null) => {
    establecerToken(s?.token ?? null);
    guardarSesion(s);
    setSesion(s);
  }, []);

  const desdeToken = useCallback(
    (r: TokenResponse) => {
      aplicar({ token: r.access_token, usuario: r.user, vence: Date.now() + r.expires_in * 1000 });
      return r.user;
    },
    [aplicar],
  );

  const salir = useCallback(() => aplicar(null), [aplicar]);

  // Si el backend responde 401 (token vencido), se cierra la sesión
  useEffect(() => {
    window.addEventListener(EVENTO_SESION_VENCIDA, salir);
    return () => window.removeEventListener(EVENTO_SESION_VENCIDA, salir);
  }, [salir]);

  // Cierra la sesión cuando vence el token
  useEffect(() => {
    if (!sesion) return;
    const t = setTimeout(salir, Math.max(sesion.vence - Date.now(), 0));
    return () => clearTimeout(t);
  }, [sesion, salir]);

  const valor = useMemo<ContextoAuth>(
    () => ({
      usuario: sesion?.usuario ?? null,
      esOperador: sesion?.usuario.role === 'OPERADOR',
      ingresar: async (email, clave) => desdeToken(await api.login(email, clave)),
      registrar: async (nombre, email, clave) => desdeToken(await api.registro(nombre, email, clave)),
      conGoogle: async (credential) => desdeToken(await api.conGoogle(credential)),
      conFacebook: async (accessToken) => desdeToken(await api.conFacebook(accessToken)),
      salir,
    }),
    [sesion, desdeToken, salir],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

/** Protege una página: sin sesión manda a "Ingresar"; si pide operador y no lo es, muestra acceso denegado */
export function RutaProtegida({ children, soloOperador = false }: { children: ReactNode; soloOperador?: boolean }) {
  const { usuario, esOperador } = useAuth();
  const location = useLocation();

  if (!usuario) {
    const volver = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/ingresar?volver=${volver}`} replace />;
  }
  if (soloOperador && !esOperador) {
    return <Navigate to="/acceso-denegado" replace />;
  }
  return <>{children}</>;
}
