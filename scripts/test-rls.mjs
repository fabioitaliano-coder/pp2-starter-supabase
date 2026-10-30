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
const cliente2 = await conSesion('cliente2@demo.test');
const adminSes = await conSesion('admin@demo.test');
const anonimo = nuevoClientePublico();

// Datos válidos para crear_pedido(p_items, p_envio, p_pago). Cada prueba copia y cambia lo que necesita.
const ENVIO = {
  nombre: 'Cliente Uno', calle: 'Av. Rivadavia 6500', piso_depto: '3° B', ciudad: 'CABA',
  provincia: 'Ciudad Autónoma de Buenos Aires', cp: 'C1406', telefono: '11 5555-0101', notas: '',
};
const PAGO = { metodo: 'tarjeta', marca: 'Visa', ultimos4: '4242' };

// Crea un pedido de prueba como cliente1 y devuelve { id, prod, cantidad }.
async function pedidoDePrueba(cantidad = 1) {
  const { data: prod, error: eProd } = await cliente1
    .from('productos').select('id, nombre, precio, stock').gt('stock', cantidad).limit(1).single();
  assert.ifError(eProd);
  const { data: id, error } = await cliente1.rpc('crear_pedido', {
    p_items: [{ producto_id: prod.id, cantidad }], p_envio: ENVIO, p_pago: PAGO,
  });
  assert.ifError(error);
  return { id, prod, cantidad };
}
// Limpieza con la clave secret: primero la factura (la FK no deja borrar el pedido),
// después renglones y pedido. Devuelve el stock que el pedido descontó, si se pide.
async function borrarPedido(id, devolverStock) {
  await admin.from('facturas').delete().eq('pedido_id', id);
  await admin.from('pedido_detalles').delete().eq('pedido_id', id);
  await admin.from('pedidos').delete().eq('id', id);
  if (devolverStock) {
    await admin.from('productos').update({ stock: devolverStock.stock }).eq('id', devolverStock.id);
  }
}

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
await caso('cliente1 no puede insertar un pedido directo (solo crear_pedido)', async () => {
  const { error } = await cliente1.from('pedidos').insert({ user_id: A, total: 1 });
  assert.ok(error, 'debía fallar');
});
await caso('cliente1 no puede crear un pedido a nombre de cliente2', async () => {
  const { error } = await cliente1.from('pedidos').insert({ user_id: B, total: 1 });
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
await caso('sin sesión se ve el catálogo vigente', async () => {
  const { data, error } = await anonimo.from('productos').select('id');
  assert.ifError(error);
  assert.ok((data ?? []).length > 0);
});
await caso('sin sesión no se puede comprar', async () => {
  const { data: prod } = await anonimo.from('productos').select('id').limit(1).single();
  const { error } = await anonimo.rpc('crear_pedido', {
    p_items: [{ producto_id: prod.id, cantidad: 1 }], p_envio: ENVIO, p_pago: PAGO,
  });
  assert.ok(error, 'debía fallar');
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
await caso('crear_pedido arma el pedido y calcula el total (ignora un precio mandado)', async () => {
  const { data: prod, error: eProd } = await cliente1
    .from('productos').select('id, nombre, precio, stock').gt('stock', 1).limit(1).single();
  assert.ifError(eProd);
  const { data, error } = await cliente1.rpc('crear_pedido', {
    p_items: [{ producto_id: prod.id, cantidad: 2, precio_unitario: 0.01, producto_nombre: 'hackeado' }],
    p_envio: ENVIO,
    p_pago: { ...PAGO, total: 1 },
  });
  assert.ifError(error);
  try {
    const { data: ped } = await admin.from('pedidos').select('user_id, total, estado').eq('id', data).single();
    assert.equal(ped.user_id, A);
    assert.equal(ped.estado, 'pendiente');
    assert.equal(Number(ped.total), Number(prod.precio) * 2);
    const { data: det } = await admin.from('pedido_detalles')
      .select('producto_nombre, precio_unitario').eq('pedido_id', data).single();
    assert.equal(det.producto_nombre, prod.nombre);
    assert.equal(Number(det.precio_unitario), Number(prod.precio));
  } finally {
    await borrarPedido(data, prod);
  }
});

console.log('\nCheckout: domicilio y pago simulado');
await caso('crear_pedido guarda domicilio y pago (solo marca y últimos 4)', async () => {
  const { id, prod } = await pedidoDePrueba();
  try {
    const { data: ped } = await cliente1.from('pedidos')
      .select('numero, envio_calle, envio_cp, pago_metodo, pago_detalle').eq('id', id).single();
    assert.ok(ped.numero > 0, 'el pedido debe tener número de seguimiento');
    assert.equal(ped.envio_calle, ENVIO.calle);
    assert.equal(ped.envio_cp, 'C1406');
    assert.equal(ped.pago_metodo, 'tarjeta');
    assert.match(ped.pago_detalle, /4242/);
  } finally {
    await borrarPedido(id, prod);
  }
});
await caso('crear_pedido rechaza el número completo de tarjeta o el CVV', async () => {
  const { data: prod } = await cliente1.from('productos').select('id').gt('stock', 0).limit(1).single();
  for (const extra of [{ tarjeta_numero: '4242424242424242' }, { cvv: '123' }]) {
    const { data, error } = await cliente1.rpc('crear_pedido', {
      p_items: [{ producto_id: prod.id, cantidad: 1 }], p_envio: ENVIO, p_pago: { ...PAGO, ...extra },
    });
    if (data) await borrarPedido(data);
    assert.ok(error, `debía fallar con ${Object.keys(extra)[0]}`);
  }
});
await caso('crear_pedido exige domicilio de entrega válido', async () => {
  const { data: prod } = await cliente1.from('productos').select('id').gt('stock', 0).limit(1).single();
  for (const envio of [{ ...ENVIO, calle: '' }, { ...ENVIO, cp: 'abc' }, {}]) {
    const { data, error } = await cliente1.rpc('crear_pedido', {
      p_items: [{ producto_id: prod.id, cantidad: 1 }], p_envio: envio, p_pago: PAGO,
    });
    if (data) await borrarPedido(data);
    assert.ok(error, 'debía fallar');
  }
});
await caso('crear_pedido exige una forma de pago conocida', async () => {
  const { data: prod } = await cliente1.from('productos').select('id').gt('stock', 0).limit(1).single();
  const { data, error } = await cliente1.rpc('crear_pedido', {
    p_items: [{ producto_id: prod.id, cantidad: 1 }], p_envio: ENVIO, p_pago: { metodo: 'bitcoin' },
  });
  if (data) await borrarPedido(data);
  assert.ok(error, 'debía fallar');
});

console.log('\nMi cuenta: datos propios');
await caso('cliente1 puede cambiar su nombre (y solo el suyo)', async () => {
  const { data: antes } = await admin.from('profiles').select('full_name').eq('id', A).single();
  try {
    const { error } = await cliente1.from('profiles').update({ full_name: 'Cliente Uno Editado' }).eq('id', A);
    assert.ifError(error);
    const { data } = await admin.from('profiles').select('full_name').eq('id', A).single();
    assert.equal(data.full_name, 'Cliente Uno Editado');
    await cliente1.from('profiles').update({ full_name: 'Hackeado' }).eq('id', B);
    const { data: ajeno } = await admin.from('profiles').select('full_name').eq('id', B).single();
    assert.notEqual(ajeno.full_name, 'Hackeado');
  } finally {
    await admin.from('profiles').update({ full_name: antes.full_name }).eq('id', A);
  }
});
await caso('cliente1 no puede cambiar su email en profiles (lo maneja Supabase Auth)', async () => {
  const { error } = await cliente1.from('profiles').update({ email: 'otro@demo.test' }).eq('id', A);
  const { data } = await admin.from('profiles').select('email').eq('id', A).single();
  assert.equal(data.email, 'cliente1@demo.test');
  assert.ok(error, 'el GRANT por columna debía rechazarlo');
});
await caso('cliente1 guarda su domicilio (upsert) y cliente2 no lo ve', async () => {
  const fila = { user_id: A, calle: 'Av. Rivadavia 6500', ciudad: 'CABA', provincia: 'Buenos Aires', codigo_postal: '1406' };
  const { error } = await cliente1.from('direcciones').upsert(fila, { onConflict: 'user_id' });
  assert.ifError(error);
  const { data: propio } = await cliente1.from('direcciones').select('user_id').eq('user_id', A);
  assert.equal(propio.length, 1);
  const { data: ajeno } = await cliente2.from('direcciones').select('user_id').eq('user_id', A);
  assert.equal(ajeno.length, 0);
});
await caso('cliente1 no puede escribir el domicilio de cliente2', async () => {
  const { error } = await cliente1.from('direcciones').upsert(
    { user_id: B, calle: 'Calle Falsa 123', ciudad: 'Springfield', provincia: 'Buenos Aires', codigo_postal: '1234' },
    { onConflict: 'user_id' },
  );
  const { data } = await admin.from('direcciones').select('calle').eq('user_id', B).maybeSingle();
  assert.notEqual(data?.calle, 'Calle Falsa 123');
  assert.ok(error, 'debía fallar');
});
await caso('cliente1 no puede cambiar el total de su pedido', async () => {
  const { data: mio } = await cliente1.from('pedidos').select('id, total').limit(1).single();
  await cliente1.from('pedidos').update({ total: 1 }).eq('id', mio.id);
  const { data } = await admin.from('pedidos').select('total').eq('id', mio.id).single();
  assert.equal(Number(data.total), Number(mio.total));
});
await caso('ni el admin puede cambiar el total de un pedido (GRANT solo en estado)', async () => {
  const { data: p } = await admin.from('pedidos').select('id, total').limit(1).single();
  const { error } = await adminSes.from('pedidos').update({ total: 1 }).eq('id', p.id);
  const { data } = await admin.from('pedidos').select('total').eq('id', p.id).single();
  assert.equal(Number(data.total), Number(p.total));
  assert.ok(error, 'debía fallar');
});

console.log('\nEstados y factura');
await caso('cliente1 no puede emitirse una factura (ni insert ni RPC)', async () => {
  const { data: mio } = await cliente1.from('pedidos').select('id').limit(1).single();
  const { error: eInsert } = await cliente1.from('facturas').insert({
    pedido_id: mio.id, user_id: A, cliente_nombre: 'Yo', total: 1, iva_contenido: 0,
  });
  assert.ok(eInsert, 'el insert debía fallar');
  const { error: eRpc } = await cliente1.rpc('emitir_factura', { p_pedido: mio.id });
  assert.ok(eRpc, 'la RPC debía fallar');
});
await caso('IDOR: cliente1 no ve facturas de cliente2', async () => {
  const { data: ajenas } = await admin.from('facturas').select('id').eq('user_id', B).limit(1);
  if (!ajenas?.length) return { omitida: 'cliente2 no tiene facturas (corré npm run seed).' };
  const { data } = await cliente1.from('facturas').select('id').eq('id', ajenas[0].id);
  assert.equal(data.length, 0);
});
await caso('no se puede despachar un pedido sin confirmarlo', async () => {
  const { id, prod } = await pedidoDePrueba();
  try {
    const { error } = await adminSes.from('pedidos').update({ estado: 'despachado' }).eq('id', id);
    assert.ok(error, 'debía fallar');
    const { count } = await admin.from('facturas').select('*', { count: 'exact', head: true }).eq('pedido_id', id);
    assert.equal(count, 0);
  } finally {
    await borrarPedido(id, prod);
  }
});
await caso('confirmar → despachar emite UNA factura que ve el dueño y no otro cliente', async () => {
  const { id, prod } = await pedidoDePrueba(2);
  try {
    const { error: e1 } = await adminSes.from('pedidos').update({ estado: 'confirmado' }).eq('id', id);
    assert.ifError(e1);
    const { error: e2 } = await adminSes.from('pedidos').update({ estado: 'despachado' }).eq('id', id);
    assert.ifError(e2);
    const { data: facturas } = await admin.from('facturas').select('id, total, user_id').eq('pedido_id', id);
    assert.equal(facturas.length, 1);
    assert.equal(facturas[0].user_id, A);
    assert.equal(Number(facturas[0].total), Number(prod.precio) * 2);
    const { data: suya } = await cliente1.from('facturas').select('id').eq('pedido_id', id);
    assert.equal(suya.length, 1);
    const { data: ajena } = await cliente2.from('facturas').select('id').eq('pedido_id', id);
    assert.equal(ajena.length, 0);
    const { data: ped } = await admin.from('pedidos').select('confirmado_at, despachado_at').eq('id', id).single();
    assert.ok(ped.confirmado_at && ped.despachado_at, 'el trigger debía guardar las fechas');
    // Despachado y facturado: ya no se cancela.
    const { error: e3 } = await adminSes.from('pedidos').update({ estado: 'cancelado' }).eq('id', id);
    assert.ok(e3, 'cancelar un pedido facturado debía fallar');
  } finally {
    await borrarPedido(id, prod);
  }
});
await caso('cancelar un pedido devuelve el stock', async () => {
  const { id, prod, cantidad } = await pedidoDePrueba(2);
  try {
    const { data: antes } = await admin.from('productos').select('stock').eq('id', prod.id).single();
    assert.equal(antes.stock, prod.stock - cantidad);
    const { error } = await adminSes.from('pedidos').update({ estado: 'cancelado' }).eq('id', id);
    assert.ifError(error);
    const { data: despues } = await admin.from('productos').select('stock').eq('id', prod.id).single();
    assert.equal(despues.stock, prod.stock);
  } finally {
    await borrarPedido(id, prod);
  }
});

console.log(fallos ? `\n${fallos} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(fallos ? 1 : 0);
