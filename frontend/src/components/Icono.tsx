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
