import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { CondominiumRole, MembershipStatus } from '../types/database.types';

export interface CondominiumUser {
  id: string;
  condominium_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  cpf?: string | null;
  role: CondominiumRole;
  unit_number?: string | null;
  block?: string | null;
  resident_type?: 'Proprietário' | 'Inquilino';
  has_pet?: boolean;
  avatar_url?: string | null;
  status: MembershipStatus;
  log_access_granted?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUserInput {
  condominium_id: string;
  full_name: string;
  email: string;
  phone?: string;
  cpf?: string;
  role: CondominiumRole;
  unit_number?: string;
  block?: string;
  resident_type?: 'Proprietário' | 'Inquilino';
  has_pet?: boolean;
  avatar_url?: string;
  log_access_granted?: boolean;
}

/**
 * Validação rigorosa de autorização para RBAC:
 * "Apenas o Síndico e o Super Administrador devem ter a função de cadastrar novos usuários e conceder privilégios."
 */
export const canManageUsersAndPrivileges = (role: CondominiumRole | null | undefined): boolean => {
  return role === 'sindico' || role === 'superadmin';
};

const DEFAULT_USERS: CondominiumUser[] = [
  {
    id: 'usr-sindico-001',
    condominium_id: 'condo-imperial-001',
    full_name: 'Dra. Patrícia Lima',
    email: 'sindico@condor.com.br',
    phone: '(11) 98765-4321',
    role: 'sindico',
    unit_number: 'Administração / Síndica',
    avatar_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCcP2EM7PC3LJ-2tvwQdWRy4rZQHQfz32_v0HHn2ANWMg-BcuiRQgCTS3AsMkvhoYaTcH-I3azZMuXcowKAlf25CS3BVa5WIG7PXHBtH_9ptOqZJBwecSc-CShsf3tQACctQWqGXWl1GS7Bn95cYEubf_IEPUUzvlJ_wertPm0iXxxGASFB0WmV5nKuLcUOPwwMy2gn1vpEEXpUYVIHLw4THq1rGIi5WTlem19-6YXj88WVJd244wElMg',
    status: 'active',
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-01-10T10:00:00Z',
  },
  {
    id: 'usr-admin-004',
    condominium_id: 'condo-imperial-001',
    full_name: 'Superadministrador Geral',
    email: 'admin@condor.com.br',
    phone: '(11) 99999-9999',
    role: 'superadmin',
    unit_number: 'Matriz Condor',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80',
    status: 'active',
    created_at: '2026-01-01T08:00:00Z',
    updated_at: '2026-01-01T08:00:00Z',
  },
  {
    id: 'usr-porteiro-003',
    condominium_id: 'condo-imperial-001',
    full_name: 'Marcos Silva',
    email: 'porteiro@condor.com.br',
    phone: '(11) 96543-2109',
    role: 'porteiro',
    unit_number: 'Guarita / Portaria Principal',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&auto=format&fit=crop&q=80',
    status: 'active',
    created_at: '2026-02-15T14:30:00Z',
    updated_at: '2026-02-15T14:30:00Z',
  },
  {
    id: 'usr-morador-002',
    condominium_id: 'condo-imperial-001',
    full_name: 'Carlos Eduardo Oliveira',
    email: 'morador@condor.com.br',
    phone: '(11) 97123-4567',
    role: 'morador',
    unit_number: '302-B',
    avatar_url: null,
    status: 'active',
    created_at: '2026-03-01T09:15:00Z',
    updated_at: '2026-03-01T09:15:00Z',
  },
  {
    id: 'usr-morador-005',
    condominium_id: 'condo-imperial-001',
    full_name: 'Helena Ramos',
    email: 'helena@condor.com.br',
    phone: '(11) 98111-2233',
    role: 'morador',
    unit_number: '401-A',
    avatar_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCTczSNnAmSvG-_c4hP69EGDtwbCYVlL01COY56Y33FWfPs1KmchYiQTHgOWPBUnxuWWzRbXiqxM94DulZL2z3lZE6J-ZHtFTWZulmXCV_LyxWhwlI298nj6FnTzRrTFbr8PwwXg5YIB-Jf4lhh3nPxASbnl9O_uGo-AjZQ9n60urOzEEuFyMwe5Tn2ExzBbqc6akHC03yYEtrEC30dgK3TSAIabYdbPFhP9yVlIfuF4Z1qOo9eNoF2Bg',
    status: 'active',
    created_at: '2026-03-05T11:20:00Z',
    updated_at: '2026-03-05T11:20:00Z',
  },
  {
    id: 'usr-porteiro-006',
    condominium_id: 'condo-imperial-001',
    full_name: 'Rodrigo Maia',
    email: 'rodrigo.porteiro@condor.com.br',
    phone: '(11) 97654-3210',
    role: 'porteiro',
    unit_number: 'Portaria Torre A',
    avatar_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDg8YU1TuK4gcrn7sF-QOejDtmolnlWqunA5_N_Pv7BhvjpOlbdt6XaU1rs0i5XGl7KgvUfJA5derrZmc66YDfXkEg5n0hgoDD32eDFRzLlme8bIws_jpEOfixXXaA6lcESQTi7TcH88BHBjoAMDqfh5jBZ3YEUZXRQZPwKf2lqQPhF8OpwbyiwTwiKdqLHhNIIlp5D3qXgOYfflhSApwDTeHLHz3jqfy7sHiJ6nPzrHzPg9oh9-VeVWA',
    status: 'active',
    created_at: '2026-03-12T16:00:00Z',
    updated_at: '2026-03-12T16:00:00Z',
  },
  {
    id: '786e1481-818d-4161-93b2-db836b08f168',
    condominium_id: 'condo-imperial-001',
    full_name: 'Carlos Oliveira (Morador Teste)',
    email: 'morador.teste@condor.com.br',
    phone: '(11) 97123-4567',
    role: 'morador',
    unit_number: '104-A',
    avatar_url: null,
    status: 'active',
    created_at: '2026-10-08T11:05:00Z',
    updated_at: '2026-10-08T11:05:00Z',
  },
  {
    id: '28297913-3de5-45c5-8b33-ec019c174d4c',
    condominium_id: 'condo-imperial-001',
    full_name: 'Antônio Ferreira (Porteiro Teste)',
    email: 'porteiro.teste@condor.com.br',
    phone: '(11) 96543-2109',
    role: 'porteiro',
    unit_number: 'Portaria Principal / Cancelas',
    avatar_url: null,
    status: 'active',
    created_at: '2026-10-08T11:08:00Z',
    updated_at: '2026-10-08T11:08:00Z',
  },
];

class UserService {
  private getStorageKey(condominiumId: string): string {
    return `condor_users_${condominiumId}`;
  }

