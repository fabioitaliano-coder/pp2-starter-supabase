export type Rol = 'cliente' | 'admin';
export type Estado = 'pendiente' | 'confirmado' | 'entregado' | 'cancelado';
export const ESTADOS: Estado[] = ['pendiente', 'confirmado', 'entregado', 'cancelado'];

export const ESTADO_ETIQUETA: Record<Estado, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export interface Producto {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  stock: number;
  emoji: string;
  activo: boolean;
}

export interface PedidoDetalle {
  id: string;
  pedido_id: string;
  producto_id: string | null;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
}

export interface Pedido {
  id: string;
  user_id: string;
  total: number;
  estado: Estado;
  created_at: string;
  pedido_detalles?: PedidoDetalle[];
  profiles?: { email: string | null; full_name: string } | null;
}

export interface ResumenEstado {
  estado: Estado;
  cantidad: number;
  total: number;
}
