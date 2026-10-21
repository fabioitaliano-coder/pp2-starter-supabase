export type Rol = 'cliente' | 'admin';
export type Estado = 'pendiente' | 'confirmado' | 'entregado' | 'cancelado';
export const ESTADOS: Estado[] = ['pendiente', 'confirmado', 'entregado', 'cancelado'];

export interface Pedido {
  id: string;
  user_id: string;
  total: number;
  estado: Estado;
  created_at: string;
}

export interface ResumenEstado {
  estado: Estado;
  cantidad: number;
  total: number;
}
