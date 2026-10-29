-- =============================================================================
-- schema.sql · Esquema, trigger de alta y políticas RLS (PP2 · IFTS 16)
-- =============================================================================
-- Cómo ejecutarlo: Supabase Studio > SQL Editor > New query > pegar > Run.
-- Es idempotente: se puede correr más de una vez (proyecto vacío o demo ya creada).
-- Solo datos ficticios (Ley 25.326).
-- Los nombres (crear_pedido, pedido_detalles, producto_nombre) coinciden con la
-- app de referencia ecommerce-ifts16-supabase, en una versión más chica.

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
-- registra. El rol SIEMPRE nace como 'cliente'; el primer admin se promueve a mano.
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

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. TABLAS DE NEGOCIO ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.productos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  precio      NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
  stock       INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  emoji       TEXT NOT NULL DEFAULT '📦',
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS productos_nombre_idx ON public.productos (nombre);

CREATE TABLE IF NOT EXISTS public.pedidos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  total      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  estado     TEXT NOT NULL DEFAULT 'pendiente'
             CHECK (estado IN ('pendiente', 'confirmado', 'entregado', 'cancelado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pedidos_user_id_idx ON public.pedidos (user_id, created_at DESC);
ALTER TABLE public.pedidos ALTER COLUMN total SET DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.pedido_detalles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  cantidad        INT NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (precio_unitario >= 0)
);
ALTER TABLE public.pedido_detalles
  ADD COLUMN IF NOT EXISTS producto_id UUID REFERENCES public.productos(id) ON DELETE SET NULL;
ALTER TABLE public.pedido_detalles
  ADD COLUMN IF NOT EXISTS producto_nombre TEXT;
ALTER TABLE public.pedido_detalles
  ADD COLUMN IF NOT EXISTS nombre TEXT;
ALTER TABLE public.pedido_detalles
  ALTER COLUMN precio_unitario SET DEFAULT 0;

-- Compatibilidad con el starter anterior (columna texto "producto" o "nombre").
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pedido_detalles' AND column_name = 'producto'
  ) THEN
    UPDATE public.pedido_detalles
       SET producto_nombre = COALESCE(producto_nombre, nombre, producto)
     WHERE producto_nombre IS NULL;
    ALTER TABLE public.pedido_detalles DROP COLUMN producto;
  END IF;
END $$;

UPDATE public.pedido_detalles
   SET producto_nombre = COALESCE(producto_nombre, nombre, 'Artículo')
 WHERE producto_nombre IS NULL;
ALTER TABLE public.pedido_detalles ALTER COLUMN producto_nombre SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pedido_detalles' AND column_name = 'nombre'
  ) THEN
    ALTER TABLE public.pedido_detalles DROP COLUMN nombre;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pedido_detalles_pedido_id_idx ON public.pedido_detalles (pedido_id);

-- 5. HELPER is_admin() ------------------------------------------------------------
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

-- 6. CHECKOUT: crear_pedido() calcula precio, stock y total en la base ------------
-- Concepto · El navegador manda solo [{ producto_id, cantidad }]. Precio y stock
-- salen de la fila real, bloqueada con FOR UPDATE (dos compras no venden la misma
-- última unidad). Si algo falla, RAISE EXCEPTION revierte pedido y stock juntos.
-- Misma idea que en ecommerce-ifts16-supabase, sin descuentos.
DROP TRIGGER IF EXISTS pedidos_before_insert_total ON public.pedidos;
DROP TRIGGER IF EXISTS pedido_detalles_before_insert ON public.pedido_detalles;
DROP TRIGGER IF EXISTS pedido_detalles_after_write ON public.pedido_detalles;
DROP FUNCTION IF EXISTS public.forzar_total_cero_al_crear();
DROP FUNCTION IF EXISTS public.preparar_detalle_pedido();
DROP FUNCTION IF EXISTS public.recalcular_total_pedido();

