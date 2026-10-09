/**
 * Fotos más livianas.
 *
 * Las fotos del catálogo vienen de Wikimedia Commons en tamaño 1280 px (unos 280 KB cada una),
 * pero las tarjetas las muestran en unos 300 px de ancho. Wikimedia entrega la misma foto en
 * otros tamaños cambiando el número del nombre ("1280px-Foto.jpg" -> "500px-Foto.jpg"),
 * así que cada pantalla pide solo el tamaño que necesita.
 *
 * Tamaños que acepta Wikimedia: 330, 500, 960 y 1280 (otros, como 640, dan error 400).
 * Si la URL no es de Wikimedia, o no tiene ese formato, se deja tal cual.
 */
export type AnchoFoto = 330 | 500 | 960 | 1280;

/** Anchos por uso: miniaturas (carrito, administración), tarjetas, y fotos grandes (portada, detalle) */
export const ANCHO = { miniatura: 330, tarjeta: 500, grande: 960 } as const satisfies Record<string, AnchoFoto>;

export function fotoUrl(url: string, ancho: AnchoFoto): string {
  try {
    if (new URL(url).host !== 'thumb.wikimedia.org') return url;
  } catch {
    return url;
  }
  return url.replace(/\/\d+px-([^/]+)$/, `/${ancho}px-$1`);
}
