// Pruebas de seguridad contra TU proyecto de Supabase. Corré antes: npm run seed
import assert from 'node:assert/strict';
import { admin, nuevoClientePublico, asegurarUsuario, USUARIOS_DEMO, PASSWORD_DEMO } from './_clientes.mjs';

let fallos = 0;
async function caso(nombre, fn) {
  try {
    const r = await fn();
    console.log(r?.omitida ? `  omitida ${nombre}\n        ${r.omitida}` : `  ok   ${nombre}`);
  }
  catch (e) { fallos++; console.log(`  FALLA ${nombre}\n        ${e.message}`); }
}
async function conSesion(email) {
  const c = nuevoClientePublico();
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD_DEMO });
  assert.ifError(error);
  return c;
}

const ids = {};
for (const u of USUARIOS_DEMO) ids[u.email] = await asegurarUsuario(u);
const [A, B] = [ids['cliente1@demo.test'], ids['cliente2@demo.test']];
const cliente1 = await conSesion('cliente1@demo.test');
const adminSes = await conSesion('admin@demo.test');
const anonimo = nuevoClientePublico();

console.log('Pruebas RLS');

await caso('sin sesión no se ve ningún pedido', async () => {
  const { data } = await anonimo.from('pedidos').select('id');
  assert.equal((data ?? []).length, 0);
});
await caso('cliente1 ve solo pedidos propios', async () => {
  const { data, error } = await cliente1.from('pedidos').select('user_id');
  assert.ifError(error);
  assert.ok(data.length > 0);
  assert.ok(data.every((p) => p.user_id === A));
});
await caso('IDOR: cliente1 no puede leer un pedido de cliente2 por id', async () => {
  const { data: ajeno } = await admin.from('pedidos').select('id').eq('user_id', B).limit(1).single();
  const { data } = await cliente1.from('pedidos').select('id').eq('id', ajeno.id);
  assert.equal(data.length, 0);
});
await caso('cliente1 no puede crear un pedido a nombre de cliente2', async () => {
  const { error } = await cliente1.from('pedidos').insert({ user_id: B, total: 1 });
  assert.ok(error, 'debía fallar');
});
await caso('cliente1 no puede crear un pedido ya "entregado"', async () => {
  const { error } = await cliente1.from('pedidos').insert({ user_id: A, total: 1, estado: 'entregado' });
  assert.ok(error, 'debía fallar');
});
await caso('cliente1 no puede cambiar el estado de un pedido', async () => {
  const { data: mio } = await cliente1.from('pedidos').select('id, estado').limit(1).single();
  await cliente1.from('pedidos').update({ estado: 'entregado' }).eq('id', mio.id);
  const { data: despues } = await admin.from('pedidos').select('estado').eq('id', mio.id).single();
  assert.equal(despues.estado, mio.estado);
});
await caso('cliente1 no puede ascenderse a admin', async () => {
  await cliente1.from('profiles').update({ role: 'admin' }).eq('id', A);
  const { data } = await admin.from('profiles').select('role').eq('id', A).single();
  assert.equal(data.role, 'cliente');
});
await caso('registrarse con role=admin en el metadata crea un cliente', async () => {
  const email = `intruso-${Date.now()}@demo.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD_DEMO, email_confirm: true,
    user_metadata: { full_name: 'Intruso', role: 'admin' },
  });
  assert.ifError(error);
  const { data: perfil } = await admin.from('profiles').select('role').eq('id', data.user.id).single();
  await admin.auth.admin.deleteUser(data.user.id);
  assert.equal(perfil.role, 'cliente');
});
await caso('signUp PÚBLICO con role=admin en el metadata crea un cliente', async () => {
  // Es el camino real de un atacante: clave publishable, sin privilegios.
  // Supabase rechaza dominios inventados (.test). Definí TEST_SIGNUP_EMAIL en .env con un
  // email tuyo con alias (ej: nombre+rls@gmail.com); te llegará un mail de confirmación.
  const base = process.env.TEST_SIGNUP_EMAIL;
  if (!base) return { omitida: 'definí TEST_SIGNUP_EMAIL en .env para probar el alta pública.' };
  const email = base.replace('@', `+${Date.now()}@`);
  const { data, error } = await nuevoClientePublico().auth.signUp({
    email, password: PASSWORD_DEMO, options: { data: { full_name: 'Intruso', role: 'admin' } },
  });
  if (error) return { omitida: `el proyecto rechazó el alta pública: ${error.message}` };
  const id = data.user.id;
  const { data: perfil } = await admin.from('profiles').select('role').eq('id', id).single();
  await admin.auth.admin.deleteUser(id);
  assert.equal(perfil.role, 'cliente');
});
await caso('el admin ve pedidos de varios clientes', async () => {
  const { data } = await adminSes.from('pedidos').select('user_id').limit(100);
  assert.ok(new Set(data.map((p) => p.user_id)).size >= 2);
});
await caso('el admin puede cambiar un estado', async () => {
  const { data: p } = await adminSes.from('pedidos').select('id, estado').limit(1).single();
  const { error } = await adminSes.from('pedidos').update({ estado: p.estado }).eq('id', p.id);
  assert.ifError(error);
});
await caso('la vista resumen respeta RLS (cliente1 no cuenta pedidos ajenos)', async () => {
  const { data } = await cliente1.from('resumen_pedidos_por_estado').select('cantidad');
  const suma = data.reduce((n, r) => n + r.cantidad, 0);
  const { count } = await admin.from('pedidos').select('*', { count: 'exact', head: true }).eq('user_id', A);
  assert.equal(suma, count);
});
await caso('sin sesión no se ve el catálogo', async () => {
  const { data } = await anonimo.from('productos').select('id');
  assert.equal((data ?? []).length, 0);
});
await caso('cliente1 ve el catálogo', async () => {
  const { data, error } = await cliente1.from('productos').select('id');
  assert.ifError(error);
  assert.ok(data.length > 0);
});
await caso('cliente1 no puede crear un producto', async () => {
  const { error } = await cliente1.from('productos').insert({
    nombre: `intruso-${Date.now()}`, precio: 1, stock: 1,
  });
  assert.ok(error, 'debía fallar');
});
await caso('cliente1 no puede cambiar el precio de un producto', async () => {
  const { data: prod } = await cliente1.from('productos').select('id, precio').limit(1).single();
  await cliente1.from('productos').update({ precio: 1 }).eq('id', prod.id);
  const { data: despues } = await admin.from('productos').select('precio').eq('id', prod.id).single();
  assert.equal(Number(despues.precio), Number(prod.precio));
});
await caso('el admin puede actualizar un producto', async () => {
  const { data: prod } = await adminSes.from('productos').select('id, stock').limit(1).single();
  const { error } = await adminSes.from('productos').update({ stock: prod.stock }).eq('id', prod.id);
  assert.ifError(error);
});
await caso('IDOR: cliente1 no ve renglones de un pedido de cliente2', async () => {
  const { data: ajeno } = await admin.from('pedidos').select('id').eq('user_id', B).limit(1).single();
  const { data } = await cliente1.from('pedido_detalles').select('id').eq('pedido_id', ajeno.id);
  assert.equal(data.length, 0);
});
await caso('cliente1 no puede agregar artículos al pedido de cliente2', async () => {
  const { data: prod } = await cliente1.from('productos').select('id').limit(1).single();
  const { data: ajeno } = await admin.from('pedidos').select('id').eq('user_id', B).limit(1).single();
  const { error } = await cliente1.from('pedido_detalles').insert({
    pedido_id: ajeno.id, producto_id: prod.id, cantidad: 1,
  });
  assert.ok(error, 'debía fallar');
});
await caso('cliente1 no puede agregar artículos a un pedido propio ya entregado', async () => {
  const { data: prod } = await cliente1.from('productos').select('id').gt('stock', 0).limit(1).single();
  const { data: mio } = await admin.from('pedidos').select('id').eq('user_id', A).eq('estado', 'entregado').limit(1).single();
  assert.ok(mio, 'hace falta un pedido entregado de cliente1 (corré npm run seed)');
  const { error } = await cliente1.from('pedido_detalles').insert({
    pedido_id: mio.id, producto_id: prod.id, cantidad: 1,
  });
  assert.ok(error, 'debía fallar');
});
await caso('el precio y el nombre del renglón los pone la base', async () => {
  const { data: prod, error: eProd } = await cliente1
    .from('productos').select('id, nombre, precio').gt('stock', 0).limit(1).single();
  assert.ifError(eProd);
  const { data: pedido, error: ePed } = await cliente1
    .from('pedidos').insert({ user_id: A }).select('id, total').single();
  assert.ifError(ePed);
  assert.equal(Number(pedido.total), 0);
  const { error: eDet } = await cliente1.from('pedido_detalles').insert({
    pedido_id: pedido.id,
    producto_id: prod.id,
    cantidad: 1,
    precio_unitario: 0.01,
    nombre: 'hackeado',
  });
  assert.ifError(eDet);
  const { data: det } = await admin.from('pedido_detalles')
    .select('nombre, precio_unitario').eq('pedido_id', pedido.id).single();
  assert.equal(det.nombre, prod.nombre);
  assert.equal(Number(det.precio_unitario), Number(prod.precio));
  const { data: ped } = await admin.from('pedidos').select('total').eq('id', pedido.id).single();
  assert.equal(Number(ped.total), Number(prod.precio));
  await admin.from('pedido_detalles').delete().eq('pedido_id', pedido.id);
  await admin.from('pedidos').delete().eq('id', pedido.id);
});
await caso('crear_pedido arma el pedido y calcula el total', async () => {
  const { data: prod, error: eProd } = await cliente1
    .from('productos').select('id, precio').gt('stock', 1).limit(1).single();
  assert.ifError(eProd);
  const { data, error } = await cliente1.rpc('crear_pedido', {
    p_items: [{ producto_id: prod.id, cantidad: 2 }],
  });
  assert.ifError(error);
  const { data: ped } = await admin.from('pedidos').select('user_id, total, estado').eq('id', data).single();
  assert.equal(ped.user_id, A);
  assert.equal(ped.estado, 'pendiente');
  assert.equal(Number(ped.total), Number(prod.precio) * 2);
  await admin.from('pedido_detalles').delete().eq('pedido_id', data);
  await admin.from('pedidos').delete().eq('id', data);
});

console.log(fallos ? `\n${fallos} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(fallos ? 1 : 0);
