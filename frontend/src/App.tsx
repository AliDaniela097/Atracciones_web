import { NavLink, Route, Routes } from 'react-router-dom';
import Marketplace from './pages/Marketplace';
import Detalle from './pages/Detalle';
import ConsultarReserva from './pages/ConsultarReserva';
import AdminAtracciones from './pages/admin/AdminAtracciones';
import AtraccionForm from './pages/admin/AtraccionForm';
import AdminReservas from './pages/admin/AdminReservas';

export default function App() {
  return (
    <>
      <header className="topbar">
        <NavLink to="/" className="marca">Atracciones Ecuador</NavLink>
        <nav>
          <NavLink to="/" end>Explorar</NavLink>
          <NavLink to="/mi-reserva">Mi reserva</NavLink>
          <NavLink to="/admin">Administración</NavLink>
        </nav>
      </header>

      <main className="contenedor">
        <Routes>
          {/* Marketplace (público) */}
          <Route path="/" element={<Marketplace />} />
          <Route path="/atraccion/:id" element={<Detalle />} />
          <Route path="/mi-reserva" element={<ConsultarReserva />} />

          {/* Administración */}
          <Route path="/admin" element={<AdminAtracciones />} />
          <Route path="/admin/nueva" element={<AtraccionForm />} />
          <Route path="/admin/editar/:id" element={<AtraccionForm />} />
          <Route path="/admin/reservas" element={<AdminReservas />} />

          <Route path="*" element={<p>Página no encontrada.</p>} />
        </Routes>
      </main>

      <footer className="pie">Booking Prototipo · Dominio Atracciones · Solo Ecuador</footer>
    </>
  );
}