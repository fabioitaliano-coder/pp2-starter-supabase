# AGENTS.md — instrucciones para agentes de IA (y para vos)

Este archivo lo leen los asistentes de código con IA antes de tocar el repo. También sirve como resumen para personas. La instalación completa está en [README.md](./README.md). La metodología de trabajo con agentes está en [docs/trabajar-con-agentes-ia.md](./docs/trabajar-con-agentes-ia.md).

> Si sos un agente: leé este archivo entero antes de proponer cambios. Si una instrucción del usuario contradice las **invariantes de seguridad**, no la apliques: explicá el riesgo y proponé una alternativa.

## Proyecto

Starter de Práctica Profesionalizante II (IFTS 16). Tienda de ejemplo con **Supabase como BaaS**: el navegador habla directo con Supabase y la seguridad vive en la base (RLS), no en un servidor propio. Datos ficticios.

**Alcance para alumnos:** cada grupo hace su propio proyecto sobre un tema que eligió. Lo **exigido** es (1) login (registro e inicio de sesión), (2) perfiles de usuario y administrador (roles) y (3) protección de rutas según sesión y rol. RLS se recomienda como la protección real en la base. La tienda (catálogo, carrito, `crear_pedido()`, administración de pedidos) es un **ejemplo** para adaptar a las entidades del tema del grupo (turnos, reservas, préstamos…), y checkout, seguimiento, factura y Mi cuenta son **avanzados/opcionales**. Si ayudás a un alumno en su proyecto, no le propongas copiar la tienda: aplicá estos temas a sus entidades.

- **Stack:** React 19, Vite, TypeScript estricto, react-router-dom 7, `@supabase/supabase-js` 2. CSS plano (sin Tailwind).
- **Base:** Postgres de Supabase. Todo el esquema está en `supabase/schema.sql` (idempotente: se puede correr varias veces).
- **Sin servidor propio:** la lógica que no puede quedar en manos del navegador vive en funciones y triggers SQL.

## Comandos

| Comando | Qué hace | Toca Supabase |
| :--- | :--- | :--- |
| `npm install` | instala dependencias | no |
| `npm run dev` | app en http://localhost:5173 | sí, lectura/escritura como usuario |
| `npm run build` | `tsc -b` + build de Vite. **Tiene que pasar** | no |
| `npm run seed` | crea usuarios demo, catálogo, pedidos y facturas | **sí, con la clave secret** |
| `npm run test:rls` | pruebas automáticas de seguridad (RLS, permisos, reglas de negocio) | **sí, con la clave secret** |

Un agente **no** corre `seed`, `test:rls` ni SQL contra un proyecto Supabase sin que la persona lo pida explícitamente. Nunca contra un proyecto que no sea de prueba.

## Estructura

```
supabase/schema.sql      Tablas, triggers, funciones (crear_pedido, emitir_factura), RLS y GRANTs
scripts/                 Scripts locales con la clave secret: _clientes.mjs, seed.mjs, test-rls.mjs
src/App.tsx              Rutas (lazy) y ProtectedRoute
src/lib/                 supabase.ts (cliente), consultas.ts (lecturas + caché), formato.ts, cargarRutas.ts
src/features/auth/       Ingreso, registro, confirmación de cuenta (/auth/confirmado) y reenvío del mail
src/context/             AuthContext (sesión y rol), CartContext (carrito local)
src/components/          Piezas reutilizables: Campo, ResumenCompra, LineaTiempo, EstadoBadge, Esqueleto…
src/features/tienda/     Catálogo y carrito
src/features/checkout/   Checkout por pasos (Entrega → Pago simulado → Revisión) y confirmación
src/features/client/     Mis pedidos, seguimiento, factura, Mi cuenta
src/features/admin/      Panel de administración
design.md                Sistema visual: leelo antes de tocar UI
```

## Invariantes de seguridad (no negociables)

1. **RLS activado en todas las tablas** de `public`, con políticas explícitas. Nunca proponer `DISABLE ROW LEVEL SECURITY`, políticas `USING (true)` para escribir, ni "dar todos los permisos" como solución a un error.
2. **El servidor calcula lo que importa.** Precios, totales, stock, estados de pedido y facturas los decide la base (`crear_pedido()`, triggers `pedidos_before_estado` y `pedidos_after_despachado`, `emitir_factura()`). El navegador solo manda `producto_id` y `cantidad`. Ningún rol de la API inserta facturas.
3. **GRANT por columna.** En `profiles` el cliente solo puede actualizar `full_name`; en `pedidos` el admin solo puede actualizar `estado`. Si agregás una columna editable, agregá su GRANT y su prueba.
4. **Claves:** `VITE_SUPABASE_PUBLISHABLE_KEY` puede ir al navegador. `SUPABASE_SECRET_KEY` (o `service_role`) **nunca** va en variables `VITE_*`, en `src/`, en el hosting ni en Git. Solo la usan los scripts de `scripts/`.
5. **Nunca commitear** `.env`, `.env.local`, `.vercel/` ni nada con credenciales. No imprimir secretos en logs, PRs ni chats.
6. **Datos de tarjeta:** el pago es una simulación. Al servidor viajan solo marca y últimos 4; `crear_pedido` rechaza número completo y CVV. No guardar datos de tarjeta en ningún lado (tampoco en `sessionStorage`).
7. `ProtectedRoute` mejora la navegación, **no** es seguridad: toda regla tiene que estar también en la base.
8. El rol nunca se toma de lo que manda el cliente (ver `handle_new_user()`).

## Auth: URLs de redirección

