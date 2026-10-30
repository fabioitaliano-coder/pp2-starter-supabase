# PP2 · Starter Supabase (React + Vite + TypeScript)

Aplicación de referencia de Práctica Profesionalizante II · IFTS 16. Muestra el camino **Supabase como BaaS**: el navegador habla directo con Supabase y la seguridad vive en la base (RLS), no en un servidor propio.

Este repo es la **base copiable** (auth, RLS, catálogo, carrito, checkout por pasos con pago simulado, seguimiento de pedidos, factura simulada y Mi cuenta). Cuando termines de recorrerlo, el siguiente paso es la app completa: [`ecommerce-ifts16-supabase`](https://github.com/fabioitaliano-coder/ecommerce-ifts16-supabase) (categorías, descuentos, Storage, administración de catálogo).

Datos 100 % ficticios (Ley 25.326). Licencia MIT.

## Primeros pasos (alumnos)

Seguí estos pasos en orden para tener el starter andando en tu computadora con tu propio proyecto de Supabase. Cada paso enlaza a la explicación completa más abajo.

**Antes de empezar necesitás:** [Git](https://git-scm.com/downloads), [Node.js 22](https://nodejs.org/) (es la versión de `.nvmrc`; si usás nvm, corré `nvm use`), una cuenta en [GitHub](https://github.com) y una cuenta gratuita en [Supabase](https://supabase.com).

1. **Hacé tu copia del repositorio.** Para trabajar con tu equipo, tocá **Fork** arriba a la derecha en GitHub y cloná tu fork. Si solo querés probarlo, cloná este directamente:

   ```bash
   git clone https://github.com/fabioitaliano-coder/pp2-starter-supabase.git
   cd pp2-starter-supabase
   ```

2. **Instalá las dependencias:**

   ```bash
   npm install
   ```

3. **Creá un proyecto en Supabase** y copiá la Project URL, la clave Publishable y la clave Secret. Ver [Crear el proyecto y conseguir las claves](#crear-el-proyecto-y-conseguir-las-claves).

4. **Configurá el `.env`.** Copiá el archivo de ejemplo y completá los valores:

   ```bash
   cp .env.example .env
   ```

   | Variable | Qué va | Dónde se usa |
   | :--- | :--- | :--- |
   | `VITE_SUPABASE_URL` | Project URL | navegador |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | clave `sb_publishable_…` | navegador |
   | `SUPABASE_SECRET_KEY` | clave `sb_secret_…` | solo scripts locales (`seed`, `test:rls`) |
   | `TEST_SIGNUP_EMAIL` | un mail tuyo (opcional) | una de las pruebas RLS |

   El `.env` ya está en `.gitignore`: **nunca lo subas a GitHub** ni pongas la clave secret en Vercel.

5. **Creá las tablas y la seguridad.** En Supabase abrí **SQL Editor → New query**, pegá todo `supabase/schema.sql` y ejecutalo. Ver [Aplicar el DDL y ejecutar el seed](#aplicar-el-ddl-y-ejecutar-el-seed).

6. **Cargá los datos de prueba:**

   ```bash
   npm run seed
   ```

   Crea un admin, dos clientes, un catálogo de artículos y pedidos ficticios con renglones. Los usuarios y la contraseña de prueba están en el aula virtual de PP2.

7. **Comprobá que RLS protege los datos:**

   ```bash
   npm run test:rls
   ```

   Tiene que terminar con «Todas las pruebas pasaron.». Qué prueba y cómo leer la salida: [Pruebas automáticas](#pruebas-automáticas-test-rls).

8. **Levantá la app.** El catálogo se ve sin iniciar sesión; para comprar y para administrar sí hace falta entrar:

   ```bash
   npm run dev   # http://localhost:5173
   ```

   Para que el registro con confirmación por mail funcione, configurá las URL de Auth de tu proyecto: ver [Conectar el dominio con Supabase](#conectar-el-dominio-con-supabase-registro-confirmación-de-email-y-mi-cuenta).

9. **(Opcional) Publicala en Vercel.** Ver [Despliegue en Vercel](#despliegue-en-vercel). Después agregá la URL del deploy en Supabase (Site URL y Redirect URLs).

**Si algo falla:** si la app avisa que faltan variables de Supabase, revisá que el archivo se llame exactamente `.env`, que esté en la raíz del proyecto y reiniciá `npm run dev`. Si `npm run seed` falla, revisá `SUPABASE_SECRET_KEY` y que hayas ejecutado `schema.sql` antes. Dudas: foro de consultas del aula virtual.

## Qué demuestra

| Tema | Dónde verlo |
| :--- | :--- |
| Alta de usuario con perfil automático (trigger) | `supabase/schema.sql`, secciones 2 y 3 |
| El rol **nunca** se toma de lo que manda el cliente | trigger `handle_new_user()` y `RegisterForm.tsx` |
| Registro con «Confirmar contraseña», confirmación por mail, reenvío y vuelta al mismo sitio | `RegisterForm.tsx`, `ConfirmacionCuenta.tsx`, `retornoAuth.ts`, `ReenviarConfirmacion.tsx` |
| Catálogo público y carrito lateral | `Tienda.tsx`, `CartPanel.tsx` |
| Checkout por pasos (entrega → pago simulado → revisión) con resumen siempre visible | `src/features/checkout/`, `ResumenCompra.tsx` |
| Pago simulado: al servidor solo viajan marca y últimos 4 (nunca número completo ni CVV) | `PasoPago.tsx`, `tarjetaSimulada.ts`, `crear_pedido()` |
| Confirmación con «Seguir comprando» y seguimiento con línea de tiempo | `CompraConfirmada.tsx`, `SeguimientoPedido.tsx`, `LineaTiempo.tsx` |
| Transiciones de estado validadas en la base (trigger) | `pedidos_before_estado` en `supabase/schema.sql` |
| Factura simulada emitida por un trigger al despachar | `emitir_factura()`, `pedidos_after_despachado`, `Factura.tsx` |
| Mi cuenta: nombre, email (Supabase Auth), domicilio e historial | `MiCuenta.tsx`, tabla `direcciones` |
| GRANT por columna (el cliente solo cambia `full_name`; el admin solo `estado`) | `supabase/schema.sql`, sección de permisos |
| Precio, stock y total calculados en la base (`FOR UPDATE`) | `crear_pedido()` en `supabase/schema.sql`, sección 6 |
| RLS por dueño y por rol (`is_admin()`) | `supabase/schema.sql`, sección 7 |
| Vista SQL que respeta RLS (`security_invoker`) | `supabase/schema.sql`, sección 8 y `PanelAdmin.tsx` |
| Badges de estado reutilizados | `EstadoBadge.tsx`, `MisPedidos.tsx`, `PanelAdmin.tsx` |
| Clave pública frente a clave privada | `.env.example`, `src/lib/supabase.ts`, `scripts/_clientes.mjs` |
| Cliente singleton, `AuthContext`, rutas protegidas | `src/lib/`, `src/context/`, `src/routes/` |
| Diseño (mismas clases que la app de referencia) | `design.md`, `src/index.css` |
| Paginación con `.range()` sin `COUNT(*)` | `MisPedidos.tsx`, `PanelAdmin.tsx`, `PaginationControls.tsx` |
| Caché por clave (TTL, SWR, dedupe, invalidación) | `consultaCache.ts`, `consultas.ts`, `useConsulta.ts` |
| Pruebas que intentan romper la seguridad | `scripts/test-rls.mjs` |
| Instrucciones para agentes de IA | `AGENTS.md`, `docs/trabajar-con-agentes-ia.md` |

## Flujo de compra

1. **Carrito** (`CartPanel.tsx`): «Ir a pagar» lleva a `/checkout`. Sin sesión, pasa antes por `/login` y vuelve.
2. **Checkout por pasos** (`/checkout`):
   - **Entrega:** nombre, calle, piso/depto, ciudad, provincia, código postal, teléfono y notas. Se prellena con el domicilio guardado en Mi cuenta.
   - **Pago (simulado):** tarjeta (Visa, Mastercard o American Express), transferencia o efectivo al recibir. La tarjeta se valida en el navegador (Luhn, vencimiento, CVV) pero **al servidor solo viajan la marca y los últimos 4 dígitos**. La tarjeta `4000 0000 0000 0002` simula un rechazo.
   - **Revisión:** datos de entrega, pago y facturación. «Confirmar pedido» llama a `crear_pedido()`.
   - El **resumen** (artículos, envío, total) queda siempre visible: al costado en escritorio, desplegable en celular.
3. **Confirmación** (`/checkout/listo/:id`): número de pedido, «Seguir comprando» y «Seguir mi pedido».
4. **Seguimiento** (`/pedidos/:id`, o buscar por número en `/seguimiento`): línea de tiempo con fechas de cada estado.
5. **Factura** (`/pedidos/:id/factura`): aparece cuando el pedido se despacha.

### Estados del pedido

| Desde | Puede pasar a |
| :--- | :--- |
| `pendiente` | `confirmado`, `cancelado` |
| `confirmado` | `despachado` (emite la factura), `pendiente`, `cancelado` |
| `despachado` | `entregado` |
| `entregado`, `cancelado` | — (finales) |

El trigger `pedidos_before_estado` rechaza las transiciones que no están en la tabla (por ejemplo, despachar sin confirmar), guarda la fecha de cada estado y, al cancelar, **devuelve el stock**. `entregado` y `cancelado` son finales; un pedido despachado ya no se puede cancelar.

### Factura simulada

La factura se emite **cuando el pedido confirmado se despacha**: el trigger `pedidos_after_despachado` llama a `emitir_factura()`, que numera, copia los datos de facturación y calcula el IVA contenido. Ningún usuario de la API puede insertar facturas ni llamar a esa función: solo la base (y la clave secret del seed). Es idempotente: un pedido tiene como máximo una factura.

Es una **simulación didáctica**: «Factura B», con la marca SIMULADA, sin CAE y sin validez fiscal; no se informa a ARCA. La página es imprimible (o se guarda como PDF desde el diálogo de impresión).

## Pruebas automáticas (`test:rls`)

### Qué son y por qué

`scripts/test-rls.mjs` se conecta a **tu proyecto de Supabase de prueba** con los usuarios demo (admin, cliente1, cliente2 y un visitante sin sesión) y hace lo que haría alguien con la clave pública y malas intenciones: leer pedidos o facturas ajenas, ascenderse a admin, cambiar el total de un pedido, emitirse una factura, despachar sin confirmar, mandar el número completo de la tarjeta… Cada intento **tiene que fallar**. También comprueba que lo permitido funcione (que el dueño vea su factura, que cancelar devuelva el stock, etc.).

¿Por qué hacen falta? Porque en este proyecto **no hay servidor propio**: toda la seguridad está en las políticas RLS, los GRANT y las funciones SQL. Un error en una política no se ve en la interfaz (la app no muestra el botón), pero cualquiera puede llamar a la API directamente. Las pruebas son la única forma rápida de saber que la base realmente bloquea lo que tiene que bloquear, y de enterarte si un cambio posterior (tuyo o de un agente de IA) rompió algo.

### Cómo correrlas

```bash
npm run seed       # una vez: crea usuarios demo, catálogo y pedidos
npm run test:rls
```

Necesitan `.env` con `SUPABASE_SECRET_KEY` (la usan para preparar y limpiar datos) y el esquema aplicado. Crean pedidos de prueba y los borran al terminar. **Corrélas solo contra un proyecto de prueba**, nunca contra uno con datos reales.

Sin conexión podés comprobar al menos que el archivo no tenga errores de sintaxis: `node --check scripts/test-rls.mjs`.

### Cómo leer la salida

```
Pruebas RLS
  ok   sin sesión no se ve ningún pedido
  ok   cliente1 ve solo pedidos propios
  FALLA IDOR: cliente1 no puede leer un pedido de cliente2 por id
        Expected values to be strictly equal: 1 !== 0
  omitida signUp PÚBLICO con role=admin en el metadata crea un cliente
        definí TEST_SIGNUP_EMAIL en .env para probar el alta pública.
…
1 prueba(s) fallaron.
```

(Ejemplo ilustrativo: con el esquema correcto, la prueba de IDOR pasa.)

- **`ok`**: la base se comportó como se esperaba.
- **`FALLA`**: debajo aparece el motivo. Casi siempre significa que una política, un GRANT o una función deja hacer algo que no debería (o bloquea algo que sí). **No se arregla tocando la prueba**: se arregla el esquema.
- **`omitida`**: falta algo opcional para correrla (por ejemplo `TEST_SIGNUP_EMAIL`).
- Al final: «Todas las pruebas pasaron.» (código de salida 0) o «N prueba(s) fallaron.» (código 1, útil para automatizarlo).

### Cómo agregar una prueba

Cada prueba es un `caso(nombre, fn)`: si `fn` lanza un error (por ejemplo, un `assert` que no se cumple), la prueba falla.

```js
await caso('cliente1 no ve el domicilio de cliente2', async () => {
  const { data } = await cliente1.from('direcciones').select('user_id').eq('user_id', B);
  assert.equal(data.length, 0); // RLS filtra: no hay error, pero vuelve vacío
});
```

Pautas:

- Probá **las dos caras**: que el usuario sin permiso **no** pueda y que el correcto **sí**.
- Para lecturas, RLS no tira error: devuelve 0 filas. Para escrituras bloqueadas por GRANT, sí hay error. Comprobá el resultado consultando con `admin` (la clave secret), no solo mirando el error.
- Si la prueba crea datos, limpialos en un `finally` con `admin` (ver `borrarPedido()`).
- Usá los helpers existentes: `conSesion(email)`, `pedidoDePrueba()`, `ENVIO`, `PAGO`.

> **Regla de la cátedra:** toda tabla, política, GRANT o regla de negocio nueva viene con su prueba en `test-rls.mjs`. Si es una regla de seguridad, mejor escribir la prueba **antes** del cambio: primero falla y después pasa.

## Estructura

```
supabase/schema.sql        Esquema completo e idempotente: tablas, triggers, funciones, RLS, GRANT, vista
scripts/
  _clientes.mjs            Clientes de Supabase para scripts (admin con clave secret)
  seed.mjs                 Datos demo: usuarios, catálogo, pedidos en todos los estados, facturas
  test-rls.mjs             Pruebas automáticas de seguridad
src/
  App.tsx, main.tsx        Rutas (carga diferida) y arranque
  lib/                     supabase.ts, consultas.ts + consultaCache.ts (caché), formato.ts, cargarRutas.ts
  context/                 AuthContext (sesión y rol), CartContext (carrito local)
  routes/                  ProtectedRoute
  components/              Layout, CartPanel, Campo, ResumenCompra, LineaTiempo, DatosPedido, Esqueleto…
  features/auth/           Ingreso, registro y confirmación de cuenta (/auth/confirmado)
  features/tienda/         Catálogo
  features/checkout/       Checkout por pasos y confirmación
  features/client/         Mis pedidos, seguimiento, factura, Mi cuenta
  features/admin/          Panel de administración
AGENTS.md                  Instrucciones para agentes de IA (y resumen para personas)
docs/                      Guía de trabajo con agentes de IA
design.md                  Sistema visual
```

## Trabajar con agentes de IA

Si usás un asistente de código (VS Code + GitHub Copilot, Google Antigravity, Cursor u otro), el repo ya trae sus instrucciones en [`AGENTS.md`](./AGENTS.md) (y un puntero en `.github/copilot-instructions.md`). La guía [docs/trabajar-con-agentes-ia.md](./docs/trabajar-con-agentes-ia.md) explica la mecánica (ciclo plan → tarea chica → diff → build + pruebas → commit), cómo pedir y revisar cambios, los resguardos (secretos, RLS, comandos destructivos, paquetes inventados) y la declaración de uso de IA.

## Supabase: crear el proyecto, conectar credenciales y preparar datos

Este starter ya incluye las dos piezas necesarias para preparar una base de demostración:

- **DDL y seguridad:** [`supabase/schema.sql`](./supabase/schema.sql) crea el esquema de tablas (perfiles, productos, pedidos y renglones), tipo de rol, índices, trigger de perfiles, función `crear_pedido` (precio/stock/total en la base con `FOR UPDATE`), políticas RLS, permisos y vista. Es el esquema fuente de este ejemplo; no hace falta crear otro archivo DDL duplicado.
- **Seed de demostración:** [`scripts/seed.mjs`](./scripts/seed.mjs), ejecutado con `npm run seed`, crea las cuentas de prueba mediante Supabase Auth Admin API, carga un catálogo y genera pedidos ficticios con artículos. El script es local, no es un seed SQL ni se ejecuta en el navegador.

### Crear el proyecto y conseguir las claves

1. En [supabase.com/dashboard](https://supabase.com/dashboard), iniciá sesión y elegí **New project**. Seleccioná la organización, asigná un nombre y una contraseña segura para la base de datos. Guardá esa contraseña en un gestor seguro; no es ninguna de las claves de API de la aplicación.
2. Esperá a que el proyecto termine de aprovisionarse. En **Project Settings → API** copiá la **Project URL**. En **Project Settings → API Keys**, copiá la clave **Publishable** (`sb_publishable_…`) y la clave **Secret** (`sb_secret_…`). En proyectos antiguos pueden aparecer como `anon` y `service_role`, respectivamente.
3. En la raíz de este proyecto, copiá `.env.example` como `.env` y asigná los valores así:
   - Project URL → `VITE_SUPABASE_URL`
   - Publishable key → `VITE_SUPABASE_PUBLISHABLE_KEY`
   - Secret key → `SUPABASE_SECRET_KEY`

   La URL y la clave *publishable* conectan el cliente del navegador; la clave *secret* es solo local para `scripts/seed.mjs` y `scripts/test-rls.mjs`. `TEST_SIGNUP_EMAIL` es opcional y solo se usa en una de las pruebas RLS. No compartas `.env`, no subas sus valores a Git y jamás configures la clave secret en Vercel.

La clave *publishable* está diseñada para ser pública y **no concede por sí misma acceso a los datos**: las políticas RLS del esquema deciden qué puede hacer cada usuario. La clave *secret* evita RLS; cualquier persona que la obtenga puede actuar con privilegios administrativos. Rotala en Supabase si se filtra.

### Aplicar el DDL y ejecutar el seed

En un proyecto Supabase de prueba vacío, seguí este orden:

1. Abrí **SQL Editor → New query**, pegá el contenido de `supabase/schema.sql` y ejecutalo. El archivo puede correrse más de una vez; define las tablas, el trigger de perfil, `crear_pedido()`, índices, políticas RLS y `(SELECT auth.uid())`. Si el proyecto ya tenía el esquema anterior, corré este archivo de nuevo: es idempotente, migra lo que falte (columnas de envío y pago en `pedidos`, tablas `direcciones` y `facturas`, triggers de estado, índices) y emite las facturas de los pedidos ya despachados o entregados. Ver [Actualizar un proyecto existente](#actualizar-un-proyecto-existente).
2. En la terminal, instalá las dependencias y creá los datos demo:

   ```bash
   npm install
   npm run seed
   ```

3. El seed crea tres cuentas de prueba confirmadas (un admin y dos clientes), un catálogo de 8 artículos y pedidos ficticios con renglones. Los usuarios y la contraseña de la demo están en el [aula virtual de PP2 (Moodle)](https://aulasvirtuales.bue.edu.ar/mod/page/view.php?id=1071759). Asigna el rol admin después de crear su usuario. Podés volver a correrlo para reparar/preparar las cuentas y el catálogo; los pedidos (en los cinco estados, con domicilio y pago simulado) se agregan solamente cuando la tabla todavía está vacía. Si ya había pedidos sin artículos o sin domicilio, el seed los completa, guarda un domicilio para cada cliente y emite las facturas que falten. No uses estas credenciales en producción ni cargues datos reales en este proyecto.
4. Verificá el aislamiento ejecutando `npm run test:rls` y probá la app con `npm run dev`.

### Actualizar un proyecto existente

Si tu proyecto ya tenía una versión anterior del esquema:

1. Pegá y ejecutá de nuevo `supabase/schema.sql` en el SQL Editor (es idempotente; no borra datos).
2. **Publicá enseguida el frontend nuevo**: `crear_pedido()` ahora recibe domicilio y pago, así que el carrito de la versión anterior deja de poder comprar.
3. (Opcional) `npm run seed` para completar domicilios, pedidos de ejemplo y facturas.
4. `npm run test:rls`.

No insertamos usuarios directamente en `auth.users` con SQL: Supabase Auth administra esa tabla y el trigger del esquema crea cada perfil. Por eso el seed usa la Auth Admin API desde un script local con la clave secret, sin exponerla al navegador. Si solo necesitás preparar el esquema, ejecutá el DDL y omití `npm run seed`.

## Rendimiento

Este starter es una **SPA con Vite (CSR)**: el navegador baja el JavaScript, pinta la UI y habla con Supabase. El caché vive en el cliente (`consultaCache.ts`). Es la elección del curso porque se ve completo el camino *navegador → Auth → RLS*, sin un servidor Node intermedio.

**Cuándo convendría SSR/SSG (Next, Astro), sin migrar este repo:** si el primer HTML tiene que aparecer con datos (SEO, catálogo público indexable, TTFB en redes lentas) o si querés esconder la clave publishable detrás de un servidor. Para un panel con login y un catálogo de demostración, CSR + caché alcanza y se lee mejor.

No usa TanStack Query: tres lecturas (catálogo, Mis pedidos, resumen admin) entran en un módulo de ~100 líneas que los alumnos pueden abrir. Una librería sumaría API (QueryClient, query keys) y kilobytes gzip a cambio de lo mismo.

Técnicas (cada una comentada en el código):

- **Esqueletos** en catálogo, Mis pedidos, seguimiento, Mi cuenta y Administración.
- **Caché por clave** con TTL (30 s fresco), stale-while-revalidate, deduplicación de requests en vuelo, invalidación tras `crear_pedido` y tras cambiar estado, refetch al volver el foco solo si el dato está viejo. El catálogo además se guarda en `sessionStorage`.
- **Carrito 100 % local.** Contextos separados: el badge de la barra solo mira `cantidadTotal`; `memo` en la tarjeta evita re-pintar toda la grilla en cada +/−.
- **Consultas:** columnas puntuales, embed de PostgREST (pedido + detalles, sin N+1), paginación `.range()` sin `COUNT(*)` (si la página vino llena, hay más). El resumen admin es una **vista SQL**, no un `reduce` en el cliente.
- **`getSession()`** al arrancar (JWT local). `getUser()` haría red.
- **`React.lazy`** + prefetch del chunk **y** de los datos al pasar el mouse por Tienda / Mis pedidos / Mi cuenta / Administración, y del checkout al pasar por «Ir a pagar».
- **`preconnect`** a Supabase en `index.html`.
- **Code splitting** con `React.lazy` (checkout, confirmación, seguimiento, factura, Mi cuenta, Mis pedidos y Administración). Medimos `manualChunks` de React/supabase-js: el gzip del primer load no baja, y forzar un chunk de supabase-js anula el tree-shaking. En Vercel, `/assets/*` se cachea 1 año (`immutable`); `index.html` va con `no-cache`.
- **Índices** que cubren los filtros reales y políticas con `(SELECT auth.uid())` + `is_admin()` STABLE. Si el proyecto demo ya tenía el esquema de `main`, **volvé a pegar `schema.sql`** (es idempotente) para los índices nuevos.

Para comprobar el code splitting: `npm run build` y mirá `dist/assets`.

## UI y guía de diseño

La interfaz usa el mismo sistema visual que [`ecommerce-ifts16-supabase`](https://github.com/fabioitaliano-coder/ecommerce-ifts16-supabase): CSS plano y variables en [`src/index.css`](./src/index.css). La guía está en [`design.md`](./design.md). Antes de pedir un cambio visual, pedile que lea esa guía, reutilice las clases existentes (`tienda-layout`, `CartPanel`, `estado`, `insignia-stock`) y no agregue Tailwind ni otra biblioteca de componentes.

Ejemplo de solicitud:

> Leé `design.md` antes de cambiar la UI. Aplicá el diseño existente (CSS plano y tokens en `:root`), preservá accesibilidad y responsive (carrito al costado en escritorio, barra inferior en celular) y no agregues Tailwind ni shadcn/ui. Actualizá `design.md` solo si proponés un nuevo valor compartido.

## Desarrollo local

```bash
npm run dev       # http://localhost:5173
npm run test:rls  # intenta leer datos ajenos, ascenderse a admin, etc.
```

Antes, completá `.env`, aplicá el DDL y ejecutá `npm run seed` siguiendo «Supabase: crear el proyecto, conectar credenciales y preparar datos». La variable `TEST_SIGNUP_EMAIL` es opcional; sin ella se omite únicamente la prueba de registro público.

## CLI de GitHub, Vercel y Supabase

Además de la interfaz web, podés usar las herramientas oficiales de línea de comandos (CLI). No son dependencias de la aplicación: se ejecutan desde una terminal y cada una requiere iniciar sesión por separado.

### GitHub CLI (`gh`)

Usalo para consultar el repositorio, issues y pull requests desde la terminal. Instalá GitHub CLI según tu sistema y autenticá tu cuenta:

```bash
gh auth login
gh auth status
gh repo view
```

`gh repo view` y otros comandos que usan el repositorio actual necesitan que estés en un clon conectado a GitHub. Este starter puede estar dentro de un repositorio más grande; antes de publicar cambios, comprobá con `git remote -v` cuál es el remoto para no subirlos al proyecto equivocado.

### Vercel CLI (`vercel`)

Usalo para vincular el directorio con un proyecto de Vercel y publicar sin pasar por el panel web:

```bash
npx vercel login
npx vercel link
npx vercel                 # despliegue de prueba
npx vercel deploy --prod   # despliegue de producción
```

La primera vez, `vercel link` te pide seleccionar o crear un proyecto. Para que el sitio pueda conectarse con Supabase, configurá allí `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (desde **Settings → Environment Variables** o con `npx vercel env add`). Los valores `VITE_*` son públicos porque quedan incorporados al JavaScript que recibe el navegador. **Nunca cargues `SUPABASE_SECRET_KEY` en Vercel.**

### Supabase CLI (`supabase`)

Usalo para autenticarte y consultar los proyectos disponibles:

```bash
npx supabase login
npx supabase projects list
```

Para la primera instalación, este starter usa **SQL Editor** y el archivo `supabase/schema.sql`; listar proyectos con la CLI no conecta automáticamente la app ni copia sus claves a `.env`. El identificador del proyecto es la parte anterior a `.supabase.co` en la Project URL. Si elegís administrar el esquema con la CLI en vez del panel, inicializá y vinculá el proyecto (`npx supabase init`, `npx supabase link --project-ref TU_PROJECT_REF`) y adoptá migraciones versionadas antes de usar `npx supabase db push`. No alternes SQL Editor y migraciones sin controlar qué cambios ya se aplicaron.

## Las dos claves

- **Publishable** (`sb_publishable_…`; en proyectos viejos *anon*): va en el navegador con el prefijo `VITE_`. No es un secreto; el aislamiento lo garantizan las políticas RLS.
- **Secret** (`sb_secret_…`; en proyectos viejos *service_role*): saltea RLS. Solo se usa en `scripts/`, desde tu máquina. Nunca con prefijo `VITE_`, nunca en Render o Vercel, nunca en Git. Si se filtra, hay que rotarla desde el panel.

## Primer administrador

El registro siempre crea un `cliente`. Para el primer admin, registrá la cuenta y ejecutá en el SQL Editor:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'tu_email@ejemplo.com';
```

## Despliegue en Vercel

La aplicación es un sitio estático de Vite: al ejecutar `npm run build` se genera `dist/`, que es lo que Vercel publica. Para desplegarla:

1. Subí el proyecto a un repositorio Git y, en Vercel, elegí **Add New → Project** para importarlo.
2. Verificá la configuración de compilación: framework **Vite**, comando `npm run build` y directorio de salida `dist`.
3. En **Settings → Environment Variables**, agregá `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` con los valores de tu proyecto Supabase. Seleccioná los entornos en los que vas a probar o publicar (por ejemplo, Production y Preview).
4. Creá el despliegue. Los valores `VITE_*` se incorporan al bundle durante la compilación; si los cambiás, generá un nuevo despliegue para que el sitio use los valores actualizados.

### Por qué existe `vercel.json`

La aplicación usa React Router para mostrar rutas como `/login` y `/admin` en el navegador. Al abrir o recargar directamente una de esas direcciones, Vercel debe servir la aplicación de una sola página en vez de buscar un archivo físico con ese nombre. `vercel.json` reescribe esas solicitudes a `/index.html` y además pone `Cache-Control: public, max-age=31536000, immutable` en `/assets/*` (archivos con hash) y `no-cache` en `index.html` (para que un deploy nuevo no quede pegado). La regla **excluye** `/assets/` y cualquier ruta que termine en extensión (`.js`, `.css`, `.ico`…): si un archivo no existe, devuelve un 404 real en vez de `index.html`. `public/_redirects` es la regla equivalente para otros hostings.

**La pestaña en blanco después de un deploy.** Cada build genera archivos con hash nuevo y borra los viejos. Si alguien tenía la app abierta y navega a una pantalla de carga diferida, el navegador pide un chunk que ya no existe. Antes, ese pedido recibía `index.html` (HTML en lugar de JavaScript) y la pantalla quedaba en blanco. Ahora el 404 es real, Vite dispara `vite:preloadError` y `main.tsx` recarga la página **una sola vez** (`recargaChunk.ts`), con lo que se baja la versión nueva. Si aun así falla, `LimiteError.tsx` muestra un mensaje con un botón para recargar.

### Conectar el dominio con Supabase (registro, confirmación de email y Mi cuenta)

> [!TIP]
> **Síntoma:** «Me registré, me llegó el mail, pero al tocar el enlace no quedé logueado» o «el enlace me lleva a `http://localhost:3000`».
>
> **Causa:** en un proyecto nuevo de Supabase la **Site URL** viene en `http://localhost:3000`. Supabase confirma la cuenta igual, pero después redirige a la Site URL salvo que la dirección que pide la app (`emailRedirectTo`) esté en la lista de **Redirect URLs**. Si ninguna coincide con tu sitio, el navegador termina en otro lado y la sesión no se inicia donde estabas.
>
> **Arreglo A · Panel:** **Authentication → URL Configuration**
> - **Site URL:** la URL de tu deploy, por ejemplo `https://tu-app.vercel.app`.
> - **Redirect URLs:** `https://tu-app.vercel.app/**` y `http://localhost:5173/**` (5173 es el puerto por defecto de `npm run dev`; si Vite te muestra otro, usá ese).
>
> **Arreglo B · Supabase CLI:** un `supabase/config.toml` mínimo, **solo** con lo que querés cambiar:
>
> ```toml
> project_id = "TU_PROJECT_REF"   # lo que va antes de .supabase.co
>
> [auth]
> site_url = "https://tu-app.vercel.app"
> additional_redirect_urls = ["https://tu-app.vercel.app/**", "http://localhost:5173/**"]
> ```
>
> ```bash
> npx supabase link --project-ref TU_PROJECT_REF
> npx supabase config diff    # muestra qué cambiaría en el proyecto remoto
> npx supabase config push    # pide confirmación por cada cambio
> ```
>
> `config push` solo sube las propiedades que el archivo declara; las demás quedan como están. **Leé siempre el diff antes de confirmar.** Ojo: el `config.toml` completo que genera `npx supabase init` declara muchísimas opciones con valores de desarrollo local (entre ellas `site_url = "http://127.0.0.1:3000"`); si lo subís sin revisar, pisás la configuración del proyecto.
>
> **Si cambiás de dominio** (otro proyecto de Vercel, un dominio propio, renombrás el proyecto), actualizá la Site URL y las Redirect URLs. El nuevo deploy no lo hace solo.

Así funciona el circuito en este starter:

1. `RegisterForm.tsx` llama a `signUp` con `emailRedirectTo = <origen actual>/auth/confirmado`. Por eso el enlace vuelve al mismo sitio donde la persona se registró: la demo o `localhost`.
2. Supabase verifica el token y redirige con la sesión en el `#hash`. `supabase-js` la detecta sola (`detectSessionInUrl`, flujo implícito: el enlace funciona aunque lo abras en otro dispositivo).
3. `ConfirmacionCuenta.tsx` lleva a la tienda con el aviso «Cuenta confirmada». Si el enlace venció o ya se usó (`otp_expired`), explica qué pasó y ofrece **reenviar el mail** (`supabase.auth.resend`, con 60 s de espera entre envíos). Si el enlace cayó en la Site URL, `Layout.tsx` igual lo deriva a esa pantalla.
4. Si alguien intenta ingresar sin haber confirmado, el login dice «Todavía no confirmaste tu email» y ofrece reenviar, en vez de «contraseña incorrecta».

**«Confirm email»** (**Authentication → Sign In / Providers → Email**): si está activado, la cuenta no puede ingresar hasta tocar el enlace (es lo recomendable y lo que asume esta app). Si lo desactivás, `signUp` inicia sesión en el acto y la app va directo a la tienda. En la misma pantalla está **Minimum password length**: ponelo en 8 para que coincida con la validación del formulario. El SMTP de prueba de Supabase manda **muy pocos mails por hora**; si probás muchas altas seguidas, vas a ver el aviso de límite. Los correos institucionales a veces «revisan» los enlaces antes que vos y los consumen: si te aparece «enlace vencido», probá ingresar, porque la cuenta puede ya estar confirmada.

El **cambio de email de Mi cuenta** usa el mismo mecanismo: el enlace vuelve a `/cuenta`, que también queda cubierto por `/**`. Las cuentas `@demo.test` no reciben correo: para probar estos flujos usá un mail real tuyo.

> **Importante:** en Vercel configurá únicamente la URL del proyecto y la clave *publishable*. No agregues `SUPABASE_SECRET_KEY` ni una clave antigua `service_role`: esas credenciales evitan RLS y son solo para ejecutar scripts locales. Si una clave secreta se publica accidentalmente, rotala desde Supabase.

Antes de compartir el sitio, probá iniciar sesión con los dos roles y verificá que cada uno vea únicamente su sección. Las cuentas demo tienen una contraseña conocida y sus datos son descartables; no las uses con información real.
