-- ==============================================================================
-- Esquema de Base de Datos para el Dispensador de Pastillas IoT en Supabase
-- Tablas: cuidadores, dispositivos, horarios, historial_tomas
-- Incluye: Trigger para auth.users y Políticas RLS Auditadas
-- ==============================================================================

-- 1. Tabla: Cuidadores (Perfiles vinculados al Supabase Auth)
CREATE TABLE IF NOT EXISTS public.cuidadores (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    nombre TEXT,
    telefono TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla: Dispositivos IoT
CREATE TABLE IF NOT EXISTS public.dispositivos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mac_id TEXT UNIQUE NOT NULL,
    cuidador_id UUID REFERENCES public.cuidadores(id) ON DELETE SET NULL,
    nombre TEXT DEFAULT 'Dispensador IoT',
    pastillas_restantes INTEGER DEFAULT 30 CHECK (pastillas_restantes >= 0),
    capacidad_maxima INTEGER DEFAULT 30,
    estado TEXT DEFAULT 'online' CHECK (estado IN ('online', 'offline', 'mantenimiento')),
    ultima_conexion TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabla: Horarios de Toma (CRUD)
CREATE TABLE IF NOT EXISTS public.horarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispositivo_id UUID REFERENCES public.dispositivos(id) ON DELETE CASCADE,
    mac_id TEXT NOT NULL,
    hora_programada TIME NOT NULL, -- Ej: 08:00:00 o 14:30:00
    estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
    medicamento TEXT,
    dosis TEXT DEFAULT '1 pastilla',
    dias TEXT[] DEFAULT ARRAY['L', 'M', 'X', 'J', 'V', 'S', 'D'],
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabla: Historial de Tomas y Eventos del Hardware
-- Eventos: 'dispensado', 'atasco', 'tapa_abierta'
CREATE TABLE IF NOT EXISTS public.historial_tomas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispositivo_id UUID REFERENCES public.dispositivos(id) ON DELETE CASCADE,
    mac_id TEXT NOT NULL,
    evento TEXT NOT NULL CHECK (evento IN ('dispensado', 'atasco', 'tapa_abierta')),
    detalles TEXT,
    medicamento TEXT,
    dosis TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- TRIGGER: Sincronización automática de auth.users a public.cuidadores
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.cuidadores (id, email, nombre, telefono, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'telefono',
    COALESCE(NEW.created_at, timezone('utc'::text, now()))
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nombre = COALESCE(EXCLUDED.nombre, cuidadores.nombre),
    telefono = COALESCE(EXCLUDED.telefono, cuidadores.telefono);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- Habilitar Row Level Security (RLS) en todas las tablas
-- ==============================================================================
ALTER TABLE public.cuidadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispositivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_tomas ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- POLÍTICAS RLS DEFINITIVAS
-- ==============================================================================

-- 1. Cuidadores: SOLO LECTURA para el propio usuario autenticado
DROP POLICY IF EXISTS "cuidadores_read_only_own_profile" ON public.cuidadores;
CREATE POLICY "cuidadores_read_only_own_profile" 
ON public.cuidadores 
FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- 2. Dispositivos:
-- SELECT para dispositivos vinculados al usuario o libres
DROP POLICY IF EXISTS "dispositivos_select_linked_or_available" ON public.dispositivos;
CREATE POLICY "dispositivos_select_linked_or_available" 
ON public.dispositivos 
FOR SELECT 
TO authenticated 
USING (cuidador_id = auth.uid() OR cuidador_id IS NULL);

-- UPDATE únicamente para setear su propio cuidador_id
DROP POLICY IF EXISTS "dispositivos_update_set_own_cuidador_id" ON public.dispositivos;
CREATE POLICY "dispositivos_update_set_own_cuidador_id" 
ON public.dispositivos 
FOR UPDATE 
TO authenticated 
USING (cuidador_id IS NULL OR cuidador_id = auth.uid()) 
WITH CHECK (cuidador_id = auth.uid());

-- 3. Horarios: CRUD completo condicionado a que el mac_id pertenezca al cuidador actual
DROP POLICY IF EXISTS "horarios_crud_by_linked_mac_id" ON public.horarios;
CREATE POLICY "horarios_crud_by_linked_mac_id" 
ON public.horarios 
FOR ALL 
TO authenticated 
USING (
    mac_id IN (SELECT d.mac_id FROM public.dispositivos d WHERE d.cuidador_id = auth.uid())
)
WITH CHECK (
    mac_id IN (SELECT d.mac_id FROM public.dispositivos d WHERE d.cuidador_id = auth.uid())
);

-- 4. Historial: CRUD completo condicionado a que el mac_id pertenezca al cuidador actual
DROP POLICY IF EXISTS "historial_tomas_crud_by_linked_mac_id" ON public.historial_tomas;
CREATE POLICY "historial_tomas_crud_by_linked_mac_id" 
ON public.historial_tomas 
FOR ALL 
TO authenticated 
USING (
    mac_id IN (SELECT d.mac_id FROM public.dispositivos d WHERE d.cuidador_id = auth.uid())
)
WITH CHECK (
    mac_id IN (SELECT d.mac_id FROM public.dispositivos d WHERE d.cuidador_id = auth.uid())
);

-- ==============================================================================
-- Habilitar Supabase Realtime
-- ==============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.dispositivos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.horarios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.historial_tomas;
