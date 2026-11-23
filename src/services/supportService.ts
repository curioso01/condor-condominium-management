import { supabase, isSupabaseConfigured, isDemoSessionActive } from '../lib/supabase';
import { auditService } from './auditService';

export interface CreateSupportTicketInput {
  condominiumId?: string | null;
  subject?: string;
  message: string;
}

export const supportService = {
  /**
   * Registra um chamado de suporte na tabela public.support_tickets do Supabase.
   * Nunca retorna sucesso falso caso a gravação falhe.
   */
  async createTicket(input: CreateSupportTicketInput): Promise<{
    id: string | null;
    error: { message: string } | null;
  }> {
    if (!input.message.trim()) {
      return { id: null, error: { message: 'Descreva sua solicitação antes de enviar.' } };
    }

    if (isDemoSessionActive()) {
      return { id: `demo-ticket-${Date.now()}`, error: null };
    }

    if (!isSupabaseConfigured) {
      return {
        id: null,
        error: { message: 'Envio bloqueado: Supabase não configurado.' },
      };
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user?.id) {
        return { id: null, error: { message: 'Sessão inválida. Faça login novamente.' } };
      }

      const isUuidCondo =
        input.condominiumId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.condominiumId);

      const { data, error } = await (supabase.from('support_tickets') as any)
        .insert({
          condominium_id: isUuidCondo ? input.condominiumId : null,
          user_id: user.id,
          user_name: (user.user_metadata?.full_name as string) || user.email || 'Usuário Condor',
          user_email: user.email || null,
          subject: input.subject?.trim() || 'Suporte Plataforma Condor',
          message: input.message.trim(),
          status: 'open',
        })
        .select('id')
        .single();

      if (error || !data) {
        return {
          id: null,
          error: {
            message:
              error?.message ||
              'Não foi possível registrar seu chamado no banco de dados. Tente novamente ou use o e-mail de suporte.',
          },
        };
      }

      await auditService.log({
        condominiumId: input.condominiumId,
        action: 'SUPPORT_TICKET_CREATED',
        entityTable: 'support_tickets',
        entityId: data.id,
      });

      return { id: data.id, error: null };
    } catch (err: any) {
      return { id: null, error: { message: err?.message || 'Erro ao enviar chamado de suporte.' } };
    }
  },
};
