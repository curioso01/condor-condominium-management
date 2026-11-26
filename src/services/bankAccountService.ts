import { supabase, isSupabaseConfigured, isDemoSessionActive } from '../lib/supabase';
import { auditService } from './auditService';

export interface CondominiumBankSettings {
  condominiumId?: string;
  bankCode: string;
  bankName: string;
  agency: string;
  agencyDigit: string;
  accountNumber: string;
  accountDigit: string;
  walletCode: string;
  agreementCode: string;
  documentVariety: string;
  beneficiaryName: string;
  beneficiaryCnpj: string;
  beneficiaryAddress: string;
  pixKeyType: 'CNPJ' | 'E-mail' | 'Telefone' | 'Chave Aleatória';
  pixKey: string;
  pixMerchantName: string;
  pixMerchantCity: string;
  interestRateMonthly: number;
  interestMonthlyPercent: number;
  finePercent: number;
  penaltyPercent: number;
  instructionsLine1: string;
  instructionsLine2: string;
  instructionsLine3: string;
  activeIntegration: boolean;
  updatedAt: string;
  updatedBy: string;
}

export const PRESET_BANKS = [
  { code: '341', name: 'Itaú Unibanco', fullName: 'Itaú Unibanco S.A.', defaultWallet: '109' },
  { code: '237', name: 'Bradesco', fullName: 'Banco Bradesco S.A.', defaultWallet: '09' },
  { code: '001', name: 'Banco do Brasil', fullName: 'Banco do Brasil S.A.', defaultWallet: '17' },
  { code: '033', name: 'Santander', fullName: 'Banco Santander (Brasil) S.A.', defaultWallet: '101' },
  { code: '104', name: 'Caixa Econômica', fullName: 'Caixa Econômica Federal', defaultWallet: 'RG' },
  { code: '077', name: 'Banco Inter', fullName: 'Banco Inter S.A.', defaultWallet: '112' },
  { code: '260', name: 'Nubank / Nu Pagamentos', fullName: 'Nu Pagamentos S.A.', defaultWallet: '01' },
  { code: '336', name: 'Banco C6', fullName: 'Banco C6 S.A.', defaultWallet: '20' },
  { code: '403', name: 'Cora SCD', fullName: 'Cora Sociedade de Crédito Direto S.A.', defaultWallet: '01' },
  { code: '756', name: 'Sicoob', fullName: 'Banco Cooperativo Sicoob S.A.', defaultWallet: '01' },
  { code: '748', name: 'Sicredi', fullName: 'Banco Cooperativo Sicredi S.A.', defaultWallet: '1' },
];

export function generateBoletoNumbers(params: {
  bankCode: string;
  agency: string;
  account: string;
  wallet: string;
  amount: number;
  documentNumber: string;
}) {
  const code = (params.bankCode || '341').padStart(3, '0').slice(0, 3);
  const ag = (params.agency || '0001').replace(/\D/g, '').padStart(4, '0').slice(0, 4);
  const acc = (params.account || '00000').replace(/\D/g, '').padStart(6, '0').slice(0, 6);
  const wallet = (params.wallet || '109').replace(/\D/g, '').padStart(3, '0').slice(0, 3);
  const docDigits = (params.documentNumber || '0001').replace(/\D/g, '').padStart(8, '0').slice(-8);
  const amountCents = Math.round((params.amount || 0) * 100)
    .toString()
    .padStart(10, '0');

  const nossoNumero = `${wallet}/${docDigits}-7`;
  const linhaDigitavel = `${code}9${wallet.slice(0, 1)}.${ag}8 ${docDigits.slice(0, 5)}.${acc}4 ${docDigits.slice(3)}1 8 9899${amountCents}`;
  const codigoBarras = `${code}989899${amountCents}${ag}${wallet}${docDigits}${acc}`;

  return {
    nossoNumero,
    linhaDigitavel,
    codigoBarras,
  };
}

/**
 * Formata um campo TLV (Tag-Length-Value) no padrão EMVCo / BACEN BR Code.
 */
function emvTlv(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

/**
 * Remove acentos e caracteres fora do conjunto ASCII imprimível exigido pelo EMVCo.
 */
function sanitizeEmvText(input: string, maxLen: number): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, maxLen);
}

/**
 * Normaliza a chave Pix cadastrada pela síndica segundo as regras do DICT / BACEN.
 */
export function normalizePixKey(
  rawKey: string,
  keyType?: CondominiumBankSettings['pixKeyType']
): string {
  const trimmed = (rawKey || '').trim();
  if (!trimmed) return '';

  if (keyType === 'E-mail' || trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }

  if (keyType === 'Chave Aleatória') {
    return trimmed;
  }

  if (keyType === 'Telefone') {
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return '';
    return digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
  }

  // CNPJ ou CPF: remove máscara mantendo apenas dígitos
  if (keyType === 'CNPJ' || /^[\d.\-/]+$/.test(trimmed)) {
    return trimmed.replace(/\D/g, '');
  }

  return trimmed;
}

