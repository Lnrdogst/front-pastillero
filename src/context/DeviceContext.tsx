import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mockStorage } from '../lib/mockService';
import { Dispositivo, Horario, HistorialToma, EventoHistorial } from '../types/database';
import { useAuth } from './AuthContext';

interface DeviceContextType {
  device: Dispositivo | null;
  devices: Dispositivo[];
  schedules: Horario[];
  history: HistorialToma[];
  loading: boolean;
  linkingDevice: boolean;
  linkDevice: (macId: string, nombre?: string, initialPills?: number) => Promise<{ success: boolean; error?: string }>;
  selectDevice: (macId: string) => void;
  updatePillsCount: (count: number) => Promise<{ success: boolean; error?: string }>;
  createSchedule: (data: Omit<Horario, 'id' | 'created_at'>) => Promise<{ success: boolean; error?: string }>;
  updateSchedule: (id: string, updates: Partial<Horario>) => Promise<{ success: boolean; error?: string }>;
  toggleScheduleStatus: (id: string) => Promise<{ success: boolean; error?: string }>;
  deleteSchedule: (id: string) => Promise<{ success: boolean; error?: string }>;
  simulateEvent: (evento: EventoHistorial, detalles?: string) => Promise<{ success: boolean; error?: string }>;
  refreshData: () => Promise<void>;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isDemoMode } = useAuth();
  const [device, setDevice] = useState<Dispositivo | null>(null);
  const [devices, setDevices] = useState<Dispositivo[]>([]);
  const [schedules, setSchedules] = useState<Horario[]>([]);
  const [history, setHistory] = useState<HistorialToma[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [linkingDevice, setLinkingDevice] = useState<boolean>(false);

  // Cargar dispositivos del cuidador
  const loadDeviceData = useCallback(async () => {
    if (!user) {
      setDevice(null);
      setDevices([]);
      setSchedules([]);
      setHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (!isSupabaseConfigured || isDemoMode) {
        // Cargar desde mock local
        const userDevices = mockStorage.getDevices().filter(
          (d) => !d.cuidador_id || d.cuidador_id === user.id || d.cuidador_id === 'cuidador-demo-01'
        );
        setDevices(userDevices);
        const activeDev = userDevices[0] || null;
        setDevice(activeDev);

        if (activeDev) {
          setSchedules(mockStorage.getSchedules(activeDev.mac_id));
          setHistory(mockStorage.getHistory(activeDev.mac_id));
        } else {
          setSchedules([]);
          setHistory([]);
        }
        setLoading(false);
        return;
      }

      // Supabase real: Cargar dispositivos vinculados
      const { data: dbDevices, error: devError } = await supabase
        .from('dispositivos')
        .select('*')
        .eq('cuidador_id', user.id);

      if (devError) throw devError;

      setDevices(dbDevices || []);
      const current = dbDevices && dbDevices.length > 0 ? dbDevices[0] : null;
      setDevice(current);

      if (current) {
        // Cargar horarios de este dispositivo
        const { data: dbSchedules, error: schError } = await supabase
          .from('horarios')
          .select('*')
          .or(`mac_id.eq.${current.mac_id},dispositivo_id.eq.${current.id || ''}`)
          .order('hora_programada', { ascending: true });

        if (!schError && dbSchedules) {
          setSchedules(dbSchedules);
        }

        // Cargar historial
        const { data: dbHistory, error: histError } = await supabase
          .from('historial_tomas')
          .select('*')
          .or(`mac_id.eq.${current.mac_id},dispositivo_id.eq.${current.id || ''}`)
          .order('created_at', { ascending: false });

        if (!histError && dbHistory) {
          setHistory(dbHistory);
        }
      } else {
        setSchedules([]);
        setHistory([]);
      }
    } catch (err) {
      console.error('Error cargando datos del dispositivo:', err);
    } finally {
      setLoading(false);
    }
  }, [user, isDemoMode]);

  useEffect(() => {
    loadDeviceData();
  }, [loadDeviceData]);

  // Suscripción Realtime en Supabase
  useEffect(() => {
    if (!isSupabaseConfigured || isDemoMode || !device) return;

    const channel = supabase
      .channel(`device-changes-${device.mac_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dispositivos', filter: `mac_id=eq.${device.mac_id}` },
        (payload) => {
          if (payload.new) {
            setDevice((prev) => (prev ? { ...prev, ...payload.new } : (payload.new as Dispositivo)));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'horarios' },
        () => {
          loadDeviceData();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'historial_tomas' },
        (payload) => {
          if (payload.new) {
            setHistory((prev) => [payload.new as HistorialToma, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [device?.mac_id, isDemoMode, loadDeviceData]);

  // 1. Vincular dispositivo por MAC_ID
  const linkDevice = async (macId: string, nombre?: string, initialPills = 30) => {
    if (!user) return { success: false, error: 'Debes iniciar sesión para vincular un dispositivo' };

    setLinkingDevice(true);
    const formattedMac = macId.trim().toUpperCase();

    try {
      if (!isSupabaseConfigured || isDemoMode) {
        const newDevice: Dispositivo = {
          id: 'dev-' + Math.random().toString(36).substring(2, 7),
          mac_id: formattedMac,
          cuidador_id: user.id,
          pastillas_restantes: initialPills,
          nombre: nombre?.trim() || `Dispensador (${formattedMac.slice(-5)})`,
          estado: 'online',
          capacidad_maxima: 30,
          ultima_conexion: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };

        mockStorage.saveDevice(newDevice);
        setDevices((prev) => [...prev.filter((d) => d.mac_id !== formattedMac), newDevice]);
        setDevice(newDevice);
        setSchedules(mockStorage.getSchedules(formattedMac));
        setHistory(mockStorage.getHistory(formattedMac));
        return { success: true };
      }

      // En Supabase: Ejecutar consulta UPDATE directa para setear el cuidador_id del usuario autenticado
      // Cumple con la política RLS que restringe UPDATE únicamente al cuidador actual
      const { data: updatedDevices, error: updateErr } = await supabase
        .from('dispositivos')
        .update({
          cuidador_id: user.id,
          nombre: nombre?.trim() || `Dispensador (${formattedMac.slice(-5)})`,
          pastillas_restantes: initialPills,
          estado: 'online',
          ultima_conexion: new Date().toISOString(),
        })
        .eq('mac_id', formattedMac)
        .select();

      if (updateErr) {
        console.error('[DeviceContext] Error en consulta UPDATE de dispositivos:', updateErr);
        const details = updateErr.details ? ` - ${updateErr.details}` : '';
        const hint = updateErr.hint ? ` (${updateErr.hint})` : '';
        return {
          success: false,
          error: `Error en UPDATE 'dispositivos' [Código ${updateErr.code || 'RLS'}]: ${updateErr.message}${details}${hint}`,
        };
      }

      if (!updatedDevices || updatedDevices.length === 0) {
        return {
          success: false,
          error: `No se pudo vincular el dispensador '${formattedMac}'. La consulta UPDATE no afectó ninguna fila. Verifica que el dispositivo exista previamente en la tabla 'dispositivos' y que su 'cuidador_id' no esté asignado a otro usuario (violación de política RLS).`,
        };
      }

      const linkedRecord = updatedDevices[0];
      setDevice(linkedRecord);
      await loadDeviceData();
      return { success: true };
    } catch (err: unknown) {
      console.error('[DeviceContext] Excepción en linkDevice:', err);
      const msg =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : err instanceof Error
          ? err.message
          : 'Error inesperado de red al ejecutar la consulta UPDATE en dispositivos';
      return { success: false, error: msg };
    } finally {
      setLinkingDevice(false);
    }
  };

  const selectDevice = (macId: string) => {
    const selected = devices.find((d) => d.mac_id.toLowerCase() === macId.toLowerCase());
    if (selected) {
      setDevice(selected);
      if (!isSupabaseConfigured || isDemoMode) {
        setSchedules(mockStorage.getSchedules(selected.mac_id));
        setHistory(mockStorage.getHistory(selected.mac_id));
      }
    }
  };

  // 2. Actualizar pastillas_restantes
  const updatePillsCount = async (count: number) => {
    if (!device) return { success: false, error: 'No hay dispositivo seleccionado' };

    try {
      const clamped = Math.max(0, count);

      if (!isSupabaseConfigured || isDemoMode) {
        const updated = { ...device, pastillas_restantes: clamped };
        mockStorage.saveDevice(updated);
        setDevice(updated);
        setDevices((prev) => prev.map((d) => (d.mac_id === device.mac_id ? updated : d)));
        return { success: true };
      }

      const { data, error } = await supabase
        .from('dispositivos')
        .update({ pastillas_restantes: clamped })
        .eq('mac_id', device.mac_id)
        .select()
        .single();

      if (error) throw error;
      setDevice(data);
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar conteo de pastillas';
      return { success: false, error: msg };
    }
  };

  // 3. CRUD Horarios
  const createSchedule = async (data: Omit<Horario, 'id' | 'created_at'>) => {
    if (!device) return { success: false, error: 'No hay dispositivo seleccionado' };

    try {
      if (!isSupabaseConfigured || isDemoMode) {
        const newSched: Horario = {
          ...data,
          id: 'hor-' + Math.random().toString(36).substring(2, 8),
          mac_id: device.mac_id,
          dispositivo_id: device.id || device.mac_id,
          created_at: new Date().toISOString(),
        };
        mockStorage.saveSchedule(newSched);
        setSchedules((prev) => [...prev, newSched].sort((a, b) => a.hora_programada.localeCompare(b.hora_programada)));
        return { success: true };
      }

      const { data: created, error } = await supabase
        .from('horarios')
        .insert({
          dispositivo_id: device.id,
          mac_id: device.mac_id,
          hora_programada: data.hora_programada,
          estado: data.estado,
          medicamento: data.medicamento || null,
          dosis: data.dosis || null,
          dias: data.dias || null,
          notas: data.notas || null,
        })
        .select()
        .single();

      if (error) throw error;
      setSchedules((prev) => [...prev, created].sort((a, b) => a.hora_programada.localeCompare(b.hora_programada)));
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear horario';
      return { success: false, error: msg };
    }
  };

  const updateSchedule = async (id: string, updates: Partial<Horario>) => {
    try {
      if (!isSupabaseConfigured || isDemoMode) {
        const existing = schedules.find((s) => s.id === id);
        if (!existing) return { success: false, error: 'Horario no encontrado' };
        const updated = { ...existing, ...updates };
        mockStorage.saveSchedule(updated);
        setSchedules((prev) => prev.map((s) => (s.id === id ? updated : s)));
        return { success: true };
      }

      const { data, error } = await supabase
        .from('horarios')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setSchedules((prev) => prev.map((s) => (s.id === id ? data : s)));
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al modificar horario';
      return { success: false, error: msg };
    }
  };

  const toggleScheduleStatus = async (id: string) => {
    const target = schedules.find((s) => s.id === id);
    if (!target) return { success: false, error: 'Horario no encontrado' };
    const nuevoEstado = target.estado === 'activo' ? 'inactivo' : 'activo';
    return updateSchedule(id, { estado: nuevoEstado });
  };

  const deleteSchedule = async (id: string) => {
    try {
      if (!isSupabaseConfigured || isDemoMode) {
        mockStorage.deleteSchedule(id);
        setSchedules((prev) => prev.filter((s) => s.id !== id));
        return { success: true };
      }

      const { error } = await supabase.from('horarios').delete().eq('id', id);
      if (error) throw error;
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar horario';
      return { success: false, error: msg };
    }
  };

  // 4. Simulación o recepción de eventos IoT para 'historial_tomas'
  const simulateEvent = async (evento: EventoHistorial, detalles?: string) => {
    if (!device) return { success: false, error: 'No hay dispositivo seleccionado' };

    try {
      let defaultDetail = '';
      if (evento === 'dispensado') {
        defaultDetail = 'Dispensación ejecutada con éxito. Sensor infrarrojo confirma caída del comprimido.';
      } else if (evento === 'atasco') {
        defaultDetail = 'Alerta de atasco: Detección de sobrecorriente en servomotor. La pastilla quedó obstruida.';
      } else if (evento === 'tapa_abierta') {
        defaultDetail = 'Aviso de seguridad: Sensor de contacto detectó apertura no programada del depósito de pastillas.';
      }

      const newHistoryItem: HistorialToma = {
        id: 'hist-' + Math.random().toString(36).substring(2, 9),
        dispositivo_id: device.id || device.mac_id,
        mac_id: device.mac_id,
        evento,
        detalles: detalles || defaultDetail,
        medicamento: schedules[0]?.medicamento || 'Medicamento programado',
        created_at: new Date().toISOString(),
      };

      if (!isSupabaseConfigured || isDemoMode) {
        mockStorage.addHistory(newHistoryItem);
        setHistory((prev) => [newHistoryItem, ...prev]);

        // Si fue dispensado, restar 1 a pastillas_restantes
        if (evento === 'dispensado') {
          await updatePillsCount(Math.max(0, device.pastillas_restantes - 1));
        }
        return { success: true };
      }

      const { data, error } = await supabase
        .from('historial_tomas')
        .insert({
          dispositivo_id: device.id,
          mac_id: device.mac_id,
          evento,
          detalles: detalles || defaultDetail,
        })
        .select()
        .single();

      if (error) throw error;

      setHistory((prev) => [data, ...prev]);

      if (evento === 'dispensado') {
        await updatePillsCount(Math.max(0, device.pastillas_restantes - 1));
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar evento';
      return { success: false, error: msg };
    }
  };

  return (
    <DeviceContext.Provider
      value={{
        device,
        devices,
        schedules,
        history,
        loading,
        linkingDevice,
        linkDevice,
        selectDevice,
        updatePillsCount,
        createSchedule,
        updateSchedule,
        toggleScheduleStatus,
        deleteSchedule,
        simulateEvent,
        refreshData: loadDeviceData,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevice = () => {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevice debe ser usado dentro de un DeviceProvider');
  }
  return context;
};
