import { useState } from 'react';
import Icono from './Icono';

/** Copia un texto (por ejemplo el código de reserva) y avisa "Copiado" */
export default function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <button type="button" className="btn-texto" onClick={copiar} aria-live="polite">
      <Icono nombre={copiado ? 'check' : 'copiar'} tamano={18} />
      {copiado ? 'Copiado' : 'Copiar'}
    </button>
  );
}
