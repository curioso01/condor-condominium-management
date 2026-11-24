import { supabase, isSupabaseConfigured, isDemoSessionActive } from '../lib/supabase';
import { auditService } from './auditService';

export interface ReserveFundTransaction {
  id: string;
  date: string;
  description: string;
  type: 'aporte' | 'rendimento' | 'resgate';
  amount: number;
  fromAccount: string;
}

export interface ReserveFundData {
  balance: number;
  monthlyYield: number;
  bankName: string;
  cdiRate: string;
  accountType: string;
  yieldRateCdi: number;
  institution: string;
  targetTitle: string;
  targetAmount: number;
  history: ReserveFundTransaction[];
}

export interface OperationalExpense {
  id: string;
  category: string;
  supplier: string;
  description?: string;
  amount: number;
  dueDate: string;
  status: 'Pago' | 'Pendente' | 'Agendado' | 'A Vencer';
}

export interface AiDiagnosisData {
  predictedRecoveryAmount: number;
  energySavingsRate: number;
  trendDescription: string;
  punctualityDiscount: number;
  smartRuleActive: boolean;
  channels: {
    whatsapp: boolean;
    email: boolean;
    push: boolean;
    appPush?: boolean;
    sms?: boolean;
  };
  active?: boolean;
  delinquencyDropPercent?: number;
  projectedSavings?: number;
  autoWhatsappD3?: boolean;
  autoEmailD1?: boolean;
  autoPixLockD15?: boolean;
  customInsight?: string;
  lastScanAt?: string;
}

export interface ChannelMetricsData {
  appCount: number;
  totemCount: number;
  whatsappCount: number;
  interfoneCount: number;
  resolutionRate24h: number;
  satisfactionScore: number;
  npsScore?: number;
}

export interface AiEnergyData {
  percentage: number;
  kwhPerDay: number;
  monthlySavings: number;
  targetLocations: string;
  appliedToAllBlocks: boolean;
  monthlySavingsBrl?: number;
  efficiencyGainPercent?: number;
  activeAutomationsCount?: number;
  insightSummary?: string;
}

export interface CondominiumHealthData {
  managementScore: number;
  monthlyRevenueTarget: number;
  annualBudgetConsumed: number;
  annualBudgetTotal: number;
  fixedExpensesPercent: number;
  worksPercent: number;
  availablePercent: number;
  overallScore?: number;
  structuralScore?: number;
  financialScore?: number;
  securityScore?: number;
}

interface CondoFinancialBundle {
  reserveFund: ReserveFundData;
  expenses: OperationalExpense[];
  monthlyBudget: number;
  aiDiagnosis: AiDiagnosisData;
  channels: ChannelMetricsData;
  aiEnergy: AiEnergyData;
  health: CondominiumHealthData;
}

// Cache em memória estritamente isolado por condominiumId (NUNCA compartilhado entre condomínios)
const condoFinancialCache = new Map<string, CondoFinancialBundle>();

const DEMO_FIN_KEY_PREFIX = 'condor_demo_financial_';

