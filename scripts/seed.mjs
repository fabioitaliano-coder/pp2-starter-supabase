// Carga usuarios y pedidos ficticios. Idempotente: no duplica pedidos si ya hay.
import { admin, USUARIOS_DEMO, asegurarUsuario, PASSWORD_DEMO } from './_clientes.mjs';

const ids = {};
for (const u of USUARIOS_DEMO) ids[u.email] = await asegurarUsuario(u);

const { count } = await admin.from('pedidos').select('*', { count: 'exact', head: true });
if (!count) {
  const estados = ['pendiente', 'confirmado', 'entregado', 'cancelado'];
  const clientes = [ids['cliente1@demo.test'], ids['cliente2@demo.test']];
  const filas = Array.from({ length: 60 }, (_, i) => ({
    user_id: clientes[i % 2],
    total: (500 + ((i * 137) % 9500)) / 1,
    estado: estados[i % 4],
    created_at: new Date(Date.now() - i * 36e5 * 5).toISOString(),
  }));
  const { error } = await admin.from('pedidos').insert(filas);
  if (error) throw error;
}
console.log(`Listo. Admin: admin@demo.test / ${PASSWORD_DEMO} · Clientes: cliente1@demo.test, cliente2@demo.test`);
