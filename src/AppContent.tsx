import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useDevice } from './context/DeviceContext';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { AuthView } from './components/auth/AuthView';
import { OnboardingView } from './components/onboarding/OnboardingView';
import { DashboardView } from './components/dashboard/DashboardView';

export const AppContent: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { device, loading: deviceLoading } = useDevice();
  const [viewOverride, setViewOverride] = useState<'dashboard' | 'onboarding' | null>(null);

  // Pantalla de carga inicial
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4" />
        <p className="text-white font-bold text-sm">Cargando PillSync IoT...</p>
        <p className="text-slate-400 text-xs mt-1">Conectando con Supabase Auth</p>
      </div>
    );
  }

  // Vista 1: Login / Registro (si no hay sesión de cuidador activa)
  if (!user) {
    return <AuthView />;
  }

  // Determinar vista activa
  const showOnboarding =
    viewOverride === 'onboarding' || (!deviceLoading && !device && viewOverride !== 'dashboard');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/70 text-slate-800">
      {/* Barra de Navegación superior */}
      <Navbar
        currentView={showOnboarding ? 'onboarding' : 'dashboard'}
        onNavigate={(view) => setViewOverride(view)}
      />

      {/* Contenido Principal */}
      <main className="flex-1">
        {showOnboarding ? (
          // Vista 2: Onboarding (vincular mac_id a la tabla 'dispositivos')
          <OnboardingView
            onComplete={() => setViewOverride('dashboard')}
            canCancel={Boolean(device)}
          />
        ) : (
          // Vista 3: Dashboard (Panel estado, pastillas_restantes, CRUD horarios, historial_tomas condicional)
          <DashboardView
            onNavigateToOnboarding={() => setViewOverride('onboarding')}
          />
        )}
      </main>

      {/* Pie de página */}
      <Footer />
    </div>
  );
};