  public getUsers(condominiumId: string): CondominiumUser[] {
    try {
      const stored = localStorage.getItem(this.getStorageKey(condominiumId));
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore localStorage issues
    }
    // Return default filtered by condo, or all defaults updated to this condo
    return DEFAULT_USERS.map((u) => ({ ...u, condominium_id: condominiumId }));
  }

  private saveUsers(condominiumId: string, users: CondominiumUser[]): void {
    try {
      localStorage.setItem(this.getStorageKey(condominiumId), JSON.stringify(users));
    } catch {
      // ignore
    }
  }

  /**
   * Cadastrar novo usuário no condomínio.
   * Regra estrita: Apenas síndico ou superadmin.
   */
  public async createUser(
    input: CreateUserInput,
    actorRole: CondominiumRole | null | undefined
  ): Promise<{ data: CondominiumUser | null; error: Error | null }> {
    if (!canManageUsersAndPrivileges(actorRole)) {
      return {
        data: null,
        error: new Error('Acesso negado: apenas o Síndico e o Super Administrador podem cadastrar novos usuários.'),
      };
    }

    if (input.role === 'superadmin' && actorRole !== 'superadmin') {
      return {
        data: null,
        error: new Error('Apenas um Super Administrador pode cadastrar outro Super Administrador.'),
      };
    }

    const currentUsers = this.getUsers(input.condominium_id);
    const existing = currentUsers.find((u) => u.email.toLowerCase() === input.email.trim().toLowerCase());
    if (existing) {
      return {
        data: null,
        error: new Error('Já existe um usuário cadastrado com este e-mail no condomínio.'),
      };
    }

    const newUser: CondominiumUser = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      condominium_id: input.condominium_id,
      full_name: input.full_name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || null,
      cpf: input.cpf?.trim() || null,
      role: input.role,
      unit_number: input.unit_number?.trim() || null,
      block: input.block?.trim() || null,
      resident_type: input.resident_type,
      has_pet: input.has_pet,
      avatar_url: input.avatar_url || null,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updated = [newUser, ...currentUsers];
    this.saveUsers(input.condominium_id, updated);

    // Sync to Supabase if available
    if (isSupabaseConfigured) {
      try {
        await (supabase.from('condominium_members') as any).insert({
          condominium_id: input.condominium_id,
          user_id: newUser.id,
          role: newUser.role,
          status: 'active',
        });
      } catch {
        // Fallback gracefully to offline cache
      }
    }

    return { data: newUser, error: null };
  }

