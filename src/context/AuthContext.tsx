import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mockStorage } from '../lib/mockService';
import { Cuidador } from '../types/database';

interface AuthContextType {
  user: Cuidador | null;
  loading: boolean;
  isDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string; status?: number }>;
  signUp: (email: string, password: string, nombre: string, telefono?: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  enableDemoMode: () => void;
  purgeSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Función de utilidad para purgar sesiones locales corruptas o bloqueadas (400 / 429)
export const purgeCorruptSession = async (): Promise<void> => {
  try {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut({ scope: 'local' });
    }
  } catch (err) {
    console.warn('[AuthContext] Advertencia al forzar supabase.auth.signOut:', err);
  }

  try {
    // Purgar tokens de autenticación de Supabase en localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase') || key.startsWith('pillsync_demo_user'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    console.info('[AuthContext] Sesión local y tokens de Supabase purgados exitosamente.');
  } catch (err) {
    console.warn('[AuthContext] Error purgando localStorage:', err);
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Cuidador | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(!isSupabaseConfigured);

  const purgeSession = useCallback(async () => {
    await purgeCorruptSession();
    setUser(null);
  }, []);

  useEffect(() => {
    // Si no está configurado Supabase, o hay usuario demo guardado
    if (!isSupabaseConfigured) {
      const savedUser = mockStorage.getUser();
      if (savedUser) {
        setUser(savedUser);
      }
      setLoading(false);
      return;
    }

    // Inicializar sesión real con Supabase Auth
    const initAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          const status = (sessionError as { status?: number }).status;
          if (status === 400 || status === 429) {
            console.warn('[AuthContext] Sesión corrupta detectada al inicio (400/429). Purgando...');
            await purgeCorruptSession();
            setUser(null);
            setLoading(false);
            return;
          }
        }

        if (session?.user) {
          // Consultar tabla cuidadores (lectura autorizada por RLS id = auth.uid())
          const { data: cuidadorData } = await supabase
            .from('cuidadores')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          setUser({
            id: session.user.id,
            email: session.user.email || '',
            nombre: cuidadorData?.nombre || session.user.user_metadata?.nombre || session.user.email?.split('@')[0],
            telefono: cuidadorData?.telefono || session.user.user_metadata?.telefono || '',
            created_at: session.user.created_at,
          });
        }
      } catch (err) {
        console.warn('Error inicializando sesión de Supabase:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
        return;
      }

      if (session?.user) {
        const { data: cuidadorData } = await supabase
          .from('cuidadores')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        setUser({
          id: session.user.id,
          email: session.user.email || '',
          nombre: cuidadorData?.nombre || session.user.user_metadata?.nombre || session.user.email?.split('@')[0],
          telefono: cuidadorData?.telefono || session.user.user_metadata?.telefono || '',
          created_at: session.user.created_at,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string; status?: number }> => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured || isDemoMode) {
        // Mock sign in
        const demoUser: Cuidador = {
          id: 'cuidador-demo-01',
          email: email.trim(),
          nombre: email.includes('@') ? email.split('@')[0] : 'Cuidador Principal',
          telefono: '+52 55 1234 5678',
          created_at: new Date().toISOString(),
        };
        mockStorage.setUser(demoUser);
        setUser(demoUser);
        setLoading(false);
        return { success: true };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const status = error.status || (error as { code?: number }).code;
        const isCorruptOrRateLimited =
          status === 400 ||
          status === 429 ||
          error.message?.includes('400') ||
          error.message?.includes('429');

        // En caso de error 400 o 429: forzar signOut y limpiar localStorage
        if (isCorruptOrRateLimited) {
          console.warn(`[AuthContext] Error ${status} en signIn. Forzando signOut y purgando localStorage.`);
          await purgeCorruptSession();
          setUser(null);
        }

        return {
          success: false,
          error: error.message || 'Error al iniciar sesión',
          status: typeof status === 'number' ? status : undefined,
        };
      }

      if (data.user) {
        // Consultar tabla cuidadores (solo lectura RLS para el propio cuidador)
        const { data: cuidadorData } = await supabase
          .from('cuidadores')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        setUser({
          id: data.user.id,
          email: data.user.email || '',
          nombre: cuidadorData?.nombre || data.user.user_metadata?.nombre || 'Cuidador',
          telefono: cuidadorData?.telefono || data.user.user_metadata?.telefono,
          created_at: data.user.created_at,
        });
      }

      return { success: true };
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión';

      if (status === 400 || status === 429 || msg.includes('400') || msg.includes('429')) {
        await purgeCorruptSession();
        setUser(null);
      }

      return { success: false, error: msg, status };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, nombre: string, telefono?: string) => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured || isDemoMode) {
        const demoUser: Cuidador = {
          id: 'cuidador-' + Math.random().toString(36).substring(2, 9),
          email: email.trim(),
          nombre: nombre.trim(),
          telefono: telefono || '',
          created_at: new Date().toISOString(),
        };
        mockStorage.setUser(demoUser);
        setUser(demoUser);
        setLoading(false);
        return { success: true };
      }

      // Registro en Supabase Auth
      // NOTA ARQUITECTÓNICA: Se envían 'nombre' y 'telefono' en los metadatos de usuario.
      // Ya NO se realiza un INSERT manual a 'public.cuidadores' desde el frontend.
      // El TRIGGER 'on_auth_user_created' en Supabase se encarga de insertar la fila en 'public.cuidadores'.
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            nombre: nombre.trim(),
            telefono: telefono?.trim() || null,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        setUser({
          id: data.user.id,
          email: data.user.email || '',
          nombre: nombre.trim(),
          telefono: telefono?.trim(),
          created_at: data.user.created_at,
        });
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar cuidador';
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured && !isDemoMode) {
        await supabase.auth.signOut();
      }
      mockStorage.setUser(null);
      setUser(null);
      // Limpieza preventiva de localStorage
      await purgeCorruptSession();
    } catch (err) {
      console.error('Error cerrando sesión:', err);
    } finally {
      setLoading(false);
    }
  };

  const enableDemoMode = () => {
    setIsDemoMode(true);
    const demoUser: Cuidador = {
      id: 'cuidador-demo-01',
      email: 'cuidador.ejemplo@pillsync.iot',
      nombre: 'Dra. María González',
      telefono: '+52 55 9876 5432',
      created_at: new Date().toISOString(),
    };
    mockStorage.setUser(demoUser);
    setUser(demoUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isDemoMode,
        signIn,
        signUp,
        signOut,
        enableDemoMode,
        purgeSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
