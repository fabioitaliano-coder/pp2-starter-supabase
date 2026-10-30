-- =============================================================================
-- schema.sql · Esquema, trigger de alta y políticas RLS (PP2 · IFTS 16)
-- =============================================================================
-- Cómo ejecutarlo: Supabase Studio > SQL Editor > New query > pegar > Run.
-- Es idempotente: se puede correr más de una vez (proyecto vacío o demo ya creada).
-- Solo datos ficticios (Ley 25.326).
-- Es el esquema de E-Commerce PP2, la app de referencia de la materia: primero el
-- núcleo (auth, perfiles y roles, RLS, catálogo, carrito, crear_pedido(), admin)
-- y después lo avanzado (checkout, seguimiento, factura simulada y Mi cuenta).

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

-- 3b. EMAIL: si la persona cambia su email (y lo confirma), se copia al perfil ----
-- Concepto · supabase.auth.updateUser({ email }) no toca auth.users.email hasta que
-- se confirma el enlace del mail. Recién ahí corre este trigger y profiles.email
-- queda igual. El cliente nunca escribe profiles.email directamente.
CREATE OR REPLACE FUNCTION public.sincronizar_email_perfil()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sincronizar_email_perfil() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sincronizar_email_perfil();

-- El nombre lo puede editar su dueño (Mi cuenta): la base pone el límite de largo.
-- NOT VALID: no revisa filas viejas, sí cada INSERT/UPDATE nuevo.
DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_full_name_largo CHECK (char_length(btrim(full_name)) BETWEEN 1 AND 80) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
-- Concepto · El catálogo filtra activo y ordena por nombre: este índice parcial cubre ese SELECT.
CREATE INDEX IF NOT EXISTS productos_activos_nombre_idx ON public.productos (nombre) WHERE activo;

