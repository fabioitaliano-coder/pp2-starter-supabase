export type Rol = 'cliente' | 'admin';
export type Estado = 'pendiente' | 'confirmado' | 'despachado' | 'entregado' | 'cancelado';
export const ESTADOS: Estado[] = ['pendiente', 'confirmado', 'despachado', 'entregado', 'cancelado'];

export const ESTADO_ETIQUETA: Record<Estado, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  despachado: 'Despachado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

// Concepto · Copia de las reglas del trigger pedidos_cambio_estado() (schema.sql, 6b).
// El panel deshabilita lo que la base va a rechazar igual: la autoridad es la base.
export const TRANSICIONES: Record<Estado, Estado[]> = {
  pendiente: ['confirmado', 'cancelado'],
  confirmado: ['pendiente', 'despachado', 'cancelado'],
  despachado: ['entregado'],
  entregado: [],
  cancelado: [],
};

export type MetodoPago = 'tarjeta' | 'transferencia' | 'efectivo';
export const METODO_PAGO_ETIQUETA: Record<MetodoPago, string> = {
  tarjeta: 'Tarjeta (simulada)',
  transferencia: 'Transferencia bancaria',
  efectivo: 'Efectivo al recibir',
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

export interface Factura {
  id: string;
  numero: number;
  punto_venta: number;
  tipo: string;
  emitida_at: string;
  cliente_nombre?: string;
  cliente_documento?: string | null;
  cliente_domicilio?: string | null;
  cliente_email?: string | null;
  total?: number;
  iva_contenido?: number;
}

export interface Pedido {
  id: string;
  numero: number;
  user_id: string;
  total: number;
  estado: Estado;
  created_at: string;
  confirmado_at?: string | null;
  despachado_at?: string | null;
  entregado_at?: string | null;
  cancelado_at?: string | null;
  envio_nombre?: string | null;
  envio_calle?: string | null;
  envio_piso_depto?: string | null;
  envio_ciudad?: string | null;
  envio_provincia?: string | null;
  envio_cp?: string | null;
  envio_telefono?: string | null;
  envio_notas?: string | null;
  pago_metodo?: MetodoPago | null;
  pago_detalle?: string | null;
  factura_nombre?: string | null;
  factura_documento?: string | null;
  factura_domicilio?: string | null;
  pedido_detalles?: PedidoDetalle[];
  profiles?: { email: string | null; full_name: string } | null;
  // PostgREST devuelve un objeto (relación 1 a 1 por UNIQUE). Ver facturaDe().
  facturas?: Factura | Factura[] | null;
}

export interface ResumenEstado {
  estado: Estado;
  cantidad: number;
  total: number;
}

export interface Direccion {
  calle: string;
  piso_depto: string | null;
  ciudad: string;
  provincia: string;
  codigo_postal: string;
  telefono: string | null;
}

export interface MiCuenta {
  id: string;
  email: string | null;
  full_name: string;
  direccion: Direccion | null;
}

export const PROVINCIAS = [
  'Ciudad Autónoma de Buenos Aires', 'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
  'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
  'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
];
