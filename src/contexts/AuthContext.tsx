import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import {
  supabase,
  isSupabaseConfigured,
  isDemoModeEnabled,
  DEMO_SESSION_STORAGE_KEY,
  clearSensitiveLocalStorage,
} from '../lib/supabase';
import type {
  UserProfile,
  Condominium,
  CondominiumMember,
  CondominiumRole,
  SubSindicoPermissionKey,
  SubSindicoPermissions,
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
  currentMembership: CondominiumMember | null;
  currentRole: CondominiumRole | null;
  currentPermissions: SubSindicoPermissions;
  setCurrentCondominiumId: (condoId: string) => void;
  refreshMemberships: () => Promise<void>;
  isLoading: boolean;
  isConfigured: boolean;
  isDemoModeEnabled: boolean;
  isDemoSession: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  enterDemoMode: (personaEmail: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ error: Error | null; successMessage?: string }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  updateAvatar: (newAvatarUrl: string) => Promise<{ error: Error | null }>;
  isSuperAdmin: boolean;
  isSindico: boolean;
  isSubSindico: boolean;
  isPorteiro: boolean;
  isMorador: boolean;
  canManageUsers: boolean;
  hasPermission: (perm: SubSindicoPermissionKey) => boolean;
  canManageCommonAreas: boolean;
  canManageAnnouncements: boolean;
  canManageReservations: boolean;
  canManageMaintenance: boolean;
  canManageUnits: boolean;
  canAccessFinance: boolean;
  canAccessConcierge: boolean;
  canViewAudit: boolean;
}

