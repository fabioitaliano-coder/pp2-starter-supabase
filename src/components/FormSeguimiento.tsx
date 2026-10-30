import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { buscarPedidoPorNumero } from '../lib/consultas';

// Formulario de seguimiento: buscás por número (#1024) y te lleva al detalle.
// Concepto · RLS: si el número es de otra persona, la consulta vuelve vacía.
export function FormSeguimiento({ compacto = false }: { compacto?: boolean }) {
  const navigate = useNavigate();
  const [valor, setValor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const numero = Number(valor.replace(/\D/g, ''));
    if (!numero) { setError('Escribí el número de pedido, por ejemplo 1024.'); return; }
    setBuscando(true);
    setError(null);
    try {
      const id = await buscarPedidoPorNumero(numero);
      if (id) navigate(`/pedidos/${id}`);
      else setError(`No encontramos el pedido #${numero} en tu cuenta.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo buscar.');
    } finally {
      setBuscando(false);
    }
  };

  return (
    <form className={`form-seguimiento ${compacto ? 'compacto' : 'tarjeta'}`} onSubmit={onSubmit} role="search">
      {!compacto && <h2>Seguí tu pedido</h2>}
      <label htmlFor="numero-seguimiento">Número de pedido</label>
      <div className="fila-busqueda">
        <input id="numero-seguimiento" inputMode="numeric" placeholder="#1024" value={valor}
          aria-invalid={error ? true : undefined} aria-describedby={error ? 'seguimiento-error' : undefined}
          onChange={(e) => { setValor(e.target.value); setError(null); }} />
        <button type="submit" disabled={buscando}>{buscando ? 'Buscando…' : 'Seguir'}</button>
      </div>
      {error && <small id="seguimiento-error" className="error-campo" role="alert">{error}</small>}
    </form>
  );
}
