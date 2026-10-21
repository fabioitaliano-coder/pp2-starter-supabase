import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Rol } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: Rol | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Rol | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSession(nuevaSesion);
      if (!nuevaSesion) {
        setRole(null);
        setLoading(false);
        return;
      }
      // Concepto · No hacer await de Supabase dentro de este callback (puede trabarse).
      // Se difiere con setTimeout y se lee el rol de la tabla profiles (protegida por RLS).
      setTimeout(async () => {
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', nuevaSesion.user.id)
          .single();
        setRole((data?.role as Rol) ?? 'cliente');
        setLoading(false);
      }, 0);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de un AuthProvider');
  return ctx;
}
