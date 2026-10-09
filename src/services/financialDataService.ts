// src/services/financialDataService.ts
// Centralized service for Condor Financial & Operational metrics with real reactivity and localStorage persistence

export interface ReserveAporte {
  id: string;
  amount: number;
  description: string;
  date: string;
  fromAccount: string;
}

export interface ReserveFundData {
  balance: number;
  monthlyYield: number;
  cdiRate: string;
  bankName: string;
  accountType: string;
  targetTitle: string;
  targetAmount: number;
  aportes: ReserveAporte[];
}

export interface OperationalExpense {
  id: string;
  supplier: string;
  category: 'Folha & Portaria' | 'Manutenção & Elevadores' | 'Concessionárias' | 'Outros';
  amount: number;
  dueDate: string;
  status: 'Pago' | 'A Vencer';
}

export interface AiDiagnosisData {
  predictedRecoveryAmount: number;
  energySavingsRate: number; // e.g. -6.2
  trendDescription: string;
  punctualityDiscount: number; // e.g. 5%
  smartRuleActive: boolean;
  channels: {
    whatsapp: boolean;
    appPush: boolean;
    sms: boolean;
    email: boolean;
  };
}

export interface ChannelMetricsData {
  appCount: number;
  totemCount: number;
  whatsappCount: number;
  interfoneCount: number;
  resolutionRate24h: number;
  satisfactionScore: number;
}

export interface AiEnergyData {
  percentage: number;
  kwhPerDay: number;
  monthlySavings: number;
  targetLocations: string;
  appliedToAllBlocks: boolean;
}

export interface CondominiumHealthData {
  monthlyRevenueTarget: number;
  annualBudgetTotal: number;
  annualBudgetConsumed: number;
  fixedExpensesPercent: number;
  worksPercent: number;
  availablePercent: number;
  managementScore: number;
}

const STORAGE_KEYS = {
  RESERVE_FUND: 'condor_reserve_fund_v1',
  OPERATIONAL_EXPENSES: 'condor_operational_expenses_v1',
  AI_DIAGNOSIS: 'condor_ai_diagnosis_v1',
  CHANNELS: 'condor_channel_metrics_v1',
  AI_ENERGY: 'condor_ai_energy_v1',
  HEALTH: 'condor_health_metrics_v1',
};

// Initial rich demo defaults
const DEFAULT_RESERVE_FUND: ReserveFundData = {
  balance: 412300.84,
  monthlyYield: 3840.20,
  cdiRate: '104.5% do CDI (11.85% a.a.)',
  bankName: 'Banco Itaú PJ',
  accountType: 'Conta Aplicação Automática',
  targetTitle: 'Meta para Reforma de Fachada',
  targetAmount: 470000.00,
  aportes: [
    {
      id: 'ap-1',
      amount: 15000,
      description: 'Aporte Ordinário Mensal (Fundo Reserva)',
      date: '05/10/2026',
      fromAccount: 'Conta Corrente Itaú PJ',
    },
  ],
};

