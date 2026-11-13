import React, { useState } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { 
  Cpu, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Info, 
  ArrowRight, 
  Pill, 
  Tag, 
  Layers,
  HelpCircle,
  Hash,
  X
} from 'lucide-react';

interface OnboardingViewProps {
  onComplete: () => void;
  canCancel?: boolean;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete, canCancel = false }) => {
  const { linkDevice, linkingDevice } = useDevice();
  const [macId, setMacId] = useState('');
  const [nombre, setNombre] = useState('');
  const [pastillas, setPastillas] = useState<number>(30);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Formateador automático de MAC ID (ej: AA:BB:CC:DD:EE:FF)
  const handleMacChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^0-9A-F:]/g, '');
    setMacId(val);
  };

  const fillExampleMac = () => {
    const randomHex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();
    const generatedMac = `24:6F:28:${randomHex()}:${randomHex()}:${randomHex()}`;
    setMacId(generatedMac);
    if (!nombre) {
      setNombre('Dispensador Inteligente Sala');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanMac = macId.trim();
    if (!cleanMac) {
      setError('Por favor ingresa la dirección MAC del dispensador.');
      return;
    }

    if (cleanMac.length < 8) {
      setError('El formato de MAC ID debe ser válido (ej. 24:6F:28:B2:8E:44).');
      return;
    }

    try {
      const res = await linkDevice(cleanMac, nombre, pastillas);
      if (!res.success) {
        setError(res.error || 'Error al ejecutar la consulta UPDATE en la tabla dispositivos.');
      } else {
        setSuccess(true);
        setTimeout(() => {
          onComplete();
        }, 1200);
      }
    } catch (err: unknown) {
      console.error('[OnboardingView] Error capturado en formulario:', err);
      const errorMsg =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : err instanceof Error
          ? err.message
          : 'Error inesperado al ejecutar el UPDATE en la tabla dispositivos';
      setError(errorMsg);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 to-slate-100/70 py-10 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-3xl w-full">
        
        {/* Progress header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-100 text-cyan-800 text-xs font-bold uppercase tracking-wider mb-3">
            <Cpu className="w-3.5 h-3.5" />
            Configuración Inicial de Hardware
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Vincular Dispensador IoT
          </h1>
          <p className="text-sm text-slate-500 max-w-lg mx-auto mt-2">
            Conecta el microcontrolador de tu pastillero físico a tu cuenta de cuidador ingresando su identificador único MAC.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden">
          
          {/* Top helper banner */}
          <div className="bg-slate-900 p-6 sm:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
            <div className="space-y-2 relative z-10">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                <HelpCircle className="w-4 h-4" />
                ¿Dónde encontrar el MAC ID?
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-md">
                Revisa la etiqueta adhesiva en la base del dispensador o la pantalla OLED al encender el equipo. El formato típico es de 6 pares hexadecimales: <span className="font-mono text-cyan-300 font-semibold">XX:XX:XX:XX:XX:XX</span>.
              </p>
            </div>

            <div className="shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={fillExampleMac}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                Generar MAC de Prueba
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 sm:p-10 space-y-6">
            
            {error && (
              <div 
                role="alert"
                className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start justify-between gap-3 text-xs text-red-800 animate-slide-up shadow-xs"
              >
                <div className="flex items-start gap-3 flex-1">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1.5 flex-1">
                    <p className="font-extrabold text-red-900 text-sm">
                      Fallo en la vinculación (Consulta UPDATE a 'dispositivos')
                    </p>
                    <p className="text-red-700 leading-relaxed font-mono text-[11px] bg-red-100/70 p-2.5 rounded-xl border border-red-200/80 break-words select-all">
                      {error}
                    </p>
                    <p className="text-[11px] text-red-600 font-medium">
                      Verifica las políticas RLS de Supabase y asegúrate de que el MAC ID exista en la tabla 'dispositivos'.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="p-1 rounded-lg text-red-400 hover:text-red-700 hover:bg-red-100/60 transition-colors"
                  title="Cerrar mensaje de error"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {success && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-700 animate-slide-up">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">¡Dispositivo vinculado con éxito en la tabla 'dispositivos'!</p>
                  <p>Redirigiendo a tu Dashboard...</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* MAC ID Field */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Dirección MAC del Dispositivo (Obligatorio)</span>
                  <span className="text-[11px] font-normal text-slate-400 lowercase">Columna mac_id</span>
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="Ej. 24:6F:28:B2:8E:44"
                    value={macId}
                    onChange={handleMacChange}
                    maxLength={20}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 transition-all bg-slate-50/50 placeholder:font-sans placeholder:normal-case"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" />
                  Identificador físico único transmitido por MQTT/HTTP por el microcontrolador ESP32.
                </p>
              </div>

              {/* Nombre descriptivo */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Nombre o Ubicación del Equipo
                </label>
                <div className="relative">
                  <Tag className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    placeholder="Ej. Pastillero Habitación Abuelo"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 transition-all bg-slate-50/50"
                  />
                </div>
              </div>

              {/* Pastillas iniciales */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Carga Inicial de Pastillas</span>
                  <span className="text-[11px] font-normal text-slate-400 lowercase">pastillas_restantes</span>
                </label>
                <div className="relative">
                  <Pill className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={pastillas}
                    onChange={(e) => setPastillas(parseInt(e.target.value) || 0)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 transition-all bg-slate-50/50"
                  />
                </div>
              </div>

            </div>

            {/* Visual Hardware Preview Card */}
            <div className="p-4 rounded-2xl bg-cyan-50/50 border border-cyan-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Layers className="w-6 h-6" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-slate-800">
                  {nombre || 'Dispensador Nuevo'} 
                  <span className="ml-2 font-mono text-[11px] font-semibold text-cyan-800 bg-cyan-100/70 px-2 py-0.5 rounded-md">
                    {macId || 'MAC: NO ESPECIFICADA'}
                  </span>
                </p>
                <p className="text-slate-500 mt-0.5">
                  Capacidad configurada: <span className="font-semibold text-cyan-900">{pastillas} pastillas</span>. Se asociará automáticamente al ID de cuidador actual.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 flex flex-col-reverse sm:flex-row items-center justify-end gap-3 border-t border-slate-100">
              {canCancel && (
                <button
                  type="button"
                  onClick={onComplete}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-slate-600 hover:text-slate-800 hover:bg-slate-100 text-xs font-bold transition-all"
                >
                  Cancelar y volver al Dashboard
                </button>
              )}

              <button
                type="submit"
                disabled={linkingDevice || success}
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-cyan-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {linkingDevice ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Vinculando en Supabase...</span>
                  </>
                ) : (
                  <>
                    <span>Vincular y Comenzar</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

          </form>

        </div>

      </div>
    </div>
  );
};