/**
 * Calcula o checksum CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF)
 * exigido pela especificação EMVCo / Banco Central do Brasil (ISO/IEC 13239).
 */
export function computePixCrc16Ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= (payload.charCodeAt(i) & 0xff) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Verifica se a síndica já cadastrou uma chave Pix válida (não placeholder) para o condomínio.
 */
export function isValidPixKeyConfigured(settings?: CondominiumBankSettings | null): boolean {
  if (!settings?.pixKey) return false;
  const cleaned = settings.pixKey.replace(/\D/g, '');
  if (cleaned === '00000000000100' || cleaned === '00000000000000') return false;
  return settings.pixKey.trim().length >= 5;
}

/**
 * Gera payload Pix Copia-e-Cola (BR Code EMVCo) 100% compatível com o padrão
 * oficial do Banco Central do Brasil usando a chave Pix cadastrada pela síndica.
 */
export function generateOfficialPixPayload(params: {
  pixKey: string;
  pixKeyType?: CondominiumBankSettings['pixKeyType'];
  merchantName: string;
  merchantCity: string;
  amount: number;
  txid: string;
  description?: string;
}): string {
  const key = normalizePixKey(params.pixKey, params.pixKeyType);
  if (!key) return '';

  const name = sanitizeEmvText(params.merchantName || 'CONDOMINIO', 25) || 'CONDOMINIO';
  const city = sanitizeEmvText(params.merchantCity || 'SAO PAULO', 15) || 'SAO PAULO';
  const rawTxid = (params.txid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25);
  const txid = rawTxid || '***';

  // Tag 26 — Merchant Account Information (GUI br.gov.bcb.pix + Chave + Descrição opcional)
  const guiField = emvTlv('00', 'br.gov.bcb.pix');
  const keyField = emvTlv('01', key);
  const maxDescLen = Math.max(0, 99 - guiField.length - keyField.length - 4);
  const descClean = params.description ? sanitizeEmvText(params.description, Math.min(35, maxDescLen)) : '';
  const descField = descClean ? emvTlv('02', descClean) : '';
  const merchantAccountInfo = emvTlv('26', `${guiField}${keyField}${descField}`);

  const parts: string[] = [
    emvTlv('00', '01'), // Payload Format Indicator
    merchantAccountInfo,
    emvTlv('52', '0000'), // Merchant Category Code
    emvTlv('53', '986'), // Currency: BRL
  ];

  if (Number.isFinite(params.amount) && params.amount > 0) {
    parts.push(emvTlv('54', params.amount.toFixed(2)));
  }

  parts.push(
    emvTlv('58', 'BR'),
    emvTlv('59', name),
    emvTlv('60', city),
    emvTlv('62', emvTlv('05', txid))
  );

  const bodyWithCrcTag = `${parts.join('')}6304`;
  const crc = computePixCrc16Ccitt(bodyWithCrcTag);
  return `${bodyWithCrcTag}${crc}`;
}

const DEMO_BANK_KEY_PREFIX = 'condor_demo_bank_settings_';

// Cache em memória estritamente isolado por condominiumId (limpo ao trocar de sessão)
const memoryBankCache = new Map<string, CondominiumBankSettings>();

export function buildDefaultBankSettingsForCondo(
  condominiumId: string = '',
  condominiumName: string = 'Condomínio',
  condominiumCnpj: string = ''
): CondominiumBankSettings {
  const interest = 1.0;
  const fine = 2.0;
  return {
    condominiumId,
    bankCode: '341',
    bankName: 'Itaú Unibanco S.A.',
    agency: '',
    agencyDigit: '',
    accountNumber: '',
    accountDigit: '',
    walletCode: '109',
    agreementCode: '',
    documentVariety: 'DM (Duplicata Mercantil / Condominial)',
    beneficiaryName: condominiumName || 'Condomínio',
    beneficiaryCnpj: condominiumCnpj || '',
    beneficiaryAddress: '',
    pixKeyType: 'CNPJ',
    pixKey: condominiumCnpj || '',
    pixMerchantName: (condominiumName || 'CONDOMINIO').slice(0, 25).toUpperCase(),
    pixMerchantCity: 'RIO DE JANEIRO',
    interestRateMonthly: interest,
    interestMonthlyPercent: interest,
    finePercent: fine,
    penaltyPercent: fine,
    instructionsLine1: 'Após o vencimento, cobrar multa de 2,00% e juros de mora de 1,00% ao mês.',
    instructionsLine2: 'Pagamento disponível via QR Code Pix na área lateral ou código de barras.',
    instructionsLine3: 'Em caso de dúvidas, contate a administração pelo aplicativo Condor.',
    activeIntegration: true,
    updatedAt: new Date().toISOString(),
    updatedBy: 'Aguardando Configuração da Administração',
  };
}

