import { supabase, isSupabaseConfigured, isDemoSessionActive } from '../lib/supabase';
import type { Condominium, CondominiumRole } from '../types/database.types';
import { auditService } from './auditService';

export interface UpsertCondominiumInput {
  name: string;
  cnpj?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  assignSindicoEmail?: string | null;
  default_reservation_time_limit?: boolean;
  default_reservation_start_time?: string | null;
  default_reservation_end_time?: string | null;
}

export const condominiumService = {
  /**
   * Cria um novo condomínio na plataforma (Exclusivo Super Administrador via RLS).
   * Opcionalmente vincula uma síndica existente no Supabase Auth ao novo condomínio.
   */
  async createCondominium(
    input: UpsertCondominiumInput,
    callerRole: CondominiumRole | null
  ): Promise<{ data: Condominium | null; error: { message: string } | null }> {
    if (callerRole !== 'superadmin') {
      return {
        data: null,
        error: {
          message:
            'Acesso negado: apenas o Super Administrador da plataforma pode cadastrar novos condomínios.',
        },
      };
    }

    if (!input.name.trim()) {
      return { data: null, error: { message: 'O nome do condomínio é obrigatório.' } };
    }

    if (!isSupabaseConfigured || isDemoSessionActive()) {
      return {
        data: null,
        error: {
          message:
            'O cadastro de novos condomínios exige conexão ativa com o banco de dados Supabase.',
        },
      };
    }

    const payload: Record<string, any> = {
      name: input.name.trim(),
      cnpj: input.cnpj?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim().toUpperCase().slice(0, 2) || null,
    };

    if (input.default_reservation_time_limit !== undefined) {
      payload.default_reservation_time_limit = Boolean(input.default_reservation_time_limit);
    }
    if (input.default_reservation_start_time !== undefined) {
      payload.default_reservation_start_time = input.default_reservation_start_time || '08:00';
    }
    if (input.default_reservation_end_time !== undefined) {
      payload.default_reservation_end_time = input.default_reservation_end_time || '22:00';
    }

    const { data, error } = await (supabase.from('condominiums') as any)
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      if (error?.code === '23505') {
        return {
          data: null,
          error: { message: 'Já existe um condomínio cadastrado com este CNPJ.' },
        };
      }
      return {
        data: null,
        error: {
          message: error?.message || 'Não foi possível criar o condomínio no Supabase.',
        },
      };
    }

    const createdCondo = data as Condominium;

    // Se informou e-mail de síndica existente no Auth, vincula como 'sindico'
    if (input.assignSindicoEmail?.trim()) {
      const { data: resolvedUsers, error: resolveErr } = await (supabase.rpc as any)(
        'resolve_user_by_email',
        { target_email: input.assignSindicoEmail.trim() }
      );

      if (!resolveErr && Array.isArray(resolvedUsers) && resolvedUsers.length > 0) {
        const targetUserId = resolvedUsers[0].user_id;
        await (supabase.from('condominium_members') as any).upsert(
          {
            condominium_id: createdCondo.id,
            user_id: targetUserId,
            role: 'sindico',
            status: 'active',
            log_access_granted: true,
          },
          { onConflict: 'condominium_id,user_id' }
        );
      }
    }

    await auditService.log({
      condominiumId: createdCondo.id,
      action: 'CONDOMINIUM_CREATED',
      entityTable: 'condominiums',
      entityId: createdCondo.id,
      metadata: { name: createdCondo.name, cnpj: createdCondo.cnpj },
    });

    return { data: createdCondo, error: null };
  },

  /**
   * Atualiza os dados cadastrais de um condomínio existente.
   * RLS garante que o síndico só pode editar condomínios onde possui vínculo ativo de 'sindico',
   * e o 'superadmin' pode editar qualquer condomínio.
   */
  async updateCondominium(
    condominiumId: string,
    input: UpsertCondominiumInput,
    callerRole: CondominiumRole | null,
    authorizedCondoIds: string[]
  ): Promise<{ data: Condominium | null; error: { message: string } | null }> {
    if (callerRole !== 'superadmin' && callerRole !== 'sindico') {
      return {
        data: null,
        error: {
          message:
            'Acesso negado: apenas o Síndico autorizado ou o Super Administrador podem editar os dados do condomínio.',
        },
      };
    }

    if (callerRole === 'sindico' && !authorizedCondoIds.includes(condominiumId)) {
      return {
        data: null,
        error: {
          message:
            'Acesso negado: você só pode editar condomínios para os quais possui autorização ativa.',
        },
      };
    }

    if (!input.name.trim()) {
      return { data: null, error: { message: 'O nome do condomínio é obrigatório.' } };
    }

    if (!isSupabaseConfigured || isDemoSessionActive()) {
      return {
        data: null,
        error: {
          message:
            'A atualização cadastral do condomínio exige conexão confirmada com o Supabase.',
        },
      };
    }

    const payload: Record<string, any> = {
      name: input.name.trim(),
      cnpj: input.cnpj?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim().toUpperCase().slice(0, 2) || null,
    };

    if (input.default_reservation_time_limit !== undefined) {
      payload.default_reservation_time_limit = Boolean(input.default_reservation_time_limit);
    }
    if (input.default_reservation_start_time !== undefined) {
      payload.default_reservation_start_time = input.default_reservation_start_time || '08:00';
    }
    if (input.default_reservation_end_time !== undefined) {
      payload.default_reservation_end_time = input.default_reservation_end_time || '22:00';
    }

    const { data, error } = await (supabase.from('condominiums') as any)
      .update(payload)
      .eq('id', condominiumId)
      .select('*')
      .single();

    if (error || !data) {
      return {
        data: null,
        error: {
          message:
            error?.message ||
            'Falha ao atualizar os dados do condomínio no Supabase (verifique permissões RLS).',
        },
      };
    }

    await auditService.log({
      condominiumId,
      action: 'CONDOMINIUM_UPDATED',
      entityTable: 'condominiums',
      entityId: condominiumId,
      metadata: { name: payload.name, cnpj: payload.cnpj },
    });

    return { data: data as Condominium, error: null };
  },
};
