// Carga usuarios, catálogo y pedidos ficticios. Idempotente: no duplica pedidos si ya hay.
import { admin, USUARIOS_DEMO, asegurarUsuario, PASSWORD_DEMO } from './_clientes.mjs';

const CATALOGO = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    nombre: 'Café en grano 250 g',
    descripcion: 'Tostado medio, para cafetera o prensa.',
    precio: 8500,
    stock: 120,
    emoji: '☕',
    activo: true,
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    nombre: 'Yerba mate 1 kg',
    descripcion: 'Suave, con palo. Ideal para el termo.',
    precio: 6200,
    stock: 120,
    emoji: '🧉',
    activo: true,
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    nombre: 'Medialunas x 6',
    descripcion: 'De manteca, para el desayuno.',
    precio: 4500,
    stock: 120,
    emoji: '🥐',
    activo: true,
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    nombre: 'Jugo de naranja 1 L',
    descripcion: 'Exprimido, sin azúcar agregada.',
    precio: 2400,
    stock: 120,
    emoji: '🧃',
    activo: true,
  },
  {
    id: '00000000-0000-4000-8000-000000000005',
    nombre: 'Cuaderno universitario',
    descripcion: 'A4 rayado, 80 hojas.',
    precio: 3200,
    stock: 120,
    emoji: '📓',
    activo: true,
  },
  {
    id: '00000000-0000-4000-8000-000000000006',
    nombre: 'Set de lapiceras x 4',
    descripcion: 'Azul, negro, rojo y verde.',
    precio: 1800,
    stock: 120,
    emoji: '✏️',
    activo: true,
  },
  {
    id: '00000000-0000-4000-8000-000000000007',
    nombre: 'Auriculares',
    descripcion: 'Con cable y micrófono.',
    precio: 24900,
    stock: 120,
    emoji: '🎧',
    activo: true,
  },
  {
    id: '00000000-0000-4000-8000-000000000008',
    nombre: 'Galletitas de avena',
    descripcion: 'Paquete de 300 g.',
    precio: 1600,
    stock: 120,
    emoji: '🍪',
    activo: true,
  },
];

const ids = {};
for (const u of USUARIOS_DEMO) ids[u.email] = await asegurarUsuario(u);

const { error: errorCatalogo } = await admin.from('productos').upsert(CATALOGO, { onConflict: 'id' });
if (errorCatalogo) throw errorCatalogo;

const { data: productos, error: errorProductos } = await admin
  .from('productos')
  .select('id, nombre, precio')
  .order('nombre');
if (errorProductos) throw errorProductos;
if (!productos?.length) throw new Error('El catálogo quedó vacío después del seed.');

async function cargarDetalles(pedidos) {
  const detalles = [];
  const totales = [];
  for (const [i, pedido] of pedidos.entries()) {
    const nItems = 1 + (i % 3);
    let total = 0;
    for (let j = 0; j < nItems; j += 1) {
      const prod = productos[(i + j) % productos.length];
      const cantidad = 1 + (j % 2);
      detalles.push({
        pedido_id: pedido.id,
        producto_id: prod.id,
        producto_nombre: prod.nombre,
        cantidad,
        precio_unitario: prod.precio,
      });
      total += Number(prod.precio) * cantidad;
    }
    totales.push({ id: pedido.id, total });
  }
  const { error } = await admin.from('pedido_detalles').insert(detalles);
  if (error) throw error;
  for (const fila of totales) {
    const { error: errorTotal } = await admin.from('pedidos').update({ total: fila.total }).eq('id', fila.id);
    if (errorTotal) throw errorTotal;
  }
}

// Domicilios ficticios de los clientes demo (también prellenan el checkout).
const DOMICILIOS = {
  'cliente1@demo.test': {
    nombre: 'Cliente Uno', calle: 'Av. Rivadavia 6500', piso_depto: '3° B', ciudad: 'CABA',
    provincia: 'Ciudad Autónoma de Buenos Aires', cp: 'C1406', telefono: '11 5555-0101',
  },
  'cliente2@demo.test': {
    nombre: 'Cliente Dos', calle: 'Calle 7 1234', piso_depto: null, ciudad: 'La Plata',
    provincia: 'Buenos Aires', cp: '1900', telefono: '221 555-0202',
  },
};
const PAGOS = [
  { pago_metodo: 'tarjeta', pago_detalle: 'Visa terminada en 4242' },
  { pago_metodo: 'transferencia', pago_detalle: 'Transferencia (simulada)' },
  { pago_metodo: 'efectivo', pago_detalle: 'Efectivo al recibir' },
];
const HORA = 36e5;