function mapDbRowToBankSettings(row: any): CondominiumBankSettings {
  const interest = Number(row.interest_rate_monthly ?? 1.0);
  const fine = Number(row.fine_percent ?? 2.0);
  const benName = row.beneficiary_name || 'Condomínio';
  return {
    condominiumId: row.condominium_id,
    bankCode: row.bank_code || '341',
    bankName: row.bank_name || 'Itaú Unibanco S.A.',
    agency: row.agency || '0001',
    agencyDigit: row.agency_digit || '0',
    accountNumber: row.account_number || '00000',
    accountDigit: row.account_digit || '0',
    walletCode: row.wallet_code || '109',
    agreementCode: row.agreement_code || row.account_number || '000000',
    documentVariety: 'DM (Duplicata Mercantil / Condominial)',
    beneficiaryName: benName,
    beneficiaryCnpj: row.beneficiary_cnpj || '00.000.000/0001-00',
    beneficiaryAddress: row.beneficiary_address || 'Endereço Administrativo do Condomínio',
    pixKeyType: row.pix_key_type || 'CNPJ',
    pixKey: row.pix_key || row.beneficiary_cnpj || '',
    pixMerchantName: benName.slice(0, 25).toUpperCase(),
    pixMerchantCity: 'SAO PAULO',
    interestRateMonthly: interest,
    interestMonthlyPercent: interest,
    finePercent: fine,
    penaltyPercent: fine,
    instructionsLine1:
      row.instructions_line1 ||
      'Após o vencimento, cobrar multa de 2,00% e juros de mora de 1,00% ao mês.',
    instructionsLine2:
      row.instructions_line2 ||
      'Pagamento disponível via QR Code Pix na área lateral ou código de barras.',
    instructionsLine3:
      row.instructions_line3 ||
      'Em caso de dúvidas, contate a administração pelo aplicativo Condor.',
    activeIntegration: Boolean(row.active_integration ?? true),
    updatedAt: row.updated_at || new Date().toISOString(),
    updatedBy: row.updated_by_name || 'Administração do Condomínio',
  };
}

