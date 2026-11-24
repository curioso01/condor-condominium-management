import { supabase, isSupabaseConfigured, isDemoSessionActive } from '../lib/supabase';
import type {
  CondominiumRole,
  MembershipStatus,
  SubSindicoPermissions,
} from '../types/database.types';
import { DEFAULT_SUBSINDICO_PERMISSIONS } from '../types/database.types';
import { auditService } from './auditService';

export interface CondominiumUser {
  id: string;
  condominium_id: string;
  full_name: string;
  email: string;
  phone: string;
  cpf?: string;
  unit_number?: string;
  block?: string;
  resident_type?: 'Proprietário' | 'Inquilino';
  has_pet?: boolean;
  role: CondominiumRole;
  permissions?: SubSindicoPermissions;
  status: MembershipStatus;
  avatar_url?: string | null;
  log_access_granted?: boolean;
  created_at: string;
}

export interface CreateCondominiumUserInput {
  condominium_id: string;
  user_id?: string;
  full_name: string;
  email: string;
  phone?: string;
  cpf?: string;
  unit_number?: string;
  block?: string;
  resident_type?: 'Proprietário' | 'Inquilino';
  has_pet?: boolean;
  role: CondominiumRole;
  permissions?: SubSindicoPermissions;
}

// Cache em memória por condomínio (apenas durante a sessão ativa; limpo no logout)
const usersMemoryCache = new Map<string, CondominiumUser[]>();

const DEMO_USERS_KEY_PREFIX = 'condor_demo_users_';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapMemberRowToUser(row: any): CondominiumUser {
  const profile = row.user_profiles || {};
  return {
    id: row.user_id,
    condominium_id: row.condominium_id,
    full_name: profile.full_name || row.full_name || 'Usuário Condor',
    email: profile.email || row.email || '—',
    phone: profile.phone || 'Não informado',
    cpf: row.cpf || undefined,
    unit_number: row.unit_number || (row.role === 'porteiro' ? 'Guarita / Portaria' : 'Administração'),
    block: row.block || 'Bloco A',
    resident_type: (row.resident_type as 'Proprietário' | 'Inquilino') || 'Proprietário',
    has_pet: Boolean(row.has_pet),
    role: row.role as CondominiumRole,
    permissions:
      row.permissions && typeof row.permissions === 'object'
        ? (row.permissions as SubSindicoPermissions)
        : {},
    status: (row.status as MembershipStatus) || 'active',
    avatar_url: profile.avatar_url || null,
    log_access_granted:
      row.role === 'superadmin' ||
      row.role === 'sindico' ||
      row.role === 'porteiro' ||
      Boolean(row.log_access_granted) ||
      Boolean(row.role === 'subsindico' && row.permissions?.manage_concierge),
    created_at: row.created_at || new Date().toISOString(),
  };
}

