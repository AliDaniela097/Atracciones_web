/**
 * Iconos SVG propios (sin librerías externas).
 * Son decorativos: el texto o el aria-label del botón/enlace es el que explica la acción.
 */
const TRAZOS = {
  inicio: 'M4 11.5 12 5l8 6.5V20h-5v-5h-6v5H4v-8.5Z',
  explorar: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm3.5 5.5-2 5-5 2 2-5 5-2Z',
  ticket: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V7Zm10-2v14',
  panel: 'M4 4h7v7H4V4Zm9 0h7v4h-7V4Zm0 6h7v10h-7V10ZM4 13h7v7H4v-7Z',
  historial: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4m4-1v5l3 2',
  buscar: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4',
  pin: 'M12 21s-6-5.6-6-11a6 6 0 1 1 12 0c0 5.4-6 11-6 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  reloj: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2',
  estrella: 'm12 4 2.4 5 5.6.6-4.2 3.8 1.2 5.5L12 16.2 7 18.9l1.2-5.5L4 9.6 9.6 9 12 4Z',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  mas: 'M12 5v14M5 12h14',
  atras: 'M15 5l-7 7 7 7',
  copiar: 'M9 9h10v10H9V9Zm-4 6V5h10',
  editar: 'M4 20h4L19 9l-4-4L4 16v4Z',
  borrar: 'M5 7h14M10 11v6m4-6v6M7 7l1 13h8l1-13M9 7V4h6v3',
  salir: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l4-4-4-4M14 12H4',
  usuario: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  sitio: 'M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  carrito: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2M10 20a1 1 0 1 0 0 .1M17 20a1 1 0 1 0 0 .1',
  tarjeta: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 3h18M7 15h3',
  candado: 'M6 11h12v9H6v-9Zm2 0V8a4 4 0 0 1 8 0v3',
  imprimir: 'M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2M7 14h10v6H7v-6Z',
  reporte: 'M5 20V10m7 10V4m7 16v-7M3 20h18',
  qr: 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-4 4h2v2h-2v-2Zm4 0h2v2h-2v-2Z',
  pulso: 'M3 12h4l2.5-6 4 12 2.5-6H21',
  google: 'M20.5 12.2c0-.6-.1-1.2-.2-1.7H12v3.3h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.6-1.6 2.6-3.8 2.6-6.5ZM12 21c2.4 0 4.5-.8 5.9-2.2L15 16.6c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H4v2.3A9 9 0 0 0 12 21ZM7 13.8a5.4 5.4 0 0 1 0-3.5V8H4a9 9 0 0 0 0 8.1l3-2.3ZM12 6.5c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 4 8l3 2.3c.7-2.1 2.7-3.8 5-3.8Z',
  facebook: 'M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v7h4v-7h3l1-4h-4V8Z',
  avion: 'M10.5 20 13 13l6 1.5V12L13 9.5V5a1 1 0 0 0-2 0v4.5L5 12v2.5l6-1.5-2.5 7h2Z',
} as const;

export type NombreIcono = keyof typeof TRAZOS;

export default function Icono({ nombre, tamano = 20 }: { nombre: NombreIcono; tamano?: number }) {
  return (
    <svg
      className="icono"
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}
