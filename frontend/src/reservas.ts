/**
 * Utilidades del código de reserva.
 * El código completo es un UUID (difícil de adivinar). Para mostrarlo se usa un código corto:
 * los primeros 8 caracteres en mayúsculas, en dos grupos (ej. 75E3-667B).
 */
export function codigoCorto(id: string) {
  const limpio = id.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `${limpio.slice(0, 4)}-${limpio.slice(4)}`;
}

/** Lo que guarda el QR: el enlace para que el operador verifique la entrada */
export function urlVerificacion(id: string) {
  return `${window.location.origin}/admin/verificar/${id}`;
}
