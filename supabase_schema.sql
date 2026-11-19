-- ==============================================================================
-- SCRIPT SQL DE MIGRACIÓN DEFENSIVA Y DEFINITIVA — Supabase
-- Proyecto: MediCheck / PillSync IoT (front-pastillero)
--
-- Este script es 100% idempotente y defensivo:
-- 1. Mantiene CREATE TABLE IF NOT EXISTS.
-- 2. Agrega explícitamente ALTER TABLE ... ADD COLUMN IF NOT EXISTS para CADA columna.
-- 3. Elimina restricciones obsoletas (como límites antiguos en pastillas_restantes).
-- 4. Normaliza el tipo de 'horarios.estado' a TEXT ('activo'/'inactivo') preservando
--    compatibilidad con la vista de hardware 'vista_horarios_esp32'.
-- 5. Configura ON DELETE CASCADE en public.cuidadores -> auth.users(id).
-- 6. Trigger simplificado: auth.users → public.cuidadores (id, email, nombre).
-- 7. Políticas RLS exactas para el cliente público autenticado.
-- 8. Publicación Realtime para sincronización reactiva en el dashboard.
-- 9. Recarga automática de schema cache en PostgREST (NOTIFY pgrst).
-- ==============================================================================


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║ 1. TABLAS Y MIGRACIÓN DEFENSIVA DE COLUMNAS                                ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- ------------------------------------------------------------------------------
-- 1.1 CUIDADORES (Perfiles de usuario sincronizados con auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cuidadores (
    id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email      TEXT NOT NULL,
    nombre     TEXT,
    telefono   TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.cuidadores ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.cuidadores ADD COLUMN IF NOT EXISTS nombre TEXT;
ALTER TABLE public.cuidadores ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE public.cuidadores ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Garantizar ON DELETE CASCADE en cuidadores -> auth.users(id)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.cuidadores'::regclass 
          AND contype = 'f'
    ) LOOP
        EXECUTE 'ALTER TABLE public.cuidadores DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END;
$$;

ALTER TABLE public.cuidadores 
    ADD CONSTRAINT cuidadores_id_fkey 
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ------------------------------------------------------------------------------
-- 1.2 DISPOSITIVOS (Pastilleros IoT vinculados por MAC)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dispositivos (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mac_id               TEXT UNIQUE NOT NULL,
    cuidador_id          UUID REFERENCES public.cuidadores(id) ON DELETE SET NULL,
    nombre               TEXT DEFAULT 'Dispensador IoT',
    pastillas_restantes  INTEGER DEFAULT 30 CHECK (pastillas_restantes >= 0),
    capacidad_maxima     INTEGER DEFAULT 30,
    estado               TEXT DEFAULT 'online' CHECK (estado IN ('online', 'offline', 'mantenimiento')),
    ultima_conexion      TIMESTAMPTZ DEFAULT now(),
    created_at           TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.dispositivos ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.dispositivos ADD COLUMN IF NOT EXISTS mac_id TEXT;
ALTER TABLE public.dispositivos ADD COLUMN IF NOT EXISTS cuidador_id UUID REFERENCES public.cuidadores(id) ON DELETE SET NULL;
ALTER TABLE public.dispositivos ADD COLUMN IF NOT EXISTS nombre TEXT DEFAULT 'Dispensador IoT';
ALTER TABLE public.dispositivos ADD COLUMN IF NOT EXISTS pastillas_restantes INTEGER DEFAULT 30;
ALTER TABLE public.dispositivos ADD COLUMN IF NOT EXISTS capacidad_maxima INTEGER DEFAULT 30;
ALTER TABLE public.dispositivos ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'online';
ALTER TABLE public.dispositivos ADD COLUMN IF NOT EXISTS ultima_conexion TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.dispositivos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Garantizar restricción UNIQUE sobre mac_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dispositivos_mac_id_key'
  ) THEN
    BEGIN
      ALTER TABLE public.dispositivos ADD CONSTRAINT dispositivos_mac_id_key UNIQUE (mac_id);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END;
$$;

-- Eliminar restricciones obsoletas de pastillas_restantes (ej. <= 9 de tablas heredadas)
ALTER TABLE public.dispositivos DROP CONSTRAINT IF EXISTS dispositivos_pastillas_restantes_check;
ALTER TABLE public.dispositivos ADD CONSTRAINT dispositivos_pastillas_restantes_check CHECK (pastillas_restantes >= 0);

-- ------------------------------------------------------------------------------
-- 1.3 HORARIOS (CRUD de programación de dosis)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.horarios (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispositivo_id   UUID REFERENCES public.dispositivos(id) ON DELETE CASCADE,
    mac_id           TEXT NOT NULL,
    hora_programada  TIME NOT NULL,
    estado           TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
    medicamento      TEXT,
    dosis            TEXT DEFAULT '1 pastilla',
    dias             TEXT[] DEFAULT ARRAY['L','M','X','J','V','S','D'],
    notas            TEXT,
    created_at       TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.horarios ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.horarios ADD COLUMN IF NOT EXISTS dispositivo_id UUID REFERENCES public.dispositivos(id) ON DELETE CASCADE;
ALTER TABLE public.horarios ADD COLUMN IF NOT EXISTS mac_id TEXT;
ALTER TABLE public.horarios ADD COLUMN IF NOT EXISTS hora_programada TIME;
ALTER TABLE public.horarios ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'activo';
ALTER TABLE public.horarios ADD COLUMN IF NOT EXISTS medicamento TEXT;
ALTER TABLE public.horarios ADD COLUMN IF NOT EXISTS dosis TEXT DEFAULT '1 pastilla';
ALTER TABLE public.horarios ADD COLUMN IF NOT EXISTS dias TEXT[] DEFAULT ARRAY['L','M','X','J','V','S','D'];
ALTER TABLE public.horarios ADD COLUMN IF NOT EXISTS notas TEXT;
ALTER TABLE public.horarios ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Si existe la vista del ESP32, eliminarla temporalmente para poder convertir 'estado' a TEXT
DROP VIEW IF EXISTS public.vista_horarios_esp32;

-- Convertir 'estado' de BOOLEAN a TEXT ('activo'/'inactivo') si la tabla era previa
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'horarios' 
      AND column_name = 'estado' 
      AND data_type = 'boolean'
  ) THEN
    ALTER TABLE public.horarios ALTER COLUMN estado DROP DEFAULT;
    ALTER TABLE public.horarios 
      ALTER COLUMN estado TYPE TEXT 
      USING (CASE WHEN estado IS TRUE THEN 'activo' ELSE 'inactivo' END);
    ALTER TABLE public.horarios ALTER COLUMN estado SET DEFAULT 'activo';
  END IF;
END;
$$;

-- Recrear vista_horarios_esp32 compatible con 'activo' o TRUE
CREATE OR REPLACE VIEW public.vista_horarios_esp32 AS
  SELECT mac_id, hora_programada
  FROM public.horarios
  WHERE estado::text IN ('activo', 'true');

GRANT SELECT ON public.vista_horarios_esp32 TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 1.4 HISTORIAL_TOMAS (Eventos y telemetría de dispensación / alertas)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.historial_tomas (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispositivo_id   UUID REFERENCES public.dispositivos(id) ON DELETE CASCADE,
    mac_id           TEXT NOT NULL,
    evento           TEXT NOT NULL CHECK (evento IN ('dispensado', 'atasco', 'tapa_abierta')),
    detalles         TEXT,
    medicamento      TEXT,
    dosis            TEXT,
    created_at       TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.historial_tomas ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.historial_tomas ADD COLUMN IF NOT EXISTS dispositivo_id UUID REFERENCES public.dispositivos(id) ON DELETE CASCADE;
ALTER TABLE public.historial_tomas ADD COLUMN IF NOT EXISTS mac_id TEXT;
ALTER TABLE public.historial_tomas ADD COLUMN IF NOT EXISTS evento TEXT;
ALTER TABLE public.historial_tomas ADD COLUMN IF NOT EXISTS detalles TEXT;
ALTER TABLE public.historial_tomas ADD COLUMN IF NOT EXISTS medicamento TEXT;
ALTER TABLE public.historial_tomas ADD COLUMN IF NOT EXISTS dosis TEXT;
ALTER TABLE public.historial_tomas ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║ 2. TRIGGER: auth.users → public.cuidadores                                 ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.cuidadores (id, email, nombre)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'nombre', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE SET
    email  = EXCLUDED.email,
    nombre = COALESCE(EXCLUDED.nombre, cuidadores.nombre);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║ 3. ROW LEVEL SECURITY (RLS)                                                ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.cuidadores      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispositivos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_tomas ENABLE ROW LEVEL SECURITY;

-- CUIDADORES
DROP POLICY IF EXISTS "cuidadores_readonly"                          ON public.cuidadores;
DROP POLICY IF EXISTS "cuidadores_update"                            ON public.cuidadores;
DROP POLICY IF EXISTS "Cuidadores pueden ver su propio perfil"       ON public.cuidadores;
DROP POLICY IF EXISTS "Cuidadores pueden actualizar su propio perfil" ON public.cuidadores;
DROP POLICY IF EXISTS "Cuidadores pueden insertar su propio perfil"  ON public.cuidadores;
DROP POLICY IF EXISTS "cuidadores_select_policy"                     ON public.cuidadores;
DROP POLICY IF EXISTS "cuidadores_read_only_own_profile"             ON public.cuidadores;

CREATE POLICY "cuidadores_readonly"
  ON public.cuidadores FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "cuidadores_update"
  ON public.cuidadores FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- DISPOSITIVOS
DROP POLICY IF EXISTS "dispositivos_select"                                   ON public.dispositivos;
DROP POLICY IF EXISTS "dispositivos_insert"                                   ON public.dispositivos;
DROP POLICY IF EXISTS "dispositivos_update"                                   ON public.dispositivos;
DROP POLICY IF EXISTS "dispositivos_delete"                                   ON public.dispositivos;
DROP POLICY IF EXISTS "Cuidadores pueden ver sus dispositivos"                ON public.dispositivos;
DROP POLICY IF EXISTS "Cuidadores pueden vincular o actualizar sus dispositivos" ON public.dispositivos;
DROP POLICY IF EXISTS "Permitir vinculación inicial por mac_id"               ON public.dispositivos;
DROP POLICY IF EXISTS "dispositivos_select_linked_or_available"               ON public.dispositivos;
DROP POLICY IF EXISTS "dispositivos_update_set_own_cuidador_id"               ON public.dispositivos;

CREATE POLICY "dispositivos_select"
  ON public.dispositivos FOR SELECT
  TO authenticated
  USING (cuidador_id = auth.uid() OR cuidador_id IS NULL);

CREATE POLICY "dispositivos_insert"
  ON public.dispositivos FOR INSERT
  TO authenticated
  WITH CHECK (cuidador_id = auth.uid());

CREATE POLICY "dispositivos_update"
  ON public.dispositivos FOR UPDATE
  TO authenticated
  USING  (cuidador_id IS NULL OR cuidador_id = auth.uid())
  WITH CHECK (cuidador_id = auth.uid());

CREATE POLICY "dispositivos_delete"
  ON public.dispositivos FOR DELETE
  TO authenticated
  USING (cuidador_id = auth.uid());

-- HORARIOS
DROP POLICY IF EXISTS "horarios_crud"                                     ON public.horarios;
DROP POLICY IF EXISTS "Cuidadores gestionan horarios de sus dispositivos" ON public.horarios;
DROP POLICY IF EXISTS "horarios_crud_by_linked_mac_id"                   ON public.horarios;

CREATE POLICY "horarios_crud"
  ON public.horarios FOR ALL
  TO authenticated
  USING (
    mac_id IN (SELECT d.mac_id FROM public.dispositivos d WHERE d.cuidador_id = auth.uid())
    OR
    dispositivo_id IN (SELECT d.id FROM public.dispositivos d WHERE d.cuidador_id = auth.uid())
  )
  WITH CHECK (
    mac_id IN (SELECT d.mac_id FROM public.dispositivos d WHERE d.cuidador_id = auth.uid())
    OR
    dispositivo_id IN (SELECT d.id FROM public.dispositivos d WHERE d.cuidador_id = auth.uid())
  );

-- HISTORIAL_TOMAS
DROP POLICY IF EXISTS "historial_crud"                                       ON public.historial_tomas;
DROP POLICY IF EXISTS "Cuidadores ven historial de sus dispositivos"        ON public.historial_tomas;
DROP POLICY IF EXISTS "Dispositivos IoT pueden registrar eventos en historial" ON public.historial_tomas;
DROP POLICY IF EXISTS "historial_tomas_crud_by_linked_mac_id"               ON public.historial_tomas;

CREATE POLICY "historial_crud"
  ON public.historial_tomas FOR ALL
  TO authenticated
  USING (
    mac_id IN (SELECT d.mac_id FROM public.dispositivos d WHERE d.cuidador_id = auth.uid())
    OR
    dispositivo_id IN (SELECT d.id FROM public.dispositivos d WHERE d.cuidador_id = auth.uid())
  )
  WITH CHECK (
    mac_id IN (SELECT d.mac_id FROM public.dispositivos d WHERE d.cuidador_id = auth.uid())
    OR
    dispositivo_id IN (SELECT d.id FROM public.dispositivos d WHERE d.cuidador_id = auth.uid())
  );


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║ 4. PERMISOS Y ROLES                                                        ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║ 5. REALTIME                                                                ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'dispositivos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dispositivos;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'horarios'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.horarios;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'historial_tomas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.historial_tomas;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║ 6. RECARGA DE CACHÉ DE POSTGREST                                          ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

NOTIFY pgrst, 'reload schema';
