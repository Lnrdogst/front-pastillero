import React, { useState, useMemo } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { HistorialToma, EventoHistorial } from '../../types/database';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  Search, 
  Calendar, 
  Sparkles, 
  RefreshCw,
  Cpu,
  ShieldAlert,
  ArrowDownUp
} from 'lucide-react';

export const HistorySection: React.FC = () => {
  const { history, simulateEvent, loading, refreshData } = useDevice();
  const [filterType, setFilterType] = useState<'all' | 'dispensado' | 'incidentes'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);

  // Filtrado y orden de eventos
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      // Filtro de tipo de evento
      if (filterType === 'dispensado' && item.evento !== 'dispensado') return false;
      if (filterType === 'incidentes' && item.evento === 'dispensado') return false;

      // Filtro de búsqueda
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesEvent = item.evento.toLowerCase().includes(query);
        const matchesDetails = item.detalles?.toLowerCase().includes(query) || false;
        const matchesMed = item.medicamento?.toLowerCase().includes(query) || false;
        return matchesEvent || matchesDetails || matchesMed;
      }

      return true;
    });
  }, [history, filterType, searchQuery]);

  // Contadores
  const countSuccess = history.filter((h) => h.evento === 'dispensado').length;
  const countIncidents = history.filter((h) => h.evento === 'atasco' || h.evento === 'tapa_abierta').length;

  const handleSimulate = async (evento: EventoHistorial) => {
    setIsSimulating(true);
    await simulateEvent(evento);
    setIsSimulating(false);
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(date);
    } catch {
      return isoString;
    }
  };

  // Renderizador condicional de estilo según el evento:
  // Verde: dispensado
  // Rojo: atasco, tapa_abierta
  const renderEventBadge = (evento: EventoHistorial) => {
    switch (evento) {
      case 'dispensado':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Dispensado con Éxito
          </span>
        );
      case 'atasco':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs animate-pulse-slow">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            Atasco en Mecanismo
          </span>
        );
      case 'tapa_abierta':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-800 border border-red-300 shadow-2xs">
            <Lock className="w-3.5 h-3.5 text-red-600" />
            Tapa Abierta Indebida
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <section className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 sm:p-8">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              Historial de Tomas y Eventos
            </h3>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {history.length} registros
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Supervisión condicional en la tabla <code className="text-cyan-700 font-semibold font-mono">historial_tomas</code> (Verde: dispensado | Rojo: atasco y tapa abierta).
          </p>
        </div>

        {/* Simulator Bar */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider px-2 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-cyan-600" />
            Simulador IoT:
          </span>

          <button
            type="button"
            disabled={isSimulating}
            onClick={() => handleSimulate('dispensado')}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            title="Simula que el motor dispensó y el sensor IR detectó la caída de la pastilla"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>+ Dispensado</span>
          </button>

          <button
            type="button"
            disabled={isSimulating}
            onClick={() => handleSimulate('atasco')}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            title="Simula un atasco mecánico en el rotor de dispensación"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>+ Atasco</span>
          </button>

          <button
            type="button"
            disabled={isSimulating}
            onClick={() => handleSimulate('tapa_abierta')}
            className="px-3 py-1.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            title="Simula la apertura de la tapa del depósito de pastillas"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>+ Tapa Abierta</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="pt-6 pb-4 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Filter Pills */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            Todos ({history.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterType('dispensado')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filterType === 'dispensado'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Exitosos ({countSuccess})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('incidentes')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filterType === 'incidentes'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Incidentes / Alertas ({countIncidents})</span>
          </button>
        </div>

        {/* Search Input & Refresh */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar en historial..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 bg-slate-50/50"
            />
          </div>

          <button
            type="button"
            onClick={refreshData}
            disabled={loading}
            title="Actualizar tabla"
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200/90 mt-2">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">Estado / Evento</th>
              <th className="py-3 px-4 flex items-center gap-1">
                <span>Fecha y Hora</span>
                <ArrowDownUp className="w-3 h-3 text-slate-400" />
              </th>
              <th className="py-3 px-4">Detalle / Diagnóstico Técnico</th>
              <th className="py-3 px-4">Dispositivo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredHistory.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-slate-400">
                  <div className="max-w-xs mx-auto space-y-2">
                    <Calendar className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="font-semibold text-slate-600">No hay eventos registrados en este filtro</p>
                    <p className="text-[11px]">Utiliza los botones de "Simulador IoT" arriba para generar eventos de prueba.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredHistory.map((item: HistorialToma) => {
                const isSuccess = item.evento === 'dispensado';
                const isJam = item.evento === 'atasco';

                // Clases condicionales de fila completas
                const rowBorderClass = isSuccess
                  ? 'border-l-4 border-l-emerald-500 hover:bg-emerald-50/40'
                  : isJam
                  ? 'border-l-4 border-l-rose-500 bg-rose-50/20 hover:bg-rose-50/50'
                  : 'border-l-4 border-l-red-500 bg-red-50/20 hover:bg-red-50/50';

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${rowBorderClass}`}
                  >
                    {/* Evento con diseño condicional */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {renderEventBadge(item.evento)}
                    </td>

                    {/* Fecha y Hora */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-700">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{formatDate(item.created_at)}</span>
                      </div>
                    </td>

                    {/* Detalle del evento */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <p className={`font-semibold ${
                          isSuccess ? 'text-slate-800' : isJam ? 'text-rose-900 font-bold' : 'text-red-900 font-bold'
                        }`}>
                          {item.detalles || (
                            isSuccess
                              ? 'Comprimido dispensado correctamente'
                              : isJam
                              ? 'Obstrucción detectada en la bandeja'
                              : 'Manipulación no autorizada del compartimento'
                          )}
                        </p>
                        {item.medicamento && (
                          <p className="text-[11px] text-slate-500">
                            Fármaco: <span className="font-medium text-slate-700">{item.medicamento}</span>
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Dispositivo MAC */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {item.mac_id || 'Dispositivo'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            Verde: Tomas exitosas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
            Rojo: Atasco o Tapa abierta
          </span>
        </div>

        <span className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-cyan-600" />
          Eventos transmitidos vía MQTT/WebSockets a Supabase
        </span>
      </div>

    </section>
  );
};