function createCleanBundleForCondo(condominiumId: string): CondoFinancialBundle {
  const isDemoImperial = isDemoSessionActive() && condominiumId === 'condo-imperial-001';

  return {
    reserveFund: {
      balance: isDemoImperial ? 412300.84 : 0,
      monthlyYield: isDemoImperial ? 4280.15 : 0,
      bankName: 'Conta Reserva Condominial',
      cdiRate: '100% do CDI',
      accountType: 'Fundo Exclusivo Renda Fixa',
      yieldRateCdi: 100,
      institution: 'Conta Reserva Condominial',
      targetTitle: 'Meta Anual de Reserva',
      targetAmount: 100000,
      history: [],
    },
    expenses: [],
    monthlyBudget: isDemoImperial ? 145000 : 0,
    aiDiagnosis: {
      predictedRecoveryAmount: isDemoImperial ? 18450 : 0,
      energySavingsRate: isDemoImperial ? 14.2 : 0,
      trendDescription: 'Acompanhamento financeiro isolado por condomínio ativo.',
      punctualityDiscount: 5,
      smartRuleActive: true,
      channels: {
        whatsapp: true,
        email: true,
        push: true,
      },
      active: true,
      delinquencyDropPercent: 0,
      projectedSavings: 0,
      autoWhatsappD3: true,
      autoEmailD1: true,
      autoPixLockD15: false,
      customInsight: 'Acompanhamento financeiro isolado por condomínio ativo.',
      lastScanAt: 'Sincronizado',
    },
    channels: {
      appCount: isDemoImperial ? 142 : 0,
      totemCount: isDemoImperial ? 38 : 0,
      whatsappCount: isDemoImperial ? 64 : 0,
      interfoneCount: isDemoImperial ? 19 : 0,
      resolutionRate24h: isDemoImperial ? 94 : 100,
      satisfactionScore: isDemoImperial ? 4.8 : 5.0,
      npsScore: 95,
    },
    aiEnergy: {
      percentage: isDemoImperial ? 18 : 0,
      kwhPerDay: isDemoImperial ? 142 : 0,
      monthlySavings: isDemoImperial ? 3420 : 0,
      targetLocations: 'Garagens G1/G2 e Halls Sociais',
      appliedToAllBlocks: true,
      monthlySavingsBrl: isDemoImperial ? 3420 : 0,
      efficiencyGainPercent: isDemoImperial ? 18 : 0,
      activeAutomationsCount: 4,
      insightSummary: 'Monitoramento energético predial ativo para o condomínio selecionado.',
    },
    health: {
      managementScore: 98,
      monthlyRevenueTarget: isDemoImperial ? 145000 : 0,
      annualBudgetConsumed: isDemoImperial ? 840000 : 0,
      annualBudgetTotal: isDemoImperial ? 1740000 : 100000,
      fixedExpensesPercent: 55,
      worksPercent: 20,
      availablePercent: 25,
      overallScore: 98,
      structuralScore: 98,
      financialScore: 98,
      securityScore: 99,
    },
  };
}

