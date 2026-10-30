import { Link } from 'react-router-dom';
import { FormSeguimiento } from '../../components/FormSeguimiento';

export function BuscarPedido() {
  return (
    <section className="angosto">
      <h1>Seguimiento de pedidos</h1>
      <p className="vacio">El número está en la pantalla de confirmación y en <Link to="/mis-pedidos">Mis pedidos</Link>.</p>
      <FormSeguimiento />
    </section>
  );
}
