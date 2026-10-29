# PP2 · Starter Supabase (React + Vite + TypeScript)

Aplicación de referencia de Práctica Profesionalizante II · IFTS 16. Muestra el camino **Supabase como BaaS**: el navegador habla directo con Supabase y la seguridad vive en la base (RLS), no en un servidor propio.

Este repo es la **base copiable** (auth, RLS, catálogo, carrito y pedidos). Cuando termines de recorrerlo, el siguiente paso es la app completa: [`ecommerce-ifts16-supabase`](https://github.com/fabioitaliano-coder/ecommerce-ifts16-supabase) (categorías, descuentos, Storage, administración de catálogo).

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

8. **Levantá la app.** El catálogo se ve sin iniciar sesión; para comprar y para administrar sí hace falta entrar:

   ```bash
   npm run dev   # http://localhost:5173
   ```

9. **(Opcional) Publicala en Vercel.** Ver [Despliegue en Vercel](#despliegue-en-vercel).

**Si algo falla:** si la app avisa que faltan variables de Supabase, revisá que el archivo se llame exactamente `.env`, que esté en la raíz del proyecto y reiniciá `npm run dev`. Si `npm run seed` falla, revisá `SUPABASE_SECRET_KEY` y que hayas ejecutado `schema.sql` antes. Dudas: foro de consultas del aula virtual.

## Qué demuestra

| Tema | Dónde verlo |
| :--- | :--- |
| Alta de usuario con perfil automático (trigger) | `supabase/schema.sql`, secciones 2 y 3 |
| El rol **nunca** se toma de lo que manda el cliente | trigger `handle_new_user()` y `RegisterForm.tsx` |
| Catálogo público, carrito lateral y checkout | `Tienda.tsx`, `CartPanel.tsx`, función `crear_pedido()` |
| Precio, stock y total calculados en la base (`FOR UPDATE`) | `crear_pedido()` en `supabase/schema.sql`, sección 6 |
| RLS por dueño y por rol (`is_admin()`) | `supabase/schema.sql`, sección 7 |
| Vista SQL que respeta RLS (`security_invoker`) | `supabase/schema.sql`, sección 8 y `PanelAdmin.tsx` |
| Badges de estado reutilizados | `EstadoBadge.tsx`, `MisPedidos.tsx`, `PanelAdmin.tsx` |
| Clave pública frente a clave privada | `.env.example`, `src/lib/supabase.ts`, `scripts/_clientes.mjs` |
| Cliente singleton, `AuthContext`, rutas protegidas | `src/lib/`, `src/context/`, `src/routes/` |
| Diseño (mismas clases que la app de referencia) | `design.md`, `src/index.css` |
| Paginación con `.range()` y `count: 'exact'` | `MisPedidos.tsx`, `PanelAdmin.tsx` |
| Pruebas que intentan romper la seguridad | `scripts/test-rls.mjs` |

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

1. Abrí **SQL Editor → New query**, pegá el contenido de `supabase/schema.sql` y ejecutalo. El archivo puede correrse más de una vez; define las tablas, el trigger de perfil, `crear_pedido()` y las políticas de seguridad. Si el proyecto ya tenía el esquema anterior, corré este archivo de nuevo: es idempotente y migra `pedido_detalles` (columna `producto_nombre`).
2. En la terminal, instalá las dependencias y creá los datos demo:

   ```bash
   npm install
   npm run seed
   ```

3. El seed crea tres cuentas de prueba confirmadas (un admin y dos clientes), un catálogo de 8 artículos y pedidos ficticios con renglones. Los usuarios y la contraseña de la demo están en el [aula virtual de PP2 (Moodle)](https://aulasvirtuales.bue.edu.ar/mod/page/view.php?id=1071759). Asigna el rol admin después de crear su usuario. Podés volver a correrlo para reparar/preparar las cuentas y el catálogo; los pedidos se agregan solamente cuando la tabla todavía está vacía. Si ya había pedidos sin artículos, el seed les carga renglones. No uses estas credenciales en producción ni cargues datos reales en este proyecto.
4. Verificá el aislamiento ejecutando `npm run test:rls` y probá la app con `npm run dev`.

No insertamos usuarios directamente en `auth.users` con SQL: Supabase Auth administra esa tabla y el trigger del esquema crea cada perfil. Por eso el seed usa la Auth Admin API desde un script local con la clave secret, sin exponerla al navegador. Si solo necesitás preparar el esquema, ejecutá el DDL y omití `npm run seed`.

## Rendimiento y carga

- Las pantallas de pedidos y administración se cargan bajo demanda con `React.lazy`; el JavaScript inicial no necesita descargar ambas antes de mostrar el ingreso.
- `AuthContext` conserva el rol en memoria por 60 segundos para evitar repetir la consulta del perfil ante eventos cercanos de renovación de sesión. El valor no se guarda en `localStorage`; al expirar se vuelve a consultar y los errores se muestran en pantalla.
- Este caché de rol solo evita trabajo repetido en la interfaz: no concede acceso a los datos. Las políticas RLS de Supabase siguen autorizando cada consulta y escritura.
- La paginación limita las filas solicitadas por pantalla. Para tablas grandes, revisar consultas, índices y políticas con datos representativos; no aumentar el tamaño de página como sustituto de medir.

Para comprobar la optimización, ejecutá `npm run build` y compará los archivos de `dist/assets`: las vistas cliente y admin deben aparecer como chunks separados. En producción, usá las herramientas de red del navegador para distinguir descarga de JavaScript, verificación de sesión y tiempo de respuesta de Supabase; son etapas distintas y conviene medirlas por separado.

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

La aplicación usa React Router para mostrar rutas como `/login` y `/admin` en el navegador. Al abrir o recargar directamente una de esas direcciones, Vercel debe servir la aplicación de una sola página en vez de buscar un archivo físico con ese nombre. La regla de `vercel.json` reescribe las solicitudes a `/index.html`, y React Router decide qué pantalla mostrar. `public/_redirects` es la regla equivalente para otros hostings que la admiten; en Vercel se usa `vercel.json`.

### Conectar el dominio con Supabase

En el proyecto de Supabase, abrí **Authentication → URL Configuration** y configurá la URL pública del sitio como **Site URL**. Agregá también las URL de los despliegues de prueba que necesites en **Redirect URLs**, en especial si vas a probar confirmación de correo o recuperación de contraseña. Así Supabase puede volver al dominio correcto después de esos flujos.

> **Importante:** en Vercel configurá únicamente la URL del proyecto y la clave *publishable*. No agregues `SUPABASE_SECRET_KEY` ni una clave antigua `service_role`: esas credenciales evitan RLS y son solo para ejecutar scripts locales. Si una clave secreta se publica accidentalmente, rotala desde Supabase.

Antes de compartir el sitio, probá iniciar sesión con los dos roles y verificá que cada uno vea únicamente su sección. Las cuentas demo tienen una contraseña conocida y sus datos son descartables; no las uses con información real.
