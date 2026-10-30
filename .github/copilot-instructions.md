# Instrucciones para GitHub Copilot

Las instrucciones del proyecto están en [`AGENTS.md`](../AGENTS.md), en la raíz del repositorio. Seguilas siempre; este archivo solo existe para que Copilot las encuentre.

Resumen de lo que nunca se negocia (el detalle está en `AGENTS.md`):

- RLS activado en todas las tablas; nunca desactivarlo ni abrir políticas para "arreglar" un error.
- Totales, estados de pedido y facturas los calcula la base, no el navegador.
- `SUPABASE_SECRET_KEY` nunca en variables `VITE_*`, en `src/`, en el hosting ni en Git. Nunca commitear `.env`.
- Toda tabla o política nueva viene con su prueba en `scripts/test-rls.mjs`.
- Antes de cambiar la UI, leer `design.md` (CSS plano, sin Tailwind).
- Terminado = `npm run build` y `npm run test:rls` pasan.
