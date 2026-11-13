-- ==============================================================================
-- SCRIPT SQL DEFINITIVO — Ejecutar en el SQL Editor de Supabase
-- Proyecto: PillSync IoT (front-pastillero)
-- 
-- Este script es idempotente: puede ejecutarse múltiples veces sin conflictos.
-- Incluye:
--   1. Tablas (con IF NOT EXISTS)
--   2. Trigger simplificado auth.users → cuidadores (id, email, nombre)
--   3. Políticas RLS que coinciden EXACTAMENTE con las peticiones del frontend
-- ==============================================================================


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  TABLAS                                                                   ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- 1. Cuidadores (perfiles de usuario sincronizados con auth.users via Trigger)
CREATE TABLE IF NOT EXISTS public.cuidadores (
    id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email      TEXT NOT NULL,
    nombre     TEXT,
    telefono   TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Dispositivos IoT (pastilleros físicos identificados por MAC)
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

-- 3. Horarios de toma (CRUD desde el frontend)
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

-- 4. Historial de tomas y eventos del hardware
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


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  TRIGGER: auth.users → public.cuidadores (simplificado: id, email, nombre)║
-- ║  El frontend NUNCA hace INSERT a cuidadores. Este trigger lo hace.        ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER          -- Ejecuta con privilegios elevados, omite RLS
SET search_path = public  -- Previene inyección de schema
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

-- Crear o recrear el trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  ROW LEVEL SECURITY — Políticas que coinciden con las peticiones React    ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- Habilitar RLS en todas las tablas
ALTER TABLE public.cuidadores      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispositivos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_tomas ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────────
-- CUIDADORES: Solo lectura (SELECT) para el propio usuario autenticado
-- Petición React: supabase.from('cuidadores').select('*').eq('id', user.id)
-- ──────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Cuidadores pueden ver su propio perfil"       ON public.cuidadores;
DROP POLICY IF EXISTS "Cuidadores pueden actualizar su propio perfil" ON public.cuidadores;
DROP POLICY IF EXISTS "Cuidadores pueden insertar su propio perfil"  ON public.cuidadores;
DROP POLICY IF EXISTS "cuidadores_select_policy"                     ON public.cuidadores;
DROP POLICY IF EXISTS "cuidadores_read_only_own_profile"             ON public.cuidadores;

CREATE POLICY "cuidadores_readonly"
  ON public.cuidadores FOR SELECT
  TO authenticated
  USING (auth.uid() = id);


-- ──────────────────────────────────────────────────────────────────────────
-- DISPOSITIVOS: SELECT + UPSERT para el cuidador autenticado
-- Petición React: supabase.from('dispositivos').upsert({...}, {onConflict:'mac_id'}).select()
-- Petición React: supabase.from('dispositivos').select('*').eq('cuidador_id', user.id)
-- Petición React: supabase.from('dispositivos').update({pastillas_restantes}).eq('mac_id',...)
-- ──────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Cuidadores pueden ver sus dispositivos"                ON public.dispositivos;
DROP POLICY IF EXISTS "Cuidadores pueden vincular o actualizar sus dispositivos" ON public.dispositivos;
DROP POLICY IF EXISTS "Permitir vinculación inicial por mac_id"               ON public.dispositivos;
DROP POLICY IF EXISTS "dispositivos_select_linked_or_available"               ON public.dispositivos;
DROP POLICY IF EXISTS "dispositivos_update_set_own_cuidador_id"               ON public.dispositivos;
DROP POLICY IF EXISTS "dispositivos_select"                                   ON public.dispositivos;
DROP POLICY IF EXISTS "dispositivos_insert"                                   ON public.dispositivos;
DROP POLICY IF EXISTS "dispositivos_update"                                   ON public.dispositivos;
DROP POLICY IF EXISTS "dispositivos_delete"                                   ON public.dispositivos;

-- SELECT: Ver dispositivos propios o dispositivos sin asignar (para vincular)
CREATE POLICY "dispositivos_select"
  ON public.dispositivos FOR SELECT
  TO authenticated
  USING (cuidador_id = auth.uid() OR cuidador_id IS NULL);

-- INSERT: El cuidador puede registrar un dispositivo nuevo asignándose a sí mismo
CREATE POLICY "dispositivos_insert"
  ON public.dispositivos FOR INSERT
  TO authenticated
  WITH CHECK (cuidador_id = auth.uid());

-- UPDATE: Solo si el dispositivo está libre (NULL) o ya le pertenece, y se asigna a sí mismo
CREATE POLICY "dispositivos_update"
  ON public.dispositivos FOR UPDATE
  TO authenticated
  USING  (cuidador_id IS NULL OR cuidador_id = auth.uid())
  WITH CHECK (cuidador_id = auth.uid());

-- DELETE: Solo puede borrar sus propios dispositivos
CREATE POLICY "dispositivos_delete"
  ON public.dispositivos FOR DELETE
  TO authenticated
  USING (cuidador_id = auth.uid());


-- ──────────────────────────────────────────────────────────────────────────
-- HORARIOS: CRUD completo filtrado por mac_id vinculado al cuidador
-- Petición React: supabase.from('horarios').insert({mac_id: device.mac_id, ...})
-- Petición React: supabase.from('horarios').update({...}).eq('id', id)
-- Petición React: supabase.from('horarios').delete().eq('id', id)
-- ──────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Cuidadores gestionan horarios de sus dispositivos" ON public.horarios;
DROP POLICY IF EXISTS "horarios_crud_by_linked_mac_id"                   ON public.horarios;
DROP POLICY IF EXISTS "horarios_crud"                                     ON public.horarios;

CREATE POLICY "horarios_crud"
  ON public.horarios FOR ALL
  TO authenticated
  USING (
    mac_id IN (SELECT d.mac_id FROM public.dispositivos d WHERE d.cuidador_id = auth.uid())
  )
  WITH CHECK (
    mac_id IN (SELECT d.mac_id FROM public.dispositivos d WHERE d.cuidador_id = auth.uid())
  );


-- ──────────────────────────────────────────────────────────────────────────
-- HISTORIAL_TOMAS: CRUD completo filtrado por mac_id vinculado al cuidador
-- Petición React: supabase.from('historial_tomas').insert({mac_id: device.mac_id, evento,...})
-- Petición React: supabase.from('historial_tomas').select('*').or(...)
-- ──────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Cuidadores ven historial de sus dispositivos"        ON public.historial_tomas;
DROP POLICY IF EXISTS "Dispositivos IoT pueden registrar eventos en historial" ON public.historial_tomas;
DROP POLICY IF EXISTS "historial_tomas_crud_by_linked_mac_id"               ON public.historial_tomas;
DROP POLICY IF EXISTS "historial_crud"                                       ON public.historial_tomas;

CREATE POLICY "historial_crud"
  ON public.historial_tomas FOR ALL
  TO authenticated
  USING (
    mac_id IN (SELECT d.mac_id FROM public.dispositivos d WHERE d.cuidador_id = auth.uid())
  )
  WITH CHECK (
    mac_id IN (SELECT d.mac_id FROM public.dispositivos d WHERE d.cuidador_id = auth.uid())
  );


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  REALTIME: Suscripciones en vivo para el dashboard                        ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

DO $$
BEGIN
  -- Solo agregar si no está ya en la publicación (evita error si se re-ejecuta)
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
END;
$$;
