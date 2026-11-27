import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project') &&
    !supabaseAnonKey.includes('your-anon-key')
);

/**
 * O modo demonstração fica estritamente desativado em produção.
 */
export const isDemoModeEnabled =
  Boolean(import.meta.env.DEV) &&
  String(import.meta.env.VITE_ENABLE_DEMO_MODE || '')
    .trim()
    .toLowerCase() === 'true';

export const DEMO_SESSION_STORAGE_KEY = 'condor_demo_session_email';

/**
 * Retorna true somente se o modo demonstração estiver explicitamente habilitado
 * e houver uma sessão demonstrativa ativa (ou se o Supabase não estiver configurado
 * em ambiente explicitamente marcado como demo).
 */
export const isDemoSessionActive = (): boolean => {
  if (!isDemoModeEnabled) return false;
  if (typeof window === 'undefined') return !isSupabaseConfigured;
  return Boolean(sessionStorage.getItem(DEMO_SESSION_STORAGE_KEY)) || !isSupabaseConfigured;
};

/**
 * Remove todos os dados pessoais, financeiros ou de sessão armazenados localmente,
 * preservando apenas preferências visuais (como tema claro/escuro).
 */
export const clearSensitiveLocalStorage = (): void => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(DEMO_SESSION_STORAGE_KEY);

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      // Preserva apenas a preferência de tema visual
      if (key === 'condor-theme' || key === 'vite-ui-theme') continue;
      if (
        key.startsWith('condor_') ||
        key.startsWith('sb-') ||
        key.includes('supabase.auth.token')
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore storage cleanup errors in restricted contexts
  }
};

if (!isSupabaseConfigured && isDemoModeEnabled) {
  console.info(
    '[Condor Auth] Ambiente em MODO DEMONSTRAÇÃO explícito (VITE_ENABLE_DEMO_MODE=true).'
  );
}

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