const DEFAULT_EXPENSES: OperationalExpense[] = [
  { id: 'exp-1', supplier: 'Atlas Schindler', category: 'Manutenção & Elevadores', amount: 14500, dueDate: '15/10', status: 'A Vencer' },
  { id: 'exp-2', supplier: 'Protege Segurança', category: 'Folha & Portaria', amount: 8200, dueDate: '10/10', status: 'Pago' },
  { id: 'exp-3', supplier: 'Sabesp', category: 'Concessionárias', amount: 12450, dueDate: '18/10', status: 'A Vencer' },
  { id: 'exp-4', supplier: 'Enel SP', category: 'Concessionárias', amount: 10740, dueDate: '12/10', status: 'A Vencer' },
  { id: 'exp-5', supplier: 'Grupo Clean Portaria Remota', category: 'Folha & Portaria', amount: 70200, dueDate: '05/10', status: 'Pago' },
  { id: 'exp-6', supplier: 'Porto Seguro Condomínio', category: 'Outros', amount: 3800, dueDate: '20/10', status: 'A Vencer' },
  { id: 'exp-7', supplier: 'Sanitas Engenharia (Caixas d\'Água)', category: 'Manutenção & Elevadores', amount: 2400, dueDate: '22/10', status: 'A Vencer' },
  { id: 'exp-8', supplier: 'Jardinagem Verde Nobre', category: 'Outros', amount: 1900, dueDate: '08/10', status: 'Pago' },
  { id: 'exp-9', supplier: 'Dedetizadora Imuniza', category: 'Outros', amount: 1150, dueDate: '25/10', status: 'A Vencer' },
  { id: 'exp-10', supplier: 'PPA Service Portões', category: 'Manutenção & Elevadores', amount: 950, dueDate: '14/10', status: 'A Vencer' },
  { id: 'exp-11', supplier: 'Acquapura Piscinas', category: 'Manutenção & Elevadores', amount: 1650, dueDate: '07/10', status: 'Pago' },
  { id: 'exp-12', supplier: 'Stemac Geradores Preventiva', category: 'Manutenção & Elevadores', amount: 1200, dueDate: '21/10', status: 'A Vencer' },
  { id: 'exp-13', supplier: 'Inspeção Extintores FireShield', category: 'Manutenção & Elevadores', amount: 850, dueDate: '27/10', status: 'A Vencer' },
  { id: 'exp-14', supplier: 'Assessoria Contábil Silva & Prado', category: 'Outros', amount: 2300, dueDate: '10/10', status: 'Pago' },
  { id: 'exp-15', supplier: 'Tarifas Split & Cobrança Bancária', category: 'Outros', amount: 480, dueDate: '30/10', status: 'A Vencer' },
  { id: 'exp-16', supplier: 'TechVision Manutenção CFTV', category: 'Manutenção & Elevadores', amount: 920, dueDate: '16/10', status: 'A Vencer' },
  { id: 'exp-17', supplier: 'Almoxarifado & Limpeza Express', category: 'Outros', amount: 650, dueDate: '09/10', status: 'Pago' },
  { id: 'exp-18', supplier: 'Reserva Contingência Elétrica', category: 'Outros', amount: 500, dueDate: '30/10', status: 'A Vencer' },
];

const DEFAULT_AI_DIAGNOSIS: AiDiagnosisData = {
  predictedRecoveryAmount: 14280.00,
  energySavingsRate: -6.2,
  trendDescription: 'Identificamos tendência de atraso em 4 cotas para o dia 15. Recomendamos disparo preventivo automático de Pix com desconto de pontualidade.',
  punctualityDiscount: 5.0,
  smartRuleActive: false,
  channels: {
    whatsapp: true,
    appPush: true,
    sms: false,
    email: true,
  },
};

const DEFAULT_CHANNELS: ChannelMetricsData = {
  appCount: 843,
  totemCount: 437,
  whatsappCount: 188,
  interfoneCount: 94,
  resolutionRate24h: 92,
  satisfactionScore: 4.9,
};

const DEFAULT_AI_ENERGY: AiEnergyData = {
  percentage: 27,
  kwhPerDay: 18,
  monthlySavings: 1450.00,
  targetLocations: 'Pavimentos 4 ao 8 (Torres Sol & Mar)',
  appliedToAllBlocks: false,
};

const DEFAULT_HEALTH: CondominiumHealthData = {
  monthlyRevenueTarget: 145000.00,
  annualBudgetTotal: 1700000.00,
  annualBudgetConsumed: 1180000.00,
  fixedExpensesPercent: 55,
  worksPercent: 14,
  availablePercent: 31,
  managementScore: 96,
};

function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn(`[financialDataService] Erro ao ler ${key}:`, e);
  }
  return defaultValue;
}

function setStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`[financialDataService] Erro ao salvar ${key}:`, e);
  }
}

