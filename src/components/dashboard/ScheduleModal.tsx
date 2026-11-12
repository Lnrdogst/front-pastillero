import React, { useState, useEffect } from 'react';
import { Horario, EstadoHorario } from '../../types/database';
import { Clock, Pill, X, Check, Calendar, FileText } from 'lucide-react';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    hora_programada: string;
    estado: EstadoHorario;
    medicamento?: string;
    dosis?: string;
    dias?: string[];
    notas?: string;
  }) => Promise<void>;
  initialData?: Horario | null;
}

const ALL_DAYS = [
  { id: 'L', label: 'Lun' },
  { id: 'M', label: 'Mar' },
  { id: 'X', label: 'Mié' },
  { id: 'J', label: 'Jue' },
  { id: 'V', label: 'Vie' },
  { id: 'S', label: 'Sáb' },
  { id: 'D', label: 'Dom' },
];

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [hora, setHora] = useState('08:00');
  const [estado, setEstado] = useState<EstadoHorario>('activo');
  const [medicamento, setMedicamento] = useState('');
  const [dosis, setDosis] = useState('1 pastilla');
  const [selectedDays, setSelectedDays] = useState<string[]>(['L', 'M', 'X', 'J', 'V', 'S', 'D']);
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setHora(initialData.hora_programada?.slice(0, 5) || '08:00');
      setEstado(initialData.estado || 'activo');
      setMedicamento(initialData.medicamento || '');
      setDosis(initialData.dosis || '1 pastilla');
      setSelectedDays(initialData.dias || ['L', 'M', 'X', 'J', 'V', 'S', 'D']);
      setNotas(initialData.notas || '');
    } else {
      setHora('08:00');
      setEstado('activo');
      setMedicamento('');
      setDosis('1 pastilla');
      setSelectedDays(['L', 'M', 'X', 'J', 'V', 'S', 'D']);
      setNotas('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const toggleDay = (dayId: string) => {
    if (selectedDays.includes(dayId)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== dayId));
      }
    } else {
      setSelectedDays([...selectedDays, dayId]);
    }
  };

  const handleSelectAllDays = () => {
    setSelectedDays(['L', 'M', 'X', 'J', 'V', 'S', 'D']);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      hora_programada: hora,
      estado,
      medicamento: medicamento.trim() || 'Medicamento programado',
      dosis: dosis.trim() || '1 pastilla',
      dias: selectedDays,
      notas: notas.trim(),
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                {initialData ? 'Editar Horario de Toma' : 'Nuevo Horario Programado'}
              </h3>
              <p className="text-xs text-slate-400">Tabla Supabase: <code>horarios</code></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Hora programada */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Hora de Dispensación</span>
                <span className="text-[10px] text-cyan-600 font-normal">hora_programada</span>
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="time"
                  required
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 bg-slate-50/50"
                />
              </div>
            </div>

            {/* Estado */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Estado Inicial</span>
                <span className="text-[10px] text-cyan-600 font-normal">estado</span>
              </label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as EstadoHorario)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 bg-slate-50/50"
              >
                <option value="activo">🟢 Activo (Dispensar)</option>
                <option value="inactivo">⚪ Inactivo (Pausado)</option>
              </select>
            </div>
          </div>

          {/* Medicamento y Dosis */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nombre del Fármaco
              </label>
              <div className="relative">
                <Pill className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="Ej. Losartán 50mg"
                  value={medicamento}
                  onChange={(e) => setMedicamento(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 bg-slate-50/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Dosis por Toma
              </label>
              <input
                type="text"
                placeholder="Ej. 1 pastilla"
                value={dosis}
                onChange={(e) => setDosis(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Días de la semana */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-600" />
                Días de Repetición
              </label>
              <button
                type="button"
                onClick={handleSelectAllDays}
                className="text-[11px] text-cyan-600 hover:text-cyan-800 font-semibold"
              >
                Todos los días
              </button>
            </div>
            <div className="flex items-center justify-between gap-1.5">
              {ALL_DAYS.map((day) => {
                const isSelected = selectedDays.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleDay(day.id)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notas o Indicaciones */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Instrucciones para el Cuidador / Paciente
            </label>
            <input
              type="text"
              placeholder="Ej. Tomar con abundante agua después de cenar"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 bg-slate-50/50"
            />
          </div>

          {/* Footer actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 text-xs font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-md shadow-cyan-600/20 transition-all flex items-center gap-2"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{initialData ? 'Guardar Cambios' : 'Crear Horario'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
