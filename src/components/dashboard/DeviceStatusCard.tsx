import React, { useState } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { 
  Wifi, 
  WifiOff, 
  Pill, 
  AlertTriangle, 
  RefreshCw, 
  Copy, 
  Check, 
  PlusCircle, 
  Layers, 
  Clock, 
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { RefillModal } from './RefillModal';

interface DeviceStatusCardProps {
  onLinkNewDevice?: () => void;
}

export const DeviceStatusCard: React.FC<DeviceStatusCardProps> = ({ onLinkNewDevice }) => {
  const { device, refreshData, loading } = useDevice();
  const [copied, setCopied] = useState(false);
  const [showRefillModal, setShowRefillModal] = useState(false);

  if (!device) return null;

  const pastillas = device.pastillas_restantes;
  const maxCap = device.capacidad_maxima || 30;
  const percent = Math.min(100, Math.round((pastillas / maxCap) * 100));

  // Estado visual condicional de pastillas
  const isCritical = pastillas <= 5;
  const isWarning = pastillas > 5 && pastillas <= 12;

  const copyMac = () => {
    navigator.clipboard.writeText(device.mac_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
        {/* Main Banner Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          
          {/* Left Column: Device Info & Status */}
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              {/* Header tags */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  {device.estado === 'online' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      Dispositivo Conectado (Online)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      <WifiOff className="w-3.5 h-3.5 text-slate-400" />
                      Dispositivo Desconectado (Offline)
                    </span>
                  )}

                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                    <ShieldCheck className="w-3 h-3 text-cyan-600" />
                    Supabase Sync
                  </span>
                </div>

                <button
                  onClick={refreshData}
                  disabled={loading}
                  title="Sincronizar estado con Supabase"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
                </button>
              </div>

              {/* Device Title & MAC */}
              <div className="space-y-1 mb-6">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {device.nombre || 'Dispensador IoT'}
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium">MAC ID:</span>
                  <button
                    onClick={copyMac}
                    className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
                    title="Copiar MAC ID al portapapeles"
                  >
                    <span>{device.mac_id}</span>
                    {copied ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3 text-slate-400" />
                    )}
                  </button>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    {device.ultima_conexion ? 'Sincronizado hoy' : 'Activo'}
                  </span>
                </div>
              </div>

              {/* Critical Alert Notice if <= 5 pills */}
              {isCritical && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-800 animate-pulse-slow mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-extrabold text-red-900">¡Alerta: Nivel crítico de pastillas!</p>
                    <p className="mt-0.5 text-red-700">
                      Quedan solo <strong>{pastillas} pastillas</strong> en el pastillero. Recarga el depósito para evitar interrupciones en la toma de medicamentos del paciente.
                    </p>
                  </div>
                </div>
              )}

              {/* Warning Notice if 6 - 12 pills */}
              {isWarning && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-amber-800 mb-4">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold">Aviso de stock medio: </span>
                    Quedan {pastillas} pastillas. Considera reponer los comprimidos pronto.
                  </div>
                </div>
              )}
            </div>

            {/* Bottom quick actions in left col */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4 text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-slate-400" />
                  Capacidad máx: <strong>{maxCap} cápsulas</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <Wifi className="w-4 h-4 text-teal-600" />
                  Canal WiFi: <strong>2.4 GHz</strong>
                </span>
              </div>

              {onLinkNewDevice && (
                <button
                  type="button"
                  onClick={onLinkNewDevice}
                  className="text-cyan-700 hover:text-cyan-800 font-bold inline-flex items-center gap-1"
                >
                  <span>Vincular otro pastillero</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Pill Inventory Gauge & Refill CTA */}
          <div className="lg:col-span-5 p-6 sm:p-8 bg-slate-50/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Pill className="w-4 h-4 text-cyan-600 rotate-45" />
                  pastillas_restantes
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    isCritical
                      ? 'bg-red-100 text-red-800'
                      : isWarning
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {isCritical ? 'Stock Crítico' : isWarning ? 'Stock Medio' : 'Stock Óptimo'}
                </span>
              </div>

              {/* Number and visual bar */}
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-5xl font-black text-slate-900 tracking-tight font-mono">
                  {pastillas}
                </span>
                <span className="text-sm font-semibold text-slate-400">/ {maxCap} pastillas</span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden p-0.5 border border-slate-300/40">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    isCritical
                      ? 'bg-gradient-to-r from-red-500 to-rose-600'
                      : isWarning
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                      : 'bg-gradient-to-r from-teal-500 to-cyan-500'
                  }`}
                  style={{ width: `${Math.max(5, percent)}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[11px] text-slate-500 mt-2 font-medium">
                <span>0 pastillas (Vacío)</span>
                <span className="font-bold text-slate-700">{percent}% de capacidad</span>
                <span>{maxCap} pastillas (Lleno)</span>
              </div>
            </div>

            {/* CTA Button to Refill */}
            <div className="mt-6 pt-4 border-t border-slate-200/60">
              <button
                type="button"
                onClick={() => setShowRefillModal(true)}
                className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-xs shadow-xs hover:shadow transition-all flex items-center justify-center gap-2 group"
              >
                <PlusCircle className="w-4 h-4 text-cyan-600 group-hover:scale-110 transition-transform" />
                <span>Recargar / Ajustar Inventario de Pastillas</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Refill Modal */}
      <RefillModal
        isOpen={showRefillModal}
        onClose={() => setShowRefillModal(false)}
      />
    </>
  );
};
