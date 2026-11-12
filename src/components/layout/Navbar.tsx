import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDevice } from '../../context/DeviceContext';
import { 
  Pill, 
  Wifi, 
  WifiOff, 
  LogOut, 
  PlusCircle, 
  ChevronDown, 
  Sliders, 
  Sparkles,
  ShieldCheck 
} from 'lucide-react';

interface NavbarProps {
  currentView: 'dashboard' | 'onboarding';
  onNavigate: (view: 'dashboard' | 'onboarding') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate }) => {
  const { user, signOut, isDemoMode } = useAuth();
  const { device, devices, selectDevice } = useDevice();
  const [showDeviceMenu, setShowDeviceMenu] = React.useState(false);

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <Pill className="w-6 h-6 rotate-45" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">PillSync <span className="text-cyan-600 font-extrabold">IoT</span></span>
                {isDemoMode && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    <Sparkles className="w-3 h-3" /> Modo Demo
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">Control inteligente de dispensadores médicos</p>
            </div>
          </div>

          {/* Device Selector & Actions */}
          <div className="flex items-center gap-3">
            {/* Device Dropdown if user has devices */}
            {device && currentView === 'dashboard' && (
              <div className="relative">
                <button
                  onClick={() => setShowDeviceMenu(!showDeviceMenu)}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors text-xs text-slate-700"
                >
                  <div className="flex items-center gap-1.5">
                    {device.estado === 'online' ? (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full h-2 w-2 bg-slate-400"></span>
                    )}
                    <span className="font-semibold text-slate-800 max-w-[130px] sm:max-w-[180px] truncate">
                      {device.nombre || device.mac_id}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {showDeviceMenu && (
                  <div 
                    className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 animate-fade-in"
                    onMouseLeave={() => setShowDeviceMenu(false)}
                  >
                    <div className="px-3 py-1.5 border-b border-slate-100">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Dispositivos Vinculados</p>
                    </div>
                    {devices.map((d) => (
                      <button
                        key={d.mac_id}
                        onClick={() => {
                          selectDevice(d.mac_id);
                          setShowDeviceMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 ${
                          d.mac_id === device.mac_id ? 'bg-cyan-50/60 font-medium text-cyan-900' : 'text-slate-600'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <p className="truncate font-semibold">{d.nombre || 'Dispensador'}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{d.mac_id}</p>
                        </div>
                        {d.estado === 'online' ? (
                          <Wifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <WifiOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                      </button>
                    ))}
                    <div className="pt-1 mt-1 border-t border-slate-100 px-2">
                      <button
                        onClick={() => {
                          setShowDeviceMenu(false);
                          onNavigate('onboarding');
                        }}
                        className="w-full text-left px-2 py-1.5 text-xs text-cyan-700 hover:bg-cyan-50 rounded-md font-medium flex items-center gap-1.5"
                      >
                        <PlusCircle className="w-3.5 h-3.5 text-cyan-600" />
                        Vincular nuevo dispensador
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Navigation buttons */}
            {device && currentView === 'onboarding' && (
              <button
                onClick={() => onNavigate('dashboard')}
                className="text-xs font-semibold px-3 py-2 text-cyan-700 hover:text-cyan-800 bg-cyan-50 hover:bg-cyan-100 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Sliders className="w-3.5 h-3.5" />
                Ir al Dashboard
              </button>
            )}

            {/* Caregiver info & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1 justify-end">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                  {user?.nombre || user?.email?.split('@')[0]}
                </span>
                <span className="text-[10px] text-slate-400 truncate max-w-[150px]">{user?.email}</span>
              </div>

              <button
                onClick={signOut}
                title="Cerrar sesión"
                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                aria-label="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
