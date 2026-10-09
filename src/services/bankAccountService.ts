export interface BankPreset {
  code: string;
  name: string;
  fullName: string;
  defaultWallet: string;
}

export const PRESET_BANKS: BankPreset[] = [
  { code: '341', name: 'Itaú Unibanco', fullName: '341 - Banco Itaú S.A.', defaultWallet: '109' },
  { code: '001', name: 'Banco do Brasil', fullName: '001 - Banco do Brasil S.A.', defaultWallet: '17' },
  { code: '237', name: 'Bradesco', fullName: '237 - Banco Bradesco S.A.', defaultWallet: '09' },
  { code: '033', name: 'Santander', fullName: '033 - Banco Santander (Brasil) S.A.', defaultWallet: '101' },
  { code: '104', name: 'Caixa Econômica', fullName: '104 - Caixa Econômica Federal', defaultWallet: 'SR' },
  { code: '077', name: 'Banco Inter', fullName: '077 - Banco Inter S.A.', defaultWallet: '112' },
  { code: '260', name: 'Nubank', fullName: '260 - Nu Pagamentos S.A.', defaultWallet: '01' },
  { code: '756', name: 'Sicoob', fullName: '756 - Banco Cooperativo do Brasil (Sicoob)', defaultWallet: '1' },
  { code: '748', name: 'Sicredi', fullName: '748 - Banco Cooperativo Sicredi S.A.', defaultWallet: '1' },
  { code: '422', name: 'Banco Safra', fullName: '422 - Banco Safra S.A.', defaultWallet: '01' },
  { code: '999', name: 'Outro Banco', fullName: '999 - Outra Instituição Financeira', defaultWallet: '1' },
];

export interface CondominiumBankSettings {
  // Dados Bancários
  bankCode: string;
  bankName: string;
  agency: string;
  agencyDigit: string;
  accountNumber: string;
  accountDigit: string;
  walletCode: string; // Carteira
  agreementCode: string; // Convênio / Código do Cedente / Beneficiário
  documentVariety: string; // Espécie (ex: DM, RC)

  // Beneficiário (Condomínio)
  beneficiaryName: string;
  beneficiaryCnpj: string;
  beneficiaryAddress: string;

  // Pix (Boleto Híbrido)
  pixKeyType: 'cnpj' | 'email' | 'telefone' | 'aleatoria';
  pixKey: string;
  pixMerchantName: string;
  pixMerchantCity: string;

  // Regras de Cobrança e Instruções
  penaltyPercent: number; // Multa % (padrão 2.0%)
  interestMonthlyPercent: number; // Juros % a.m. (padrão 1.0%)
  instructionsLine1: string;
  instructionsLine2: string;
  instructionsLine3: string;

  updatedAt: string;
  updatedBy?: string;
}

const STORAGE_KEY = 'condor_bank_settings_v1';

export const DEFAULT_BANK_SETTINGS: CondominiumBankSettings = {
  bankCode: '341',
  bankName: '341 - Banco Itaú S.A.',
  agency: '1234',
  agencyDigit: '5',
  accountNumber: '98765',
  accountDigit: '4',
  walletCode: '109',
  agreementCode: '4829104',
  documentVariety: 'DM',

  beneficiaryName: 'Condomínio Edifício Grand Condor Residencial',
  beneficiaryCnpj: '42.109.876/0001-35',
  beneficiaryAddress: 'Av. Paulista, 1500 - Bela Vista, São Paulo - SP, CEP 01310-100',

  pixKeyType: 'cnpj',
  pixKey: '42.109.876/0001-35',
  pixMerchantName: 'CONDOR RESIDENCIAL',
  pixMerchantCity: 'SAO PAULO',

  penaltyPercent: 2.0,
  interestMonthlyPercent: 1.0,
  instructionsLine1: 'Após o vencimento cobrar multa de 2% e juros de 1% ao mês.',
  instructionsLine2: 'Sr. Caixa, não receber após 30 dias do vencimento.',
  instructionsLine3: 'Pagável preferencialmente via QR Code Pix para liquidação instantânea.',

  updatedAt: new Date().toISOString(),
  updatedBy: 'Dra. Patrícia Lima (Síndica)',
};

export const bankAccountService = {
  getSettings(): CondominiumBankSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_BANK_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Erro ao carregar configurações bancárias do localStorage:', e);
    }
    return DEFAULT_BANK_SETTINGS;
  },

  saveSettings(settings: Partial<CondominiumBankSettings>, updatedBy?: string): CondominiumBankSettings {
    const current = this.getSettings();
    const updated: CondominiumBankSettings = {
      ...current,
      ...settings,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy || current.updatedBy,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Erro ao salvar configurações bancárias no localStorage:', e);
    }
    return updated;
  },

  resetSettings(): CondominiumBankSettings {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Erro ao resetar configurações bancárias:', e);
    }
    return DEFAULT_BANK_SETTINGS;
  },
};

