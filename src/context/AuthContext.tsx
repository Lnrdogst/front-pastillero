import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mockStorage } from '../lib/mockService';
import { Cuidador } from '../types/database';

interface AuthContextType {
  user: Cuidador | null;
  loading: boolean;
  isDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, nombre: string, telefono?: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  enableDemoMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Cuidador | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(!isSupabaseConfigured);

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
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Consultar tabla cuidadores
          const { data: cuidadorData } = await supabase
            .from('cuidadores')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          setUser({
            id: session.user.id,
            email: session.user.email || '',
            nombre: cuidadorData?.nombre || session.user.user_metadata?.nombre || session.user.email?.split('@')[0],
            telefono: cuidadorData?.telefono || '',
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

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
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
          telefono: cuidadorData?.telefono || '',
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

  const signIn = async (email: string, password: string) => {
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

      if (error) throw error;

      if (data.user) {
        // Traer datos de cuidadores
        const { data: cuidadorData } = await supabase
          .from('cuidadores')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        setUser({
          id: data.user.id,
          email: data.user.email || '',
          nombre: cuidadorData?.nombre || data.user.user_metadata?.nombre || 'Cuidador',
          telefono: cuidadorData?.telefono,
        });
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión';
      return { success: false, error: msg };
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

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            nombre,
            telefono,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Insertar en la tabla 'cuidadores'
        try {
          await supabase.from('cuidadores').insert({
            id: data.user.id,
            email: data.user.email,
            nombre,
            telefono: telefono || null,
          });
        } catch (dbErr) {
          console.warn('Nota: registro en tabla cuidadores:', dbErr);
        }

        setUser({
          id: data.user.id,
          email: data.user.email || '',
          nombre,
          telefono,
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
