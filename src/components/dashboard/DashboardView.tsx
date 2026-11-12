import React from 'react';
import { useDevice } from '../../context/DeviceContext';
import { DeviceStatusCard } from './DeviceStatusCard';
import { SchedulesSection } from './SchedulesSection';
import { HistorySection } from './HistorySection';
import { Cpu, Plus } from 'lucide-react';

interface DashboardViewProps {
  onNavigateToOnboarding: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigateToOnboarding }) => {
  const { device, loading } = useDevice();

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-slate-500 text-xs">
          <div className="w-8 h-8 border-3 border-cyan-600/30 border-t-cyan-600 rounded-full animate-spin" />
          <span>Sincronizando con Supabase...</span>
        </div>
      </div>
    );
  }

  // Si el usuario no tiene ningún dispositivo vinculado aún
  if (!device) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 sm:px-6 text-center">
        <div className="bg-white rounded-3xl p-10 border border-slate-200/80 shadow-sm max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center mx-auto mb-4 border border-cyan-100">
            <Cpu className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            No tienes un dispensador vinculado
          </h2>
          <p className="text-xs text-slate-500 mt-2 mb-6 leading-relaxed">
            Para visualizar el estado de las pastillas restantes, configurar horarios y revisar el historial de tomas, vincula primero la dirección MAC de tu pastillero físico.
          </p>
          <button
            onClick={onNavigateToOnboarding}
            className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-md shadow-cyan-600/20 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Vincular mi primer dispensador</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* 1. Panel Superior (Estado del dispositivo y pastillas_restantes) */}
      <DeviceStatusCard onLinkNewDevice={onNavigateToOnboarding} />

      {/* 2. Sección CRUD para crear, leer, actualizar y eliminar 'horarios' */}
      <SchedulesSection />

      {/* 3. Tabla histórica listando el 'historial_tomas' (verde: exitoso, rojo: atasco/tapa abierta) */}
      <HistorySection />
    </div>
  );
};
