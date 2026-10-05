import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { EstadoVacio } from './Estados';

/**
 * Páginas de compra (carrito, pago, comprobante, mis reservas): solo para clientes o visitantes.
 * El operador administra y no compra; si llega aquí, ve un aviso y un enlace a su panel.
 * El backend también lo impide: la cuenta del operador no tiene el permiso attractions:book.
 */
export default function SoloClientes({ children }: { children: ReactNode }) {
  const { esOperador } = useAuth();
  if (!esOperador) return <>{children}</>;
  return (
    <EstadoVacio titulo="Las compras son solo para clientes">
      <p>Iniciaste sesión como operador. El operador administra el catálogo y las reservas, pero no compra entradas.</p>
      <Link to="/admin" className="btn">
        Ir al panel del operador
      </Link>
    </EstadoVacio>
  );
}
