import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Rol } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: Rol | null;
  loading: boolean;
  authError: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const ROLE_CACHE_TTL_MS = 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Rol | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let requestId = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const roleCache = new Map<string, { role: Rol; cachedAt: number }>();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      const currentRequest = ++requestId;
      setSession(nuevaSesion);
      if (!nuevaSesion) {
        setRole(null);
        setAuthError(null);
        setLoading(false);
        return;
      }

      const cached = roleCache.get(nuevaSesion.user.id);
      if (cached && Date.now() - cached.cachedAt < ROLE_CACHE_TTL_MS) {
        setRole(cached.role);
        setAuthError(null);
        setLoading(false);
        return;
      }

      setRole(null);
      setAuthError(null);
      setLoading(true);

      // Concepto · Se difiere la consulta para no bloquear el callback de Supabase Auth.
      // Los eventos repetidos reutilizan el rol en memoria durante un minuto.
      timer = setTimeout(async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', nuevaSesion.user.id)
          .single();
        if (!active || currentRequest !== requestId) return;

        if (error || (data?.role !== 'cliente' && data?.role !== 'admin')) {
          setRole(null);
          setAuthError(
            error
              ? `No se pudo verificar tu rol: ${error.message}`
              : 'No se encontró un rol válido para tu perfil. Recargá la página o volvé a iniciar sesión.',
          );
          setLoading(false);
          return;
        }

        roleCache.set(nuevaSesion.user.id, { role: data.role, cachedAt: Date.now() });
        setRole(data.role);
        setAuthError(null);
        setLoading(false);
      }, 0);
    });
    return () => {
      active = false;
      requestId += 1;
      if (timer) clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, role, loading, authError, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de un AuthProvider');
  return ctx;
}
