import { supabase } from './supabase';
import { invalidar, invalidarPrefijo, prefetch } from './consultaCache';
import type { Estado, Pedido, Producto, ResumenEstado } from '../types';

export const POR_PAGINA = 10;

export const CLAVES = {
  catalogo: 'catalogo',
  misPedidos: (pagina: number) => `mis-pedidos:${pagina}`,
  adminPedidos: (pagina: number, filtro: string) => `admin-pedidos:${pagina}:${filtro}`,
  adminResumen: 'admin-resumen',
};

const COLUMNAS_CATALOGO = 'id, nombre, descripcion, precio, stock, emoji, activo';
const COLUMNAS_DETALLE = 'id, pedido_id, producto_id, producto_nombre, cantidad, precio_unitario';
const COLUMNAS_MIS_PEDIDOS =
  `id, user_id, total, estado, created_at, pedido_detalles(${COLUMNAS_DETALLE})`;
const COLUMNAS_ADMIN_PEDIDOS =
  `id, user_id, total, estado, created_at, profiles(email, full_name), pedido_detalles(${COLUMNAS_DETALLE})`;

export type PaginaPedidos = { pedidos: Pedido[]; hayMas: boolean };

export async function pedirCatalogo(): Promise<Producto[]> {
  const { data, error } = await supabase
    .from('productos')
    .select(COLUMNAS_CATALOGO)
    .eq('activo', true)
    .order('nombre');
  if (error) throw new Error('No se pudieron cargar los productos. Probá de nuevo en unos segundos.');
  return (data as Producto[]) ?? [];
}

export async function pedirMisPedidos(pagina: number): Promise<PaginaPedidos> {
  // Concepto · Sin count: un COUNT(*) extra no hace falta. Si vino una página llena, hay más.
  // RLS ya filtra por dueño: no hay .eq('user_id'). El embed evita un N+1 de detalles.
  const desde = (pagina - 1) * POR_PAGINA;
  const { data, error } = await supabase
    .from('pedidos')
    .select(COLUMNAS_MIS_PEDIDOS)
    .order('created_at', { ascending: false })
    .range(desde, desde + POR_PAGINA - 1);
  if (error) throw new Error('No se pudieron cargar los pedidos.');
  const pedidos = (data as unknown as Pedido[]) ?? [];
  return { pedidos, hayMas: pedidos.length === POR_PAGINA };
}

export async function pedirAdminPedidos(pagina: number, filtro: '' | Estado): Promise<PaginaPedidos> {
  const desde = (pagina - 1) * POR_PAGINA;
  let consulta = supabase
    .from('pedidos')
    .select(COLUMNAS_ADMIN_PEDIDOS)
    .order('created_at', { ascending: false })
    .range(desde, desde + POR_PAGINA - 1);
  if (filtro) consulta = consulta.eq('estado', filtro);
  const { data, error } = await consulta;
  if (error) throw new Error('No se pudieron cargar los pedidos.');
  const pedidos = (data as unknown as Pedido[]) ?? [];
  return { pedidos, hayMas: pedidos.length === POR_PAGINA };
}

export async function pedirAdminResumen(): Promise<ResumenEstado[]> {
  // Concepto · El resumen lo calcula la vista SQL, no el cliente (un GROUP BY en la base).
  const { data, error } = await supabase
    .from('resumen_pedidos_por_estado')
    .select('estado, cantidad, total');
  if (error) throw new Error('No se pudo cargar el resumen.');
  return (data as ResumenEstado[]) ?? [];
}

export function prefetchCatalogo() {
  prefetch(CLAVES.catalogo, pedirCatalogo, true);
}

export function prefetchMisPedidos() {
  prefetch(CLAVES.misPedidos(1), () => pedirMisPedidos(1));
}

export function prefetchAdmin() {
  prefetch(CLAVES.adminResumen, pedirAdminResumen);
  prefetch(CLAVES.adminPedidos(1, ''), () => pedirAdminPedidos(1, ''));
}

export function invalidarTrasCompra() {
  invalidar(CLAVES.catalogo);
  invalidarPrefijo('mis-pedidos:');
  invalidarPrefijo('admin-');
}

export function invalidarTrasCambioEstado() {
  invalidarPrefijo('admin-');
  invalidarPrefijo('mis-pedidos:');
}