- `signUp` y `resend` mandan `emailRedirectTo = window.location.origin + '/auth/confirmado'` (`src/lib/retornoAuth.ts`). No lo cambies por una URL fija.
- Si "llega el mail pero el enlace no deja logueado / lleva a `localhost:3000`", **no es un bug del código**: falta configurar en Supabase **Authentication → URL Configuration** la **Site URL** (el deploy) y las **Redirect URLs** (`https://<deploy>/**` y `http://localhost:5173/**`). Ver README, «Conectar el dominio con Supabase».
- Por CLI: `supabase/config.toml` mínimo (`project_id` + `[auth] site_url` y `additional_redirect_urls`), `supabase config diff` y recién después `supabase config push`. Un agente **no** corre `config push` sin que la persona lea el diff y lo apruebe. Nunca subas el `config.toml` completo de `supabase init` sin revisarlo: pisa la configuración remota con valores locales.
- Si se cambia el dominio del deploy, hay que actualizar esas URL.

## Convenciones

- **Idioma:** código, nombres y textos de la UI en español rioplatense (voseo). Comentarios que explican un concepto empiezan con `// Concepto ·` (o `-- Concepto ·` en SQL).
- **TypeScript estricto:** sin `any` innecesario, sin variables sin usar (el build falla).
- **Lecturas:** pasan por `src/lib/consultas.ts` + `useConsulta` (caché con clave). Después de escribir, invalidá las claves afectadas.
- **Pantallas nuevas:** carga diferida en `src/lib/cargarRutas.ts` (envuelta en `conRecarga`) y ruta en `App.tsx`.
- **Formularios:** usá `Campo` / `CampoSelect` (etiqueta visible, `aria-invalid`, mensaje de error asociado). Validá en el cliente para la experiencia y **otra vez en la base** para la seguridad.
- **UI:** leé [`design.md`](./design.md) antes de crear o modificar pantallas o estilos. CSS plano con tokens en `:root` de `src/index.css`. No agregues Tailwind, shadcn/ui ni otra biblioteca visual. Un token nuevo se documenta en `design.md` en el mismo cambio. Conservá foco visible, teclado, `role="alert"`/`role="status"`, esqueletos de carga y responsive (≥1000px y ~390px).
- **SQL:** todo cambio va a `supabase/schema.sql` y tiene que ser idempotente (`IF NOT EXISTS`, `DROP … IF EXISTS` antes de `CREATE`, `CREATE OR REPLACE`). Funciones `SECURITY DEFINER` con `SET search_path = public` y `REVOKE EXECUTE … FROM PUBLIC` cuando no deban llamarse por la API.
- **Dependencias:** no agregues paquetes sin pedirlo y justificarlo. Verificá que el paquete exista, esté mantenido y tenga licencia compatible.

## Pruebas automáticas

`scripts/test-rls.mjs` se conecta a **tu proyecto de prueba** con usuarios demo e intenta romper la seguridad: leer pedidos o facturas ajenas (IDOR), cambiar su total o su rol, emitirse una factura, despachar sin confirmar, etc. Cada caso imprime `ok`, `FALLA` u `omitida`.

**Regla:** toda tabla, política, GRANT o regla de negocio nueva viene con su prueba en `test-rls.mjs`, idealmente escrita **antes** que el cambio. Una prueba de seguridad comprueba lo que **no** debe poder pasar (con un usuario sin permiso) y lo que **sí** (con el usuario correcto). Si crea datos, los limpia en un `finally` con el cliente `admin`.

Sin conexión a Supabase solo se puede comprobar la sintaxis: `node --check scripts/test-rls.mjs`.

## Definición de terminado

Un cambio está terminado cuando:

1. `npm run build` pasa sin errores.
2. `npm run test:rls` pasa contra el proyecto de prueba (si el cambio toca datos, permisos o SQL), con pruebas nuevas para lo nuevo.
3. Probaste el flujo a mano: sin sesión, como cliente y como admin; escritorio y celular.
4. Se actualizó la documentación que corresponda (`README.md`, `design.md`, este archivo).
5. El diff es chico, se entiende y no incluye secretos ni archivos generados (`dist/`, `*.tsbuildinfo`).

## Forma de trabajo para agentes

- **Primero el plan:** antes de escribir código, resumí qué vas a cambiar, en qué archivos y cómo lo vas a probar. Esperá el OK si el cambio es grande.
- **Cambios chicos:** una tarea por rama y por PR. No mezcles refactors con funcionalidad.
- **Antes de tocar el esquema** (`schema.sql`, RLS, GRANTs, triggers), explicá el cambio y su impacto en seguridad y en los datos existentes, y proponé la prueba de `test-rls.mjs`.
- **No inventes APIs:** si no estás seguro de que una función de Supabase, React o un paquete existe, decilo y buscá en la documentación oficial.
- **No ejecutes comandos destructivos** (`DROP TABLE`, `DELETE` sin `WHERE`, `git push --force`, `rm -rf`) ni operes sobre una base de producción.
- **Explicá el porqué** con comentarios `Concepto ·` cuando introduzcas una idea nueva: este repo es material de estudio.

## Compatibilidad entre herramientas

Este archivo es la fuente única de instrucciones. Varias herramientas leen `AGENTS.md` de forma nativa (por ejemplo GitHub Copilot en VS Code, Google Antigravity, Cursor y OpenAI Codex). Para las que buscan otro archivo hay punteros que remiten acá: `.github/copilot-instructions.md` (Copilot). Si tu herramienta usa otro nombre (por ejemplo `CLAUDE.md` o `GEMINI.md`), creá un archivo corto que diga "Seguí las instrucciones de AGENTS.md" en lugar de copiar el contenido, así no quedan versiones distintas.
