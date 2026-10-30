import { fechaCorta } from '../lib/formato';
import type { Pedido } from '../types';

type EstadoHito = 'hecho' | 'actual' | 'futuro' | 'cancelado';

interface Hito {
  titulo: string;
  detalle: string;
  cuando: string | null | undefined;
  estado: EstadoHito;
}

// Concepto · La línea de tiempo se arma con las fechas que completa el trigger
// (confirmado_at, despachado_at…). El navegador solo las muestra.
function hitos(p: Pedido): Hito[] {
  const recibido: Hito = {
    titulo: 'Pedido recibido', detalle: 'Registramos tu compra y reservamos el stock.',
    cuando: p.created_at, estado: 'hecho',
  };
  if (p.estado === 'cancelado') {
    return [recibido, {
      titulo: 'Pedido cancelado', detalle: 'No se va a despachar. El stock volvió a la tienda.',
      cuando: p.cancelado_at, estado: 'cancelado',
    }];
  }
  const orden = ['pendiente', 'confirmado', 'despachado', 'entregado'];
  const actual = orden.indexOf(p.estado);
  const estadoDe = (i: number): EstadoHito => (i < actual ? 'hecho' : i === actual ? (i === 3 ? 'hecho' : 'actual') : 'futuro');
  return [
    { ...recibido, estado: actual === 0 ? 'actual' : 'hecho' },
    { titulo: 'Pago y pedido confirmados', detalle: 'Verificamos el pago y preparamos tu paquete.', cuando: p.confirmado_at, estado: estadoDe(1) },
    { titulo: 'Despachado · factura emitida', detalle: 'Tu pedido salió y la factura ya está disponible.', cuando: p.despachado_at, estado: estadoDe(2) },
    { titulo: 'Entregado', detalle: 'El pedido llegó a destino.', cuando: p.entregado_at, estado: estadoDe(3) },
  ];
}

const LEYENDA: Record<EstadoHito, string> = {
  hecho: 'Completado', actual: 'En curso', futuro: 'Pendiente', cancelado: 'Cancelado',
};

export function LineaTiempo({ pedido }: { pedido: Pedido }) {
  return (
    <ol className="linea-tiempo">
      {hitos(pedido).map((h) => (
        <li key={h.titulo} className={h.estado} aria-current={h.estado === 'actual' ? 'step' : undefined}>
          <span className="punto" aria-hidden="true">{h.estado === 'hecho' ? '✓' : h.estado === 'cancelado' ? '✕' : ''}</span>
          <div>
            <strong>{h.titulo}</strong>
            <span className="sr-only"> · {LEYENDA[h.estado]}</span>
            <p className="nota">{h.cuando && h.estado !== 'futuro' ? fechaCorta(h.cuando) : h.detalle}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
