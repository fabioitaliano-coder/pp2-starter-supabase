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

const { count: nPedidos } = await admin.from('pedidos').select('*', { count: 'exact', head: true });
const { count: nDetalles } = await admin.from('pedido_detalles').select('*', { count: 'exact', head: true });

if (!nPedidos) {
  const estados = ['pendiente', 'confirmado', 'entregado', 'cancelado'];
  const clientes = [ids['cliente1@demo.test'], ids['cliente2@demo.test']];
  const filas = Array.from({ length: 24 }, (_, i) => ({
    user_id: clientes[i % 2],
    estado: estados[Math.floor(i / 2) % 4],
    created_at: new Date(Date.now() - i * 36e5 * 5).toISOString(),
  }));
  const { data: creados, error } = await admin.from('pedidos').insert(filas).select('id');
  if (error) throw error;
  await cargarDetalles(creados);
} else if (!nDetalles) {
  const { data: existentes, error } = await admin.from('pedidos').select('id').order('created_at', { ascending: false });
  if (error) throw error;
  await cargarDetalles(existentes);
}

console.log(`Listo. Admin: admin@demo.test / ${PASSWORD_DEMO} · Clientes: cliente1@demo.test, cliente2@demo.test`);