const DEMO_CONDOMINIUMS: Condominium[] = [
  {
    id: 'condo-imperial-001',
    name: 'Residencial Reserva Imperial (Demo 01)',
    cnpj: '10.111.222/0001-01',
    address: 'Av. Paulista, 1000',
    city: 'São Paulo',
    state: 'SP',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'condo-ilhas-002',
    name: 'Condomínio Ilhas Gregas (Demo 02)',
    cnpj: '20.222.333/0001-02',
    address: 'Rua Oscar Freire, 450',
    city: 'São Paulo',
    state: 'SP',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'condo-jardim-003',
    name: 'Edifício Jardim Botânico (Demo 03)',
    cnpj: '30.333.444/0001-03',
    address: 'Al. Santos, 820',
    city: 'São Paulo',
    state: 'SP',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'condo-palmeiras-004',
    name: 'Solar das Palmeiras (Demo 04 - Vazio)',
    cnpj: '40.444.555/0001-04',
    address: 'Rua dos Pinheiros, 310',
    city: 'São Paulo',
    state: 'SP',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Personas de demonstração (somente utilizadas quando VITE_ENABLE_DEMO_MODE=true)
const DEMO_PERSONAS: Record<
  string,
  {
    user: User;
    profile: UserProfile;
    memberships: CondominiumWithRole[];
  }
> = {
  'sindico@condor.com.br': {
    user: {
      id: 'usr-sindico-001',
      app_metadata: {},
      user_metadata: { full_name: 'Dra. Helena Martins (Demo)' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: 'sindico@condor.com.br',
    } as unknown as User,
    profile: {
      id: 'usr-sindico-001',
      full_name: 'Dra. Helena Martins (Demo)',
      email: 'sindico@condor.com.br',
      phone: '(11) 90000-0001',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    memberships: DEMO_CONDOMINIUMS.map((condo, idx) => ({
      condominium: condo,
      membership: {
        id: `mem-sindico-00${idx + 1}`,
        condominium_id: condo.id,
        user_id: 'usr-sindico-001',
        role: 'sindico',
        status: 'active',
        log_access_granted: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    })),
  },
  'morador@condor.com.br': {
    user: {
      id: 'usr-morador-002',
      app_metadata: {},
      user_metadata: { full_name: 'Morador Fictício (Demo)' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: 'morador@condor.com.br',
    } as unknown as User,
    profile: {
      id: 'usr-morador-002',
      full_name: 'Morador Fictício (Demo)',
      email: 'morador@condor.com.br',
      phone: '(11) 90000-0002',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    memberships: [
      {
        condominium: DEMO_CONDOMINIUMS[0],
        membership: {
          id: 'mem-morador-001',
          condominium_id: DEMO_CONDOMINIUMS[0].id,
          user_id: 'usr-morador-002',
          role: 'morador',
          status: 'active',
          log_access_granted: false,
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
      user_metadata: { full_name: 'Portaria Turno A (Demo)' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: 'porteiro@condor.com.br',
    } as unknown as User,
    profile: {
      id: 'usr-porteiro-003',
      full_name: 'Portaria Turno A (Demo)',
      email: 'porteiro@condor.com.br',
      phone: '(11) 90000-0003',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    memberships: [
      {
        condominium: DEMO_CONDOMINIUMS[0],
        membership: {
          id: 'mem-porteiro-001',
          condominium_id: DEMO_CONDOMINIUMS[0].id,
          user_id: 'usr-porteiro-003',
          role: 'porteiro',
          status: 'active',
          log_access_granted: true,
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
      user_metadata: { full_name: 'Superadministrador Condor (Demo)' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: 'admin@condor.com.br',
    } as unknown as User,
    profile: {
      id: 'usr-admin-004',
      full_name: 'Superadministrador Condor (Demo)',
      email: 'admin@condor.com.br',
      phone: '(11) 90000-0000',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    memberships: DEMO_CONDOMINIUMS.map((condo, idx) => ({
      condominium: condo,
      membership: {
        id: `mem-admin-00${idx + 1}`,
        condominium_id: condo.id,
        user_id: 'usr-admin-004',
        role: 'superadmin',
        status: 'active',
        log_access_granted: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    })),
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [memberships, setMemberships] = useState<CondominiumWithRole[]>([]);
  const [currentCondominium, setCurrentCondominium] = useState<Condominium | null>(null);
  const [currentRole, setCurrentRole] = useState<CondominiumRole | null>(null);
  const [isDemoSession, setIsDemoSession] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

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
        setProfile(profileData as UserProfile);
      }

      // 2. Fetch user active memberships and condominium details
      const { data: memberData, error: memberError } = await supabase
        .from('condominium_members')
        .select(
          `
          id,
          condominium_id,
          user_id,
          role,
          status,
          unit_id,
          unit_number,
          block,
          permissions,
          log_access_granted,
          created_at,
          updated_at,
          condominiums:condominium_id (
            id,
            name,
            cnpj,
            address,
            city,
            state,
            blocks,
            default_reservation_time_limit,
            default_reservation_start_time,
            default_reservation_end_time,
            created_at,
            updated_at
          )
        `
        )
        .eq('user_id', userId)
        .eq('status', 'active');

      if (memberError) {
        console.warn('[Condor Auth] Erro ao carregar vínculos condominiais:', memberError.message);
        setMemberships([]);
        setCurrentCondominium(null);
        setCurrentRole(null);
        return;
      }

      if (memberData && memberData.length > 0) {
        const mappedMemberships: CondominiumWithRole[] = memberData
          .filter((item: any) => item.condominiums)
          .map((item: any) => ({
            membership: {
              id: item.id,
              condominium_id: item.condominium_id,
              user_id: item.user_id,
              role: item.role as CondominiumRole,
              status: item.status,
              unit_id: item.unit_id ?? null,
              unit_number: item.unit_number ?? null,
              block: item.block ?? null,
              permissions: (item.permissions && typeof item.permissions === 'object' ? item.permissions : {}) as SubSindicoPermissions,
              log_access_granted: Boolean(item.log_access_granted),
              created_at: item.created_at,
              updated_at: item.updated_at,
            },
            condominium: item.condominiums as Condominium,
          }));

        setMemberships(mappedMemberships);

        const savedCondoId = localStorage.getItem(`condor_active_condo_${userId}`);
        const preferred =
          (savedCondoId && mappedMemberships.find((m) => m.condominium.id === savedCondoId)) ||
          mappedMemberships[0];

        if (preferred) {
          setCurrentCondominium(preferred.condominium);
          setCurrentRole(preferred.membership.role);
        }
      } else {
        setMemberships([]);
        setCurrentCondominium(null);
        setCurrentRole(null);
      }
    } catch (err) {
      console.error('[Condor Auth] Erro inesperado ao recuperar contexto:', err);
    }
  }, []);

  const refreshMemberships = useCallback(async () => {
    if (user?.id && !isDemoSession && isSupabaseConfigured) {
      await loadUserData(user.id);
    }
  }, [user?.id, isDemoSession, loadUserData]);

  // Initialize session on mount
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      setIsLoading(true);

      // Somente restaura sessão demonstrativa se VITE_ENABLE_DEMO_MODE=true
      const demoEmail = sessionStorage.getItem(DEMO_SESSION_STORAGE_KEY);
      if (isDemoModeEnabled && demoEmail && DEMO_PERSONAS[demoEmail]) {
        const persona = DEMO_PERSONAS[demoEmail];
        setIsDemoSession(true);
        setSession(null);
        setUser(persona.user);
        setProfile(persona.profile);
        setMemberships(persona.memberships);
        setCurrentCondominium(persona.memberships[0]?.condominium || null);
        setCurrentRole(persona.memberships[0]?.membership.role || null);
        setIsLoading(false);
        return;
      } else if (!isDemoModeEnabled && demoEmail) {
        sessionStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
      }

      if (isSupabaseConfigured) {
        try {
          const {
            data: { session: initialSession },
          } = await supabase.auth.getSession();
          if (isMounted) {
            setIsDemoSession(false);
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
        setIsLoading(false);
      }
    }

    initAuth();

    let subscription: { unsubscribe: () => void } | null = null;
    if (isSupabaseConfigured) {
      const authListener = supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (!isMounted) return;
        // Se uma sessão real do Supabase ocorrer, garante que não é modo demo
        if (newSession?.user) {
          sessionStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
          setIsDemoSession(false);
        }
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
  const setCurrentCondominiumId = useCallback(
    (condoId: string) => {
      const found = memberships.find((m) => m.condominium.id === condoId);
      if (found) {
        setCurrentCondominium(found.condominium);
        setCurrentRole(found.membership.role);
        if (user?.id) {
          try {
            localStorage.setItem(`condor_active_condo_${user.id}`, condoId);
          } catch {
            // ignore storage errors
          }
        }
      }
    },
    [memberships, user?.id]
  );

  /**
   * Autenticação real via Supabase Auth.
   * Com Supabase configurado, uma senha incorreta SEMPRE resulta em acesso negado
   * (sem qualquer fallback automático para DEMO_PERSONAS).
   */
  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: Error | null }> => {
      setIsLoading(true);
      try {
        if (isSupabaseConfigured) {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

          if (error || !data.user) {
            setIsLoading(false);
            return {
              error: error || new Error('Acesso negado: credenciais inválidas.'),
            };
          }

          sessionStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
          setIsDemoSession(false);
          setUser(data.user);
          setSession(data.session);
          await loadUserData(data.user.id);
          setIsLoading(false);
          return { error: null };
        }

        // Se o Supabase não estiver configurado, o login por formulário é negado;
        // o modo demonstração só pode ser acionado explicitamente via enterDemoMode se VITE_ENABLE_DEMO_MODE=true
        setIsLoading(false);
        return {
          error: new Error(
            isDemoModeEnabled
              ? 'Banco Supabase não configurado. Utilize os botões explícitos de Modo Demonstração abaixo.'
              : 'Serviço de autenticação indisponível: banco de dados Supabase não configurado.'
          ),
        };
      } catch (err: any) {
        setIsLoading(false);
        return {
          error: err instanceof Error ? err : new Error('Falha inesperada na autenticação.'),
        };
      }
    },
    [loadUserData]
  );

  /**
   * Entrada explícita em modo demonstração.
   * Bloqueada se VITE_ENABLE_DEMO_MODE !== 'true'.
   */
  const enterDemoMode = useCallback(
    async (personaEmail: string): Promise<{ error: Error | null }> => {
      if (!isDemoModeEnabled) {
        return {
          error: new Error(
            'Modo demonstração desabilitado neste ambiente (VITE_ENABLE_DEMO_MODE=false).'
          ),
        };
      }

      const normalizedEmail = personaEmail.trim().toLowerCase();
      const persona = DEMO_PERSONAS[normalizedEmail];
      if (!persona) {
        return { error: new Error('Perfil de demonstração não encontrado.') };
      }

      sessionStorage.setItem(DEMO_SESSION_STORAGE_KEY, normalizedEmail);
      setIsDemoSession(true);
      setSession(null);
      setUser(persona.user);
      setProfile(persona.profile);
      setMemberships(persona.memberships);
      setCurrentCondominium(persona.memberships[0]?.condominium || null);
      setCurrentRole(persona.memberships[0]?.membership.role || null);
      return { error: null };
    },
    []
  );

  // Sign Out function — limpa todos os dados pessoais e caches de sessão locais
  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      clearSensitiveLocalStorage();
      if (isSupabaseConfigured && !isDemoSession) {
        await supabase.auth.signOut();
      }
    } finally {
      setIsDemoSession(false);
      setUser(null);
      setSession(null);
      setProfile(null);
      setMemberships([]);
      setCurrentCondominium(null);
      setCurrentRole(null);
      setIsLoading(false);
    }
  }, [isDemoSession]);

  const resetPasswordForEmail = useCallback(
    async (email: string): Promise<{ error: Error | null; successMessage?: string }> => {
      const genericSuccess =
        'Se houver uma conta associada a este e-mail, as instruções para redefinição foram enviadas com sucesso.';
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

        return { error: null, successMessage: genericSuccess };
      } catch {
        return { error: null, successMessage: genericSuccess };
      }
    },
    []
  );

  const updatePassword = useCallback(
    async (newPassword: string): Promise<{ error: Error | null }> => {
      if (!isSupabaseConfigured || isDemoSession) {
        return {
          error: new Error(
            'A alteração de senha exige uma sessão autenticada no Supabase.'
          ),
        };
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
    },
    [isDemoSession]
  );

  const updateProfile = useCallback(
    async (updates: Partial<UserProfile>): Promise<{ error: Error | null }> => {
      try {
        if (isSupabaseConfigured && !isDemoSession) {
          if (!user?.id) {
            return { error: new Error('Sessão de usuário inválida.') };
          }

          const payload = {
            id: user.id,
            full_name: updates.full_name || profile?.full_name || 'Usuário Condor',
            email: user.email || profile?.email || null,
            phone: updates.phone !== undefined ? updates.phone : profile?.phone || null,
            avatar_url:
              updates.avatar_url !== undefined ? updates.avatar_url : profile?.avatar_url || null,
            updated_at: new Date().toISOString(),
          };

          const { data, error } = await (supabase.from('user_profiles') as any)
            .upsert(payload)
            .select('*')
            .single();

          if (error) {
            return { error: new Error(error.message || 'Erro ao salvar perfil no Supabase.') };
          }

          setProfile(data as UserProfile);

          if (updates.avatar_url || updates.full_name) {
            await supabase.auth.updateUser({
              data: {
                ...(updates.avatar_url ? { avatar_url: updates.avatar_url } : {}),
                ...(updates.full_name ? { full_name: updates.full_name } : {}),
              },
            });
          }

          return { error: null };
        }

        // Somente em sessão explícita de demonstração atualiza o estado em memória
        if (isDemoSession && isDemoModeEnabled) {
          setProfile((prev) =>
            prev
              ? { ...prev, ...updates, updated_at: new Date().toISOString() }
              : ({
                  id: user?.id || 'usr-demo',
                  full_name: updates.full_name || 'Usuário Demo',
                  phone: updates.phone || null,
                  avatar_url: updates.avatar_url || null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                } as UserProfile)
          );
          return { error: null };
        }

        return { error: new Error('Não foi possível confirmar a persistência do perfil.') };
      } catch (err: any) {
        return { error: err instanceof Error ? err : new Error('Falha ao atualizar perfil.') };
      }
    },
    [user?.id, user?.email, profile?.full_name, profile?.avatar_url, profile?.phone, profile?.email, isDemoSession]
  );

  const updateAvatar = useCallback(
    async (newAvatarUrl: string): Promise<{ error: Error | null }> => {
      return updateProfile({ avatar_url: newAvatarUrl });
    },
    [updateProfile]
  );

  // Vínculo e permissões ativas no condomínio selecionado
  const currentMembership = useMemo(() => {
    if (!currentCondominium?.id) return null;
    return memberships.find((m) => m.condominium.id === currentCondominium.id)?.membership || null;
  }, [memberships, currentCondominium?.id]);

  const currentPermissions = useMemo<SubSindicoPermissions>(
    () => (currentMembership?.permissions && typeof currentMembership.permissions === 'object' ? currentMembership.permissions : {}),
    [currentMembership]
  );

  // Regra estrita: Papel nulo JAMAIS concede qualquer permissão administrativa
  const isSuperAdmin = useMemo(() => currentRole === 'superadmin', [currentRole]);
  const isSindico = useMemo(
    () => currentRole === 'sindico' || currentRole === 'superadmin',
    [currentRole]
  );
  const isSubSindico = useMemo(() => currentRole === 'subsindico', [currentRole]);
  const isPorteiro = useMemo(
    () =>
      currentRole === 'porteiro' ||
      currentRole === 'sindico' ||
      currentRole === 'superadmin',
    [currentRole]
  );
  const isMorador = useMemo(() => currentRole === 'morador', [currentRole]);
  const canManageUsers = useMemo(
    () => currentRole === 'sindico' || currentRole === 'superadmin',
    [currentRole]
  );

  const hasPermission = useCallback(
    (perm: SubSindicoPermissionKey): boolean => {
      if (currentRole === 'superadmin' || currentRole === 'sindico') return true;
      if (currentRole === 'subsindico') {
        return Boolean(currentPermissions[perm]);
      }
      return false;
    },
    [currentRole, currentPermissions]
  );

  const canManageCommonAreas = useMemo(() => hasPermission('manage_common_areas'), [hasPermission]);
  const canManageAnnouncements = useMemo(() => hasPermission('manage_announcements'), [hasPermission]);
  const canManageReservations = useMemo(() => hasPermission('manage_reservations'), [hasPermission]);
  const canManageMaintenance = useMemo(() => hasPermission('manage_maintenance'), [hasPermission]);
  const canManageUnits = useMemo(() => hasPermission('manage_units'), [hasPermission]);
  const canAccessFinance = useMemo(() => hasPermission('view_finance'), [hasPermission]);
  const canAccessConcierge = useMemo(
    () =>
      currentRole === 'superadmin' ||
      currentRole === 'sindico' ||
      currentRole === 'porteiro' ||
      hasPermission('manage_concierge'),
    [currentRole, hasPermission]
  );
  const canViewAudit = useMemo(() => hasPermission('view_audit'), [hasPermission]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      profile,
      memberships,
      currentCondominium,
      currentMembership,
      currentRole,
      currentPermissions,
      setCurrentCondominiumId,
      refreshMemberships,
      isLoading,
      isConfigured: isSupabaseConfigured,
      isDemoModeEnabled,
      isDemoSession,
      signIn,
      enterDemoMode,
      signOut,
      resetPasswordForEmail,
      updatePassword,
      updateProfile,
      updateAvatar,
      isSuperAdmin,
      isSindico,
      isSubSindico,
      isPorteiro,
      isMorador,
      canManageUsers,
      hasPermission,
      canManageCommonAreas,
      canManageAnnouncements,
      canManageReservations,
      canManageMaintenance,
      canManageUnits,
      canAccessFinance,
      canAccessConcierge,
      canViewAudit,
    }),
    [
      user,
      session,
      profile,
      memberships,
      currentCondominium,
      currentMembership,
      currentRole,
      currentPermissions,
      setCurrentCondominiumId,
      refreshMemberships,
      isLoading,
      isDemoSession,
      signIn,
      enterDemoMode,
      signOut,
      resetPasswordForEmail,
      updatePassword,
      updateProfile,
      updateAvatar,
      isSuperAdmin,
      isSindico,
      isSubSindico,
      isPorteiro,
      isMorador,
      canManageUsers,
      hasPermission,
      canManageCommonAreas,
      canManageAnnouncements,
      canManageReservations,
      canManageMaintenance,
      canManageUnits,
      canAccessFinance,
      canAccessConcierge,
      canViewAudit,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um <AuthProvider />');
  }
  return context;
};