export const financialDataService = {
  // 1. Fundo de Reserva
  getReserveFund(): ReserveFundData {
    return getStorageItem(STORAGE_KEYS.RESERVE_FUND, DEFAULT_RESERVE_FUND);
  },

  updateReserveFund(data: ReserveFundData): void {
    setStorageItem(STORAGE_KEYS.RESERVE_FUND, data);
  },

  addReserveAporte(aporte: Omit<ReserveAporte, 'id'>): ReserveFundData {
    const current = this.getReserveFund();
    const newAporte: ReserveAporte = {
      ...aporte,
      id: `ap-${Date.now()}`,
    };
    const updated: ReserveFundData = {
      ...current,
      balance: current.balance + aporte.amount,
      aportes: [newAporte, ...current.aportes],
    };
    this.updateReserveFund(updated);
    return updated;
  },

  // 2. Despesas Operacionais
  getExpenses(): OperationalExpense[] {
    return getStorageItem(STORAGE_KEYS.OPERATIONAL_EXPENSES, DEFAULT_EXPENSES);
  },

  updateExpenses(expenses: OperationalExpense[]): void {
    setStorageItem(STORAGE_KEYS.OPERATIONAL_EXPENSES, expenses);
  },

  addExpense(expense: Omit<OperationalExpense, 'id'>): OperationalExpense[] {
    const current = this.getExpenses();
    const newExp: OperationalExpense = {
      ...expense,
      id: `exp-${Date.now()}`,
    };
    const updated = [newExp, ...current];
    this.updateExpenses(updated);
    return updated;
  },

  deleteExpense(id: string): OperationalExpense[] {
    const current = this.getExpenses();
    const updated = current.filter((e) => e.id !== id);
    this.updateExpenses(updated);
    return updated;
  },

  // 3. CONDOR AI Diagnóstico
  getAiDiagnosis(): AiDiagnosisData {
    return getStorageItem(STORAGE_KEYS.AI_DIAGNOSIS, DEFAULT_AI_DIAGNOSIS);
  },

  updateAiDiagnosis(data: AiDiagnosisData): void {
    setStorageItem(STORAGE_KEYS.AI_DIAGNOSIS, data);
  },

  // 4. Canais de Abertura
  getChannels(): ChannelMetricsData {
    return getStorageItem(STORAGE_KEYS.CHANNELS, DEFAULT_CHANNELS);
  },

  updateChannels(data: ChannelMetricsData): void {
    setStorageItem(STORAGE_KEYS.CHANNELS, data);
  },

  incrementChannel(channel: 'app' | 'totem' | 'whatsapp' | 'interfone'): ChannelMetricsData {
    const current = this.getChannels();
    const updated = { ...current };
    if (channel === 'app') updated.appCount += 1;
    if (channel === 'totem') updated.totemCount += 1;
    if (channel === 'whatsapp') updated.whatsappCount += 1;
    if (channel === 'interfone') updated.interfoneCount += 1;
    this.updateChannels(updated);
    return updated;
  },

  // 5. Economia de Energia IA
  getAiEnergy(): AiEnergyData {
    return getStorageItem(STORAGE_KEYS.AI_ENERGY, DEFAULT_AI_ENERGY);
  },

  updateAiEnergy(data: AiEnergyData): void {
    setStorageItem(STORAGE_KEYS.AI_ENERGY, data);
  },

  // 6. Saúde Financeira & Auditoria
  getHealth(): CondominiumHealthData {
    return getStorageItem(STORAGE_KEYS.HEALTH, DEFAULT_HEALTH);
  },

  updateHealth(data: CondominiumHealthData): void {
    setStorageItem(STORAGE_KEYS.HEALTH, data);
  },

  // 7. OFX Bank Statement Generator & Downloader
  downloadOfxFile(reserve: ReserveFundData): void {
    const today = new Date();
    const dateFormatted = today.toISOString().slice(0, 10).replace(/-/g, '');
    const timeFormatted = '120000[-03:EST]';

    const transItems = reserve.aportes.map((ap, idx) => {
      return `
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>${dateFormatted}
<TRNAMT>${ap.amount.toFixed(2)}
<FITID>APORTE-${idx + 1}-${dateFormatted}
<CHECKNUM>${1000 + idx}
<MEMO>${ap.description} (${ap.fromAccount})
</STMTTRN>`;
    }).join('');

    const ofxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLFILEHND:IN
<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>${dateFormatted}${timeFormatted}
<LANGUAGE>POR
<FI>
<ORG>BANCO ITAU SA
<FID>341
</FI>
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1001
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>341
<ACCTID>04928-1
<ACCTTYPE>SAVINGS
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>${dateFormatted}
<DTEND>${dateFormatted}
${transItems}
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>${reserve.balance.toFixed(2)}
<DTASOF>${dateFormatted}
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

    const blob = new Blob([ofxContent], { type: 'application/x-ofx;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extrato_reserva_condor_${dateFormatted}.ofx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // 8. Balancete CSV Generator & Downloader
  downloadBalanceteCsv(reserve: ReserveFundData, expenses: OperationalExpense[]): void {
    const todayStr = new Date().toLocaleDateString('pt-BR');
    const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);

    let csv = `BALANCETE MENSAL - CONDOMÍNIO RESERVA IMPERIAL\n`;
    csv += `Data de Emissão:;${todayStr}\n\n`;
    csv += `FUNDO DE RESERVA & INVESTIMENTOS\n`;
    csv += `Instituição:;${reserve.bankName}\n`;
    csv += `Saldo Atual:;R$ ${reserve.balance.toFixed(2).replace('.', ',')}\n`;
    csv += `Rendimento Líquido:;R$ ${reserve.monthlyYield.toFixed(2).replace('.', ',')}\n`;
    csv += `Meta do Fundo (${reserve.targetTitle}):;R$ ${reserve.targetAmount.toFixed(2).replace('.', ',')}\n\n`;

    csv += `DESPESAS OPERACIONAIS (${expenses.length} Fornecedores)\n`;
    csv += `Fornecedor;Categoria;Valor (R$);Vencimento;Status\n`;
    expenses.forEach((e) => {
      csv += `${e.supplier};${e.category};${e.amount.toFixed(2).replace('.', ',')};${e.dueDate};${e.status}\n`;
    });
    csv += `TOTAL DESPESAS:;;R$ ${totalExpenses.toFixed(2).replace('.', ',')};;\n`;

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `balancete_financeiro_condor_${todayStr.replace(/\//g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // 9. Conciliação Bancária CSV Downloader
  downloadConciliationCsv(): void {
    const todayStr = new Date().toLocaleDateString('pt-BR');
    let csv = `RELATÓRIO DE CONCILIAÇÃO BANCÁRIA OPEN FINANCE\n`;
    csv += `Data:;${todayStr}\n`;
    csv += `Conta Corrente Itaú PJ:;Ag 0492 C/C 19482-1\n`;
    csv += `Status da Conciliação:;100% Conciliado (R$ 0,00 de divergência)\n\n`;
    csv += `Data Lançamento;Descrição;Documento;Valor (R$);Status Conciliação\n`;
    csv += `05/10/2026;Recebimento Cotas Condominiais Pix Lote A;PIX-84920;94280,00;Conciliado Automático\n`;
    csv += `06/10/2026;Recebimento Cotas Condominiais Boleto Lote B;BOL-19283;48520,00;Conciliado Automático\n`;
    csv += `07/10/2026;Pgto Grupo Clean Portaria Remota;TED-93021;-70200,00;Conciliado Automático\n`;
    csv += `08/10/2026;Pgto Sabesp & Enel Água/Energia;DEB-48192;-23190,00;Conciliado Automático\n`;
    csv += `09/10/2026;Rendimento Aplicação Fundo de Reserva;APL-00291;3840,20;Conciliado Automático\n`;

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conciliacao_bancaria_condor_${todayStr.replace(/\//g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