CREATE TABLE IF NOT EXISTS public.pedidos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  total      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  estado     TEXT NOT NULL DEFAULT 'pendiente'
             CHECK (estado IN ('pendiente', 'confirmado', 'despachado', 'entregado', 'cancelado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Concepto · Índice en la FK que mira RLS ("mis pedidos" filtra por user_id).
-- Sin él, cada SELECT del cliente barre toda la tabla de pedidos.
CREATE INDEX IF NOT EXISTS pedidos_user_id_idx ON public.pedidos (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pedidos_estado_idx ON public.pedidos (estado);
-- Filtro admin por estado + ORDER BY created_at DESC (cubre más que estado solo).
CREATE INDEX IF NOT EXISTS pedidos_estado_created_at_idx ON public.pedidos (estado, created_at DESC);
ALTER TABLE public.pedidos ALTER COLUMN total SET DEFAULT 0;

-- Estado nuevo 'despachado' (entre confirmado y entregado). Se recrea el CHECK
-- para que un proyecto con el esquema anterior también lo acepte.
ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_estado_check
  CHECK (estado IN ('pendiente', 'confirmado', 'despachado', 'entregado', 'cancelado'));

-- Número legible para la persona (#1001, #1002…). El id UUID sigue siendo la clave.
-- Concepto · IDENTITY numera también las filas que ya existían al agregar la columna.
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS numero BIGINT GENERATED ALWAYS AS IDENTITY (START WITH 1001);
CREATE UNIQUE INDEX IF NOT EXISTS pedidos_numero_idx ON public.pedidos (numero);

-- Cuándo pasó por cada estado: lo completa el trigger, nunca el navegador.
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS confirmado_at TIMESTAMPTZ;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS despachado_at TIMESTAMPTZ;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS entregado_at  TIMESTAMPTZ;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cancelado_at  TIMESTAMPTZ;

-- Checkout: entrega, pago simulado y facturación. Es una "foto" al momento de comprar:
-- si después la persona cambia su domicilio en Mi cuenta, el pedido no cambia.
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS envio_nombre      TEXT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS envio_calle       TEXT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS envio_piso_depto  TEXT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS envio_ciudad      TEXT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS envio_provincia   TEXT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS envio_cp          TEXT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS envio_telefono    TEXT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS envio_notas       TEXT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS pago_metodo       TEXT
  CHECK (pago_metodo IN ('tarjeta', 'transferencia', 'efectivo'));
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS pago_detalle      TEXT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS factura_nombre    TEXT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS factura_documento TEXT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS factura_domicilio TEXT;

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

-- Concepto · pedido_id es la FK de la política detalles_select (EXISTS sobre pedidos).
-- producto_id cubre el JOIN / SET NULL al borrar un artículo.
CREATE INDEX IF NOT EXISTS pedido_detalles_pedido_id_idx ON public.pedido_detalles (pedido_id);
CREATE INDEX IF NOT EXISTS pedido_detalles_producto_id_idx ON public.pedido_detalles (producto_id);

-- Domicilio de entrega guardado (uno por persona). Lo edita su dueño en Mi cuenta
-- y el checkout lo usa para prellenar el formulario.
CREATE TABLE IF NOT EXISTS public.direcciones (
  user_id       UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  calle         TEXT NOT NULL CHECK (char_length(btrim(calle)) BETWEEN 3 AND 120),
  piso_depto    TEXT CHECK (char_length(piso_depto) <= 40),
  ciudad        TEXT NOT NULL CHECK (char_length(btrim(ciudad)) BETWEEN 2 AND 80),
  provincia     TEXT NOT NULL CHECK (char_length(btrim(provincia)) BETWEEN 2 AND 60),
  codigo_postal TEXT NOT NULL CHECK (codigo_postal ~ '^[A-Za-z]?[0-9]{4}[A-Za-z]{0,3}$'),
  telefono      TEXT CHECK (telefono ~ '^[0-9 +()-]{6,25}$'),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Factura SIMULADA (sin validez fiscal, no se informa a ARCA/AFIP).
-- Concepto · Ningún rol de la API puede insertarla: la emite la base (sección 6b)
-- cuando el admin pasa un pedido confirmado a 'despachado'.
CREATE TABLE IF NOT EXISTS public.facturas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero            BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  punto_venta       INT  NOT NULL DEFAULT 1,
  tipo              TEXT NOT NULL DEFAULT 'B',
  pedido_id         UUID NOT NULL UNIQUE REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  cliente_nombre    TEXT NOT NULL,
  cliente_documento TEXT,
  cliente_domicilio TEXT,
  cliente_email     TEXT,
  total             NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  iva_contenido     NUMERIC(10,2) NOT NULL CHECK (iva_contenido >= 0),
  emitida_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS facturas_user_id_idx ON public.facturas (user_id, emitida_at DESC);

-- 5. HELPER is_admin() ------------------------------------------------------------
-- Concepto · STABLE + (SELECT auth.uid()): Postgres evalúa el uid y el EXISTS
-- una vez por consulta, no por fila. Es el "es_admin()" del enunciado.
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
-- Concepto · El navegador manda solo [{ producto_id, cantidad }], el domicilio y el
-- MÉTODO de pago. Precio y stock salen de la fila real, bloqueada con FOR UPDATE (dos
-- compras no venden la misma última unidad). Si algo falla, RAISE EXCEPTION revierte
-- pedido y stock juntos. Sin descuentos, para que el ejemplo quede simple.
-- Concepto · Pago simulado: de una tarjeta solo viajan marca y últimos 4 dígitos.
-- En un sistema real los datos completos van a la pasarela (Mercado Pago, Stripe…)
-- y la base guarda un token. Si llega un número completo o un CVV, se rechaza.
DROP TRIGGER IF EXISTS pedidos_before_insert_total ON public.pedidos;
DROP TRIGGER IF EXISTS pedido_detalles_before_insert ON public.pedido_detalles;
DROP TRIGGER IF EXISTS pedido_detalles_after_write ON public.pedido_detalles;
DROP FUNCTION IF EXISTS public.forzar_total_cero_al_crear();
DROP FUNCTION IF EXISTS public.preparar_detalle_pedido();
DROP FUNCTION IF EXISTS public.recalcular_total_pedido();
-- La versión anterior recibía solo p_items: se borra para no dejar dos firmas.
DROP FUNCTION IF EXISTS public.crear_pedido(jsonb);

-- Devuelve el texto sin espacios de más, o NULL si quedó vacío.
CREATE OR REPLACE FUNCTION public.texto_limpio(p TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT NULLIF(btrim(regexp_replace(p, '\s+', ' ', 'g')), '') $$;

CREATE OR REPLACE FUNCTION public.crear_pedido(p_items JSONB, p_envio JSONB, p_pago JSONB)
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
  -- entrega
  v_nombre   TEXT := public.texto_limpio(p_envio->>'nombre');
  v_calle    TEXT := public.texto_limpio(p_envio->>'calle');
  v_piso     TEXT := public.texto_limpio(p_envio->>'piso_depto');
  v_ciudad   TEXT := public.texto_limpio(p_envio->>'ciudad');
  v_prov     TEXT := public.texto_limpio(p_envio->>'provincia');
  v_cp       TEXT := upper(public.texto_limpio(p_envio->>'cp'));
  v_tel      TEXT := public.texto_limpio(p_envio->>'telefono');
  v_notas    TEXT := public.texto_limpio(p_envio->>'notas');
  -- pago y facturación
  v_metodo   TEXT := p_pago->>'metodo';
  v_marca    TEXT := p_pago->>'marca';
  v_ult4     TEXT := p_pago->>'ultimos4';
  v_detalle  TEXT;
  v_fac_nom  TEXT := public.texto_limpio(p_pago->>'factura_nombre');
  v_fac_doc  TEXT := NULLIF(regexp_replace(COALESCE(p_pago->>'factura_documento', ''), '[^0-9]', '', 'g'), '');
  v_fac_dom  TEXT := public.texto_limpio(p_pago->>'factura_domicilio');
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

  -- Entrega: la base valida aunque el formulario ya lo haya hecho (el navegador se puede saltear).
  IF v_nombre IS NULL OR char_length(v_nombre) NOT BETWEEN 3 AND 80 THEN
    RAISE EXCEPTION 'Completá el nombre de quien recibe.' USING ERRCODE = '22023';
  END IF;
  IF v_calle IS NULL OR char_length(v_calle) NOT BETWEEN 3 AND 120 THEN
    RAISE EXCEPTION 'Completá la calle y el número de entrega.' USING ERRCODE = '22023';
  END IF;
  IF v_ciudad IS NULL OR v_prov IS NULL OR char_length(v_ciudad) > 80 OR char_length(v_prov) > 60 THEN
    RAISE EXCEPTION 'Completá la localidad y la provincia.' USING ERRCODE = '22023';
  END IF;
  IF v_cp IS NULL OR v_cp !~ '^[A-Z]?[0-9]{4}[A-Z]{0,3}$' THEN
    RAISE EXCEPTION 'El código postal no es válido (ej.: 1406 o C1406ABC).' USING ERRCODE = '22023';
  END IF;
  IF v_tel IS NOT NULL AND v_tel !~ '^[0-9 +()-]{6,25}$' THEN
    RAISE EXCEPTION 'El teléfono no es válido.' USING ERRCODE = '22023';
  END IF;
  IF char_length(COALESCE(v_piso, '')) > 40 OR char_length(COALESCE(v_notas, '')) > 200 THEN
    RAISE EXCEPTION 'Piso/depto o indicaciones demasiado largos.' USING ERRCODE = '22023';
  END IF;

  -- Pago simulado: nunca se aceptan datos completos de tarjeta.
  IF p_pago ?| ARRAY['numero', 'tarjeta_numero', 'cvv', 'tarjeta_cvv'] THEN
    RAISE EXCEPTION 'No mandes el número completo ni el CVV: solo marca y últimos 4.' USING ERRCODE = '22023';
  END IF;
  IF v_metodo = 'tarjeta' THEN
    IF v_marca NOT IN ('Visa', 'Mastercard', 'American Express') OR v_ult4 IS NULL OR v_ult4 !~ '^[0-9]{4}$' THEN
      RAISE EXCEPTION 'Datos de tarjeta inválidos.' USING ERRCODE = '22023';
    END IF;
    v_detalle := v_marca || ' terminada en ' || v_ult4 || ' · aprobada (simulación)';
  ELSIF v_metodo = 'transferencia' THEN
    v_detalle := 'Transferencia al alias PP2.STARTER.DEMO · a acreditar (simulación)';
  ELSIF v_metodo = 'efectivo' THEN
    v_detalle := 'Efectivo al recibir el pedido (simulación)';
  ELSE
    RAISE EXCEPTION 'Elegí una forma de pago.' USING ERRCODE = '22023';
  END IF;
  IF v_fac_doc IS NOT NULL AND v_fac_doc !~ '^[0-9]{7,11}$' THEN
    RAISE EXCEPTION 'El DNI o CUIT debe tener entre 7 y 11 números.' USING ERRCODE = '22023';
  END IF;
  IF char_length(COALESCE(v_fac_nom, '')) > 80 OR char_length(COALESCE(v_fac_dom, '')) > 200 THEN
    RAISE EXCEPTION 'Datos de facturación demasiado largos.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.pedidos (
    user_id, total, estado,
    envio_nombre, envio_calle, envio_piso_depto, envio_ciudad, envio_provincia, envio_cp,
    envio_telefono, envio_notas, pago_metodo, pago_detalle,
    factura_nombre, factura_documento, factura_domicilio
  )
  VALUES (
    v_uid, 0, 'pendiente',
    v_nombre, v_calle, v_piso, v_ciudad, v_prov, v_cp,
    v_tel, v_notas, v_metodo, v_detalle,
    COALESCE(v_fac_nom, v_nombre), v_fac_doc, v_fac_dom
  )
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
REVOKE EXECUTE ON FUNCTION public.crear_pedido(jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.crear_pedido(jsonb, jsonb, jsonb) TO authenticated;

-- 6b. ESTADOS Y FACTURA: reglas en la base, no en el panel ---------------------------
-- Concepto · Máquina de estados. El select del admin deshabilita las opciones que no
-- corresponden, pero la regla real es este trigger: vale también para un UPDATE directo.
--   pendiente  → confirmado | cancelado
--   confirmado → pendiente | despachado | cancelado
--   despachado → entregado            (ya tiene factura: no se cancela ni vuelve atrás)
--   entregado y cancelado son finales.
CREATE OR REPLACE FUNCTION public.pedidos_cambio_estado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_permitidos TEXT[];
BEGIN
  IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN
    RETURN NEW;
  END IF;

  v_permitidos := CASE OLD.estado
    WHEN 'pendiente'  THEN ARRAY['confirmado', 'cancelado']
    WHEN 'confirmado' THEN ARRAY['pendiente', 'despachado', 'cancelado']
    WHEN 'despachado' THEN ARRAY['entregado']
    ELSE ARRAY[]::TEXT[]
  END;
  IF NOT (NEW.estado = ANY (v_permitidos)) THEN
    RAISE EXCEPTION 'El pedido #% no puede pasar de % a %.', OLD.numero, OLD.estado, NEW.estado
      USING ERRCODE = 'P0001',
            HINT = CASE WHEN OLD.estado IN ('entregado', 'cancelado') THEN 'Los estados entregado y cancelado son finales.'
                        WHEN OLD.estado = 'despachado' THEN 'Ya tiene factura emitida: solo puede pasar a entregado.'
                        WHEN NEW.estado = 'despachado' THEN 'Primero confirmá el pedido.'
                        ELSE 'Revisá el orden: pendiente → confirmado → despachado → entregado.' END;
  END IF;

  CASE NEW.estado
    WHEN 'confirmado' THEN NEW.confirmado_at := now();
    WHEN 'despachado' THEN NEW.despachado_at := now();
    WHEN 'entregado'  THEN NEW.entregado_at  := now();
    WHEN 'cancelado'  THEN NEW.cancelado_at  := now();
    ELSE NULL;
  END CASE;
  IF NEW.estado = 'pendiente' THEN
    NEW.confirmado_at := NULL;
  END IF;

  -- Cancelar devuelve el stock (agrupado: un producto puede venir en dos renglones).
  IF NEW.estado = 'cancelado' THEN
    UPDATE public.productos p
       SET stock = p.stock + d.cantidad
      FROM (SELECT producto_id, SUM(cantidad)::INT AS cantidad
              FROM public.pedido_detalles
             WHERE pedido_id = NEW.id AND producto_id IS NOT NULL
             GROUP BY producto_id) d
     WHERE p.id = d.producto_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pedidos_cambio_estado() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS pedidos_before_estado ON public.pedidos;
CREATE TRIGGER pedidos_before_estado
  BEFORE UPDATE OF estado ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.pedidos_cambio_estado();

-- Emite (una sola vez) la factura simulada de un pedido confirmado y despachado.
-- Copia nombre, documento y domicilio: la factura no cambia si después se edita el perfil.
-- IVA contenido (Factura B a consumidor final, 21 %): total − total / 1,21.
CREATE OR REPLACE FUNCTION public.emitir_factura(p_pedido UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ped    public.pedidos%ROWTYPE;
  v_email  TEXT;
  v_nombre TEXT;
  v_id     UUID;
BEGIN
  SELECT id INTO v_id FROM public.facturas WHERE pedido_id = p_pedido;
  IF FOUND THEN
    RETURN v_id;
  END IF;

  SELECT * INTO v_ped FROM public.pedidos WHERE id = p_pedido;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el pedido.' USING ERRCODE = 'P0002';
  END IF;
  IF v_ped.estado NOT IN ('despachado', 'entregado') OR v_ped.confirmado_at IS NULL THEN
    RAISE EXCEPTION 'Solo se factura un pedido confirmado y despachado.' USING ERRCODE = 'P0001';
  END IF;

  SELECT email, full_name INTO v_email, v_nombre FROM public.profiles WHERE id = v_ped.user_id;

  INSERT INTO public.facturas (
    pedido_id, user_id, cliente_nombre, cliente_documento, cliente_domicilio, cliente_email,
    total, iva_contenido, emitida_at
  )
  VALUES (
    v_ped.id, v_ped.user_id,
    COALESCE(v_ped.factura_nombre, v_ped.envio_nombre, v_nombre),
    v_ped.factura_documento,
    COALESCE(v_ped.factura_domicilio,
             NULLIF(concat_ws(', ', v_ped.envio_calle, v_ped.envio_piso_depto, v_ped.envio_ciudad,
                              v_ped.envio_provincia, v_ped.envio_cp), '')),
    v_email,
    v_ped.total,
    round(v_ped.total - v_ped.total / 1.21, 2),
    COALESCE(v_ped.despachado_at, now())
  )
  ON CONFLICT (pedido_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.facturas WHERE pedido_id = p_pedido;
  END IF;
  RETURN v_id;
END;
$$;
-- Concepto · Ni anon ni authenticated pueden llamarla por RPC: la dispara el trigger.
-- service_role (scripts/seed.mjs) sí, para completar los pedidos de demostración.
REVOKE EXECUTE ON FUNCTION public.emitir_factura(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.emitir_factura(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.pedidos_facturar_al_despachar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.emitir_factura(NEW.id);
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pedidos_facturar_al_despachar() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS pedidos_after_despachado ON public.pedidos;
CREATE TRIGGER pedidos_after_despachado
  AFTER UPDATE OF estado ON public.pedidos
  FOR EACH ROW
  WHEN (NEW.estado = 'despachado' AND OLD.estado IS DISTINCT FROM NEW.estado)
  EXECUTE FUNCTION public.pedidos_facturar_al_despachar();

-- Pedidos que ya existían (demo creada con el esquema anterior): fechas aproximadas
-- y factura para los entregados. Es idempotente: solo completa lo que falta.
UPDATE public.pedidos SET confirmado_at = LEAST(now(), created_at + INTERVAL '2 hours')
 WHERE estado IN ('confirmado', 'despachado', 'entregado') AND confirmado_at IS NULL;
UPDATE public.pedidos SET despachado_at = LEAST(now(), created_at + INTERVAL '1 day')
 WHERE estado IN ('despachado', 'entregado') AND despachado_at IS NULL;
UPDATE public.pedidos SET entregado_at = LEAST(now(), created_at + INTERVAL '3 days')
 WHERE estado = 'entregado' AND entregado_at IS NULL;
UPDATE public.pedidos SET cancelado_at = LEAST(now(), created_at + INTERVAL '3 hours')
 WHERE estado = 'cancelado' AND cancelado_at IS NULL;
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.id FROM public.pedidos p
     WHERE p.estado IN ('despachado', 'entregado')
       AND NOT EXISTS (SELECT 1 FROM public.facturas f WHERE f.pedido_id = p.id)
     ORDER BY p.created_at
  LOOP
    PERFORM public.emitir_factura(r.id);
  END LOOP;
END $$;

-- 7. RLS -------------------------------------------------------------------------
-- Concepto · (SELECT auth.uid()) se evalúa una vez por consulta (initPlan de Postgres).
-- auth.uid() suelto se reevalúa en cada fila y sale más caro cuando RLS filtra muchas filas.
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direcciones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR public.is_admin());

-- Concepto · Cada persona edita SU perfil (Mi cuenta). Qué columnas puede tocar lo
-- decide el GRANT por columna de la sección 9: solo full_name. role y email no.
DROP POLICY IF EXISTS "profiles_update_propio" ON public.profiles;
CREATE POLICY "profiles_update_propio" ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

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

-- Domicilio guardado: cada persona lee y escribe solo el suyo; el admin lo puede leer.
DROP POLICY IF EXISTS "direcciones_select" ON public.direcciones;
CREATE POLICY "direcciones_select" ON public.direcciones FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "direcciones_insert_propia" ON public.direcciones;
CREATE POLICY "direcciones_insert_propia" ON public.direcciones FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "direcciones_update_propia" ON public.direcciones;
CREATE POLICY "direcciones_update_propia" ON public.direcciones FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- Facturas: solo lectura (propias o admin). No hay INSERT/UPDATE/DELETE para la API.
DROP POLICY IF EXISTS "facturas_select" ON public.facturas;
CREATE POLICY "facturas_select" ON public.facturas FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());

-- 8. VISTA para el panel admin ------------------------------------------------------
CREATE OR REPLACE VIEW public.resumen_pedidos_por_estado
WITH (security_invoker = true) AS
  SELECT estado, COUNT(*)::INT AS cantidad, COALESCE(SUM(total), 0)::NUMERIC(12,2) AS total
  FROM public.pedidos
  GROUP BY estado;

-- 9. PERMISOS de la API --------------------------------------------------------------
-- Concepto · GRANT por columna: RLS decide QUÉ FILAS, el GRANT decide QUÉ COLUMNAS.
-- Así el dueño cambia su nombre pero no su rol, y el admin cambia el estado de un
-- pedido pero no su total. Revocar la tabla también revoca los grants por columna.
REVOKE ALL ON public.profiles, public.productos, public.pedidos, public.pedido_detalles,
              public.direcciones, public.facturas, public.resumen_pedidos_por_estado
  FROM anon, authenticated;
GRANT SELECT                         ON public.productos                  TO anon;
GRANT SELECT                         ON public.profiles                   TO authenticated;
GRANT UPDATE (full_name)             ON public.profiles                   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.productos                  TO authenticated;
GRANT SELECT                         ON public.pedidos                    TO authenticated;
GRANT UPDATE (estado)                ON public.pedidos                    TO authenticated;
GRANT SELECT                         ON public.pedido_detalles            TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.direcciones                TO authenticated;
GRANT SELECT                         ON public.facturas                   TO authenticated;
GRANT SELECT                         ON public.resumen_pedidos_por_estado TO authenticated;

NOTIFY pgrst, 'reload schema';
