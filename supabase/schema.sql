-- =============================================================================
-- schema.sql · Esquema, trigger de alta y políticas RLS (PP2 · IFTS 16)
-- =============================================================================
-- Cómo ejecutarlo: Supabase Studio > SQL Editor > New query > pegar > Run.
-- Es idempotente: se puede correr más de una vez (proyecto vacío o demo ya creada).
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
-- Catálogo: lo lee cualquier usuario autenticado; solo el admin lo escribe.
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

-- Renglones del pedido. nombre y precio_unitario son una "foto" del artículo al
-- confirmar: si después cambia el catálogo, el pedido histórico no se reescribe.
-- producto_id puede quedar NULL en filas viejas migradas; los pedidos nuevos
-- siempre lo traen. El trigger preparar_detalle_pedido() completa nombre/precio
-- y descuenta stock: el cliente no puede mandar un importe inventado.
CREATE TABLE IF NOT EXISTS public.pedido_detalles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  cantidad        INT NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (precio_unitario >= 0)
);
ALTER TABLE public.pedido_detalles
  ADD COLUMN IF NOT EXISTS producto_id UUID REFERENCES public.productos(id) ON DELETE RESTRICT;
ALTER TABLE public.pedido_detalles
  ADD COLUMN IF NOT EXISTS nombre TEXT;
ALTER TABLE public.pedido_detalles
  ALTER COLUMN precio_unitario SET DEFAULT 0;

-- Compatibilidad: el starter anterior tenía la columna texto "producto".
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pedido_detalles' AND column_name = 'producto'
  ) THEN
    UPDATE public.pedido_detalles
       SET nombre = COALESCE(nombre, producto)
     WHERE nombre IS NULL;
    ALTER TABLE public.pedido_detalles DROP COLUMN producto;
  END IF;
END $$;

UPDATE public.pedido_detalles SET nombre = 'Artículo' WHERE nombre IS NULL;
ALTER TABLE public.pedido_detalles ALTER COLUMN nombre SET NOT NULL;
CREATE INDEX IF NOT EXISTS pedido_detalles_pedido_id_idx ON public.pedido_detalles (pedido_id);

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

-- 6. TOTAL Y PRECIO EN LA BASE (no confiar en el cliente) -------------------------
-- Al crear un pedido ignoramos cualquier total que mande el navegador.
CREATE OR REPLACE FUNCTION public.forzar_total_cero_al_crear()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.total := 0;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.forzar_total_cero_al_crear() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS pedidos_before_insert_total ON public.pedidos;
CREATE TRIGGER pedidos_before_insert_total
  BEFORE INSERT ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.forzar_total_cero_al_crear();

-- Completa nombre/precio desde el catálogo y descuenta stock.
-- SECURITY DEFINER: el rol authenticated no tiene UPDATE sobre productos;
-- el trigger sí necesita descontar stock en la misma transacción.
CREATE OR REPLACE FUNCTION public.preparar_detalle_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prod public.productos%ROWTYPE;
BEGIN
  SELECT * INTO v_prod
    FROM public.productos
   WHERE id = NEW.producto_id AND activo
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El artículo no está disponible';
  END IF;
  IF NEW.cantidad IS NULL OR NEW.cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad tiene que ser mayor a 0';
  END IF;
  IF v_prod.stock < NEW.cantidad THEN
    RAISE EXCEPTION 'No hay stock suficiente de %', v_prod.nombre;
  END IF;

  NEW.nombre := v_prod.nombre;
  NEW.precio_unitario := v_prod.precio;

  UPDATE public.productos
     SET stock = stock - NEW.cantidad
   WHERE id = NEW.producto_id AND stock >= NEW.cantidad;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay stock suficiente de %', v_prod.nombre;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.preparar_detalle_pedido() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS pedido_detalles_before_insert ON public.pedido_detalles;
CREATE TRIGGER pedido_detalles_before_insert
  BEFORE INSERT ON public.pedido_detalles
  FOR EACH ROW EXECUTE FUNCTION public.preparar_detalle_pedido();

-- Recalcula pedidos.total como SUM(cantidad * precio_unitario).
-- SECURITY DEFINER: el cliente no puede hacer UPDATE de pedidos (solo el admin
-- cambia el estado); sin esto, insertar renglones no podría actualizar el total.
CREATE OR REPLACE FUNCTION public.recalcular_total_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido_id UUID;
BEGIN
  v_pedido_id := COALESCE(NEW.pedido_id, OLD.pedido_id);
  UPDATE public.pedidos
     SET total = COALESCE((
       SELECT SUM(cantidad * precio_unitario)
         FROM public.pedido_detalles
        WHERE pedido_id = v_pedido_id
     ), 0)
   WHERE id = v_pedido_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.recalcular_total_pedido() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS pedido_detalles_after_write ON public.pedido_detalles;
