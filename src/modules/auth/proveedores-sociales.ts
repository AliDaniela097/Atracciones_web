import { createPublicKey, createVerify, type JsonWebKey } from 'node:crypto';

/**
 * Verificación de identidades de Google y Facebook SIN dependencias externas.
 *
 * Google (Sign in with Google / Google Identity Services):
 *   el navegador recibe un ID token (JWT firmado con RS256). Aquí se verifica:
 *   firma con las llaves públicas de Google, emisor (iss), audiencia (aud = nuestro Client ID),
 *   vencimiento (exp) y que el correo esté verificado.
 *   Doc: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
 *
 * Facebook (Facebook Login para la Web):
 *   el navegador recibe un access token. Aquí se pregunta a Graph API si el token es válido
 *   y si fue emitido para NUESTRA app (debug_token), y luego se leen nombre y correo (/me).
 *   Doc: https://developers.facebook.com/docs/facebook-login/guides/access-tokens/debugging
 */

export interface IdentidadSocial {
  proveedor: 'google' | 'facebook';
  id: string;
  email: string;
  nombre: string;
}

export class ErrorProveedor extends Error {}

// ------------------------------------------------------------------ Google
const GOOGLE_CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISS = ['accounts.google.com', 'https://accounts.google.com'];
let cacheLlaves: { llaves: (JsonWebKey & { kid?: string })[]; vence: number } | null = null;

async function llavesGoogle(forzar = false) {
  if (!forzar && cacheLlaves && cacheLlaves.vence > Date.now()) return cacheLlaves.llaves;
  const res = await fetch(GOOGLE_CERTS);
  if (!res.ok) throw new ErrorProveedor('No se pudo contactar a Google para verificar el inicio de sesión.');
  const json = (await res.json()) as { keys: (JsonWebKey & { kid?: string })[] };
  // Google indica cuánto tiempo guardar las llaves (Cache-Control: max-age)
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  cacheLlaves = { llaves: json.keys, vence: Date.now() + maxAge * 1000 };
  return json.keys;
}

function base64url(txt: string) {
  return Buffer.from(txt.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export async function verificarGoogle(idToken: string, clientId: string): Promise<IdentidadSocial> {
  const partes = idToken.split('.');
  if (partes.length !== 3) throw new ErrorProveedor('El token de Google no tiene el formato correcto.');
  let cabecera: { alg?: string; kid?: string };
  let datos: Record<string, unknown>;
  try {
    cabecera = JSON.parse(base64url(partes[0]).toString('utf8'));
    datos = JSON.parse(base64url(partes[1]).toString('utf8'));
  } catch {
    throw new ErrorProveedor('El token de Google no se pudo leer.');
  }
  if (cabecera.alg !== 'RS256' || !cabecera.kid) throw new ErrorProveedor('Algoritmo de firma no permitido.');

  let jwk = (await llavesGoogle()).find((k) => k.kid === cabecera.kid);
  if (!jwk) jwk = (await llavesGoogle(true)).find((k) => k.kid === cabecera.kid); // Google rota sus llaves
  if (!jwk) throw new ErrorProveedor('La llave de firma de Google no es válida.');

  const verificador = createVerify('RSA-SHA256');
  verificador.update(`${partes[0]}.${partes[1]}`);
  const firmaOk = verificador.verify(createPublicKey({ key: jwk, format: 'jwk' }), base64url(partes[2]));
  if (!firmaOk) throw new ErrorProveedor('La firma del token de Google no es válida.');

  const ahora = Math.floor(Date.now() / 1000);
  if (!GOOGLE_ISS.includes(String(datos.iss))) throw new ErrorProveedor('El token no fue emitido por Google.');
  if (datos.aud !== clientId) throw new ErrorProveedor('El token de Google no es para esta aplicación.');
  if (typeof datos.exp !== 'number' || datos.exp < ahora - 30) throw new ErrorProveedor('El token de Google ya venció. Intenta de nuevo.');
  if (datos.email_verified !== true || typeof datos.email !== 'string') {
    throw new ErrorProveedor('Tu cuenta de Google no tiene un correo verificado.');
  }
  return {
    proveedor: 'google',
    id: String(datos.sub),
    email: datos.email.toLowerCase(),
    nombre: String(datos.name ?? datos.email).slice(0, 150),
  };
}

// ------------------------------------------------------------------ Facebook
const GRAPH = 'https://graph.facebook.com/v19.0';

export async function verificarFacebook(accessToken: string, appId: string, appSecret: string): Promise<IdentidadSocial> {
  const appToken = `${appId}|${appSecret}`;
  const dbg = await fetch(
    `${GRAPH}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appToken)}`,
  );
  const info = (await dbg.json().catch(() => null)) as { data?: { is_valid?: boolean; app_id?: string; user_id?: string } } | null;
  if (!dbg.ok || !info?.data?.is_valid) throw new ErrorProveedor('El inicio de sesión con Facebook no es válido o ya venció.');
  if (info.data.app_id !== appId) throw new ErrorProveedor('El token de Facebook no es para esta aplicación.');

  const me = await fetch(`${GRAPH}/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`);
  const perfil = (await me.json().catch(() => null)) as { id?: string; name?: string; email?: string } | null;
  if (!me.ok || !perfil?.id || perfil.id !== info.data.user_id) throw new ErrorProveedor('No se pudo leer tu perfil de Facebook.');
  if (!perfil.email) {
    throw new ErrorProveedor('Facebook no compartió tu correo. Acepta el permiso de correo o crea la cuenta con tu email.');
  }
  return { proveedor: 'facebook', id: perfil.id, email: perfil.email.toLowerCase(), nombre: (perfil.name ?? perfil.email).slice(0, 150) };
}