export const bankAccountService = {
  /**
   * Obtém de forma síncrona a configuração em cache do condomínio específico,
   * sem jamais compartilhar dados bancários entre condomínios diferentes.
   */
  getSettings(
    condominiumId: string = '',
    condominiumName?: string,
    condominiumCnpj?: string | null
  ): CondominiumBankSettings {
    if (!condominiumId) {
      return buildDefaultBankSettingsForCondo('', condominiumName, condominiumCnpj || undefined);
    }

    if (isDemoSessionActive()) {
      try {
        const raw = localStorage.getItem(`${DEMO_BANK_KEY_PREFIX}${condominiumId}`);
        if (raw) {
          return JSON.parse(raw) as CondominiumBankSettings;
        }
      } catch {
        // ignore
      }
    }

    const cached = memoryBankCache.get(condominiumId);
    if (cached) {
      return cached;
    }

    return buildDefaultBankSettingsForCondo(
      condominiumId,
      condominiumName,
      condominiumCnpj || undefined
    );
  },

  resetSettings(
    condominiumId: string = '',
    condominiumName?: string,
    condominiumCnpj?: string | null
  ): CondominiumBankSettings {
    const defaults = buildDefaultBankSettingsForCondo(
      condominiumId,
      condominiumName,
      condominiumCnpj || undefined
    );
    if (condominiumId) {
      memoryBankCache.set(condominiumId, defaults);
    }
    return defaults;
  },

  /**
   * Busca as configurações bancárias do condomínio diretamente no Supabase (public.condominium_bank_settings).
   */
  async fetchSettings(
    condominiumId: string,
    condominiumName?: string,
    condominiumCnpj?: string | null
  ): Promise<{
    data: CondominiumBankSettings;
    error: { message: string } | null;
  }> {
    const fallback = buildDefaultBankSettingsForCondo(
      condominiumId,
      condominiumName,
      condominiumCnpj || undefined
    );

    if (!condominiumId) {
      return { data: fallback, error: null };
    }

    if (isDemoSessionActive()) {
      const demoData = this.getSettings(condominiumId, condominiumName, condominiumCnpj);
      memoryBankCache.set(condominiumId, demoData);
      return { data: demoData, error: null };
    }

    if (!isSupabaseConfigured) {
      return { data: fallback, error: { message: 'Supabase não configurado.' } };
    }

    try {
      const { data, error } = await (supabase.from('condominium_bank_settings') as any)
        .select('*')
        .eq('condominium_id', condominiumId)
        .maybeSingle();

      if (error) {
        return { data: fallback, error: { message: error.message } };
      }

      if (!data) {
        memoryBankCache.set(condominiumId, fallback);
        return { data: fallback, error: null };
      }

      const mapped = mapDbRowToBankSettings(data);
      memoryBankCache.set(condominiumId, mapped);
      return { data: mapped, error: null };
    } catch (err: any) {
      return {
        data: fallback,
        error: { message: err?.message || 'Erro ao carregar dados bancários do condomínio.' },
      };
    }
  },

  /**
   * Salva as configurações bancárias do condomínio no Supabase.
   * Só retorna sucesso se o banco confirmar a persistência.
   */
  async saveSettingsAsync(
    condominiumId: string,
    settings: Omit<CondominiumBankSettings, 'updatedAt' | 'updatedBy'>,
    updatedBy: string = 'Síndico Administrador'
  ): Promise<{
    data: CondominiumBankSettings | null;
    error: { message: string } | null;
  }> {
    if (!condominiumId) {
      return { data: null, error: { message: 'Condomínio ativo não identificado.' } };
    }

    const updatedObj: CondominiumBankSettings = {
      ...settings,
      condominiumId,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    if (isDemoSessionActive()) {
      localStorage.setItem(`${DEMO_BANK_KEY_PREFIX}${condominiumId}`, JSON.stringify(updatedObj));
      memoryBankCache.set(condominiumId, updatedObj);
      window.dispatchEvent(new CustomEvent('condor:bank-settings-updated'));
      return { data: updatedObj, error: null };
    }

    if (!isSupabaseConfigured) {
      return {
        data: null,
        error: {
          message: 'Alteração bancária bloqueada: banco de dados Supabase não configurado.',
        },
      };
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      const payload = {
        condominium_id: condominiumId,
        bank_code: settings.bankCode.trim(),
        bank_name: settings.bankName.trim(),
        agency: settings.agency.trim(),
        account_number: settings.accountNumber.trim(),
        account_digit: settings.accountDigit.trim(),
        wallet_code: settings.walletCode.trim(),
        beneficiary_name: settings.beneficiaryName.trim(),
        beneficiary_cnpj: settings.beneficiaryCnpj.trim(),
        pix_key_type: settings.pixKeyType,
        pix_key: settings.pixKey.trim(),
        interest_rate_monthly: Number(settings.interestMonthlyPercent ?? settings.interestRateMonthly ?? 1.0),
        fine_percent: Number(settings.penaltyPercent ?? settings.finePercent ?? 2.0),
        instructions_line1: settings.instructionsLine1 || null,
        instructions_line2: settings.instructionsLine2 || null,
        active_integration: Boolean(settings.activeIntegration),
        updated_by_name: updatedBy,
        updated_by: authData?.user?.id || null,
      };

      const { data, error } = await (supabase.from('condominium_bank_settings') as any)
        .upsert(payload, { onConflict: 'condominium_id' })
        .select('*')
        .single();

      if (error || !data) {
        return {
          data: null,
          error: {
            message:
              error?.message ||
              'Não foi possível salvar os dados bancários no Supabase (verifique se a migration foi executada e suas permissões).',
          },
        };
      }

      const saved = {
        ...updatedObj,
        ...mapDbRowToBankSettings(data),
        agencyDigit: settings.agencyDigit || '0',
        agreementCode: settings.agreementCode || settings.accountNumber,
        beneficiaryAddress: settings.beneficiaryAddress || 'Endereço Administrativo do Condomínio',
        pixMerchantName: settings.pixMerchantName || savedBeneficiaryUpper(data.beneficiary_name),
        pixMerchantCity: settings.pixMerchantCity || 'SAO PAULO',
        instructionsLine3: settings.instructionsLine3 || '',
      };
      memoryBankCache.set(condominiumId, saved);

      await auditService.log({
        condominiumId,
        action: 'BANK_SETTINGS_UPDATED',
        entityTable: 'condominium_bank_settings',
        entityId: data.id,
        metadata: {
          bank_code: saved.bankCode,
          beneficiary_cnpj: saved.beneficiaryCnpj,
          pix_key_type: saved.pixKeyType,
        },
      });

      window.dispatchEvent(new CustomEvent('condor:bank-settings-updated'));
      return { data: saved, error: null };
    } catch (err: any) {
      return {
        data: null,
        error: { message: err?.message || 'Erro ao salvar configurações bancárias no Supabase.' },
      };
    }
  },

  clearCache(): void {
    memoryBankCache.clear();
  },
};

function savedBeneficiaryUpper(name?: string): string {
  return (name || 'CONDOMINIO').slice(0, 25).toUpperCase();
}
