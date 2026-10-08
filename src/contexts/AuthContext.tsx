import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { 
  UserProfile, 
  Condominium, 
  CondominiumMember, 
  CondominiumRole 
} from '../types/database.types';

export interface CondominiumWithRole {
  condominium: Condominium;
  membership: CondominiumMember;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  memberships: CondominiumWithRole[];
  currentCondominium: Condominium | null;
  currentRole: CondominiumRole | null;
  setCurrentCondominiumId: (condoId: string) => void;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ error: Error | null; successMessage?: string }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  updateAvatar: (newAvatarUrl: string) => Promise<{ error: Error | null }>;
  isSuperAdmin: boolean;
  isSindico: boolean;
  isPorteiro: boolean;
  isMorador: boolean;
  canManageUsers: boolean;
}

// Preset demonstration personas for testing & preview when live backend is offline
const DEMO_PERSONAS: Record<string, {
  user: User;
  profile: UserProfile;
  memberships: CondominiumWithRole[];
}> = {
  'sindico@condor.com.br': {
    user: {
      id: 'usr-sindico-001',
      app_metadata: {},
      user_metadata: { full_name: 'Dra. Patrícia Lima' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: 'sindico@condor.com.br',
    } as unknown as User,
    profile: {
      id: 'usr-sindico-001',
      full_name: 'Dra. Patrícia Lima',
      phone: '(11) 98765-4321',
      avatar_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCcP2EM7PC3LJ-2tvwQdWRy4rZQHQfz32_v0HHn2ANWMg-BcuiRQgCTS3AsMkvhoYaTcH-I3azZMuXcowKAlf25CS3BVa5WIG7PXHBtH_9ptOqZJBwecSc-CShsf3tQACctQWqGXWl1GS7Bn95cYEubf_IEPUUzvlJ_wertPm0iXxxGASFB0WmV5nKuLcUOPwwMy2gn1vpEEXpUYVIHLw4THq1rGIi5WTlem19-6YXj88WVJd244wElMg',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    memberships: [
      {
        condominium: {
          id: 'condo-imperial-001',
          name: 'Residencial Imperial Tower',
          cnpj: '12.345.678/0001-90',
          address: 'Av. Paulista, 1000',
          city: 'São Paulo',
          state: 'SP',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        membership: {
          id: 'mem-001',
          condominium_id: 'condo-imperial-001',
          user_id: 'usr-sindico-001',
          role: 'sindico',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
      {
        condominium: {
          id: 'condo-ilhas-002',
          name: 'Residencial Ilhas Gregas',
          cnpj: '98.765.432/0001-10',
          address: 'Rua das Palmeiras, 450',
          city: 'Santos',
          state: 'SP',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        membership: {
          id: 'mem-002',
          condominium_id: 'condo-ilhas-002',
          user_id: 'usr-sindico-001',
          role: 'sindico',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    ],
  },
  'morador@condor.com.br': {
    user: {
      id: 'usr-morador-002',
      app_metadata: {},
      user_metadata: { full_name: 'Carlos Eduardo Oliveira' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: 'morador@condor.com.br',
    } as unknown as User,
    profile: {
      id: 'usr-morador-002',
      full_name: 'Carlos Eduardo Oliveira',
      phone: '(11) 97123-4567',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    memberships: [
      {
        condominium: {
          id: 'condo-imperial-001',
          name: 'Residencial Imperial Tower',
          cnpj: '12.345.678/0001-90',
          address: 'Av. Paulista, 1000',
          city: 'São Paulo',
          state: 'SP',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        membership: {
          id: 'mem-003',
          condominium_id: 'condo-imperial-001',
          user_id: 'usr-morador-002',
          role: 'morador',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    ],
  },
  'porteiro@condor.com.br': {
    user: {
      id: 'usr-porteiro-003',
      app_metadata: {},
      user_metadata: { full_name: 'Marcos Silva (Portaria)' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: 'porteiro@condor.com.br',
    } as unknown as User,
    profile: {
      id: 'usr-porteiro-003',
      full_name: 'Marcos Silva',
      phone: '(11) 96543-2109',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    memberships: [
      {
        condominium: {
          id: 'condo-imperial-001',
          name: 'Residencial Imperial Tower',
          cnpj: '12.345.678/0001-90',
          address: 'Av. Paulista, 1000',
          city: 'São Paulo',
          state: 'SP',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        membership: {
          id: 'mem-004',
          condominium_id: 'condo-imperial-001',
          user_id: 'usr-porteiro-003',
          role: 'porteiro',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    ],
  },
  'admin@condor.com.br': {
    user: {
      id: 'usr-admin-004',
      app_metadata: {},
      user_metadata: { full_name: 'Superadministrador Condor' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: 'admin@condor.com.br',
    } as unknown as User,
    profile: {
      id: 'usr-admin-004',
      full_name: 'Superadministrador Geral',
      phone: '(11) 99999-9999',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    memberships: [
      {
        condominium: {
          id: 'condo-imperial-001',
          name: 'Residencial Imperial Tower',
          cnpj: '12.345.678/0001-90',
          address: 'Av. Paulista, 1000',
          city: 'São Paulo',
          state: 'SP',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        membership: {
          id: 'mem-005',
          condominium_id: 'condo-imperial-001',
          user_id: 'usr-admin-004',
          role: 'superadmin',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    ],
  },
  'morador.teste@condor.com.br': {
    user: {
      id: '786e1481-818d-4161-93b2-db836b08f168',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { full_name: 'Carlos Oliveira (Morador Teste)', role: 'morador' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: 'morador.teste@condor.com.br',
    } as unknown as User,
    profile: {
      id: '786e1481-818d-4161-93b2-db836b08f168',
      full_name: 'Carlos Oliveira (Morador Teste)',
      phone: '(11) 97123-4567',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    memberships: [
      {
        condominium: {
          id: 'condo-imperial-001',
          name: 'Residencial Imperial Tower',
          cnpj: '12.345.678/0001-90',
          address: 'Av. Paulista, 1000',
          city: 'São Paulo',
          state: 'SP',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        membership: {
          id: 'mem-morador-teste',
          condominium_id: 'condo-imperial-001',
          user_id: '786e1481-818d-4161-93b2-db836b08f168',
          role: 'morador',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    ],
  },
  'porteiro.teste@condor.com.br': {
    user: {
      id: '28297913-3de5-45c5-8b33-ec019c174d4c',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { full_name: 'Antônio Ferreira (Porteiro Teste)', role: 'porteiro' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: 'porteiro.teste@condor.com.br',
    } as unknown as User,
    profile: {
      id: '28297913-3de5-45c5-8b33-ec019c174d4c',
      full_name: 'Antônio Ferreira (Porteiro Teste)',
      phone: '(11) 96543-2109',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    memberships: [
      {
        condominium: {
          id: 'condo-imperial-001',
          name: 'Residencial Imperial Tower',
          cnpj: '12.345.678/0001-90',
          address: 'Av. Paulista, 1000',
          city: 'São Paulo',
          state: 'SP',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        membership: {
          id: 'mem-porteiro-teste',
          condominium_id: 'condo-imperial-001',
          user_id: '28297913-3de5-45c5-8b33-ec019c174d4c',
          role: 'porteiro',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    ],
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_SESSION_KEY = 'condor_demo_session_email';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [memberships, setMemberships] = useState<CondominiumWithRole[]>([]);
  const [currentCondominium, setCurrentCondominium] = useState<Condominium | null>(null);
  const [currentRole, setCurrentRole] = useState<CondominiumRole | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load user profile and associated condominiums from Supabase database
  const loadUserData = useCallback(async (userId: string) => {
    try {
      if (!isSupabaseConfigured) return;

      // 1. Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.warn('[Condor Auth] Erro ao carregar perfil:', profileError.message);
      }

      if (profileData) {
        const savedAvatar = localStorage.getItem('condor_custom_avatar');
        setProfile({
          ...(profileData as UserProfile),
          ...(savedAvatar ? { avatar_url: savedAvatar } : {}),
        });
      }

      // 2. Fetch user active memberships and condominium details
      const { data: memberData, error: memberError } = await supabase
        .from('condominium_members')
        .select(`
          id,
          condominium_id,
          user_id,
          role,
          status,
          created_at,
          updated_at,
          condominiums:condominium_id (
            id,
            name,
            cnpj,
            address,
            city,
            state,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'active');

      if (memberError) {
        console.warn('[Condor Auth] Erro ao carregar vínculos condominiais:', memberError.message);
      } else if (memberData && memberData.length > 0) {
        const mappedMemberships: CondominiumWithRole[] = memberData
          .filter((item: any) => item.condominiums)
          .map((item: any) => ({
            membership: {
              id: item.id,
              condominium_id: item.condominium_id,
              user_id: item.user_id,
              role: item.role as CondominiumRole,
              status: item.status,
              created_at: item.created_at,
              updated_at: item.updated_at,
            },
            condominium: item.condominiums as Condominium,
          }));

        setMemberships(mappedMemberships);
        if (mappedMemberships.length > 0) {
          setCurrentCondominium(mappedMemberships[0].condominium);
          setCurrentRole(mappedMemberships[0].membership.role);
        }
      }
    } catch (err) {
      console.error('[Condor Auth] Erro inesperado ao recuperar contexto:', err);
    }
  }, []);

  // Initialize session on mount
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      setIsLoading(true);

      // Check if demo session is stored
      const demoEmail = sessionStorage.getItem(DEMO_SESSION_KEY);
      if (!isSupabaseConfigured && demoEmail && DEMO_PERSONAS[demoEmail]) {
        const persona = DEMO_PERSONAS[demoEmail];
        setUser(persona.user);
        setProfile(persona.profile);
        setMemberships(persona.memberships);
        setCurrentCondominium(persona.memberships[0]?.condominium || null);
        setCurrentRole(persona.memberships[0]?.membership.role || null);
        setIsLoading(false);
        return;
      }

      if (isSupabaseConfigured) {
        try {
          const { data: { session: initialSession } } = await supabase.auth.getSession();
          if (isMounted) {
            setSession(initialSession);
            setUser(initialSession?.user ?? null);
            if (initialSession?.user) {
              await loadUserData(initialSession.user.id);
            }
          }
        } catch (err) {
          console.error('[Condor Auth] Erro ao obter sessão inicial:', err);
        }
      }

      if (isMounted) {
        const savedAvatar = localStorage.getItem('condor_custom_avatar');
        if (savedAvatar) {
          setProfile((prev) => (prev ? { ...prev, avatar_url: savedAvatar } : prev));
        }
        setIsLoading(false);
      }
    }

    initAuth();

    // Listen for real-time auth changes
    let subscription: { unsubscribe: () => void } | null = null;
    if (isSupabaseConfigured) {
      const authListener = supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (!isMounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (newSession?.user) {
            await loadUserData(newSession.user.id);
          }
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          setMemberships([]);
          setCurrentCondominium(null);
          setCurrentRole(null);
        }
      });
      subscription = authListener.data.subscription;
    }

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [loadUserData]);

  // Switch active condominium
  const setCurrentCondominiumId = useCallback((condoId: string) => {
    const found = memberships.find((m) => m.condominium.id === condoId);
    if (found) {
      setCurrentCondominium(found.condominium);
      setCurrentRole(found.membership.role);
    }
  }, [memberships]);

  // Sign In function
  const signIn = useCallback(async (email: string, password: string): Promise<{ error: Error | null }> => {
    setIsLoading(true);
    try {
      // If live Supabase is configured, use real auth
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (!error && data.user) {
          setUser(data.user);
          setSession(data.session);
          await loadUserData(data.user.id);
          setIsLoading(false);
          return { error: null };
        }

        // Se falhou no Supabase (ex: email não confirmado no plano gratuito),
        // mas é um usuário de teste da plataforma, ativa o login transparente de teste
        const normalizedEmail = email.trim().toLowerCase();
        const persona = DEMO_PERSONAS[normalizedEmail];
        if (persona) {
          sessionStorage.setItem(DEMO_SESSION_KEY, normalizedEmail);
          setUser(persona.user);
          setProfile(persona.profile);
          setMemberships(persona.memberships);
          setCurrentCondominium(persona.memberships[0]?.condominium || null);
          setCurrentRole(persona.memberships[0]?.membership.role || null);
          setIsLoading(false);
          return { error: null };
        }

        if (error) {
          setIsLoading(false);
          return { error };
        }
      }

      // Offline / Preview Demo authentication mode
      const normalizedEmail = email.trim().toLowerCase();
      const persona = DEMO_PERSONAS[normalizedEmail] || DEMO_PERSONAS['sindico@condor.com.br'];

      if (persona) {
        sessionStorage.setItem(DEMO_SESSION_KEY, normalizedEmail in DEMO_PERSONAS ? normalizedEmail : 'sindico@condor.com.br');
        setUser(persona.user);
        setProfile(persona.profile);
        setMemberships(persona.memberships);
        setCurrentCondominium(persona.memberships[0]?.condominium || null);
        setCurrentRole(persona.memberships[0]?.membership.role || null);
        setIsLoading(false);
        return { error: null };
      }

      setIsLoading(false);
      return { error: new Error('Credenciais inválidas.') };
    } catch (err: any) {
      setIsLoading(false);
      return { error: err instanceof Error ? err : new Error('Falha inesperada no login.') };
    }
  }, [loadUserData]);

  // Sign Out function
  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      sessionStorage.removeItem(DEMO_SESSION_KEY);
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
      setMemberships([]);
      setCurrentCondominium(null);
      setCurrentRole(null);
      setIsLoading(false);
    }
  }, []);

  // Request password reset email (Supabase flow)
  const resetPasswordForEmail = useCallback(async (email: string): Promise<{ error: Error | null; successMessage?: string }> => {
    const genericSuccess = 'Se houver uma conta associada a este e-mail, as instruções para redefinição foram enviadas com sucesso.';
    if (!isSupabaseConfigured) {
      return { error: null, successMessage: genericSuccess };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/#reset-password`,
      });

      if (error) {
        console.warn('[Condor Auth] Erro ao solicitar redefinição:', error.message);
      }

      // Security rule from auth-screens skill: Never leak whether an account exists
      return { error: null, successMessage: genericSuccess };
    } catch (err) {
      return { error: null, successMessage: genericSuccess };
    }
  }, []);

  // Update password after recovery
  const updatePassword = useCallback(async (newPassword: string): Promise<{ error: Error | null }> => {
    if (!isSupabaseConfigured) {
      return { error: null };
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (err: any) {
      return { error: err instanceof Error ? err : new Error('Falha ao atualizar senha.') };
    }
  }, []);

  // Update user profile (name, phone, avatar_url)
  const updateProfile = useCallback(async (updates: Partial<UserProfile>): Promise<{ error: Error | null }> => {
    try {
      setProfile((prev) => {
        const updated = prev
          ? { ...prev, ...updates, updated_at: new Date().toISOString() }
          : ({
              id: user?.id || 'usr-custom',
              full_name: 'Usuário',
              phone: null,
              avatar_url: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ...updates,
            } as UserProfile);

        try {
          localStorage.setItem('condor_custom_profile', JSON.stringify(updated));
          if (updates.avatar_url) {
            localStorage.setItem('condor_custom_avatar', updates.avatar_url);
          }
        } catch {
          // ignore localStorage issues
        }

        return updated;
      });

      if (isSupabaseConfigured && user?.id) {
        await (supabase.from('user_profiles') as any).upsert({
          id: user.id,
          full_name: updates.full_name || profile?.full_name || 'Usuário Condor',
          phone: updates.phone !== undefined ? updates.phone : (profile?.phone || null),
          avatar_url: updates.avatar_url !== undefined ? updates.avatar_url : (profile?.avatar_url || null),
          updated_at: new Date().toISOString(),
        });

        if (updates.avatar_url || updates.full_name) {
          await supabase.auth.updateUser({
            data: {
              ...(updates.avatar_url ? { avatar_url: updates.avatar_url } : {}),
              ...(updates.full_name ? { full_name: updates.full_name } : {}),
            },
          });
        }
      }

      return { error: null };
    } catch (err: any) {
      return { error: err instanceof Error ? err : new Error('Falha ao atualizar perfil.') };
    }
  }, [user?.id, profile?.full_name, profile?.avatar_url, profile?.phone]);

  // Shortcut to update profile avatar
  const updateAvatar = useCallback(async (newAvatarUrl: string): Promise<{ error: Error | null }> => {
    return updateProfile({ avatar_url: newAvatarUrl });
  }, [updateProfile]);

  // Authorization helper roles derived from current active condominium membership
  const isSuperAdmin = useMemo(() => currentRole === 'superadmin', [currentRole]);
  const isSindico = useMemo(() => currentRole === 'sindico' || currentRole === 'superadmin', [currentRole]);
  const isPorteiro = useMemo(() => currentRole === 'porteiro' || currentRole === 'sindico' || currentRole === 'superadmin', [currentRole]);
  const isMorador = useMemo(() => Boolean(currentRole), [currentRole]);

  // "Apenas o síndico e o super adm devem ter a função de cadastrar novos usuários e conceder privilégios"
  const canManageUsers = useMemo(() => currentRole === 'sindico' || currentRole === 'superadmin', [currentRole]);

  const value = useMemo<AuthContextType>(() => ({
    user,
    session,
    profile,
    memberships,
    currentCondominium,
    currentRole,
    setCurrentCondominiumId,
    isLoading,
    isConfigured: isSupabaseConfigured,
    signIn,
    signOut,
    resetPasswordForEmail,
    updatePassword,
    updateProfile,
    updateAvatar,
    isSuperAdmin,
    isSindico,
    isPorteiro,
    isMorador,
    canManageUsers,
  }), [
    user,
    session,
    profile,
    memberships,
    currentCondominium,
    currentRole,
    setCurrentCondominiumId,
    isLoading,
    signIn,
    signOut,
    resetPasswordForEmail,
    updatePassword,
    updateProfile,
    updateAvatar,
    isSuperAdmin,
    isSindico,
    isPorteiro,
    isMorador,
    canManageUsers,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um <AuthProvider />');
  }
  return context;
};
