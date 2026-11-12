// Tipos correspondientes al esquema de Supabase para el Dispensador IoT

export type EventoHistorial = 'dispensado' | 'atasco' | 'tapa_abierta';

export type EstadoHorario = 'activo' | 'inactivo';

export interface Cuidador {
  id: string; // auth.users.id
  email: string;
  nombre?: string;
  telefono?: string;
  created_at?: string;
}

export interface Dispositivo {
  id?: string;
  mac_id: string;
  cuidador_id: string;
  pastillas_restantes: number;
  nombre?: string;
  estado?: 'online' | 'offline' | 'activo';
  capacidad_maxima?: number;
  ultima_conexion?: string;
  created_at?: string;
}

export interface Horario {
  id: string;
  dispositivo_id?: string;
  mac_id?: string;
  hora_programada: string; // formato "HH:mm" o "HH:mm:ss"
  estado: EstadoHorario;
  medicamento?: string;
  dosis?: string;
  dias?: string[]; // Ej: ['L', 'M', 'X', 'J', 'V', 'S', 'D']
  notas?: string;
  created_at?: string;
}

export interface HistorialToma {
  id: string;
  dispositivo_id?: string;
  mac_id?: string;
  evento: EventoHistorial;
  created_at: string; // Timestamp ISO
  detalles?: string;
  medicamento?: string;
  dosis?: string;
}

// Interfaz para la respuesta o configuración del entorno
export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}
