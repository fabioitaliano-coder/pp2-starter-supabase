-- =============================================================================
-- schema.sql · Esquema, trigger de alta y políticas RLS (PP2 · IFTS 16)
-- =============================================================================
-- Cómo ejecutarlo: Supabase Studio > SQL Editor > New query > pegar > Run.
-- Es idempotente: se puede correr más de una vez.
-- Solo datos ficticios (Ley 25.326).

-- 1. ROLES ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('cliente', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. PERFILES (1 a 1 con auth.users) --------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  full_name  TEXT NOT NULL,
  role       public.user_role NOT NULL DEFAULT 'cliente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TRIGGER: al registrarse en Supabase Auth se crea el perfil solo ------------
-- Concepto · Nunca confiar en el cliente: raw_user_meta_data lo escribe quien se
-- registra (supabase.auth.signUp({ options: { data: {...} } })). Si de ahí se
-- leyera el rol, cualquiera podría registrarse como admin. El rol SIEMPRE nace
-- como 'cliente'; el primer admin se promueve a mano (ver README).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    'cliente'
  );
  RETURN NEW;
END;
$$;

-- Solo el motor de autenticación dispara el trigger; nadie la llama por la API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. TABLAS DE NEGOCIO ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pedidos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  total      NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  estado     TEXT NOT NULL DEFAULT 'pendiente'
             CHECK (estado IN ('pendiente', 'confirmado', 'entregado', 'cancelado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pedidos_user_id_idx ON public.pedidos (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.pedido_detalles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  producto        TEXT NOT NULL,
  cantidad        INT NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0)
);

-- 5. HELPER is_admin() ------------------------------------------------------------
-- Concepto · SECURITY DEFINER evita la recursión infinita: la función lee
-- profiles salteándose su RLS, así una política de profiles puede preguntar "¿es admin?".
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 6. RLS: activar en TODAS las tablas ---------------------------------------------
-- Sin ENABLE ROW LEVEL SECURITY, la clave pública deja leer y escribir todo.
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_detalles ENABLE ROW LEVEL SECURITY;

-- profiles: cada uno ve el suyo; el admin ve todos; solo el admin cambia roles.
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- pedidos: el cliente ve y crea los suyos (siempre 'pendiente'); el admin ve todos
-- y es el único que cambia el estado. Nadie borra pedidos desde la API.
DROP POLICY IF EXISTS "pedidos_select" ON public.pedidos;
CREATE POLICY "pedidos_select" ON public.pedidos FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "pedidos_insert_propio" ON public.pedidos;
CREATE POLICY "pedidos_insert_propio" ON public.pedidos FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND estado = 'pendiente');

DROP POLICY IF EXISTS "pedidos_update_admin" ON public.pedidos;
CREATE POLICY "pedidos_update_admin" ON public.pedidos FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- pedido_detalles: se hereda el acceso del pedido al que pertenecen.
DROP POLICY IF EXISTS "detalles_select" ON public.pedido_detalles;
CREATE POLICY "detalles_select" ON public.pedido_detalles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.id = pedido_id AND (p.user_id = (SELECT auth.uid()) OR public.is_admin())
  ));

DROP POLICY IF EXISTS "detalles_insert_propio" ON public.pedido_detalles;
CREATE POLICY "detalles_insert_propio" ON public.pedido_detalles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.id = pedido_id AND p.user_id = (SELECT auth.uid())
  ));

-- 7. VISTA para el panel admin ------------------------------------------------------
-- Concepto · security_invoker = true: la vista se ejecuta con los permisos de quien
-- consulta, así RLS de pedidos sigue aplicando. Sin esto la vista corre como su
-- dueño y se saltea RLS (fuga clásica).
CREATE OR REPLACE VIEW public.resumen_pedidos_por_estado
WITH (security_invoker = true) AS
  SELECT estado, COUNT(*)::INT AS cantidad, COALESCE(SUM(total), 0)::NUMERIC(12,2) AS total
  FROM public.pedidos
  GROUP BY estado;

-- 8. PERMISOS de la API --------------------------------------------------------------
-- anon (sin sesión) no accede a nada; authenticated, solo lo que RLS permita.
REVOKE ALL ON public.profiles, public.pedidos, public.pedido_detalles,
              public.resumen_pedidos_por_estado FROM anon;
GRANT SELECT, UPDATE         ON public.profiles                  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pedidos                   TO authenticated;
GRANT SELECT, INSERT         ON public.pedido_detalles           TO authenticated;
GRANT SELECT                 ON public.resumen_pedidos_por_estado TO authenticated;