function getOrInitBundle(condominiumId: string = ''): CondoFinancialBundle {
  if (!condominiumId) {
    return createCleanBundleForCondo('');
  }

  if (isDemoSessionActive()) {
    try {
      const raw = localStorage.getItem(`${DEMO_FIN_KEY_PREFIX}${condominiumId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as CondoFinancialBundle;
        condoFinancialCache.set(condominiumId, parsed);
        return parsed;
      }
    } catch {
      // ignore
    }
  }

  const existing = condoFinancialCache.get(condominiumId);
  if (existing) return existing;

  const created = createCleanBundleForCondo(condominiumId);
  condoFinancialCache.set(condominiumId, created);
  return created;
}

function saveDemoBundle(condominiumId: string, bundle: CondoFinancialBundle): void {
  if (!condominiumId) return;
  condoFinancialCache.set(condominiumId, bundle);
  if (isDemoSessionActive()) {
    try {
      localStorage.setItem(`${DEMO_FIN_KEY_PREFIX}${condominiumId}`, JSON.stringify(bundle));
    } catch {
      // ignore
    }
  }
}

export const financialDataService = {
  /**
   * Carrega do Supabase os parâmetros de Fundo de Reserva e Despesas Operacionais
   * exclusivos do condomínio informado.
   */
  async loadCondominiumFinancials(condominiumId: string): Promise<{
    reserveFund: ReserveFundData;
    expenses: OperationalExpense[];
    monthlyBudget: number;
    aiDiagnosis: AiDiagnosisData;
    channels: ChannelMetricsData;
    aiEnergy: AiEnergyData;
    health: CondominiumHealthData;
    error: { message: string } | null;
  }> {
    const clean = createCleanBundleForCondo(condominiumId);

    if (!condominiumId) {
      return { ...clean, error: null };
    }

    if (isDemoSessionActive()) {
      const demo = getOrInitBundle(condominiumId);
      return { ...demo, error: null };
    }

    if (!isSupabaseConfigured) {
      return { ...clean, error: { message: 'Supabase não configurado.' } };
    }

    try {
      const [configRes, expensesRes] = await Promise.all([
        (supabase.from('condominium_financial_config') as any)
          .select('*')
          .eq('condominium_id', condominiumId)
          .maybeSingle(),
        (supabase.from('operational_expenses') as any)
          .select('*')
          .eq('condominium_id', condominiumId)
          .order('due_date', { ascending: false }),
      ]);

      const cfg = configRes?.data;
      const expRows: any[] = expensesRes?.data || [];

      const balance = cfg ? Number(cfg.reserve_fund_balance ?? 0) : 0;
      const yieldRateCdi = cfg ? Number(cfg.reserve_fund_yield_rate ?? 100) : 100;
      const institution = cfg?.reserve_fund_institution || 'Conta Reserva Condominial';
      const monthlyBudgetVal = cfg ? Number(cfg.monthly_budget ?? 50000) : 0;

      const bundle: CondoFinancialBundle = {
        reserveFund: cfg
          ? {
              balance,
              monthlyYield: Number((balance * 0.0095 * (yieldRateCdi / 100)).toFixed(2)),
              bankName: institution,
              cdiRate: `${yieldRateCdi}% do CDI`,
              accountType: 'Fundo Exclusivo Renda Fixa',
              yieldRateCdi,
              institution,
              targetTitle: cfg.reserve_fund_target_title || 'Meta Anual de Reserva',
              targetAmount: Number(cfg.reserve_fund_target_amount ?? 100000),
              history: Array.isArray(cfg.reserve_fund_history) ? cfg.reserve_fund_history : [],
            }
          : clean.reserveFund,
        expenses: expRows.map((row) => ({
          id: row.id,
          category: row.category,
          supplier: row.supplier,
          description: row.description || row.supplier,
          amount: Number(row.amount),
          dueDate: row.due_date
            ? row.due_date.slice(0, 10).split('-').reverse().join('/')
            : '—',
          status: row.status || 'Pendente',
        })),
        monthlyBudget: monthlyBudgetVal,
        aiDiagnosis:
          cfg?.ai_diagnosis && typeof cfg.ai_diagnosis === 'object'
            ? { ...clean.aiDiagnosis, ...(cfg.ai_diagnosis as Partial<AiDiagnosisData>) }
            : clean.aiDiagnosis,
        channels:
          cfg?.channel_metrics && typeof cfg.channel_metrics === 'object'
            ? { ...clean.channels, ...(cfg.channel_metrics as Partial<ChannelMetricsData>) }
            : clean.channels,
        aiEnergy:
          cfg?.ai_energy && typeof cfg.ai_energy === 'object'
            ? { ...clean.aiEnergy, ...(cfg.ai_energy as Partial<AiEnergyData>) }
            : clean.aiEnergy,
        health:
          cfg?.health_metrics && typeof cfg.health_metrics === 'object'
            ? {
                ...clean.health,
                monthlyRevenueTarget: monthlyBudgetVal,
                ...(cfg.health_metrics as Partial<CondominiumHealthData>),
              }
            : {
                ...clean.health,
                monthlyRevenueTarget: monthlyBudgetVal,
              },
      };

      condoFinancialCache.set(condominiumId, bundle);
      return { ...bundle, error: null };
    } catch (err: any) {
      condoFinancialCache.set(condominiumId, clean);
      return {
        ...clean,
        error: { message: err?.message || 'Erro ao carregar indicadores financeiros do condomínio.' },
      };
    }
  },

  getReserveFund(condominiumId: string = ''): ReserveFundData {
    return getOrInitBundle(condominiumId).reserveFund;
  },

  async updateReserveFund(
    updated: ReserveFundData,
    condominiumId: string = ''
  ): Promise<{ data: ReserveFundData; error: { message: string } | null }> {
    const normalized: ReserveFundData = {
      ...updated,
      institution: updated.bankName || updated.institution || 'Conta Reserva Condominial',
      bankName: updated.bankName || updated.institution || 'Conta Reserva Condominial',
    };
    const bundle = { ...getOrInitBundle(condominiumId), reserveFund: normalized };
    saveDemoBundle(condominiumId, bundle);

    if (!isSupabaseConfigured || isDemoSessionActive() || !condominiumId) {
      return { data: normalized, error: null };
    }

    const { error } = await (supabase.from('condominium_financial_config') as any).upsert(
      {
        condominium_id: condominiumId,
        reserve_fund_balance: normalized.balance,
        reserve_fund_yield_rate: normalized.yieldRateCdi || 100,
        reserve_fund_institution: normalized.institution,
        reserve_fund_target_title: normalized.targetTitle,
        reserve_fund_target_amount: normalized.targetAmount,
        reserve_fund_history: normalized.history,
      },
      { onConflict: 'condominium_id' }
    );

    if (error) {
      return { data: normalized, error: { message: error.message } };
    }

    await auditService.log({
      condominiumId,
      action: 'RESERVE_FUND_UPDATED',
      entityTable: 'condominium_financial_config',
      metadata: { balance: normalized.balance, target_amount: normalized.targetAmount },
    });

    return { data: normalized, error: null };
  },

  async updateReserveFundAsync(
    updated: ReserveFundData,
    condominiumId: string = ''
  ): Promise<{ data: ReserveFundData; error: string | null }> {
    const res = await this.updateReserveFund(updated, condominiumId);
    return { data: res.data, error: res.error?.message || null };
  },

  async addReserveAporte(
    tx: Omit<ReserveFundTransaction, 'id' | 'type'>,
    condominiumId: string = ''
  ): Promise<{ data: ReserveFundData; error: { message: string } | null }> {
    const current = this.getReserveFund(condominiumId);
    const newTx: ReserveFundTransaction = {
      ...tx,
      id: `rf-${Date.now()}`,
      type: 'aporte',
    };
    const updated: ReserveFundData = {
      ...current,
      balance: Number((current.balance + tx.amount).toFixed(2)),
      history: [newTx, ...current.history],
    };
    return this.updateReserveFund(updated, condominiumId);
  },

  async addReserveAporteAsync(
    tx: Omit<ReserveFundTransaction, 'id' | 'type'>,
    condominiumId: string = ''
  ): Promise<{ data: ReserveFundData; error: string | null }> {
    const res = await this.addReserveAporte(tx, condominiumId);
    return { data: res.data, error: res.error?.message || null };
  },

  getExpenses(condominiumId: string = ''): OperationalExpense[] {
    return getOrInitBundle(condominiumId).expenses;
  },

  async addExpense(
    exp: Omit<OperationalExpense, 'id'>,
    condominiumId: string = ''
  ): Promise<{ data: OperationalExpense[]; error: { message: string } | null }> {
    const current = this.getExpenses(condominiumId);

    if (isDemoSessionActive()) {
      const newExp: OperationalExpense = { ...exp, id: `exp-${Date.now()}` };
      const updated = [newExp, ...current];
      saveDemoBundle(condominiumId, { ...getOrInitBundle(condominiumId), expenses: updated });
      return { data: updated, error: null };
    }

    if (!isSupabaseConfigured || !condominiumId) {
      return {
        data: current,
        error: { message: 'Cadastro de despesa bloqueado: Supabase não configurado.' },
      };
    }

    let isoDate = exp.dueDate;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(exp.dueDate)) {
      const [d, m, y] = exp.dueDate.split('/');
      isoDate = `${y}-${m}-${d}`;
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(exp.dueDate)) {
      isoDate = new Date().toISOString().slice(0, 10);
    }

    const dbStatus = exp.status === 'A Vencer' ? 'Pendente' : exp.status;

    const { data, error } = await (supabase.from('operational_expenses') as any)
      .insert({
        condominium_id: condominiumId,
        category: exp.category,
        supplier: exp.supplier,
        description: exp.description || exp.supplier,
        amount: exp.amount,
        due_date: isoDate,
        status: dbStatus,
      })
      .select('*')
      .single();

    if (error || !data) {
      return {
        data: current,
        error: {
          message: error?.message || 'Não foi possível salvar a despesa operacional no Supabase.',
        },
      };
    }

    const created: OperationalExpense = {
      id: data.id,
      category: data.category,
      supplier: data.supplier,
      description: data.description,
      amount: Number(data.amount),
      dueDate: exp.dueDate,
      status: data.status,
    };

    const updated = [created, ...current];
    condoFinancialCache.set(condominiumId, {
      ...getOrInitBundle(condominiumId),
      expenses: updated,
    });

    await auditService.log({
      condominiumId,
      action: 'OPERATIONAL_EXPENSE_CREATED',
      entityTable: 'operational_expenses',
      entityId: created.id,
      metadata: { supplier: created.supplier, amount: created.amount },
    });

    return { data: updated, error: null };
  },

  async addExpenseAsync(
    exp: Omit<OperationalExpense, 'id'>,
    condominiumId: string = ''
  ): Promise<{ data: OperationalExpense[]; error: string | null }> {
    const res = await this.addExpense(exp, condominiumId);
    return { data: res.data, error: res.error?.message || null };
  },

  async deleteExpense(
    id: string,
    condominiumId: string = ''
  ): Promise<{ data: OperationalExpense[]; error: { message: string } | null }> {
    const current = this.getExpenses(condominiumId);

    if (isDemoSessionActive()) {
      const updated = current.filter((e) => e.id !== id);
      saveDemoBundle(condominiumId, { ...getOrInitBundle(condominiumId), expenses: updated });
      return { data: updated, error: null };
    }

    if (!isSupabaseConfigured || !condominiumId) {
      return {
        data: current,
        error: { message: 'Exclusão de despesa bloqueada: Supabase não configurado.' },
      };
    }

    const { error } = await (supabase.from('operational_expenses') as any)
      .delete()
      .eq('id', id)
      .eq('condominium_id', condominiumId);

    if (error) {
      return { data: current, error: { message: error.message } };
    }

    const updated = current.filter((e) => e.id !== id);
    condoFinancialCache.set(condominiumId, {
      ...getOrInitBundle(condominiumId),
      expenses: updated,
    });
    return { data: updated, error: null };
  },

  async deleteExpenseAsync(
    id: string,
    condominiumId: string = ''
  ): Promise<{ data: OperationalExpense[]; error: string | null }> {
    const res = await this.deleteExpense(id, condominiumId);
    return { data: res.data, error: res.error?.message || null };
  },

  async toggleExpenseStatus(
    id: string,
    condominiumId: string = ''
  ): Promise<{ data: OperationalExpense[]; error: { message: string } | null }> {
    const current = this.getExpenses(condominiumId);
    const target = current.find((e) => e.id === id);
    if (!target) return { data: current, error: null };

    const nextStatus: 'Pago' | 'Pendente' = target.status === 'Pago' ? 'Pendente' : 'Pago';

    if (isDemoSessionActive()) {
      const updated = current.map((e) => (e.id === id ? { ...e, status: nextStatus } : e));
      saveDemoBundle(condominiumId, { ...getOrInitBundle(condominiumId), expenses: updated });
      return { data: updated, error: null };
    }

    if (!isSupabaseConfigured || !condominiumId) {
      return { data: current, error: { message: 'Supabase não configurado.' } };
    }

    const { error } = await (supabase.from('operational_expenses') as any)
      .update({ status: nextStatus })
      .eq('id', id)
      .eq('condominium_id', condominiumId);

    if (error) {
      return { data: current, error: { message: error.message } };
    }

    const updated = current.map((e) => (e.id === id ? { ...e, status: nextStatus } : e));
    condoFinancialCache.set(condominiumId, {
      ...getOrInitBundle(condominiumId),
      expenses: updated,
    });
    return { data: updated, error: null };
  },

  async updateMonthlyBudgetAsync(
    newBudget: number,
    condominiumId: string = ''
  ): Promise<{ error: string | null }> {
    const bundle = {
      ...getOrInitBundle(condominiumId),
      health: {
        ...getOrInitBundle(condominiumId).health,
        monthlyRevenueTarget: newBudget,
      },
    };
    if (isDemoSessionActive()) {
      saveDemoBundle(condominiumId, bundle);
      return { error: null };
    }
    if (!isSupabaseConfigured || !condominiumId) {
      return { error: 'Alteração de orçamento bloqueada: Supabase não configurado.' };
    }
    const { error } = await (supabase.from('condominium_financial_config') as any).upsert(
      { condominium_id: condominiumId, monthly_budget: newBudget },
      { onConflict: 'condominium_id' }
    );
    if (error) return { error: error.message };
    condoFinancialCache.set(condominiumId, bundle);
    return { error: null };
  },

  getAiDiagnosis(condominiumId: string = ''): AiDiagnosisData {
    return getOrInitBundle(condominiumId).aiDiagnosis;
  },

  async updateAiDiagnosisAsync(
    updated: AiDiagnosisData,
    condominiumId: string = ''
  ): Promise<{ data: AiDiagnosisData; error: string | null }> {
    const bundle = { ...getOrInitBundle(condominiumId), aiDiagnosis: updated };
    if (isDemoSessionActive()) {
      saveDemoBundle(condominiumId, bundle);
      return { data: updated, error: null };
    }
    if (!isSupabaseConfigured || !condominiumId) {
      return { data: updated, error: 'Supabase não configurado.' };
    }
    const { error } = await (supabase.from('condominium_financial_config') as any).upsert(
      { condominium_id: condominiumId, ai_diagnosis: updated },
      { onConflict: 'condominium_id' }
    );
    if (error) return { data: updated, error: error.message };
    condoFinancialCache.set(condominiumId, bundle);
    return { data: updated, error: null };
  },

  updateAiDiagnosis(updated: AiDiagnosisData, condominiumId: string = ''): AiDiagnosisData {
    void this.updateAiDiagnosisAsync(updated, condominiumId);
    return updated;
  },

  getChannels(condominiumId: string = ''): ChannelMetricsData {
    return getOrInitBundle(condominiumId).channels;
  },

  async updateChannelsAsync(
    updated: ChannelMetricsData,
    condominiumId: string = ''
  ): Promise<{ data: ChannelMetricsData; error: string | null }> {
    const bundle = { ...getOrInitBundle(condominiumId), channels: updated };
    if (isDemoSessionActive()) {
      saveDemoBundle(condominiumId, bundle);
      return { data: updated, error: null };
    }
    if (!isSupabaseConfigured || !condominiumId) {
      return { data: updated, error: 'Supabase não configurado.' };
    }
    const { error } = await (supabase.from('condominium_financial_config') as any).upsert(
      { condominium_id: condominiumId, channel_metrics: updated },
      { onConflict: 'condominium_id' }
    );
    if (error) return { data: updated, error: error.message };
    condoFinancialCache.set(condominiumId, bundle);
    return { data: updated, error: null };
  },

  updateChannels(updated: ChannelMetricsData, condominiumId: string = ''): ChannelMetricsData {
    void this.updateChannelsAsync(updated, condominiumId);
    return updated;
  },

  getAiEnergy(condominiumId: string = ''): AiEnergyData {
    return getOrInitBundle(condominiumId).aiEnergy;
  },

  async updateAiEnergyAsync(
    updated: AiEnergyData,
    condominiumId: string = ''
  ): Promise<{ data: AiEnergyData; error: string | null }> {
    const bundle = { ...getOrInitBundle(condominiumId), aiEnergy: updated };
    if (isDemoSessionActive()) {
      saveDemoBundle(condominiumId, bundle);
      return { data: updated, error: null };
    }
    if (!isSupabaseConfigured || !condominiumId) {
      return { data: updated, error: 'Supabase não configurado.' };
    }
    const { error } = await (supabase.from('condominium_financial_config') as any).upsert(
      { condominium_id: condominiumId, ai_energy: updated },
      { onConflict: 'condominium_id' }
    );
    if (error) return { data: updated, error: error.message };
    condoFinancialCache.set(condominiumId, bundle);
    return { data: updated, error: null };
  },

  updateAiEnergy(updated: AiEnergyData, condominiumId: string = ''): AiEnergyData {
    void this.updateAiEnergyAsync(updated, condominiumId);
    return updated;
  },

  getHealth(condominiumId: string = ''): CondominiumHealthData {
    return getOrInitBundle(condominiumId).health;
  },

  clearCache(): void {
    condoFinancialCache.clear();
  },

  downloadOfxFile(reserve: ReserveFundData): void {
    const txBlocks = (reserve.history || [])
      .map(
        (tx, idx) =>
          `<STMTTRN><TRNTYPE>${tx.type === 'resgate' ? 'DEBIT' : 'CREDIT'}</TRNTYPE><TRNAMT>${(
            tx.type === 'resgate' ? -Math.abs(tx.amount) : Math.abs(tx.amount)
          ).toFixed(2)}</TRNAMT><FITID>${tx.id || idx}</FITID><MEMO>${tx.description}</MEMO></STMTTRN>`
      )
      .join('\n');
    const ofx = `OFXHEADER:100\nDATA:OFXSGML\n<OFX>\n<BANKMSGSRSV1>\n<STMTTRNRS>\n<STMTRS>\n<BANKTRANLIST>\n${txBlocks}\n</BANKTRANLIST>\n<LEDGERBAL><BALAMT>${reserve.balance.toFixed(2)}</BALAMT></LEDGERBAL>\n</STMTRS>\n</STMTTRNRS>\n</BANKMSGSRSV1>\n</OFX>`;
    const blob = new Blob([ofx], { type: 'application/x-ofx;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Extrato_Reserva_${new Date().toISOString().slice(0, 10)}.ofx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  downloadConciliationCsv(
    rows: Array<{ date: string; description: string; document: string; amount: number; status: string }> = [],
    condominiumName: string = 'Condominio'
  ): void {
    const header = '\uFEFFCondominio;Data;Descricao;Documento;Valor (R$);Status\n';
    const body = rows
      .map(
        (r) =>
          `"${condominiumName}";"${r.date}";"${r.description}";"${r.document}";"${r.amount.toFixed(2)}";"${r.status}"`
      )
      .join('\n');
    const csvContent = header + body;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Conciliacao_Condor_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  downloadBalanceteCsv(reserve: ReserveFundData, expenses: OperationalExpense[]): void {
    const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
    const paidExpenses = expenses
      .filter((e) => e.status === 'Pago')
      .reduce((acc, e) => acc + e.amount, 0);

    const rows = [
      ['RELATORIO FINANCEIRO E BALANCETE MENSAL - CONDOR'],
      ['Data de Emissao', new Date().toLocaleDateString('pt-BR')],
      [],
      ['RESUMO DO FUNDO DE RESERVA'],
      ['Saldo Atual (R$)', reserve.balance.toFixed(2)],
      ['Instituicao Custodiante', reserve.institution],
      ['Rentabilidade (% CDI)', `${reserve.yieldRateCdi}%`],
      ['Meta Atual', reserve.targetTitle],
      ['Valor da Meta (R$)', reserve.targetAmount.toFixed(2)],
      [],
      ['DESPESAS OPERACIONAIS DO MES'],
      ['ID', 'Categoria', 'Fornecedor', 'Descricao', 'Vencimento', 'Status', 'Valor (R$)'],
      ...expenses.map((e) => [
        e.id,
        e.category,
        e.supplier,
        e.description || '',
        e.dueDate,
        e.status,
        e.amount.toFixed(2),
      ]),
      [],
      ['TOTAL DE DESPESAS LANCADAS (R$)', totalExpenses.toFixed(2)],
      ['TOTAL DE DESPESAS PAGAS (R$)', paidExpenses.toFixed(2)],
    ];

    const csvContent =
      '\uFEFF' + rows.map((r) => r.map((cell) => `"${cell ?? ''}"`).join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Balancete_Condor_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
