import { supabase } from './supabase';
import { invalidar, invalidarPrefijo, prefetch } from './consultaCache';
import type { Direccion, Estado, MiCuenta, Pedido, Producto, ResumenEstado } from '../types';

export const POR_PAGINA = 10;

export const CLAVES = {
  catalogo: 'catalogo',
  misPedidos: (pagina: number) => `mis-pedidos:${pagina}`,
  adminPedidos: (pagina: number, filtro: string) => `admin-pedidos:${pagina}:${filtro}`,
  adminResumen: 'admin-resumen',
  pedido: (id: string) => `pedido:${id}`,
  miCuenta: (uid: string) => `mi-cuenta:${uid}`,
};

const COLUMNAS_CATALOGO = 'id, nombre, descripcion, precio, stock, emoji, activo';
const COLUMNAS_DETALLE = 'id, pedido_id, producto_id, producto_nombre, cantidad, precio_unitario';
const COLUMNAS_FACTURA_CORTA = 'id, numero, punto_venta, tipo, emitida_at';
const COLUMNAS_FACTURA =
  `${COLUMNAS_FACTURA_CORTA}, cliente_nombre, cliente_documento, cliente_domicilio, cliente_email, total, iva_contenido`;
const COLUMNAS_MIS_PEDIDOS =
  `id, numero, user_id, total, estado, created_at, pedido_detalles(${COLUMNAS_DETALLE}), facturas(${COLUMNAS_FACTURA_CORTA})`;
const COLUMNAS_ADMIN_PEDIDOS =
  `id, numero, user_id, total, estado, created_at, confirmado_at, despachado_at, profiles(email, full_name), ` +
  'envio_calle, envio_piso_depto, envio_ciudad, envio_provincia, envio_cp, pago_metodo, pago_detalle, ' +
  `pedido_detalles(${COLUMNAS_DETALLE}), facturas(${COLUMNAS_FACTURA_CORTA})`;
// Seguimiento y factura: una sola consulta con todo lo del pedido (embed, sin N+1).
const COLUMNAS_PEDIDO = [
  'id, numero, user_id, total, estado, created_at',
  'confirmado_at, despachado_at, entregado_at, cancelado_at',
  'envio_nombre, envio_calle, envio_piso_depto, envio_ciudad, envio_provincia, envio_cp, envio_telefono, envio_notas',
  'pago_metodo, pago_detalle, factura_nombre, factura_documento, factura_domicilio',
  `pedido_detalles(${COLUMNAS_DETALLE})`,
  `facturas(${COLUMNAS_FACTURA})`,
].join(', ');

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

export async function pedirPedido(id: string): Promise<Pedido> {
  // Concepto · Si el pedido es de otra persona, RLS lo esconde: para la API "no existe".
  const { data, error } = await supabase.from('pedidos').select(COLUMNAS_PEDIDO).eq('id', id).maybeSingle();
  if (error) throw new Error('No se pudo cargar el pedido.');
  if (!data) throw new Error('No encontramos ese pedido en tu cuenta.');
  return data as unknown as Pedido;
}

export async function buscarPedidoPorNumero(numero: number): Promise<string | null> {
  const { data, error } = await supabase.from('pedidos').select('id').eq('numero', numero).maybeSingle();
  if (error) throw new Error('No se pudo buscar el pedido.');
  return data?.id ?? null;
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

export async function pedirMiCuenta(uid: string): Promise<MiCuenta> {
  // Dos lecturas en paralelo (Promise.all): perfil y domicilio guardado.
  const [perfil, dir] = await Promise.all([
    supabase.from('profiles').select('id, email, full_name').eq('id', uid).single(),
    supabase
      .from('direcciones')
      .select('calle, piso_depto, ciudad, provincia, codigo_postal, telefono')
      .eq('user_id', uid)
      .maybeSingle(),
  ]);
  if (perfil.error || dir.error) throw new Error('No se pudieron cargar tus datos.');
  return { ...perfil.data, direccion: (dir.data as Direccion | null) ?? null };
}

// --- Escrituras de Mi cuenta (RLS: solo filas propias) ---------------------------

export async function guardarNombre(uid: string, fullName: string) {
  // Concepto · El GRANT por columna solo deja tocar full_name: aunque mandaras role, falla.
  const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', uid);
  if (error) throw new Error('No se pudo guardar el nombre.');
  invalidar(CLAVES.miCuenta(uid));
}

export async function guardarDireccion(uid: string, d: Direccion) {
  // upsert: crea la fila la primera vez y la actualiza después (PK = user_id).
  const { error } = await supabase
    .from('direcciones')
    .upsert({ user_id: uid, ...d, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw new Error('No se pudo guardar el domicilio. Revisá los datos.');
  invalidar(CLAVES.miCuenta(uid));
}

// --- Prefetch e invalidación -------------------------------------------------------

export function prefetchCatalogo() {
  prefetch(CLAVES.catalogo, pedirCatalogo, true);
}

export function prefetchMisPedidos() {
  prefetch(CLAVES.misPedidos(1), () => pedirMisPedidos(1));
}

export function prefetchPedido(id: string) {
  prefetch(CLAVES.pedido(id), () => pedirPedido(id));
}

export function prefetchMiCuenta(uid: string) {
  prefetch(CLAVES.miCuenta(uid), () => pedirMiCuenta(uid));
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
  invalidarPrefijo('pedido:');
  // Cancelar devuelve stock: el catálogo cambia.
  invalidar(CLAVES.catalogo);
}
