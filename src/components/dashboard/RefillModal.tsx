import React, { useState } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { Pill, X, Plus, Check } from 'lucide-react';

interface RefillModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RefillModal: React.FC<RefillModalProps> = ({ isOpen, onClose }) => {
  const { device, updatePillsCount } = useDevice();
  const currentCount = device?.pastillas_restantes ?? 0;
  const [pills, setPills] = useState<number>(currentCount);
  const [loading, setLoading] = useState(false);

  if (!isOpen || !device) return null;

  const handleSave = async () => {
    setLoading(true);
    await updatePillsCount(pills);
    setLoading(false);
    onClose();
  };

  const handleAddPreset = (amount: number) => {
    setPills((prev) => Math.min(60, prev + amount));
  };

  const handleSetMax = () => {
    setPills(30);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Pill className="w-5 h-5 rotate-45" />
            </div>
            <div>
              <h3 className="font-bold text-base">Recargar Pastillero</h3>
              <p className="text-xs text-slate-400 font-mono">Dispositivo: {device.mac_id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div className="text-center py-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Cantidad total de pastillas en compartimento
            </p>
            <div className="inline-flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setPills((p) => Math.max(0, p - 1))}
                className="w-10 h-10 rounded-full border border-slate-200 hover:bg-slate-100 flex items-center justify-center font-bold text-lg text-slate-700"
              >
                -
              </button>
              <div className="text-5xl font-black text-slate-900 tracking-tight font-mono w-24 text-center">
                {pills}
              </div>
              <button
                type="button"
                onClick={() => setPills((p) => Math.min(60, p + 1))}
                className="w-10 h-10 rounded-full border border-slate-200 hover:bg-slate-100 flex items-center justify-center font-bold text-lg text-slate-700"
              >
                +
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Anterior: <span className="font-bold text-slate-600">{currentCount} pastillas</span>
            </p>
          </div>

          {/* Quick presets */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Accesos rápidos
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleAddPreset(5)}
                className="py-2 rounded-xl border border-cyan-200 bg-cyan-50/60 hover:bg-cyan-100 text-cyan-800 text-xs font-bold transition-all flex items-center justify-center gap-1"
              >
                <Plus className="w-3 h-3" /> 5
              </button>
              <button
                type="button"
                onClick={() => handleAddPreset(10)}
                className="py-2 rounded-xl border border-cyan-200 bg-cyan-50/60 hover:bg-cyan-100 text-cyan-800 text-xs font-bold transition-all flex items-center justify-center gap-1"
              >
                <Plus className="w-3 h-3" /> 10
              </button>
              <button
                type="button"
                onClick={() => handleAddPreset(20)}
                className="py-2 rounded-xl border border-cyan-200 bg-cyan-50/60 hover:bg-cyan-100 text-cyan-800 text-xs font-bold transition-all flex items-center justify-center gap-1"
              >
                <Plus className="w-3 h-3" /> 20
              </button>
              <button
                type="button"
                onClick={handleSetMax}
                className="py-2 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition-all"
              >
                Llenar (30)
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 text-xs font-bold transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-md shadow-cyan-600/20 transition-all flex items-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Actualizar en Supabase</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
