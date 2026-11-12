import { Cuidador, Dispositivo, Horario, HistorialToma } from '../types/database';

const STORAGE_KEYS = {
  USER: 'pillsync_demo_user',
  DEVICES: 'pillsync_demo_devices',
  SCHEDULES: 'pillsync_demo_schedules',
  HISTORY: 'pillsync_demo_history',
};

const INITIAL_DEVICE: Dispositivo = {
  id: 'dev-001',
  mac_id: '24:6F:28:B2:8E:44',
  cuidador_id: 'cuidador-demo-01',
  pastillas_restantes: 22,
  nombre: 'Dispensador Principal - Habitación',
  estado: 'online',
  capacidad_maxima: 30,
  ultima_conexion: new Date().toISOString(),
};

const INITIAL_SCHEDULES: Horario[] = [
  {
    id: 'hor-001',
    dispositivo_id: 'dev-001',
    mac_id: '24:6F:28:B2:8E:44',
    hora_programada: '08:00',
    estado: 'activo',
    medicamento: 'Losartán 50mg',
    dosis: '1 pastilla',
    dias: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
    notas: 'Tomar con vaso de agua en ayunas',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'hor-002',
    dispositivo_id: 'dev-001',
    mac_id: '24:6F:28:B2:8E:44',
    hora_programada: '14:00',
    estado: 'activo',
    medicamento: 'Metformina 850mg',
    dosis: '1 pastilla',
    dias: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
    notas: 'Después del almuerzo',
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'hor-003',
    dispositivo_id: 'dev-001',
    mac_id: '24:6F:28:B2:8E:44',
    hora_programada: '21:30',
    estado: 'inactivo',
    medicamento: 'Atorvastatina 20mg',
    dosis: '1 cápsula',
    dias: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
    notas: 'Antes de dormir',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
];

const INITIAL_HISTORY: HistorialToma[] = [
  {
    id: 'hist-001',
    dispositivo_id: 'dev-001',
    mac_id: '24:6F:28:B2:8E:44',
    evento: 'dispensado',
    created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(), // hace 35 min
    medicamento: 'Losartán 50mg',
    detalles: 'Dispensación exitosa detectada por sensor infrarrojo',
  },
  {
    id: 'hist-002',
    dispositivo_id: 'dev-001',
    mac_id: '24:6F:28:B2:8E:44',
    evento: 'atasco',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // hace 6 hrs
    medicamento: 'Metformina 850mg',
    detalles: 'Alerta: Resistencia anómala en motor paso a paso. Requiere inspección.',
  },
  {
    id: 'hist-003',
    dispositivo_id: 'dev-001',
    mac_id: '24:6F:28:B2:8E:44',
    evento: 'dispensado',
    created_at: new Date(Date.now() - 86400000).toISOString(), // ayer
    medicamento: 'Losartán 50mg',
    detalles: 'Dispensación programada completada satisfactoriamente',
  },
  {
    id: 'hist-004',
    dispositivo_id: 'dev-001',
    mac_id: '24:6F:28:B2:8E:44',
    evento: 'tapa_abierta',
    created_at: new Date(Date.now() - 86400000 * 2 + 1000 * 3600 * 4).toISOString(),
    detalles: 'Sensor magnético: Tapa superior abierta manualmente fuera de horario de recarga',
  },
  {
    id: 'hist-005',
    dispositivo_id: 'dev-001',
    mac_id: '24:6F:28:B2:8E:44',
    evento: 'dispensado',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    medicamento: 'Losartán 50mg',
    detalles: 'Dispensación exitosa',
  },
];

export const mockStorage = {
  getUser: (): Cuidador | null => {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setUser: (user: Cuidador | null) => {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  },

  getDevices: (): Dispositivo[] => {
    const raw = localStorage.getItem(STORAGE_KEYS.DEVICES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.DEVICES, JSON.stringify([INITIAL_DEVICE]));
      return [INITIAL_DEVICE];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [INITIAL_DEVICE];
    }
  },

  saveDevice: (device: Dispositivo) => {
    const devices = mockStorage.getDevices();
    const index = devices.findIndex((d) => d.mac_id.toLowerCase() === device.mac_id.toLowerCase());
    if (index >= 0) {
      devices[index] = { ...devices[index], ...device };
    } else {
      devices.push(device);
    }
    localStorage.setItem(STORAGE_KEYS.DEVICES, JSON.stringify(devices));
    return device;
  },

  getSchedules: (macId?: string): Horario[] => {
    const raw = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
    let list: Horario[] = [];
    if (!raw) {
      list = INITIAL_SCHEDULES;
      localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(list));
    } else {
      try {
        list = JSON.parse(raw);
      } catch {
        list = INITIAL_SCHEDULES;
      }
    }
    if (macId) {
      return list.filter((s) => !s.mac_id || s.mac_id.toLowerCase() === macId.toLowerCase());
    }
    return list;
  },

  saveSchedule: (schedule: Horario) => {
    const list = mockStorage.getSchedules();
    const index = list.findIndex((s) => s.id === schedule.id);
    if (index >= 0) {
      list[index] = schedule;
    } else {
      list.unshift(schedule);
    }
    localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(list));
    return schedule;
  },

  deleteSchedule: (id: string) => {
    const list = mockStorage.getSchedules();
    const filtered = list.filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(filtered));
  },

  getHistory: (macId?: string): HistorialToma[] => {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    let list: HistorialToma[] = [];
    if (!raw) {
      list = INITIAL_HISTORY;
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(list));
    } else {
      try {
        list = JSON.parse(raw);
      } catch {
        list = INITIAL_HISTORY;
      }
    }
    if (macId) {
      return list.filter((h) => !h.mac_id || h.mac_id.toLowerCase() === macId.toLowerCase());
    }
    return list;
  },

  addHistory: (item: HistorialToma) => {
    const list = mockStorage.getHistory();
    list.unshift(item);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(list));
    return item;
  },

  resetDemoData: () => {
    localStorage.setItem(STORAGE_KEYS.DEVICES, JSON.stringify([INITIAL_DEVICE]));
    localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(INITIAL_SCHEDULES));
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(INITIAL_HISTORY));
  },
};