CREATE OR REPLACE FUNCTION public.crear_pedido(p_items JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID := (SELECT auth.uid());
  v_pedido   UUID;
  v_item     JSONB;
  v_prod     public.productos%ROWTYPE;
  v_cantidad INT;
  v_total    NUMERIC(10,2) := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Tenés que iniciar sesión para comprar.' USING ERRCODE = '28000';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El carrito está vacío.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'El carrito supera el máximo de 50 renglones.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.pedidos (user_id, total, estado)
  VALUES (v_uid, 0, 'pendiente')
  RETURNING id INTO v_pedido;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    BEGIN
      v_cantidad := (v_item->>'cantidad')::INT;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Cantidad inválida.' USING ERRCODE = '22023';
    END;
    IF v_cantidad IS NULL OR v_cantidad <= 0 OR v_cantidad > 100 THEN
      RAISE EXCEPTION 'Cantidad inválida (1 a 100).' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_prod
      FROM public.productos
     WHERE id = (v_item->>'producto_id')::UUID AND activo
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'El artículo no está disponible.' USING ERRCODE = 'P0002';
    END IF;
    IF v_prod.stock < v_cantidad THEN
      RAISE EXCEPTION 'No hay stock suficiente de % (quedan %).', v_prod.nombre, v_prod.stock
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.productos SET stock = stock - v_cantidad WHERE id = v_prod.id;
    INSERT INTO public.pedido_detalles (pedido_id, producto_id, producto_nombre, cantidad, precio_unitario)
    VALUES (v_pedido, v_prod.id, v_prod.nombre, v_cantidad, v_prod.precio);
    v_total := v_total + v_prod.precio * v_cantidad;
  END LOOP;

  UPDATE public.pedidos SET total = v_total WHERE id = v_pedido;
  RETURN v_pedido;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.crear_pedido(jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.crear_pedido(jsonb) TO authenticated;

-- 7. RLS -------------------------------------------------------------------------
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_detalles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Catálogo público (solo vigentes); el admin ve y escribe todos.
DROP POLICY IF EXISTS "productos_select" ON public.productos;
DROP POLICY IF EXISTS "productos_select_activos" ON public.productos;
CREATE POLICY "productos_select_activos" ON public.productos FOR SELECT TO anon, authenticated
  USING (activo);

DROP POLICY IF EXISTS "productos_select_admin" ON public.productos;
CREATE POLICY "productos_select_admin" ON public.productos FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "productos_insert_admin" ON public.productos;
CREATE POLICY "productos_insert_admin" ON public.productos FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "productos_update_admin" ON public.productos;
CREATE POLICY "productos_update_admin" ON public.productos FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "productos_delete_admin" ON public.productos;
CREATE POLICY "productos_delete_admin" ON public.productos FOR DELETE TO authenticated
  USING (public.is_admin());

-- Pedidos: el cliente los ve propios; el admin ve todos y cambia el estado.
-- NO hay INSERT para el rol authenticated: el alta pasa por crear_pedido().
DROP POLICY IF EXISTS "pedidos_select" ON public.pedidos;
CREATE POLICY "pedidos_select" ON public.pedidos FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "pedidos_insert_propio" ON public.pedidos;

DROP POLICY IF EXISTS "pedidos_update_admin" ON public.pedidos;
CREATE POLICY "pedidos_update_admin" ON public.pedidos FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "detalles_select" ON public.pedido_detalles;
CREATE POLICY "detalles_select" ON public.pedido_detalles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.id = pedido_id AND (p.user_id = (SELECT auth.uid()) OR public.is_admin())
  ));

DROP POLICY IF EXISTS "detalles_insert_propio" ON public.pedido_detalles;

-- 8. VISTA para el panel admin ------------------------------------------------------
CREATE OR REPLACE VIEW public.resumen_pedidos_por_estado
WITH (security_invoker = true) AS
  SELECT estado, COUNT(*)::INT AS cantidad, COALESCE(SUM(total), 0)::NUMERIC(12,2) AS total
  FROM public.pedidos
  GROUP BY estado;

-- 9. PERMISOS de la API --------------------------------------------------------------
REVOKE ALL ON public.profiles, public.productos, public.pedidos, public.pedido_detalles,
              public.resumen_pedidos_por_estado FROM anon, authenticated;
GRANT SELECT                         ON public.productos                  TO anon;
GRANT SELECT, UPDATE                 ON public.profiles                   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.productos                  TO authenticated;
GRANT SELECT, UPDATE                 ON public.pedidos                    TO authenticated;
GRANT SELECT                         ON public.pedido_detalles            TO authenticated;
GRANT SELECT                         ON public.resumen_pedidos_por_estado TO authenticated;

NOTIFY pgrst, 'reload schema';
