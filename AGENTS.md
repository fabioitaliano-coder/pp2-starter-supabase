# AGENTS.md — guía del starter para estudiantes

Este archivo explica cómo recorrer y extender el ejemplo. No reemplaza la guía de instalación y despliegue de [README.md](./README.md).

## Instrucciones obligatorias para cambios de interfaz

- Antes de crear o modificar pantallas, estilos, componentes visuales o dependencias de UI, leé [`design.md`](./design.md) y usalo como referencia de diseño y accesibilidad.
- La UI usa Tailwind CSS v4 con tokens manuales en `src/index.css`. No generes ni regeneres paletas o tokens automáticamente.
- No agregues shadcn/ui ni otra biblioteca visual sin que el usuario lo solicite expresamente.
- Si un cambio necesita un token compartido nuevo, documentá su valor y propósito en `design.md` y definilo manualmente en `src/index.css` en el mismo cambio.
- Conservá etiquetas, foco visible, navegación por teclado, mensajes de estado y adaptación móvil.

## Cómo usar este proyecto

1. Empezá por el README: creá un proyecto Supabase de prueba, obtené su Project URL y claves *publishable*/*secret*, y completá `.env` sin compartir ni publicar la clave secret.
2. Ejecutá `supabase/schema.sql` en SQL Editor para instalar el DDL, el trigger y las políticas RLS.
3. Corré `npm install` y después `npm run seed` para crear las cuentas Auth y pedidos ficticios.
4. Usá `npm run dev` para probar la aplicación. Iniciá sesión como cliente y como administrador para comparar lo que muestra cada rol.
5. Antes de dar por terminado un cambio de acceso o datos, ejecutá `npm run test:rls`. Estas pruebas intentan acceder a datos ajenos y modificar permisos.
6. Consultá la tabla «Qué demuestra» del README para encontrar el archivo relacionado con cada concepto.

## Herramientas CLI opcionales

Las herramientas CLI sirven para operar los servicios desde la terminal; no forman parte del bundle de la aplicación. Autenticá cada CLI con tu propia cuenta:

- **GitHub CLI (`gh`)**: `gh auth login`, `gh auth status` y `gh repo view`. Usala para consultar el repositorio y colaborar mediante GitHub. Revisá `git remote -v` antes de publicar: este ejemplo puede vivir dentro de un repositorio padre.
- **Vercel CLI (`npx vercel`)**: `npx vercel login`, `npx vercel link` y `npx vercel deploy --prod`. Sirve para vincular y desplegar el sitio. Configurá solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en el proyecto; nunca cargues `SUPABASE_SECRET_KEY`.
- **Supabase CLI (`npx supabase`)**: `npx supabase login` y `npx supabase projects list` permiten autenticarte y consultar tus proyectos. En este starter el esquema se aplica inicialmente desde **SQL Editor**. Para adoptar `supabase db push`, primero organizá los cambios como migraciones versionadas y revisá el SQL antes de aplicarlo.

## Dónde mirar y cuándo

- `src/App.tsx`: agregá o modificá las rutas de pantalla. Usá `ProtectedRoute` para decidir quién puede navegar a una ruta.
- `src/routes/ProtectedRoute.tsx`: estudiá el guard de navegación y el uso de `<Outlet />` para renderizar rutas anidadas.
- `src/context/AuthContext.tsx`: consultá el estado de sesión y el rol disponible para los componentes.
- `design.md`: seguí este esquema antes de solicitar o implementar cualquier trabajo visual.
- `src/lib/supabase.ts`: reutilizá el cliente compartido para consultas desde la aplicación.
- `supabase/schema.sql`: definí tablas, roles, funciones y políticas RLS. La autorización de los datos debe vivir en la base.
- `scripts/seed.mjs`: seed de demostración local. Crea usuarios con Auth Admin API y agrega pedidos de prueba; necesita `SUPABASE_SECRET_KEY`.
- `scripts/`: ejecutá tareas locales de demostración y pruebas. Solo estos scripts usan la clave `SUPABASE_SECRET_KEY`.

## Reglas para aprender y modificar con seguridad

- `ProtectedRoute` controla la navegación y mejora la experiencia; no es una barrera de seguridad. Una persona puede omitir el frontend y llamar a Supabase directamente.
- Cada operación sobre datos debe quedar protegida por políticas RLS. No uses el rol del cliente para decidir permisos en la base.
- La clave `VITE_SUPABASE_PUBLISHABLE_KEY` puede estar en el navegador; `SUPABASE_SECRET_KEY` no. Nunca copies una clave secreta a `VITE_*`, al código, a Git o al hosting.
- No crees un segundo seed SQL para duplicar `scripts/seed.mjs`: la identidad de usuario la gestiona Supabase Auth. Si hace falta cambiar el esquema, actualizá el DDL o introducí migraciones versionadas de forma explícita.
- Los datos y usuarios de demostración son ficticios. No cargues información real ni publiques las contraseñas de demo como si fueran seguras.
- Al sumar una pantalla, verificá el flujo sin sesión, con rol autorizado y con rol no autorizado; luego confirmá que RLS limita también las consultas directas.
