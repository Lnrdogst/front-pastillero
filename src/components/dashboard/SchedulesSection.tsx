import React, { useState } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { Horario, EstadoHorario } from '../../types/database';
import { 
  Clock, 
  Plus, 
  Trash2, 
  Edit3, 
  Pill, 
  CheckCircle2, 
  ToggleLeft,
  ToggleRight,
  Info
} from 'lucide-react';
import { ScheduleModal } from './ScheduleModal';

export const SchedulesSection: React.FC = () => {
  const { schedules, createSchedule, updateSchedule, deleteSchedule, toggleScheduleStatus } = useDevice();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Horario | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenCreate = () => {
    setEditingSchedule(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (schedule: Horario) => {
    setEditingSchedule(schedule);
    setIsModalOpen(true);
  };

  const handleSaveSchedule = async (data: {
    hora_programada: string;
    estado: EstadoHorario;
    medicamento?: string;
    dosis?: string;
    dias?: string[];
    notas?: string;
  }) => {
    if (editingSchedule) {
      const res = await updateSchedule(editingSchedule.id, data);
      if (res.success) {
        showToast('Horario actualizado con éxito en Supabase');
      }
    } else {
      const res = await createSchedule(data);
      if (res.success) {
        showToast('Nuevo horario programado con éxito');
      }
    }
  };

  const handleToggle = async (id: string, currentStatus: EstadoHorario) => {
    const res = await toggleScheduleStatus(id);
    if (res.success) {
      showToast(`Horario cambiado a ${currentStatus === 'activo' ? 'inactivo' : 'activo'}`);
    }
  };

  const handleDeleteConfirm = async (id: string) => {
    const res = await deleteSchedule(id);
    setDeletingId(null);
    if (res.success) {
      showToast('Horario eliminado de la base de datos');
    }
  };

  const activeCount = schedules.filter((s) => s.estado === 'activo').length;

  return (
    <section className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 sm:p-8">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-slide-up border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              Programación de Horarios
            </h3>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800">
              {activeCount} {activeCount === 1 ? 'activo' : 'activos'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            CRUD sincronizado en tiempo real con la tabla <code className="text-cyan-700 font-semibold font-mono">horarios</code> de Supabase.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-md shadow-cyan-600/20 hover:shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Horario</span>
        </button>
      </div>

      {/* List / Grid of Schedules */}
      {schedules.length === 0 ? (
        <div className="text-center py-12 px-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center mx-auto mb-3 border border-cyan-100">
            <Clock className="w-7 h-7" />
          </div>
          <h4 className="text-base font-bold text-slate-800">No hay horarios programados</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
            Agrega las horas exactas en las que el dispensador físico debe activar el servomotor y liberar la dosis.
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Configurar Primera Toma
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schedules.map((schedule) => {
            const isActive = schedule.estado === 'activo';
            const isBeingDeleted = deletingId === schedule.id;

            return (
              <div
                key={schedule.id}
                className={`rounded-2xl border transition-all p-5 flex flex-col justify-between ${
                  isActive
                    ? 'bg-white border-slate-200/90 hover:border-cyan-400 hover:shadow-md'
                    : 'bg-slate-50/70 border-slate-200/60 opacity-75'
                }`}
              >
                <div>
                  {/* Top: Time & Status Toggle */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          isActive
                            ? 'bg-cyan-100 text-cyan-700'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                          {schedule.hora_programada?.slice(0, 5)}
                        </span>
                        <span className="text-[11px] text-slate-400 ml-1.5 uppercase font-semibold">
                          {parseInt(schedule.hora_programada?.split(':')[0] || '0') >= 12 ? 'PM' : 'AM'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggle(schedule.id, schedule.estado)}
                      className={`text-xs font-bold flex items-center gap-1 px-2.5 py-1 rounded-full transition-colors ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                      title={isActive ? 'Desactivar horario' : 'Activar horario'}
                    >
                      {isActive ? (
                        <>
                          <ToggleRight className="w-4 h-4 text-emerald-600" />
                          <span>Activo</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-4 h-4 text-slate-400" />
                          <span>Inactivo</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Medicine & Dosage */}
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                      <Pill className="w-4 h-4 text-cyan-600 shrink-0" />
                      <span className="truncate">{schedule.medicamento || 'Medicamento programado'}</span>
                    </div>
                    {schedule.dosis && (
                      <p className="text-xs text-slate-500 pl-5">
                        Dosis: <span className="font-semibold text-slate-700">{schedule.dosis}</span>
                      </p>
                    )}
                  </div>

                  {/* Days */}
                  {schedule.dias && schedule.dias.length > 0 && (
                    <div className="flex items-center gap-1 mb-3">
                      {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
                        <span
                          key={d}
                          className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                            schedule.dias?.includes(d)
                              ? 'bg-cyan-100 text-cyan-900 font-extrabold'
                              : 'text-slate-300'
                          }`}
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  {schedule.notas && (
                    <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100 mb-3 flex items-start gap-1">
                      <Info className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{schedule.notas}</span>
                    </p>
                  )}
                </div>

                {/* Card Actions (Edit & Delete) */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">
                    ID: {schedule.id.slice(0, 8)}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(schedule)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-700 hover:bg-cyan-50 transition-colors"
                      title="Editar horario"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {isBeingDeleted ? (
                      <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg border border-red-200">
                        <span className="text-[10px] text-red-700 font-bold px-1">¿Borrar?</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteConfirm(schedule.id)}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white hover:bg-red-700"
                        >
                          Sí
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 hover:bg-slate-300"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeletingId(schedule.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Eliminar horario"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Create/Edit Modal */}
      <ScheduleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveSchedule}
        initialData={editingSchedule}
      />

    </section>
  );
};