function datosEnvio(email) {
  const d = DOMICILIOS[email];
  return {
    envio_nombre: d.nombre, envio_calle: d.calle, envio_piso_depto: d.piso_depto, envio_ciudad: d.ciudad,
    envio_provincia: d.provincia, envio_cp: d.cp, envio_telefono: d.telefono,
  };
}

// Fechas coherentes con el estado (el trigger solo las pone en UPDATE, no en INSERT).
function fechasSegunEstado(estado, creado) {
  const t = new Date(creado).getTime();
  const iso = (h) => new Date(Math.min(Date.now(), t + h * HORA)).toISOString();
  return {
    confirmado_at: ['confirmado', 'despachado', 'entregado'].includes(estado) ? iso(2) : null,
    despachado_at: ['despachado', 'entregado'].includes(estado) ? iso(20) : null,
    entregado_at: estado === 'entregado' ? iso(60) : null,
    cancelado_at: estado === 'cancelado' ? iso(3) : null,
  };
}

const { count: nPedidos } = await admin.from('pedidos').select('*', { count: 'exact', head: true });
const { count: nDetalles } = await admin.from('pedido_detalles').select('*', { count: 'exact', head: true });

if (!nPedidos) {
  const estados = ['pendiente', 'confirmado', 'despachado', 'entregado', 'cancelado'];
  const emails = ['cliente1@demo.test', 'cliente2@demo.test'];
  const filas = Array.from({ length: 24 }, (_, i) => {
    const estado = estados[Math.floor(i / 2) % estados.length];
    const created_at = new Date(Date.now() - i * HORA * 5).toISOString();
    return {
      user_id: ids[emails[i % 2]],
      estado,
      created_at,
      ...fechasSegunEstado(estado, created_at),
      ...datosEnvio(emails[i % 2]),
      ...PAGOS[i % PAGOS.length],
    };
  });
  const { data: creados, error } = await admin.from('pedidos').insert(filas).select('id');
  if (error) throw error;
  await cargarDetalles(creados);
} else if (!nDetalles) {
  const { data: existentes, error } = await admin.from('pedidos').select('id').order('created_at', { ascending: false });
  if (error) throw error;
  await cargarDetalles(existentes);
}

// Pedidos demo creados con el esquema anterior: completar domicilio y pago si faltan.
const emailPorId = Object.fromEntries(Object.entries(ids).map(([email, id]) => [id, email]));
const { data: sinEnvio, error: errorSinEnvio } = await admin
  .from('pedidos').select('id, user_id').is('envio_calle', null);
if (errorSinEnvio) throw errorSinEnvio;
for (const [i, p] of (sinEnvio ?? []).entries()) {
  const email = emailPorId[p.user_id];
  if (!DOMICILIOS[email]) continue; // solo cuentas demo
  const { error } = await admin.from('pedidos')
    .update({ ...datosEnvio(email), ...PAGOS[i % PAGOS.length] }).eq('id', p.id);
  if (error) throw error;
}

// Factura de los despachados/entregados que todavía no la tengan. emitir_factura() es
// idempotente y solo la puede ejecutar service_role (no la API pública).
const { data: aFacturar, error: errorFacturar } = await admin
  .from('pedidos').select('id, facturas(id)').in('estado', ['despachado', 'entregado'])
  .order('created_at', { ascending: true });
if (errorFacturar) throw errorFacturar;
for (const p of aFacturar ?? []) {
  const tiene = Array.isArray(p.facturas) ? p.facturas.length > 0 : Boolean(p.facturas);
  if (tiene) continue;
  const { error } = await admin.rpc('emitir_factura', { p_pedido: p.id });
  if (error) throw error;
}

// Domicilio guardado de los clientes demo (Mi cuenta).
const direcciones = Object.entries(DOMICILIOS).map(([email, d]) => ({
  user_id: ids[email], calle: d.calle, piso_depto: d.piso_depto, ciudad: d.ciudad,
  provincia: d.provincia, codigo_postal: d.cp, telefono: d.telefono,
}));
const { error: errorDirecciones } = await admin.from('direcciones').upsert(direcciones, { onConflict: 'user_id' });
if (errorDirecciones) throw errorDirecciones;

console.log(`Listo. Admin: admin@demo.test / ${PASSWORD_DEMO} · Clientes: cliente1@demo.test, cliente2@demo.test`);
