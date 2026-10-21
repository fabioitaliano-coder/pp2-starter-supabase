import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { PaginationControls } from '../../components/PaginationControls';
import type { Pedido } from '../../types';

const POR_PAGINA = 10;

export function MisPedidos() {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [monto, setMonto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    // Concepto · Acá NO hay .eq('user_id', ...): RLS ya devuelve solo los pedidos del usuario.
    // Paginación: .range() es inclusivo en ambos extremos y { count: 'exact' } trae el total.
    const desde = (pagina - 1) * POR_PAGINA;
    const { data, count, error } = await supabase
      .from('pedidos')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(desde, desde + POR_PAGINA - 1);
    if (error) setError('No se pudieron cargar los pedidos.');
    else { setPedidos((data as Pedido[]) ?? []); setTotal(count ?? 0); }
  }, [pagina]);

  useEffect(() => { cargar(); }, [cargar]);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando || !user) return;
    const importe = Number(monto);
    if (!Number.isFinite(importe) || importe < 0) { setError('Ingresá un total válido.'); return; }
    setEnviando(true);
    setError(null);
    // El user_id viaja desde la sesión; si se manipulara, la política WITH CHECK lo rechaza.
    const { error } = await supabase.from('pedidos').insert({ user_id: user.id, total: importe });
    if (error) setError('No se pudo crear el pedido.');
    else { setMonto(''); setPagina(1); await cargar(); }
    setEnviando(false);
  };

  return (
    <section>
      <h1>Mis pedidos</h1>
      <form className="fila" onSubmit={crear}>
        <label>Total ($) <input type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required /></label>
        <button type="submit" disabled={enviando}>{enviando ? 'Creando…' : 'Crear pedido'}</button>
      </form>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Fecha</th><th>Total</th><th>Estado</th></tr></thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id}>
                <td>{new Date(p.created_at).toLocaleString('es-AR')}</td>
                <td>${Number(p.total).toFixed(2)}</td>
                <td><span className={`estado ${p.estado}`}>{p.estado}</span></td>
              </tr>
            ))}
            {pedidos.length === 0 && <tr><td colSpan={3}>Todavía no tenés pedidos.</td></tr>}
          </tbody>
        </table>
      </div>
      <PaginationControls currentPage={pagina} totalItems={total} pageSize={POR_PAGINA} onPageChange={setPagina} />
    </section>
  );
}