CREATE TRIGGER pedido_detalles_after_write
  AFTER INSERT OR UPDATE OR DELETE ON public.pedido_detalles
  FOR EACH ROW EXECUTE FUNCTION public.recalcular_total_pedido();

-- Alta atómica del pedido + renglones. Corre como el usuario (SECURITY INVOKER):
-- RLS sigue valiendo. El total y el precio salen de los triggers de arriba.
CREATE OR REPLACE FUNCTION public.crear_pedido(p_items JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_item JSONB;
  v_i INT;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido necesita al menos un artículo';
  END IF;

  INSERT INTO public.pedidos (user_id, estado)
  VALUES ((SELECT auth.uid()), 'pendiente')
  RETURNING id INTO v_id;

  FOR v_i IN 0 .. jsonb_array_length(p_items) - 1 LOOP
    v_item := p_items -> v_i;
    INSERT INTO public.pedido_detalles (pedido_id, producto_id, cantidad)
    VALUES (
      v_id,
      (v_item->>'producto_id')::UUID,
      (v_item->>'cantidad')::INT
    );
  END LOOP;

  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.crear_pedido(jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.crear_pedido(jsonb) TO authenticated;

-- 7. RLS: activar en TODAS las tablas ---------------------------------------------
-- Sin ENABLE ROW LEVEL SECURITY, la clave pública deja leer y escribir todo.
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_detalles ENABLE ROW LEVEL SECURITY;

-- profiles: cada uno ve el suyo; el admin ve todos; solo el admin cambia roles.
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- productos: catálogo visible para quien inició sesión; escritura solo admin.
DROP POLICY IF EXISTS "productos_select" ON public.productos;
CREATE POLICY "productos_select" ON public.productos FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "productos_insert_admin" ON public.productos;
CREATE POLICY "productos_insert_admin" ON public.productos FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "productos_update_admin" ON public.productos;
CREATE POLICY "productos_update_admin" ON public.productos FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "productos_delete_admin" ON public.productos;
CREATE POLICY "productos_delete_admin" ON public.productos FOR DELETE TO authenticated
  USING (public.is_admin());

-- pedidos: el cliente ve y crea los suyos (siempre 'pendiente' y total 0; el
-- total real lo calcula el trigger al insertar renglones). El admin ve todos
-- y es el único que cambia el estado. Nadie borra pedidos desde la API.
DROP POLICY IF EXISTS "pedidos_select" ON public.pedidos;
CREATE POLICY "pedidos_select" ON public.pedidos FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "pedidos_insert_propio" ON public.pedidos;
CREATE POLICY "pedidos_insert_propio" ON public.pedidos FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND estado = 'pendiente'
    AND total = 0
  );

DROP POLICY IF EXISTS "pedidos_update_admin" ON public.pedidos;
CREATE POLICY "pedidos_update_admin" ON public.pedidos FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- pedido_detalles: se hereda el acceso del pedido al que pertenecen.
-- Insertar solo en un pedido propio que siga pendiente.
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
    WHERE p.id = pedido_id
      AND p.user_id = (SELECT auth.uid())
      AND p.estado = 'pendiente'
  ));

-- 8. VISTA para el panel admin ------------------------------------------------------
-- Concepto · security_invoker = true: la vista se ejecuta con los permisos de quien
-- consulta, así RLS de pedidos sigue aplicando. Sin esto la vista corre como su
-- dueño y se saltea RLS (fuga clásica).
CREATE OR REPLACE VIEW public.resumen_pedidos_por_estado
WITH (security_invoker = true) AS
  SELECT estado, COUNT(*)::INT AS cantidad, COALESCE(SUM(total), 0)::NUMERIC(12,2) AS total
  FROM public.pedidos
  GROUP BY estado;

-- 9. PERMISOS de la API --------------------------------------------------------------
-- anon (sin sesión) no accede a nada; authenticated, solo lo que RLS permita.
REVOKE ALL ON public.profiles, public.productos, public.pedidos, public.pedido_detalles,
              public.resumen_pedidos_por_estado FROM anon;
GRANT SELECT, UPDATE                ON public.profiles                  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.productos                TO authenticated;
GRANT SELECT, INSERT, UPDATE        ON public.pedidos                   TO authenticated;
GRANT SELECT, INSERT                ON public.pedido_detalles           TO authenticated;
GRANT SELECT                        ON public.resumen_pedidos_por_estado TO authenticated;

-- Para que PostgREST (la API) tome funciones y columnas nuevas sin reiniciar el proyecto.
NOTIFY pgrst, 'reload schema';
