import { supabase, isSupabaseConfigured, isDemoSessionActive } from '../lib/supabase';
import type { Json } from '../types/database.types';

export interface RecordAuditLogInput {
  condominiumId?: string | null;
  action: string;
  entityTable: string;
  entityId?: string | null;
  metadata?: Record<string, Json | undefined>;
}

export interface AuditLogEntry {
  id: string;
  condominium_id: string | null;
  actor_user_id: string | null;
  action: string;
  entity_table: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export const auditService = {
  /**
   * Registra operação crítica na tabela public.audit_logs quando conectado ao Supabase.
   * Nunca armazena senhas, tokens ou segredos no metadata.
   */
  async log(input: RecordAuditLogInput): Promise<void> {
    if (!isSupabaseConfigured || isDemoSessionActive()) return;

    try {
      const { data: authData } = await supabase.auth.getUser();
      const actorId = authData?.user?.id;
      if (!actorId) return;

      const isUuidCondo =
        input.condominiumId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.condominiumId);

      await (supabase.from('audit_logs') as any).insert({
        condominium_id: isUuidCondo ? input.condominiumId : null,
        actor_user_id: actorId,
        action: input.action,
        entity_table: input.entityTable,
        entity_id: input.entityId || null,
        metadata: (input.metadata || {}) as Json,
      });
    } catch {
      // Falha silenciosa apenas para telemetria caso a migration de audit_logs ainda não tenha sido aplicada
    }
  },

  /**
   * Consulta os eventos recentes da trilha de auditoria do condomínio (acesso restrito a Síndico / SuperAdmin via RLS).
   */
  async getRecentLogs(
    condominiumId: string,
    limit: number = 30
  ): Promise<{ data: AuditLogEntry[]; error: { message: string } | null }> {
    if (!condominiumId || isDemoSessionActive()) {
      return { data: [], error: null };
    }
    if (!isSupabaseConfigured) {
      return { data: [], error: { message: 'Supabase não configurado.' } };
    }

    try {
      const { data, error } = await (supabase.from('audit_logs') as any)
        .select('*')
        .eq('condominium_id', condominiumId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        return { data: [], error: { message: error.message } };
      }

      return { data: (data || []) as AuditLogEntry[], error: null };
    } catch (err: any) {
      return {
        data: [],
        error: { message: err?.message || 'Erro ao carregar trilha de auditoria.' },
      };
    }
  },
};
