-- ==============================================================================
-- Esquema de Base de Datos para el Dispensador de Pastillas IoT en Supabase
-- Tablas: cuidadores, dispositivos, horarios, historial_tomas
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
    mac_id TEXT,
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
    mac_id TEXT,
    evento TEXT NOT NULL CHECK (evento IN ('dispensado', 'atasco', 'tapa_abierta')),
    detalles TEXT,
    medicamento TEXT,
    dosis TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.cuidadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispositivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_tomas ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad (RLS)
-- Cuidadores: Cada cuidador puede ver y editar su propio perfil
CREATE POLICY "Cuidadores pueden ver su propio perfil" 
ON public.cuidadores FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Cuidadores pueden actualizar su propio perfil" 
ON public.cuidadores FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Cuidadores pueden insertar su propio perfil" 
ON public.cuidadores FOR INSERT WITH CHECK (auth.uid() = id);

-- Dispositivos: El cuidador puede ver y gestionar sus dispensadores vinculados
CREATE POLICY "Cuidadores pueden ver sus dispositivos" 
ON public.dispositivos FOR SELECT USING (auth.uid() = cuidador_id);

CREATE POLICY "Cuidadores pueden vincular o actualizar sus dispositivos" 
ON public.dispositivos FOR ALL USING (auth.uid() = cuidador_id);

CREATE POLICY "Permitir vinculación inicial por mac_id" 
ON public.dispositivos FOR INSERT WITH CHECK (auth.uid() = cuidador_id);

-- Horarios: El cuidador puede gestionar los horarios de sus dispositivos
CREATE POLICY "Cuidadores gestionan horarios de sus dispositivos" 
ON public.horarios FOR ALL USING (
    dispositivo_id IN (SELECT id FROM public.dispositivos WHERE cuidador_id = auth.uid())
    OR mac_id IN (SELECT mac_id FROM public.dispositivos WHERE cuidador_id = auth.uid())
);

-- Historial: Lectura e inserción de eventos IoT
CREATE POLICY "Cuidadores ven historial de sus dispositivos" 
ON public.historial_tomas FOR SELECT USING (
    dispositivo_id IN (SELECT id FROM public.dispositivos WHERE cuidador_id = auth.uid())
    OR mac_id IN (SELECT mac_id FROM public.dispositivos WHERE cuidador_id = auth.uid())
);

CREATE POLICY "Dispositivos IoT pueden registrar eventos en historial" 
ON public.historial_tomas FOR INSERT WITH CHECK (true);

-- Habilitar Supabase Realtime para notificaciones en vivo
ALTER PUBLICATION supabase_realtime ADD TABLE public.dispositivos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.horarios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.historial_tomas;
