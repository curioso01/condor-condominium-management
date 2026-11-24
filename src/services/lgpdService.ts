import { supabase, isSupabaseConfigured, isDemoSessionActive } from '../lib/supabase';
import { auditService } from './auditService';
import { printHtmlDocument, escapeHtml } from '../utils/printDocument';
import { formatRoleLabel } from '../types/database.types';

export type LgpdConsentType = 'privacy_terms' | 'data_export_request' | 'anonymization_request';

export const LGPD_POLICY_VERSION = '2026.1';

interface PersonalDataExportParams {
  userId: string;
  email?: string | null;
  profile: any;
  memberships: any[];
  condominiumId?: string | null;
  condominiumName?: string | null;
}

function buildPersonalDataRows(params: PersonalDataExportParams) {
  const fullName = params.profile?.full_name || 'Usuário Condor';
  const phone = params.profile?.phone || 'Não informado';
  const createdAt = params.profile?.created_at
    ? new Date(params.profile.created_at).toLocaleString('pt-BR')
    : 'Não informado';

  const membershipLines = (params.memberships || []).map((m: any) => ({
    condoName: m?.condominium?.name || m?.condominium_id || 'Condomínio',
    cnpj: m?.condominium?.cnpj || '—',
    role: formatRoleLabel(m?.membership?.role),
    status: m?.membership?.status === 'active' ? 'Ativo' : m?.membership?.status || '—',
    unit: m?.membership?.unit_number
      ? `${m.membership.unit_number}${m.membership.block ? ` • ${m.membership.block}` : ''}`
      : 'Administração / Sem unidade específica',
  }));

  return { fullName, phone, createdAt, membershipLines };
}

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
        metadata: { policy_version: LGPD_POLICY_VERSION, ...(params.metadata || {}) },
      });

      return { error: null };
    } catch (err: any) {
      return { error: { message: err?.message || 'Erro ao registrar solicitação LGPD.' } };
    }
  },

  /**
   * Exporta em documento PDF oficial (via impressão A4 limpa) todos os dados pessoais do usuário
   * autenticado (Portabilidade - LGPD Art. 18, V). Nenhum arquivo JSON é gerado.
   */
  async exportMyPersonalDataPdf(
    params: PersonalDataExportParams
  ): Promise<{ error: { message: string } | null }> {
    try {
      const generatedAt = new Date().toLocaleString('pt-BR');
      const { fullName, phone, createdAt, membershipLines } = buildPersonalDataRows(params);

      const membershipsHtml =
        membershipLines.length === 0
          ? '<tr><td colspan="5" style="text-align:center;color:#64748b;padding:12px;">Nenhum vínculo condominial ativo encontrado.</td></tr>'
          : membershipLines
              .map(
                (m) => `
                  <tr>
                    <td style="font-weight:600;">${escapeHtml(m.condoName)}</td>
                    <td>${escapeHtml(m.cnpj)}</td>
                    <td>${escapeHtml(m.role)}</td>
                    <td>${escapeHtml(m.unit)}</td>
                    <td>${escapeHtml(m.status)}</td>
                  </tr>
                `
              )
              .join('');

      const htmlBody = `
        <div style="font-family: Arial, Helvetica, sans-serif; color:#0f172a; max-width:760px; margin:0 auto;">
          <div style="border-bottom:2px solid #059669; padding-bottom:14px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:flex-end;">
            <div>
              <div style="font-size:11px; font-weight:700; color:#059669; text-transform:uppercase; letter-spacing:1px;">
                CONDOR — Relatório Oficial de Portabilidade de Dados (LGPD)
              </div>
              <h1 style="font-size:20px; font-weight:800; margin:4px 0 2px 0; color:#0f172a;">
                Extrato Completo dos Dados Pessoais do Titular
              </h1>
              <div style="font-size:11px; color:#475569;">
                Base Legal: Lei nº 13.709/2018 (LGPD — Art. 18, V) • Política Versão ${escapeHtml(LGPD_POLICY_VERSION)}
              </div>
            </div>
            <div style="text-align:right; font-size:11px; color:#475569;">
              <div><strong>Emitido em:</strong> ${escapeHtml(generatedAt)}</div>
              <div><strong>Condomínio ativo:</strong> ${escapeHtml(params.condominiumName || 'Conta Condor')}</div>
            </div>
          </div>

          <h2 style="font-size:13px; text-transform:uppercase; letter-spacing:0.6px; color:#059669; margin:18px 0 8px 0;">
            1. Identificação do Titular dos Dados
          </h2>
          <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:18px;">
            <tbody>
              <tr>
                <td style="padding:8px 10px; border:1px solid #cbd5e1; background:#f8fafc; width:34%; font-weight:700;">Nome Completo</td>
                <td style="padding:8px 10px; border:1px solid #cbd5e1;">${escapeHtml(fullName)}</td>
              </tr>
              <tr>
                <td style="padding:8px 10px; border:1px solid #cbd5e1; background:#f8fafc; font-weight:700;">E-mail de Acesso</td>
                <td style="padding:8px 10px; border:1px solid #cbd5e1;">${escapeHtml(params.email || 'Não informado')}</td>
              </tr>
              <tr>
                <td style="padding:8px 10px; border:1px solid #cbd5e1; background:#f8fafc; font-weight:700;">Telefone / WhatsApp</td>
                <td style="padding:8px 10px; border:1px solid #cbd5e1;">${escapeHtml(phone)}</td>
              </tr>
              <tr>
                <td style="padding:8px 10px; border:1px solid #cbd5e1; background:#f8fafc; font-weight:700;">Identificador Interno (UUID)</td>
                <td style="padding:8px 10px; border:1px solid #cbd5e1; font-family:monospace; font-size:11px;">${escapeHtml(params.userId)}</td>
              </tr>
              <tr>
                <td style="padding:8px 10px; border:1px solid #cbd5e1; background:#f8fafc; font-weight:700;">Cadastro na Plataforma</td>
                <td style="padding:8px 10px; border:1px solid #cbd5e1;">${escapeHtml(createdAt)}</td>
              </tr>
            </tbody>
          </table>

          <h2 style="font-size:13px; text-transform:uppercase; letter-spacing:0.6px; color:#059669; margin:18px 0 8px 0;">
            2. Vínculos Condominiais e Papéis de Acesso
          </h2>
          <table style="width:100%; border-collapse:collapse; font-size:11.5px; margin-bottom:20px;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="text-align:left; padding:8px; border:1px solid #cbd5e1;">Condomínio</th>
                <th style="text-align:left; padding:8px; border:1px solid #cbd5e1;">CNPJ</th>
                <th style="text-align:left; padding:8px; border:1px solid #cbd5e1;">Papel</th>
                <th style="text-align:left; padding:8px; border:1px solid #cbd5e1;">Unidade / Bloco</th>
                <th style="text-align:left; padding:8px; border:1px solid #cbd5e1;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${membershipsHtml}
            </tbody>
          </table>

          <div style="margin-top:24px; padding:12px 14px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; font-size:11px; color:#166534; line-height:1.5;">
            <strong>Controlador &amp; Operador:</strong> O condomínio atua como Controlador dos dados pessoais dos moradores e colaboradores; a plataforma CONDOR atua como Operadora com isolamento estrito por condomínio (Row Level Security). Esta exportação foi registrada automaticamente na trilha de auditoria LGPD.
          </div>
        </div>
      `;

      printHtmlDocument(
        `CONDOR — Portabilidade LGPD (${fullName})`,
        htmlBody
      );

      await this.recordConsentOrRequest({
        userId: params.userId,
        condominiumId: params.condominiumId,
        consentType: 'data_export_request',
        metadata: { format: 'pdf' },
      });

      return { error: null };
    } catch (err: any) {
      return { error: { message: err?.message || 'Falha ao gerar PDF dos dados pessoais.' } };
    }
  },

  /**
   * Exporta cópia legível em TXT (texto simples) para arquivamento rápido, sem uso de JSON.
   */
  async exportMyPersonalDataTxt(
    params: PersonalDataExportParams
  ): Promise<{ error: { message: string } | null }> {
    try {
      const generatedAt = new Date().toLocaleString('pt-BR');
      const { fullName, phone, createdAt, membershipLines } = buildPersonalDataRows(params);

      const lines = [
        '======================================================================',
        'CONDOR — RELATÓRIO DE PORTABILIDADE DE DADOS PESSOAIS (LGPD)',
        '======================================================================',
        `Emitido em: ${generatedAt}`,
        `Versão da Política LGPD: ${LGPD_POLICY_VERSION}`,
        `Condomínio Ativo: ${params.condominiumName || 'Conta Condor'}`,
        '',
        '1. IDENTIFICAÇÃO DO TITULAR',
        `   Nome Completo: ${fullName}`,
        `   E-mail: ${params.email || 'Não informado'}`,
        `   Telefone: ${phone}`,
        `   ID do Usuário: ${params.userId}`,
        `   Data de Cadastro: ${createdAt}`,
        '',
        '2. VÍNCULOS CONDOMINIAIS',
        ...(membershipLines.length === 0
          ? ['   Nenhum vínculo condominial ativo encontrado.']
          : membershipLines.map(
              (m, idx) =>
                `   ${idx + 1}. ${m.condoName} (CNPJ: ${m.cnpj}) | Papel: ${m.role} | Unidade: ${m.unit} | Status: ${m.status}`
            )),
        '',
        '----------------------------------------------------------------------',
        'Documento gerado em conformidade com a Lei nº 13.709/2018 (Art. 18, V).',
      ];

      const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], {
        type: 'text/plain;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `condor_meus_dados_lgpd_${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await this.recordConsentOrRequest({
        userId: params.userId,
        condominiumId: params.condominiumId,
        consentType: 'data_export_request',
        metadata: { format: 'txt' },
      });

      return { error: null };
    } catch (err: any) {
      return { error: { message: err?.message || 'Falha ao exportar dados em TXT.' } };
    }
  },
};
