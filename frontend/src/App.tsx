import { Link, Route, Routes } from 'react-router-dom';
import Inicio from './pages/Inicio';
import Marketplace from './pages/Marketplace';
import Detalle from './pages/Detalle';
import MisReservas from './pages/MisReservas';
import Carrito from './pages/Carrito';
import Checkout from './pages/Checkout';
import Comprobante from './pages/Comprobante';
import { Ingresar, Registro } from './pages/Cuenta';
import AdminAtracciones from './pages/admin/AdminAtracciones';
import AtraccionForm from './pages/admin/AtraccionForm';
import AdminReservas from './pages/admin/AdminReservas';
import AdminReportes from './pages/admin/AdminReportes';
import VerificarReserva from './pages/admin/VerificarReserva';
import { LayoutCliente, LayoutOperador } from './components/Layouts';
import { EstadoVacio } from './components/Estados';
import { RutaProtegida } from './auth';
import SoloClientes from './components/SoloClientes';

/**
 * Dos vistas separadas:
 *  - Cliente (turista): catálogo público; reservar y ver "Mis reservas" pide iniciar sesión.
 *  - Operador (/admin): solo cuentas con rol OPERADOR (scope attractions:write).
 */
export default function App() {
  return (
    <Routes>
      <Route element={<LayoutCliente />}>
        <Route path="/" element={<Inicio />} />
        <Route path="/explorar" element={<Marketplace />} />
        <Route path="/atraccion/:id" element={<Detalle />} />
        <Route path="/ingresar" element={<Ingresar />} />
        <Route path="/registro" element={<Registro />} />
        <Route
          path="/carrito"
          element={
            <SoloClientes>
              <Carrito />
            </SoloClientes>
          }
        />
        <Route
          path="/checkout"
          element={
            <RutaProtegida>
              <SoloClientes>
                <Checkout />
              </SoloClientes>
            </RutaProtegida>
          }
        />
        <Route
          path="/compra/confirmada"
          element={
            <RutaProtegida>
              <SoloClientes>
                <Comprobante />
              </SoloClientes>
            </RutaProtegida>
          }
        />
        <Route
          path="/mis-reservas"
          element={
            <RutaProtegida>
              <SoloClientes>
                <MisReservas />
              </SoloClientes>
            </RutaProtegida>
          }
        />
        <Route
          path="/acceso-denegado"
          element={
            <EstadoVacio titulo="Esta sección es solo para operadores">
              <p>Tu cuenta es de cliente. Si administras atracciones, ingresa con la cuenta de operador.</p>
              <Link to="/" className="btn">
                Ir al inicio
              </Link>
            </EstadoVacio>
          }
        />
        <Route
          path="*"
          element={
            <EstadoVacio titulo="Esta página no existe">
              <Link to="/" className="btn">
                Ir al inicio
              </Link>
            </EstadoVacio>
          }
        />
      </Route>

      <Route
        path="/admin"
        element={
          <RutaProtegida soloOperador>
            <LayoutOperador />
          </RutaProtegida>
        }
      >
        <Route index element={<AdminAtracciones />} />
        <Route path="nueva" element={<AtraccionForm />} />
        <Route path="editar/:id" element={<AtraccionForm />} />
        <Route path="reservas" element={<AdminReservas />} />
        <Route path="reportes" element={<AdminReportes />} />
        <Route path="verificar" element={<VerificarReserva />} />
        <Route path="verificar/:codigo" element={<VerificarReserva />} />
      </Route>
    </Routes>
  );
}
