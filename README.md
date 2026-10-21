# PP2 · Starter Supabase (React + Vite + TypeScript)

Aplicación de referencia de Práctica Profesionalizante II · IFTS 16. Muestra el camino **Supabase como BaaS**: el navegador habla directo con Supabase y la seguridad vive en la base (RLS), no en un servidor propio.

> Para una app más completa (catálogo, carrito, checkout transaccional y panel de administración), mirá [`ecommerce-ifts16-supabase`](https://github.com/fabioitaliano-coder/ecommerce-ifts16-supabase).

Datos 100 % ficticios (Ley 25.326). Licencia MIT.

## Qué demuestra

| Tema | Dónde verlo |
| :--- | :--- |
| Alta de usuario con perfil automático (trigger) | `supabase/schema.sql`, secciones 2 y 3 |
| El rol **nunca** se toma de lo que manda el cliente | trigger `handle_new_user()` y `RegisterForm.tsx` |
| RLS por dueño y por rol (`is_admin()`) | `supabase/schema.sql`, sección 6 |
| Vista SQL que respeta RLS (`security_invoker`) | `supabase/schema.sql`, sección 7 y `PanelAdmin.tsx` |
| Clave pública frente a clave privada | `.env.example`, `src/lib/supabase.ts`, `scripts/_clientes.mjs` |
| Cliente singleton, `AuthContext`, rutas protegidas | `src/lib/`, `src/context/`, `src/routes/` |
| Paginación con `.range()` y `count: 'exact'` | `MisPedidos.tsx`, `PanelAdmin.tsx` |
| Pruebas que intentan romper la seguridad | `scripts/test-rls.mjs` |

## Puesta en marcha

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor** pegá y ejecutá `supabase/schema.sql`.
3. En **Project Settings → API Keys** copiá la URL, la clave *publishable* y la clave *secret*.
4. Copiá `.env.example` a `.env` y completá los tres valores.
5. Instalá y cargá datos de prueba:

```bash
npm install
npm run seed        # crea admin@demo.test, cliente1@demo.test, cliente2@demo.test (clave demo1234)
npm run test:rls    # intenta leer datos ajenos, ascenderse a admin, etc.
npm run dev         # http://localhost:5173
```

## Las dos claves

- **Publishable** (`sb_publishable_…`; en proyectos viejos *anon*): va en el navegador con el prefijo `VITE_`. No es un secreto; el aislamiento lo garantizan las políticas RLS.
- **Secret** (`sb_secret_…`; en proyectos viejos *service_role*): saltea RLS. Solo se usa en `scripts/`, desde tu máquina. Nunca con prefijo `VITE_`, nunca en Render o Vercel, nunca en Git. Si se filtra, hay que rotarla desde el panel.

## Primer administrador

El registro siempre crea un `cliente`. Para el primer admin, registrá la cuenta y ejecutá en el SQL Editor:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'tu_email@ejemplo.com';
```

## Despliegue

Es un sitio estático: `npm run build` genera `dist/`. En Render (Static Site) o Vercel configurá `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (las dos públicas) y la regla de reescritura a `/index.html` (ya incluida en `public/_redirects`). **No cargues la clave secret en el hosting.**

En el proyecto de Supabase agregá la URL del sitio en **Authentication → URL Configuration**.

> Los usuarios demo tienen clave conocida: si publicás la demo, tratá esos datos como descartables.