export const userService = {
  canUserManageRoles(callerRole: CondominiumRole | null): boolean {
    return callerRole === 'sindico' || callerRole === 'superadmin';
  },

  canAccessRealtimeLogs(
    userId: string | undefined,
    role: CondominiumRole | null,
    condominiumId: string
  ): boolean {
    if (!role) return false;
    if (role === 'superadmin' || role === 'sindico' || role === 'porteiro') {
      return true;
    }
    if (!userId || !condominiumId) return false;
    const cached = usersMemoryCache.get(condominiumId) || [];
    const found = cached.find((u) => u.id === userId);
    return Boolean(found?.log_access_granted);
  },

  /**
   * Retorna a lista em cache da sessão para o condomínio (nunca usa localStorage em sessões reais).
   */
  getUsers(condominiumId: string): CondominiumUser[] {
    if (!condominiumId) return [];
    if (isDemoSessionActive()) {
      try {
        const raw = localStorage.getItem(`${DEMO_USERS_KEY_PREFIX}${condominiumId}`);
        if (raw) return JSON.parse(raw) as CondominiumUser[];
      } catch {
        // ignore
      }
    }
    return usersMemoryCache.get(condominiumId) || [];
  },

  /**
   * Busca os membros reais do condomínio no Supabase (public.condominium_members + public.user_profiles).
   */
  async fetchUsersByCondominium(condominiumId: string): Promise<{
    data: CondominiumUser[];
    error: { message: string } | null;
  }> {
    if (!condominiumId) {
      return { data: [], error: null };
    }

    if (isDemoSessionActive()) {
      return { data: this.getUsers(condominiumId), error: null };
    }

    if (!isSupabaseConfigured) {
      return { data: [], error: { message: 'Supabase não configurado.' } };
    }

    try {
      const { data: members, error: memErr } = await (supabase.from('condominium_members') as any)
        .select('*')
        .eq('condominium_id', condominiumId)
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (memErr) {
        return { data: [], error: { message: memErr.message } };
      }

      const memberRows: any[] = members || [];
      if (memberRows.length === 0) {
        usersMemoryCache.set(condominiumId, []);
        return { data: [], error: null };
      }

      const userIds = memberRows.map((m) => m.user_id).filter(Boolean);
      const { data: profiles } = await (supabase.from('user_profiles') as any)
        .select('*')
        .in('id', userIds);

      const profileMap = new Map<string, any>();
      (profiles || []).forEach((p: any) => profileMap.set(p.id, p));

      const mapped: CondominiumUser[] = memberRows.map((m) =>
        mapMemberRowToUser({
          ...m,
          user_profiles: profileMap.get(m.user_id) || {},
        })
      );

      usersMemoryCache.set(condominiumId, mapped);
      return { data: mapped, error: null };
    } catch (err: any) {
      return {
        data: [],
        error: { message: err?.message || 'Erro ao buscar usuários do condomínio no Supabase.' },
      };
    }
  },

  /**
   * Vincula um usuário autenticado existente no Supabase Auth ao condomínio em public.condominium_members.
   * REGRAS CRÍTICAS (Itens 3.1, 3.2 e 3.4):
   * - Não inventa UUIDs falsos (usr-...).
   * - Não permite que síndico conceda o papel 'superadmin'.
   * - Só confirma sucesso após persistência confirmada pelo PostgreSQL.
   */
  async createUser(
    input: CreateCondominiumUserInput,
    callerRole: CondominiumRole | null
  ): Promise<{
    data: CondominiumUser | null;
    error: { message: string } | null;
  }> {
    if (!this.canUserManageRoles(callerRole)) {
      return {
        data: null,
        error: {
          message:
            'Acesso negado: apenas o Síndico e o Super Administrador possuem permissão para cadastrar usuários e conceder privilégios.',
        },
      };
    }

    // Impede que síndico conceda privilégio superior ao próprio ('superadmin')
    if (input.role === 'superadmin' && callerRole !== 'superadmin') {
      return {
        data: null,
        error: {
          message:
            'Violação de privilégio bloqueada: apenas um Super Administrador pode conceder o papel de Super Administrador.',
        },
      };
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    if (!normalizedEmail || !input.full_name.trim()) {
      return {
        data: null,
        error: { message: 'Informe o nome completo e o e-mail do usuário.' },
      };
    }

    if (isDemoSessionActive()) {
      const current = this.getUsers(input.condominium_id);
      if (current.some((u) => u.email.toLowerCase() === normalizedEmail)) {
        return {
          data: null,
          error: { message: 'Já existe um usuário vinculado com este e-mail neste condomínio.' },
        };
      }
      const demoUser: CondominiumUser = {
        id: input.user_id && UUID_REGEX.test(input.user_id)
          ? input.user_id
          : `00000000-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12, '0')}`,
        condominium_id: input.condominium_id,
        full_name: input.full_name.trim(),
        email: normalizedEmail,
        phone: input.phone?.trim() || 'Não informado',
        cpf: input.cpf?.trim() || undefined,
        unit_number: input.unit_number?.trim() || 'Administração',
        block: input.block?.trim() || 'Bloco A',
        resident_type: input.resident_type || 'Proprietário',
        has_pet: Boolean(input.has_pet),
        role: input.role,
        status: 'active',
        log_access_granted: input.role !== 'morador',
        created_at: new Date().toISOString(),
      };
      const updated = [demoUser, ...current];
      localStorage.setItem(`${DEMO_USERS_KEY_PREFIX}${input.condominium_id}`, JSON.stringify(updated));
      usersMemoryCache.set(input.condominium_id, updated);
      return { data: demoUser, error: null };
    }

    if (!isSupabaseConfigured) {
      return {
        data: null,
        error: { message: 'Cadastro bloqueado: banco de dados Supabase não configurado.' },
      };
    }

    try {
      let targetUserId = input.user_id?.trim() || '';

      if (!UUID_REGEX.test(targetUserId)) {
        // 1. Tenta resolver via RPC segura resolve_user_by_email no PostgreSQL
        const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)(
          'resolve_user_by_email',
          { target_email: normalizedEmail }
        );

        if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0 && rpcData[0]?.user_id) {
          targetUserId = rpcData[0].user_id;
        } else {
          // 2. Fallback: busca em user_profiles caso a coluna email já esteja populada
          const { data: profileByEmail } = await (supabase.from('user_profiles') as any)
            .select('id')
            .ilike('email', normalizedEmail)
            .maybeSingle();

          if (profileByEmail?.id && UUID_REGEX.test(profileByEmail.id)) {
            targetUserId = profileByEmail.id;
          }
        }
      }

      if (!UUID_REGEX.test(targetUserId)) {
        return {
          data: null,
          error: {
            message:
              'Usuário não encontrado no Supabase Auth com este e-mail. A conta precisa existir no Supabase Auth antes de ser vinculada ao condomínio (não é permitido criar vínculo sem UUID real).',
          },
        };
      }

      const resolvedPermissions: SubSindicoPermissions =
        input.role === 'subsindico'
          ? { ...DEFAULT_SUBSINDICO_PERMISSIONS, ...(input.permissions || {}) }
          : {};

      const fullPayload = {
        condominium_id: input.condominium_id,
        user_id: targetUserId,
        role: input.role,
        status: 'active',
        unit_number: input.unit_number?.trim() || null,
        block: input.block?.trim() || null,
        resident_type: input.resident_type || 'Proprietário',
        has_pet: Boolean(input.has_pet),
        cpf: input.cpf?.trim() || null,
        permissions: resolvedPermissions,
        log_access_granted:
          input.role === 'superadmin' ||
          input.role === 'sindico' ||
          input.role === 'porteiro' ||
          Boolean(input.role === 'subsindico' && resolvedPermissions.manage_concierge),
      };

      let { data: memberRow, error: insertErr } = await (
        supabase.from('condominium_members') as any
      )
        .upsert(fullPayload, { onConflict: 'condominium_id,user_id' })
        .select('*')
        .single();

      // Fallback de colunas básicas caso a migration 20261104000001 ainda não tenha sido aplicada
      if (insertErr && (insertErr.code === '42703' || insertErr.message?.includes('column'))) {
        const basicRes = await (supabase.from('condominium_members') as any)
          .upsert(
            {
              condominium_id: input.condominium_id,
              user_id: targetUserId,
              role: input.role,
              status: 'active',
            },
            { onConflict: 'condominium_id,user_id' }
          )
          .select('*')
          .single();
        memberRow = basicRes.data;
        insertErr = basicRes.error;
      }

      if (insertErr || !memberRow) {
        return {
          data: null,
          error: {
            message:
              insertErr?.message ||
              'Não foi possível salvar o vínculo do usuário no Supabase (verifique permissões RLS).',
          },
        };
      }

      await auditService.log({
        condominiumId: input.condominium_id,
        action: 'USER_MEMBER_LINKED',
        entityTable: 'condominium_members',
        entityId: memberRow.id,
        metadata: { target_user_id: targetUserId, role: input.role },
      });

      await this.fetchUsersByCondominium(input.condominium_id);
      const createdUser: CondominiumUser = {
        id: targetUserId,
        condominium_id: input.condominium_id,
        full_name: input.full_name.trim(),
        email: normalizedEmail,
        phone: input.phone?.trim() || 'Não informado',
        cpf: input.cpf?.trim() || undefined,
        unit_number: input.unit_number?.trim() || 'Administração',
        block: input.block?.trim() || 'Bloco A',
        resident_type: input.resident_type || 'Proprietário',
        has_pet: Boolean(input.has_pet),
        role: input.role,
        status: 'active',
        log_access_granted:
          input.role === 'superadmin' || input.role === 'sindico' || input.role === 'porteiro',
        created_at: memberRow.created_at || new Date().toISOString(),
      };

      return { data: createdUser, error: null };
    } catch (err: any) {
      return {
        data: null,
        error: { message: err?.message || 'Erro ao vincular usuário no Supabase.' },
      };
    }
  },

  /**
   * Atualiza o papel (privilégio RBAC) de um membro no condomínio.
   * Impede escalada para 'superadmin' por quem não é 'superadmin' e impede auto-alteração de papel.
   */
  async updateUserRole(
    targetUserId: string,
    condominiumId: string,
    newRole: CondominiumRole,
    callerRole: CondominiumRole | null,
    callerUserId?: string,
    permissions?: SubSindicoPermissions
  ): Promise<{ error: { message: string } | null }> {
    if (!this.canUserManageRoles(callerRole)) {
      return {
        error: {
          message:
            'Acesso negado: apenas o Síndico e o Super Administrador podem conceder ou alterar privilégios.',
        },
      };
    }

    if (newRole === 'superadmin' && callerRole !== 'superadmin') {
      return {
        error: {
          message:
            'Escalada de privilégio bloqueada: apenas um Super Administrador pode conceder o papel de Super Administrador.',
        },
      };
    }

    if (callerUserId && targetUserId === callerUserId && callerRole !== 'superadmin') {
      return {
        error: {
          message: 'Operação não permitida: você não pode alterar seu próprio papel de acesso.',
        },
      };
    }

    const nextPermissions: SubSindicoPermissions =
      newRole === 'subsindico'
        ? { ...DEFAULT_SUBSINDICO_PERMISSIONS, ...(permissions || {}) }
        : {};

    if (isDemoSessionActive()) {
      const current = this.getUsers(condominiumId);
      const updated = current.map((u) =>
        u.id === targetUserId ? { ...u, role: newRole, permissions: nextPermissions } : u
      );
      localStorage.setItem(`${DEMO_USERS_KEY_PREFIX}${condominiumId}`, JSON.stringify(updated));
      usersMemoryCache.set(condominiumId, updated);
      return { error: null };
    }

    if (!isSupabaseConfigured) {
      return { error: { message: 'Alteração bloqueada: Supabase não configurado.' } };
    }

    try {
      const { data, error } = await (supabase.from('condominium_members') as any)
        .update({
          role: newRole,
          permissions: nextPermissions,
          updated_at: new Date().toISOString(),
        })
        .eq('condominium_id', condominiumId)
        .eq('user_id', targetUserId)
        .select('id')
        .single();

      if (error || !data) {
        return {
          error: {
            message:
              error?.message ||
              'Não foi possível atualizar o papel no Supabase (operação bloqueada pelas políticas RLS).',
          },
        };
      }

      await auditService.log({
        condominiumId,
        action: 'USER_ROLE_CHANGED',
        entityTable: 'condominium_members',
        entityId: data.id,
        metadata: { target_user_id: targetUserId, new_role: newRole, permissions: nextPermissions },
      });

      await this.fetchUsersByCondominium(condominiumId);
      return { error: null };
    } catch (err: any) {
      return { error: { message: err?.message || 'Erro ao atualizar papel no Supabase.' } };
    }
  },

  /**
   * Atualiza os privilégios granulares de um Sub-Síndico no condomínio.
   */
  async updateSubSindicoPermissions(
    targetUserId: string,
    condominiumId: string,
    permissions: SubSindicoPermissions,
    callerRole: CondominiumRole | null
  ): Promise<{ error: { message: string } | null }> {
    if (!this.canUserManageRoles(callerRole)) {
      return {
        error: {
          message:
            'Acesso negado: apenas o Síndico e o Super Administrador podem editar privilégios do Sub-Síndico.',
        },
      };
    }

    if (isDemoSessionActive()) {
      const current = this.getUsers(condominiumId);
      const updated = current.map((u) =>
        u.id === targetUserId
          ? { ...u, permissions, log_access_granted: Boolean(permissions.manage_concierge) }
          : u
      );
      localStorage.setItem(`${DEMO_USERS_KEY_PREFIX}${condominiumId}`, JSON.stringify(updated));
      usersMemoryCache.set(condominiumId, updated);
      return { error: null };
    }

    if (!isSupabaseConfigured) {
      return { error: { message: 'Alteração bloqueada: Supabase não configurado.' } };
    }

    try {
      const { data, error } = await (supabase.from('condominium_members') as any)
        .update({
          permissions,
          log_access_granted: Boolean(permissions.manage_concierge),
          updated_at: new Date().toISOString(),
        })
        .eq('condominium_id', condominiumId)
        .eq('user_id', targetUserId)
        .select('id')
        .single();

      if (error || !data) {
        return {
          error: {
            message:
              error?.message ||
              'Não foi possível salvar os privilégios do Sub-Síndico no Supabase.',
          },
        };
      }

      await auditService.log({
        condominiumId,
        action: 'SUBSINDICO_PERMISSIONS_UPDATED',
        entityTable: 'condominium_members',
        entityId: data.id,
        metadata: { target_user_id: targetUserId, permissions },
      });

      await this.fetchUsersByCondominium(condominiumId);
      return { error: null };
    } catch (err: any) {
      return {
        error: { message: err?.message || 'Erro ao atualizar privilégios do Sub-Síndico.' },
      };
    }
  },

  /**
   * Concede ou revoga acesso ao Log em Tempo Real da Portaria no Supabase.
   */
  async setLogAccess(
    targetUserId: string,
    condominiumId: string,
    grantAccess: boolean,
    callerRole: CondominiumRole | null
  ): Promise<{ error: { message: string } | null }> {
    if (!this.canUserManageRoles(callerRole)) {
      return {
        error: {
          message:
            'Acesso negado: apenas o Síndico e o Super Administrador podem conceder ou revogar acesso aos logs.',
        },
      };
    }

    if (isDemoSessionActive()) {
      const current = this.getUsers(condominiumId);
      const updated = current.map((u) =>
        u.id === targetUserId ? { ...u, log_access_granted: grantAccess } : u
      );
      localStorage.setItem(`${DEMO_USERS_KEY_PREFIX}${condominiumId}`, JSON.stringify(updated));
      usersMemoryCache.set(condominiumId, updated);
      return { error: null };
    }

    if (!isSupabaseConfigured) {
      return { error: { message: 'Alteração bloqueada: Supabase não configurado.' } };
    }

    try {
      const { data, error } = await (supabase.from('condominium_members') as any)
        .update({
          log_access_granted: grantAccess,
          updated_at: new Date().toISOString(),
        })
        .eq('condominium_id', condominiumId)
        .eq('user_id', targetUserId)
        .select('id')
        .single();

      if (error || !data) {
        return {
          error: {
            message:
              error?.message ||
              'Não foi possível atualizar a permissão de logs no Supabase.',
          },
        };
      }

      await auditService.log({
        condominiumId,
        action: 'USER_LOG_ACCESS_CHANGED',
        entityTable: 'condominium_members',
        entityId: data.id,
        metadata: { target_user_id: targetUserId, log_access_granted: grantAccess },
      });

      await this.fetchUsersByCondominium(condominiumId);
      return { error: null };
    } catch (err: any) {
      return { error: { message: err?.message || 'Erro ao atualizar permissão de logs.' } };
    }
  },

  /**
   * Remove o vínculo de um usuário no condomínio no Supabase.
   */
  async removeUser(
    targetUserId: string,
    condominiumId: string,
    callerRole: CondominiumRole | null
  ): Promise<{ error: { message: string } | null }> {
    if (!this.canUserManageRoles(callerRole)) {
      return {
        error: {
          message:
            'Acesso negado: apenas o Síndico e o Super Administrador podem remover vínculos de usuários.',
        },
      };
    }

    if (isDemoSessionActive()) {
      const current = this.getUsers(condominiumId);
      const updated = current.filter((u) => u.id !== targetUserId);
      localStorage.setItem(`${DEMO_USERS_KEY_PREFIX}${condominiumId}`, JSON.stringify(updated));
      usersMemoryCache.set(condominiumId, updated);
      return { error: null };
    }

    if (!isSupabaseConfigured) {
      return { error: { message: 'Remoção bloqueada: Supabase não configurado.' } };
    }

    try {
      const { error } = await (supabase.from('condominium_members') as any)
        .delete()
        .eq('condominium_id', condominiumId)
        .eq('user_id', targetUserId);

      if (error) {
        return { error: { message: error.message } };
      }

      await auditService.log({
        condominiumId,
        action: 'USER_MEMBER_REMOVED',
        entityTable: 'condominium_members',
        entityId: targetUserId,
      });

      await this.fetchUsersByCondominium(condominiumId);
      return { error: null };
    } catch (err: any) {
      return { error: { message: err?.message || 'Erro ao remover usuário no Supabase.' } };
    }
  },

  clearCache(): void {
    usersMemoryCache.clear();
  },
};
