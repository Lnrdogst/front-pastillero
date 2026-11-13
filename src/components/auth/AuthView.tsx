import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Pill, 
  Lock, 
  Mail, 
  User, 
  Phone, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  Shield,
  Activity,
  Cpu
} from 'lucide-react';

export const AuthView: React.FC = () => {
  const { signIn, signUp, enableDemoMode, isDemoMode } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setError('Por favor completa todos los campos requeridos.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);

    if (isRegister) {
      if (!nombre.trim()) {
        setError('Por favor ingresa tu nombre completo.');
        setLoading(false);
        return;
      }
      const res = await signUp(email, password, nombre, telefono);
      if (!res.success) {
        setError(res.error || 'Error al crear la cuenta de cuidador.');
      } else {
        setSuccessMessage('¡Cuenta creada con éxito! Iniciando sesión...');
      }
    } else {
      const res = await signIn(email, password);
      if (!res.success) {
        if (res.status === 400) {
          setError('Error 400 (Bad Request): Credenciales inválidas o solicitud incorrecta. Se forzó la limpieza de sesión y tokens locales para evitar estados corruptos.');
        } else if (res.status === 429) {
          setError('Error 429 (Too Many Requests): Demasiados intentos de inicio de sesión. La sesión local se ha purgado. Espera un momento antes de volver a intentar.');
        } else {
          setError(res.error || 'Credenciales inválidas. Verifica tu correo y contraseña.');
        }
      }
    }

    setLoading(false);
  };

  const handleQuickDemo = () => {
    enableDemoMode();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 border border-slate-100">
        
        {/* Left Side: Brand & IoT Highlights */}
        <div className="lg:col-span-5 bg-gradient-to-br from-cyan-600 via-teal-700 to-cyan-900 p-8 sm:p-10 text-white flex flex-col justify-between relative overflow-hidden">
          {/* Background decorative circles */}
          <div className="absolute -right-12 -top-12 w-64 h-64 bg-cyan-400/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-teal-300/20 rounded-full blur-2xl pointer-events-none"></div>

          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-inner">
                <Pill className="w-7 h-7 rotate-45" />
              </div>
              <div>
                <span className="text-2xl font-black tracking-tight">PillSync <span className="text-cyan-200">IoT</span></span>
                <p className="text-xs text-cyan-100 font-medium tracking-wide uppercase">Portal de Cuidadores</p>
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="text-3xl font-bold leading-tight">
                Cuidado médico conectado y en tiempo real.
              </h1>
              <p className="text-sm text-cyan-100/90 leading-relaxed">
                Supervisa las tomas de medicamentos, recibe alertas inmediatas de atascos o manipulación no autorizada, y programa horarios con sincronización automática al hardware físico.
              </p>
            </div>

            {/* Feature cards */}
            <div className="mt-8 space-y-3">
              <div className="flex items-start gap-3 bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/10">
                <Activity className="w-5 h-5 text-cyan-300 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white">Monitoreo de Stock y Tomas</h4>
                  <p className="text-[11px] text-cyan-100/80">Conteo exacto de pastillas restantes y confirmación por sensores.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/10">
                <Cpu className="w-5 h-5 text-teal-300 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white">Vinculación por MAC ID</h4>
                  <p className="text-[11px] text-cyan-100/80">Enlace seguro punto a punto con el microcontrolador del dispensador.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/10">
                <Shield className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white">Detección de Atascos y Tapa Abierta</h4>
                  <p className="text-[11px] text-cyan-100/80">Historial visual codificado en verde para tomas exitosas y rojo para alertas.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/15 text-xs text-cyan-100 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Supabase Auth Integrado
            </span>
            <span className="text-cyan-200/80 text-[11px]">v1.0.0 IoT Ready</span>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-center">
          
          {/* Header Switcher */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {isRegister ? 'Registro de Cuidador' : 'Bienvenido de nuevo'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {isRegister 
                  ? 'Crea tu perfil para vincular y gestionar dispensadores inteligentes.'
                  : 'Ingresa tus credenciales para acceder al panel de control.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleQuickDemo}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-50 hover:bg-cyan-100 text-cyan-700 text-xs font-semibold border border-cyan-200 transition-all shadow-xs"
              title="Explorar el sistema sin registrar cuenta"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
              Acceso Rápido Demo
            </button>
          </div>

          {/* Form Tabs */}
          <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => { setIsRegister(false); setError(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                !isRegister 
                  ? 'bg-white text-slate-900 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister(true); setError(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                isRegister 
                  ? 'bg-white text-slate-900 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Registrarse
            </button>
          </div>

          {/* Alert Error / Success */}
          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700 animate-slide-up">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-700 animate-slide-up">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nombre Completo del Cuidador
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="Ej. Dra. María González"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 transition-all bg-slate-50/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Teléfono de Contacto (Opcional)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      placeholder="+52 55 1234 5678"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 transition-all bg-slate-50/50"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  placeholder="cuidador@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 transition-all bg-slate-50/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 transition-all bg-slate-50/50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white font-bold text-sm shadow-md shadow-cyan-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isRegister ? 'Crear Cuenta de Cuidador' : 'Iniciar Sesión en PillSync'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo button on mobile */}
          <div className="mt-5 text-center block sm:hidden">
            <button
              type="button"
              onClick={handleQuickDemo}
              className="text-xs font-semibold text-cyan-600 hover:text-cyan-700 inline-flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Ingresar directamente con Perfil Demo
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
              <span>Tabla <code>cuidadores</code> conectada</span>
            </div>
            {isDemoMode && (
              <span className="text-[11px] bg-slate-100 px-2.5 py-1 rounded-md text-slate-600">
                Variables VITE_SUPABASE_* no detectadas: usando storage emulado
              </span>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
