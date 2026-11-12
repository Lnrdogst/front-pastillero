import React from 'react';
import { Pill, Activity, ShieldCheck, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-slate-200/80 bg-white/60 py-6 text-xs text-slate-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-cyan-600 text-white flex items-center justify-center">
            <Pill className="w-3.5 h-3.5 rotate-45" />
          </div>
          <span className="font-bold text-slate-800">PillSync IoT</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-400">Sistema Inteligente para Cuidadores</span>
        </div>

        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1 text-slate-500">
            <Activity className="w-3.5 h-3.5 text-teal-600" />
            Supabase DB: cuidadores, dispositivos, horarios, historial_tomas
          </span>
          <span className="flex items-center gap-1 text-slate-500 hidden md:flex">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" />
            IoT Encriptado
          </span>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <span>Desarrollado con</span>
          <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
          <span>para la salud y el bienestar del paciente</span>
        </div>

      </div>
    </footer>
  );
};