// ==========================================
// UTILITÁRIOS: PIX EMVCO BR CODE (PAYLOAD)
// ==========================================

function emvField(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16Ccitt(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function generateOfficialPixPayload(params: {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount?: number;
  txid?: string;
  description?: string;
}): string {
  const cleanKey = params.pixKey.replace(/[^\w@.-]/g, '').trim() || params.pixKey.trim();
  const cleanName = (params.merchantName || 'CONDOMINIO CONDOR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(0, 25);
  const cleanCity = (params.merchantCity || 'SAO PAULO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(0, 15);
  const txid = (params.txid || 'CONDOR' + Math.floor(Math.random() * 899999 + 100000)).slice(0, 25);

  let mai = emvField('00', 'br.gov.bcb.pix');
  mai += emvField('01', cleanKey);
  if (params.description) {
    mai += emvField('02', params.description.slice(0, 40));
  }
  const maiField = emvField('26', mai);

  let raw = '';
  raw += emvField('00', '01'); // Payload Format Indicator
  raw += maiField;
  raw += emvField('52', '0000'); // Merchant Category Code
  raw += emvField('53', '986'); // Currency (986 = BRL)
  if (params.amount && params.amount > 0) {
    raw += emvField('54', params.amount.toFixed(2));
  }
  raw += emvField('58', 'BR'); // Country Code
  raw += emvField('59', cleanName); // Merchant Name
  raw += emvField('60', cleanCity); // Merchant City
  raw += emvField('62', emvField('05', txid)); // Additional Data Field
  raw += '6304'; // CRC16 placeholder

  const checksum = crc16Ccitt(raw);
  return `${raw}${checksum}`;
}

// ==========================================
// UTILITÁRIOS: CÓDIGO DE BARRAS & LINHA DIGITÁVEL
// ==========================================

function modulo10(bloco: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = bloco.length - 1; i >= 0; i--) {
    let mul = Number(bloco[i]) * peso;
    if (mul > 9) mul = Math.floor(mul / 10) + (mul % 10);
    soma += mul;
    peso = peso === 2 ? 1 : 2;
  }
  const resto = soma % 10;
  return resto === 0 ? 0 : 10 - resto;
}

export function generateBoletoNumbers(params: {
  bankCode: string;
  agency: string;
  account: string;
  wallet: string;
  amount: number;
  documentNumber: string;
}) {
  const bank = params.bankCode.padStart(3, '0').slice(0, 3);
  const currency = '9'; // 9 = Real (R$)
  const wallet = params.wallet.padStart(3, '0').slice(0, 3);
  const agency = params.agency.replace(/\D/g, '').padStart(4, '0').slice(0, 4);
  const account = params.account.replace(/\D/g, '').padStart(5, '0').slice(0, 5);
  
  // Limpa número doc para nosso número (8 dígitos)
  const docDigits = params.documentNumber.replace(/\D/g, '');
  const nossoNumero = (docDigits ? docDigits.padStart(8, '0') : '10928374').slice(-8);

  // Fator de vencimento arbitrário fixo de referência (ex: 9876) e valor em centavos (10 dígitos)
  const fatorVencimento = '9876';
  const valorCentavos = Math.round(params.amount * 100).toString().padStart(10, '0');

  // Campo 1: Banco (3) + Moeda (1) + Primeiros 5 do campo livre + DV
  const c1Base = `${bank}${currency}${wallet.slice(0, 2)}${nossoNumero.slice(0, 3)}`;
  const c1Dv = modulo10(c1Base);
  const campo1 = `${c1Base.slice(0, 5)}.${c1Base.slice(5)}${c1Dv}`;

  // Campo 2: Restante do Nosso Número + Agência + DV
  const c2Base = `${nossoNumero.slice(3)}${agency.slice(0, 4)}${account.slice(0, 1)}`;
  const c2Dv = modulo10(c2Base);
  const campo2 = `${c2Base.slice(0, 5)}.${c2Base.slice(5)}${c2Dv}`;

  // Campo 3: Restante da Conta + Carteira restante + DV
  const c3Base = `${account.slice(1, 5)}${wallet.slice(2)}${nossoNumero.slice(0, 5)}`;
  const c3Dv = modulo10(c3Base);
  const campo3 = `${c3Base.slice(0, 5)}.${c3Base.slice(5)}${c3Dv}`;

  // Campo 4: DV Geral do Código de Barras (ex: 1)
  const campo4 = '1';

  // Campo 5: Fator de vencimento (4) + Valor nominal (10)
  const campo5 = `${fatorVencimento}${valorCentavos}`;

  const linhaDigitavel = `${campo1} ${campo2} ${campo3} ${campo4} ${campo5}`;
  const codigoBarras = `${bank}${currency}${campo4}${fatorVencimento}${valorCentavos}${wallet}${nossoNumero}${agency}${account}`;

  return {
    linhaDigitavel,
    codigoBarras,
    nossoNumero: `${wallet}/${nossoNumero}-1`,
  };
}
