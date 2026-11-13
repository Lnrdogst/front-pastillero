-- ==============================================================================
-- SCRIPT DE AUDITORÍA Y CORRECCIÓN: SUPABASE AUTH, TRIGGERS Y POLÍTICAS RLS
-- Proyecto: front-pastillero (Dispensador de Pastillas IoT)
-- Ejecutar este script en el "SQL Editor" de tu proyecto en Supabase.
-- ==============================================================================

-- ==============================================================================
-- TAREA 1: MIGRACIÓN A TRIGGER (Sincronización auth.users -> public.cuidadores)
-- Elimina la necesidad de INSERTs manuales desde el frontend tras el registro.
-- ==============================================================================

-- 1.1 Crear la función que procesa el nuevo usuario registrado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecuta con privilegios de superusuario para omitir RLS
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

-- 1.2 Asociar el trigger a auth.users para dispararse tras cada registro exitoso
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ==============================================================================
-- TAREA 3: AUDITORÍA Y ESTABLECIMIENTO DE POLÍTICAS RLS DEFINITIVAS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 3.1 TABLA: public.cuidadores (SOLO LECTURA para el usuario autenticado)
-- ------------------------------------------------------------------------------
ALTER TABLE public.cuidadores ENABLE ROW LEVEL SECURITY;

-- Limpieza de políticas antiguas
DROP POLICY IF EXISTS "Cuidadores pueden ver su propio perfil" ON public.cuidadores;
DROP POLICY IF EXISTS "Cuidadores pueden actualizar su propio perfil" ON public.cuidadores;
DROP POLICY IF EXISTS "Cuidadores pueden insertar su propio perfil" ON public.cuidadores;
DROP POLICY IF EXISTS "cuidadores_select_policy" ON public.cuidadores;
DROP POLICY IF EXISTS "cuidadores_read_only_own_profile" ON public.cuidadores;

-- Política definitiva: SOLO lectura (SELECT) para el usuario cuyo id coincida con auth.uid()
-- (Los inserts se realizan vía Trigger SECURITY DEFINER; el frontend no puede insertar/modificar)
CREATE POLICY "cuidadores_read_only_own_profile"
ON public.cuidadores
FOR SELECT
TO authenticated
USING (auth.uid() = id);


-- ------------------------------------------------------------------------------
-- 3.2 TABLA: public.dispositivos
-- Permite UPDATE solo al usuario autenticado para setear su propio cuidador_id.
-- Permite SELECT de sus dispositivos vinculados o dispositivos disponibles para vincular.
-- ------------------------------------------------------------------------------
ALTER TABLE public.dispositivos ENABLE ROW LEVEL SECURITY;

-- Limpieza de políticas antiguas
DROP POLICY IF EXISTS "Cuidadores pueden ver sus dispositivos" ON public.dispositivos;
DROP POLICY IF EXISTS "Cuidadores pueden vincular o actualizar sus dispositivos" ON public.dispositivos;
DROP POLICY IF EXISTS "Permitir vinculación inicial por mac_id" ON public.dispositivos;
DROP POLICY IF EXISTS "dispositivos_select_linked_or_available" ON public.dispositivos;
DROP POLICY IF EXISTS "dispositivos_update_set_own_cuidador_id" ON public.dispositivos;

-- SELECT: Ver dispositivos que ya pertenecen al usuario o dispositivos sin asignar disponibles para vincular
CREATE POLICY "dispositivos_select_linked_or_available"
ON public.dispositivos
FOR SELECT
TO authenticated
USING (cuidador_id = auth.uid() OR cuidador_id IS NULL);

-- UPDATE: Permite UPDATE únicamente para que el usuario autenticado asigne su propio cuidador_id
CREATE POLICY "dispositivos_update_set_own_cuidador_id"
ON public.dispositivos
FOR UPDATE
TO authenticated
USING (
  -- El dispositivo está libre para vincular o ya le pertenece a este cuidador
  cuidador_id IS NULL OR cuidador_id = auth.uid()
)
WITH CHECK (
  -- Garantiza que el nuevo cuidador_id sea forzosamente el UID del usuario actual
  cuidador_id = auth.uid()
);


-- ------------------------------------------------------------------------------
-- 3.3 TABLA: public.horarios (CRUD completo filtrado por mac_id vinculado al cuidador)
-- ------------------------------------------------------------------------------
ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;

-- Limpieza de políticas antiguas
DROP POLICY IF EXISTS "Cuidadores gestionan horarios de sus dispositivos" ON public.horarios;
DROP POLICY IF EXISTS "horarios_crud_by_linked_mac_id" ON public.horarios;

-- Política definitiva: CRUD completo (SELECT, INSERT, UPDATE, DELETE) condicionado
-- a que el mac_id pertenezca a un dispositivo vinculado al cuidador autenticado
CREATE POLICY "horarios_crud_by_linked_mac_id"
ON public.horarios
FOR ALL
TO authenticated
USING (
  mac_id IN (
    SELECT d.mac_id 
    FROM public.dispositivos d 
    WHERE d.cuidador_id = auth.uid()
  )
)
WITH CHECK (
  mac_id IN (
    SELECT d.mac_id 
    FROM public.dispositivos d 
    WHERE d.cuidador_id = auth.uid()
  )
);


-- ------------------------------------------------------------------------------
-- 3.4 TABLA: public.historial_tomas (CRUD completo filtrado por mac_id vinculado al cuidador)
-- ------------------------------------------------------------------------------
ALTER TABLE public.historial_tomas ENABLE ROW LEVEL SECURITY;

-- Limpieza de políticas antiguas
DROP POLICY IF EXISTS "Cuidadores ven historial de sus dispositivos" ON public.historial_tomas;
DROP POLICY IF EXISTS "Dispositivos IoT pueden registrar eventos en historial" ON public.historial_tomas;
DROP POLICY IF EXISTS "historial_tomas_crud_by_linked_mac_id" ON public.historial_tomas;

-- Política definitiva: CRUD completo condicionado al mac_id vinculado
CREATE POLICY "historial_tomas_crud_by_linked_mac_id"
ON public.historial_tomas
FOR ALL
TO authenticated
USING (
  mac_id IN (
    SELECT d.mac_id 
    FROM public.dispositivos d 
    WHERE d.cuidador_id = auth.uid()
  )
)
WITH CHECK (
  mac_id IN (
    SELECT d.mac_id 
    FROM public.dispositivos d 
    WHERE d.cuidador_id = auth.uid()
  )
);
