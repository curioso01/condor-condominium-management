import { supabase, isSupabaseConfigured, isDemoSessionActive } from '../lib/supabase';
import { auditService } from './auditService';

export type LgpdConsentType = 'privacy_terms' | 'data_export_request' | 'anonymization_request';

export const LGPD_POLICY_VERSION = '2026.1';

export const lgpdService = {
  /**
   * Registra aceite de Política de Privacidade ou solicitação de exercício de direitos LGPD (Art. 18).
   */
  async recordConsentOrRequest(params: {
    userId: string;
    condominiumId?: string | null;
    consentType: LgpdConsentType;
    metadata?: Record<string, string | number | boolean | null>;
  }): Promise<{ error: { message: string } | null }> {
    if (isDemoSessionActive()) {
      return { error: null };
    }
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase não configurado para registrar solicitação LGPD.' } };
    }

    try {
      const isUuidCondo =
        params.condominiumId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.condominiumId);

      const { error } = await (supabase.from('lgpd_consents') as any).insert({
        user_id: params.userId,
        condominium_id: isUuidCondo ? params.condominiumId : null,
        policy_version: LGPD_POLICY_VERSION,
        consent_type: params.consentType,
        metadata: params.metadata || {},
      });

      if (error) {
        return { error: { message: error.message } };
      }

      await auditService.log({
        condominiumId: params.condominiumId,
        action: `LGPD_${params.consentType.toUpperCase()}`,
        entityTable: 'lgpd_consents',
        metadata: { policy_version: LGPD_POLICY_VERSION },
      });

      return { error: null };
    } catch (err: any) {
      return { error: { message: err?.message || 'Erro ao registrar solicitação LGPD.' } };
    }
  },

  /**
   * Exporta em JSON estruturado todos os dados pessoais do usuário autenticado (Portabilidade - LGPD Art. 18, V).
   */
  async exportMyPersonalData(params: {
    userId: string;
    email?: string | null;
    profile: unknown;
    memberships: unknown[];
    condominiumId?: string | null;
  }): Promise<{ error: { message: string } | null }> {
    try {
      const exportPayload = {
        exported_at: new Date().toISOString(),
        lgpd_policy_version: LGPD_POLICY_VERSION,
        platform: 'CONDOR — Gestão Condominial',
        data_subject: {
          user_id: params.userId,
          email: params.email || null,
          profile: params.profile,
          condominium_memberships: params.memberships,
        },
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `condor_meus_dados_lgpd_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Registra evidência de portabilidade (ignora erro se tabela ainda não migrada)
      await this.recordConsentOrRequest({
        userId: params.userId,
        condominiumId: params.condominiumId,
        consentType: 'data_export_request',
        metadata: { format: 'json' },
      });

      return { error: null };
    } catch (err: any) {
      return { error: { message: err?.message || 'Falha ao exportar dados pessoais.' } };
    }
  },
};