  /**
   * Conceder ou alterar privilégio de um usuário.
   * Regra estrita: Apenas síndico ou superadmin.
   */
  public async updateUserRole(
    userId: string,
    condominiumId: string,
    newRole: CondominiumRole,
    actorRole: CondominiumRole | null | undefined
  ): Promise<{ success: boolean; error: Error | null }> {
    if (!canManageUsersAndPrivileges(actorRole)) {
      return {
        success: false,
        error: new Error('Acesso negado: apenas o Síndico e o Super Administrador podem conceder ou alterar privilégios.'),
      };
    }

    if (newRole === 'superadmin' && actorRole !== 'superadmin') {
      return {
        success: false,
        error: new Error('Apenas um Super Administrador pode conceder privilégios de Super Administrador.'),
      };
    }

    const users = this.getUsers(condominiumId);
    const targetIndex = users.findIndex((u) => u.id === userId);
    if (targetIndex === -1) {
      return {
        success: false,
        error: new Error('Usuário não encontrado no condomínio.'),
      };
    }

    const targetUser = users[targetIndex];
    if (targetUser.role === 'superadmin' && actorRole !== 'superadmin') {
      return {
        success: false,
        error: new Error('Você não pode alterar os privilégios de um Super Administrador.'),
      };
    }

    users[targetIndex] = {
      ...targetUser,
      role: newRole,
      updated_at: new Date().toISOString(),
    };

    this.saveUsers(condominiumId, users);

    if (isSupabaseConfigured) {
      try {
        await (supabase.from('condominium_members') as any)
          .update({ role: newRole, updated_at: new Date().toISOString() })
          .eq('condominium_id', condominiumId)
          .eq('user_id', userId);
      } catch {
        // Fallback gracefully
      }
    }

    return { success: true, error: null };
  }

  /**
   * Remover usuário do condomínio.
   * Regra estrita: Apenas síndico ou superadmin.
   */
  public async removeUser(
    userId: string,
    condominiumId: string,
    actorRole: CondominiumRole | null | undefined
  ): Promise<{ success: boolean; error: Error | null }> {
    if (!canManageUsersAndPrivileges(actorRole)) {
      return {
        success: false,
        error: new Error('Acesso negado: apenas o Síndico e o Super Administrador podem remover usuários.'),
      };
    }

    const users = this.getUsers(condominiumId);
    const target = users.find((u) => u.id === userId);
    if (target?.role === 'superadmin' && actorRole !== 'superadmin') {
      return {
        success: false,
        error: new Error('Você não pode remover um Super Administrador.'),
      };
    }

    const updated = users.filter((u) => u.id !== userId);
    this.saveUsers(condominiumId, updated);

    if (isSupabaseConfigured) {
      try {
        await (supabase.from('condominium_members') as any)
          .delete()
          .eq('condominium_id', condominiumId)
          .eq('user_id', userId);
      } catch {
        // Fallback gracefully
      }
    }

    return { success: true, error: null };
  }

  /**
   * Verificar se um usuário tem permissão para visualizar o Log em Tempo Real.
   * Regra estrita:
   * "Log em tempo real deve aparecer apenas para super admin e sindico, para outros usuarios
   * como porteiro por exemplo, deve aparecer apenas se o sindico ou o super admin conceder acesso;"
   */
  public canAccessRealtimeLogs(
    userId: string | undefined,
    role: CondominiumRole | null | undefined,
    condominiumId: string
  ): boolean {
    if (role === 'sindico' || role === 'superadmin') {
      return true;
    }
    if (!userId) return false;
    const users = this.getUsers(condominiumId);
    const user = users.find((u) => u.id === userId || u.email === userId);
    return Boolean(user?.log_access_granted);
  }

  /**
   * Conceder ou revogar permissão de acesso ao Log em Tempo Real para um usuário (ex: porteiro).
   * Regra estrita: Apenas síndico ou superadmin podem conceder ou revogar.
   */
  public async setLogAccess(
    targetUserId: string,
    condominiumId: string,
    granted: boolean,
    actorRole: CondominiumRole | null | undefined
  ): Promise<{ success: boolean; error: Error | null }> {
    if (!canManageUsersAndPrivileges(actorRole)) {
      return {
        success: false,
        error: new Error('Acesso negado: apenas o Síndico e o Super Administrador podem conceder acesso aos logs em tempo real.'),
      };
    }

    const users = this.getUsers(condominiumId);
    const targetIndex = users.findIndex((u) => u.id === targetUserId);
    if (targetIndex === -1) {
      return {
        success: false,
        error: new Error('Usuário não encontrado no condomínio.'),
      };
    }

    users[targetIndex] = {
      ...users[targetIndex],
      log_access_granted: granted,
      updated_at: new Date().toISOString(),
    };

    this.saveUsers(condominiumId, users);
    return { success: true, error: null };
  }
}

export const userService = new UserService();
