import { useMemo } from 'react';
import qrcode from '../lib/qrcode-generator';

/**
 * Código QR dibujado como SVG (nítido en pantalla y al imprimir en PDF).
 * Siempre en negro sobre blanco con margen, para que cualquier celular lo lea.
 */
export default function CodigoQR({ valor, etiqueta, tamano = 132 }: { valor: string; etiqueta: string; tamano?: number }) {
  const ruta = useMemo(() => {
    const qr = qrcode(0, 'M'); // 0 = tamaño automático; M = corrige hasta ~15 % de daño
    qr.addData(valor);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let fila = 0; fila < n; fila++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(fila, col)) d += `M${col} ${fila}h1v1h-1z`;
      }
    }
    return { d, n };
  }, [valor]);

  const margen = 4; // zona de silencio recomendada por el estándar QR
  const total = ruta.n + margen * 2;

  return (
    <svg
      className="codigo-qr"
      width={tamano}
      height={tamano}
      viewBox={`${-margen} ${-margen} ${total} ${total}`}
      role="img"
      aria-label={etiqueta}
      shapeRendering="crispEdges"
    >
      <rect x={-margen} y={-margen} width={total} height={total} fill="#ffffff" />
      <path d={ruta.d} fill="#000000" />
    </svg>
  );
}
