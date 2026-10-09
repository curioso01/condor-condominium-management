import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { mockInvoices } from '../../services/mockData';
import type { Invoice, Unit } from '../../types/condominium';
import { useAuth } from '../../contexts/AuthContext';
import { invoiceService } from '../../services/invoiceService';
import { unitService } from '../../services/unitService';
import { CreateInvoiceModal, type InvoiceSubmitPayload } from './CreateInvoiceModal';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { DynamicTelemetryChart } from '../common/DynamicTelemetryChart';
import { CheckCircle2, AlertCircle, Database, RefreshCw, FileText, Sliders, Edit, Plus, Download } from 'lucide-react';
import { financialDataService, type ReserveFundData, type OperationalExpense, type AiDiagnosisData } from '../../services/financialDataService';
import { ReserveFundModal } from './ReserveFundModal';
import { BankConciliationModal } from './BankConciliationModal';
import { AiSmartRuleModal } from './AiSmartRuleModal';
import { OperationalExpensesModal } from './OperationalExpensesModal';

export const FinancialView: React.FC = () => {
  const { currentCondominium } = useAuth();

  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMockMode, setIsMockMode] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [blockFilter, setBlockFilter] = useState<'Todos' | 'Bloco A' | 'Bloco B' | 'Atrasados'>('Todos');
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [copiedPixId, setCopiedPixId] = useState<string | null>(null);
  const [busyInvoiceId, setBusyInvoiceId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalInitialSelection, setModalInitialSelection] = useState<'all' | 'none'>('all');

  // Interactive Financial Datasets & Modals
  const [reserveFund, setReserveFund] = useState<ReserveFundData>(() => financialDataService.getReserveFund());
  const [expenses, setExpenses] = useState<OperationalExpense[]>(() => financialDataService.getExpenses());
  const [monthlyBudget, setMonthlyBudget] = useState(145000);
  const [aiDiagnosis, setAiDiagnosis] = useState<AiDiagnosisData>(() => financialDataService.getAiDiagnosis());

  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
  const [isConciliationModalOpen, setIsConciliationModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isExpensesModalOpen, setIsExpensesModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentCondominium?.id) return;
    setIsLoading(true);

    const [unitsRes, invoicesRes] = await Promise.all([
      unitService.getUnitsByCondominium(currentCondominium.id),
      invoiceService.getInvoicesByCondominium(currentCondominium.id),
    ]);

    setIsLoading(false);

    if (unitsRes.data) {
      setUnits(unitsRes.data);
    }

    if (invoicesRes.error) {
      if (invoicesRes.error.tableMissing) {
        setTableMissing(true);
        setIsMockMode(true);
        setInvoices(mockInvoices);
      } else {
        setNotification({
          type: 'error',
          message: `Erro ao buscar cobranças: ${invoicesRes.error.message}`,
        });
        setIsMockMode(true);
        setInvoices(mockInvoices);
      }
    } else {
      setTableMissing(false);
      setIsMockMode(false);
      setInvoices(invoicesRes.data);
    }
  }, [currentCondominium?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered dataset for table
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (blockFilter === 'Bloco A') return inv.block === 'Bloco A';
      if (blockFilter === 'Bloco B') return inv.block === 'Bloco B';
      if (blockFilter === 'Atrasados') return inv.status === 'overdue';
      return true;
    });
  }, [invoices, blockFilter]);

  // Aggregate metrics for Card 1
  const stats = useMemo(() => {
    const totalAmount = invoices.reduce((acc, i) => acc + i.amount, 0);
    const paidInvoices = invoices.filter((i) => i.status === 'liquidated' || i.status === 'advance');
    const paidAmount = paidInvoices.reduce((acc, i) => acc + i.amount, 0);
    const overdueInvoices = invoices.filter((i) => i.status === 'overdue');
    const overdueAmount = overdueInvoices.reduce((acc, i) => acc + i.amount, 0);
    const pendingInvoices = invoices.filter((i) => i.status === 'due_today' || i.status === 'upcoming');
    const pendingAmount = pendingInvoices.reduce((acc, i) => acc + i.amount, 0);
    const rate = invoices.length > 0 ? (paidInvoices.length / invoices.length) * 100 : 0;

    return {
      totalAmount,
      paidAmount,
      overdueAmount,
      pendingAmount,
      paidCount: paidInvoices.length,
      totalCount: invoices.length,
      rate: rate.toFixed(1),
    };
  }, [invoices]);

  const handleToggleSelectAll = () => {
    if (selectedInvoices.length === filteredInvoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(filteredInvoices.map((inv) => inv.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedInvoices((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCopyPix = (id: string, code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedPixId(id);
    setTimeout(() => setCopiedPixId(null), 2500);
  };

  const handleWhatsAppReminder = async (inv: Invoice) => {
    const text = `Olá, ${inv.residentName}! Lembramos sobre a cota condominial (${inv.description}) do Apto ${inv.unitNumber} (${inv.block}) no valor de R$ ${inv.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, com vencimento em ${inv.dueDate}.\n\nChave/Código Pix para pagamento:\n${inv.pixCode}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');

    if (!isMockMode) {
      await invoiceService.markReminderSent(inv.id);
      setInvoices((prev) =>
        prev.map((i) => (i.id === inv.id ? { ...i, whatsappReminderSent: true } : i))
      );
    }
    setNotification({
      type: 'success',
      message: `Lembrete aberto no WhatsApp para ${inv.residentName} (${inv.unitNumber})!`,
    });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleMarkPaid = async (inv: Invoice) => {
    if (isMockMode) return;
    setBusyInvoiceId(inv.id);
    const { error } = await invoiceService.markAsPaid(inv.id);
    setBusyInvoiceId(null);

    if (error) {
      setNotification({ type: 'error', message: error.message });
      setTimeout(() => setNotification(null), 5000);
      return;
    }

    setNotification({
      type: 'success',
      message: `Baixa realizada com sucesso para o Apto ${inv.unitNumber}!`,
    });
    setTimeout(() => setNotification(null), 4000);

    setInvoices((prev) =>
      prev.map((i) =>
        i.id === inv.id
          ? {
              ...i,
              status: 'liquidated',
              statusLabel: 'Liquidado',
              pixAuthenticated: true,
              paidAtIso: new Date().toISOString(),
            }
          : i
      )
    );
  };

  const handleCreateInvoices = async (payload: InvoiceSubmitPayload): Promise<{ success: boolean; error?: string }> => {
    if (!currentCondominium?.id) return { success: false, error: 'Condomínio não selecionado.' };
    if (isMockMode) {
      return {
        success: false,
        error: 'Execute a migration 03 no Supabase para habilitar a emissão de cobranças no banco de dados.',
      };
    }

    const { created, skipped, error } = await invoiceService.createInvoiceBatch({
      condominium_id: currentCondominium.id,
      description: payload.description,
      amount: payload.amount,
      dueDateIso: payload.dueDateIso,
      targets: payload.targets,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    let msg = `${created} ${created === 1 ? 'boleto emitido' : 'boletos emitidos'} com sucesso!`;
    if (skipped > 0) {
      msg += ` (${skipped} ignorado${skipped > 1 ? 's' : ''} pois já existia${skipped > 1 ? 'm' : ''}).`;
    }
    setNotification({ type: 'success', message: msg });
    setTimeout(() => setNotification(null), 5000);

    await loadData();
    return { success: true };
  };

  const handleBulkRemittance = () => {
    const cnabContent = `01REMESSA01COBRANCA       0341BANCO ITAU S.A.   ${new Date().toISOString().slice(0, 10)}\n` +
      selectedInvoices.map((id, idx) => `1${String(idx + 1).padStart(6, '0')}${id.slice(0, 10)}`).join('\n');
    const blob = new Blob([cnabContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CB${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.REM`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotification({
      type: 'success',
      message: `Arquivo de Remessa CNAB 240 baixado para ${selectedInvoices.length} boletos!`,
    });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleExportBalancete = () => {
    financialDataService.downloadBalanceteCsv(reserveFund, expenses);
    setNotification({
      type: 'success',
      message: 'Download do Balancete Mensal (CSV) concluído com sucesso!',
    });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleAddAporte = (amount: number, description: string, fromAccount: string) => {
    const updated = financialDataService.addReserveAporte({
      amount,
      description,
      date: new Date().toLocaleDateString('pt-BR'),
      fromAccount,
    });
    setReserveFund(updated);
    setNotification({
      type: 'success',
      message: `Aporte de R$ ${amount.toLocaleString('pt-BR')} adicionado ao Fundo de Reserva!`,
    });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleUpdateReserveParams = (updated: ReserveFundData) => {
    financialDataService.updateReserveFund(updated);
    setReserveFund(updated);
    setNotification({
      type: 'success',
      message: 'Parâmetros e metas do Fundo de Reserva atualizados!',
    });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleUpdateAiDiagnosis = (updated: AiDiagnosisData) => {
    financialDataService.updateAiDiagnosis(updated);
    setAiDiagnosis(updated);
    setNotification({
      type: 'success',
      message: 'Diagnóstico CONDOR AI e Régua Inteligente atualizados!',
    });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleAddExpense = (exp: Omit<OperationalExpense, 'id'>) => {
    const updated = financialDataService.addExpense(exp);
    setExpenses(updated);
    setNotification({
      type: 'success',
      message: `Despesa com ${exp.supplier} adicionada com sucesso!`,
    });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleDeleteExpense = (id: string) => {
    const updated = financialDataService.deleteExpense(id);
    setExpenses(updated);
    setNotification({
      type: 'info',
      message: 'Despesa removida do orçamento operacional.',
    });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleUpdateBudget = (newBudget: number) => {
    setMonthlyBudget(newBudget);
    setNotification({
      type: 'success',
      message: `Teto orçamentário mensal atualizado para R$ ${newBudget.toLocaleString('pt-BR')}!`,
    });
    setTimeout(() => setNotification(null), 4000);
  };

  const currentMonthName = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const formattedCompetence = `Competência ${currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1)}`;

  // Derived dynamic calculations
  const totalExpenses = useMemo(() => expenses.reduce((acc, e) => acc + e.amount, 0), [expenses]);
  const budgetPct = monthlyBudget > 0 ? Math.round((totalExpenses / monthlyBudget) * 100) : 0;
  const folhaTotal = useMemo(() => expenses.filter((e) => e.category === 'Folha & Portaria').reduce((acc, e) => acc + e.amount, 0), [expenses]);
  const folhaPct = totalExpenses > 0 ? Math.round((folhaTotal / totalExpenses) * 100) : 0;
  const manutencaoTotal = useMemo(() => expenses.filter((e) => e.category === 'Manutenção & Elevadores').reduce((acc, e) => acc + e.amount, 0), [expenses]);
  const manutencaoPct = totalExpenses > 0 ? Math.round((manutencaoTotal / totalExpenses) * 100) : 0;
  const concessionariasTotal = useMemo(() => expenses.filter((e) => e.category === 'Concessionárias').reduce((acc, e) => acc + e.amount, 0), [expenses]);
  const concessionariasPct = totalExpenses > 0 ? Math.round((concessionariasTotal / totalExpenses) * 100) : 0;
  const reserveGoalPct = Math.min(100, Math.round((reserveFund.balance / (reserveFund.targetAmount || 1)) * 100));

  return (
    <div className="flex flex-col gap-5 pb-6 min-w-0" data-purpose="financial-view">
      {/* Top Banner / Pill Tabs */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-1">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Gestão Financeira & Arrecadação
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Conciliação bancária automática, controle de inadimplência e régua inteligente
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={handleExportBalancete}
            className="px-4 py-2 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            Exportar Balancete
          </button>
          <button 
            type="button"
            onClick={() => {
              setModalInitialSelection('all');
              setIsCreateModalOpen(true);
            }}
            className="px-4 py-2 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-pill hover:bg-emerald-700 transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
          >
            <span>+</span> Emitir Boletos em Lote
          </button>
        </div>
      </div>

      {/* Toast Notification Banner */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3.5 rounded-2xl flex items-center justify-between text-xs font-semibold animate-fadeIn ${
            notification.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : notification.type === 'error'
              ? 'bg-rose-50 border border-rose-200 text-rose-800'
              : 'bg-sky-50 border border-sky-200 text-sky-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-sky-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100 ml-4 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Migration Missing Banner */}
      {tableMissing && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center shrink-0 text-amber-700 dark:text-amber-300">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold">Tabela de cobranças ainda não criada no Supabase</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300/80">
                Execute a migration <code className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 font-mono font-bold">20261005000003_invoices.sql</code> no SQL Editor do Supabase para ativar dados reais e persistência. Exibindo dados de demonstração.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="px-3 py-1.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Recarregar</span>
          </button>
        </div>
      )}

      {/* Bento Grid Container */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5" data-purpose="bento-grid">
        {/* BENTO CARD 1: Resumo de Receita & Distribuição */}
        <section className="md:col-span-12 lg:col-span-4 bg-white rounded-3xl p-6 shadow-bento border border-slate-100 flex flex-col justify-between relative overflow-hidden group hover:shadow-bento-hover transition-all duration-300">
          <div>
            <div className="flex items-start justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" aria-hidden="true"></span>
                  {formattedCompetence}
                </div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Arrecadação Mensal
                </h3>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                    {stats.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    ↑ +8.4%
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-emerald-600 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
              </div>
            </div>

            {/* Progress breakdown */}
            <div className="my-6">
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className="text-slate-600">Taxa de Liquidação de Boletos</span>
                <span className="font-extrabold text-slate-900 tabular-nums">
                  {stats.rate}% <span className="text-slate-400 font-normal">({stats.paidCount}/{stats.totalCount} aptos)</span>
                </span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex gap-1 p-0.5">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all"
                  style={{ width: `${stats.totalAmount > 0 ? (stats.paidAmount / stats.totalAmount) * 100 : 86}%` }}
                  title="Boletos Pagos no Prazo"
                ></div>
                <div
                  className="h-full bg-amber-400 rounded-full transition-all"
                  style={{ width: `${stats.totalAmount > 0 ? (stats.pendingAmount / stats.totalAmount) * 100 : 10.8}%` }}
                  title="A Vencer / Acordo"
                ></div>
                <div
                  className="h-full bg-rose-500 rounded-full transition-all"
                  style={{ width: `${stats.totalAmount > 0 ? (stats.overdueAmount / stats.totalAmount) * 100 : 3.2}%` }}
                  title="Inadimplência"
                ></div>
              </div>
              <div className="flex items-center justify-between mt-3 text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" aria-hidden="true"></span>
                  <span>Em dia: <b className="tabular-nums">{stats.paidAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" aria-hidden="true"></span>
                  <span>A Vencer: <b className="tabular-nums">{stats.pendingAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" aria-hidden="true"></span>
                  <span>Atraso: <b className="tabular-nums">{stats.overdueAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">Meta condominial: 95%</span>
            <button 
              type="button"
              onClick={() => setIsConciliationModalOpen(true)}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1 group/btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg px-1.5 py-0.5 cursor-pointer"
            >
              Emitir Conciliação
              <svg className="w-3.5 h-3.5 transform group-hover/btn:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8.25 4.5l7.5 7.5-7.5 7.5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
              </svg>
            </button>
          </div>
        </section>

        {/* BENTO CARD 2: Gráfico Principal de Fluxo & Arrecadação */}
        <section className="md:col-span-12 lg:col-span-8 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-bento border border-slate-100 dark:border-slate-800 flex flex-col justify-between group hover:shadow-bento-hover transition-all duration-300">
          <DynamicTelemetryChart
            title="Fluxo Dinâmico de Arrecadação & Receita"
            subtitle="Comparativo dinâmico entre arrecadação liquidada e receita orçamentária"
            primaryLabel="Receita Liquidada (Atual)"
            secondaryLabel="Meta Orçada / Mês Anterior"
            primaryColor="#0D9488"
            secondaryColor="#F59E0B"
            valueFormatter={(v) => `R$ ${v.toLocaleString('pt-BR')}`}
            defaultPeriod="mes"
            height={205}
            unitLabel=""
          />
        </section>

        {/* BENTO CARD 3: Fundo de Reserva & Obras */}
        <section className="md:col-span-12 lg:col-span-4 bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 dark:bg-none dark:bg-slate-900 text-white rounded-3xl p-6 shadow-lg shadow-emerald-900/10 dark:shadow-bento flex flex-col justify-between relative overflow-hidden border border-emerald-400/30 dark:border-transparent group hover:shadow-2xl transition-all duration-300">
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-emerald-400/20 dark:bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 dark:bg-slate-800 border border-white/25 dark:border-slate-700 text-white dark:text-emerald-400 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 dark:bg-emerald-400 animate-pulse" aria-hidden="true"></span>
                {reserveFund.accountType}
              </span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-emerald-100 dark:text-slate-400 font-medium">{reserveFund.bankName}</span>
                <button
                  type="button"
                  onClick={() => setIsReserveModalOpen(true)}
                  className="p-1 text-emerald-200 hover:text-white hover:bg-white/20 rounded-lg transition cursor-pointer"
                  title="Editar Parâmetros do Fundo"
                >
                  <Edit className="w-3 h-3" />
                </button>
              </div>
            </div>
            <h3 className="text-xs font-semibold text-emerald-100 dark:text-slate-400 uppercase tracking-wider">
              Fundo de Reserva & Obras
            </h3>
            <div className="text-3xl font-extrabold tracking-tight mt-1 text-white tabular-nums">
              {reserveFund.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <div className="mt-4 p-3.5 bg-white/15 dark:bg-slate-800/80 rounded-2xl border border-white/20 dark:border-slate-700/60 backdrop-blur-md dark:backdrop-blur-sm">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-100 dark:text-slate-400">Rendimento Mensal Líquido</span>
                <span className="font-bold text-white dark:text-emerald-400 tabular-nums">
                  + {reserveFund.monthlyYield.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1.5">
                <span className="text-emerald-100 dark:text-slate-400">Rentabilidade Atual</span>
                <span className="font-semibold text-white dark:text-slate-200">{reserveFund.cdiRate}</span>
              </div>
            </div>
          </div>

          <div className="my-5 relative z-10">
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="text-white dark:text-slate-300 font-medium">{reserveFund.targetTitle}</span>
              <span className="font-extrabold text-white dark:text-emerald-400">
                {reserveGoalPct}% <span className="text-emerald-200 dark:text-slate-400 font-normal">/ {reserveFund.targetAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </span>
            </div>
            <div className="w-full h-2.5 bg-black/15 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
              <div className="h-full bg-emerald-300 dark:bg-gradient-to-r dark:from-emerald-500 dark:to-emerald-400 rounded-full shadow-[0_0_8px_rgba(110,231,183,0.7)] dark:shadow-none transition-all" style={{ width: `${reserveGoalPct}%` }}></div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 relative z-10">
            <button 
              type="button"
              onClick={() => setIsReserveModalOpen(true)}
              className="flex-1 py-2.5 px-4 rounded-full bg-white hover:bg-emerald-50 text-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:text-white font-bold text-xs transition-all shadow-md dark:shadow-pill flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
            >
              <span>+</span> Aporte Adicional
            </button>
            <button 
              type="button"
              onClick={() => {
                financialDataService.downloadOfxFile(reserveFund);
                setNotification({ type: 'success', message: 'Download do extrato bancário OFX concluído!' });
              }}
              className="py-2.5 px-3.5 rounded-full bg-white/20 hover:bg-white/30 dark:bg-slate-800 dark:hover:bg-slate-700 text-white dark:text-slate-300 dark:hover:text-white border border-white/25 dark:border-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
            >
              Extrato OFX
            </button>
          </div>
        </section>

        {/* BENTO CARD 4: CONDOR AI • Diagnóstico Financeiro */}
        <section className="md:col-span-12 lg:col-span-4 bg-gradient-to-br from-teal-700 via-emerald-700 to-teal-800 dark:from-teal-900 dark:via-slate-900 dark:to-slate-950 text-white rounded-3xl p-6 shadow-lg shadow-emerald-900/10 dark:shadow-bento relative overflow-hidden flex flex-col justify-between border border-teal-500/30 dark:border-teal-800/40">
          <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-teal-400/20 rounded-full blur-3xl pointer-events-none dark:hidden" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 dark:bg-emerald-500/20 border border-white/25 dark:border-emerald-400/30 text-white dark:text-emerald-300 text-[10px] font-extrabold uppercase tracking-widest">
                CONDOR AI • Diagnóstico
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-teal-100 dark:text-teal-200/60 font-semibold">Previsão 60 dias</span>
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(true)}
                  className="p-1 text-teal-200 hover:text-white hover:bg-white/20 rounded-lg transition cursor-pointer"
                  title="Configurar Diagnóstico & Régua"
                >
                  <Sliders className="w-3 h-3" />
                </button>
              </div>
            </div>
            <h3 className="text-base font-bold text-white tracking-tight mt-2">Redução Preditiva de Inadimplência</h3>
            <p className="text-xs text-teal-100 dark:text-teal-100/75 mt-1.5 leading-relaxed">
              {aiDiagnosis.trendDescription}
            </p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-white/15 dark:bg-black/30 rounded-2xl p-3 border border-white/20 dark:border-white/5 backdrop-blur-md dark:backdrop-blur-none">
                <span className="text-[10px] font-medium text-teal-100 dark:text-teal-200/70 uppercase">Recuperação Estimada</span>
                <p className="text-lg font-extrabold text-white mt-0.5 tabular-nums">
                  {aiDiagnosis.predictedRecoveryAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <span className="text-[10px] text-emerald-200 dark:text-emerald-400 font-semibold">+18% vs mês ant.</span>
              </div>
              <div className="bg-white/15 dark:bg-black/30 rounded-2xl p-3 border border-white/20 dark:border-white/5 backdrop-blur-md dark:backdrop-blur-none">
                <span className="text-[10px] font-medium text-teal-100 dark:text-teal-200/70 uppercase">Economia Prevista</span>
                <p className="text-lg font-extrabold text-white mt-0.5 tabular-nums">
                  {aiDiagnosis.energySavingsRate > 0 ? `+${aiDiagnosis.energySavingsRate}%` : `${aiDiagnosis.energySavingsRate}%`}
                </p>
                <span className="text-[10px] text-teal-200 dark:text-teal-300 font-semibold">Conta de Energia</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-white/20 dark:border-teal-700/50 flex items-center justify-between relative z-10">
            <span className="text-[11px] text-teal-100 dark:text-teal-200/70">Ação automatizada</span>
            <button 
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              className="px-4 py-2 bg-white hover:bg-emerald-50 text-teal-900 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-slate-950 font-bold rounded-full text-xs shadow-md transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"
            >
              {aiDiagnosis.smartRuleActive ? '✓ Régua Ativada' : 'Ativar régua inteligente →'}
            </button>
          </div>
        </section>

        {/* BENTO CARD 5: Despesas Operacionais por Categoria */}
        <section className="md:col-span-12 lg:col-span-4 bg-white rounded-3xl p-6 shadow-bento border border-slate-100 flex flex-col justify-between group hover:shadow-bento-hover transition-all duration-300">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Despesas Operacionais</h3>
                <p className="text-xl font-extrabold text-slate-900 mt-0.5 tabular-nums">
                  {totalExpenses.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}{' '}
                  <span className="text-xs font-normal text-slate-400">
                    / {monthlyBudget.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} orçado
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsExpensesModalOpen(true)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-50 transition cursor-pointer"
                  title="Gerenciar Despesas"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                  {budgetPct}%
                </div>
              </div>
            </div>

            <div className="space-y-4 mt-5">
              <div>
                <div className="flex justify-between items-center text-xs font-semibold mb-1">
                  <span className="text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-800" aria-hidden="true"></span>
                    Folha & Portaria Remota
                  </span>
                  <span className="text-slate-900 font-bold tabular-nums">
                    {folhaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}{' '}
                    <span className="text-slate-400 font-normal">({folhaPct}%)</span>
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-800 rounded-full transition-all" style={{ width: `${folhaPct}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs font-semibold mb-1">
                  <span className="text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" aria-hidden="true"></span>
                    Manutenção & Elevadores
                  </span>
                  <span className="text-slate-900 font-bold tabular-nums">
                    {manutencaoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}{' '}
                    <span className="text-slate-400 font-normal">({manutencaoPct}%)</span>
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${manutencaoPct}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs font-semibold mb-1">
                  <span className="text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-400" aria-hidden="true"></span>
                    Concessionárias (Água & Luz)
                  </span>
                  <span className="text-slate-900 font-bold tabular-nums">
                    {concessionariasTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}{' '}
                    <span className="text-slate-400 font-normal">({concessionariasPct}%)</span>
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-400 rounded-full transition-all" style={{ width: `${concessionariasPct}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
            <div className="flex items-center -space-x-2">
              <span className="w-7 h-7 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-700" title="Atlas Schindler">AS</span>
              <span className="w-7 h-7 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-emerald-800" title="Sabesp">SB</span>
              <span className="w-7 h-7 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-blue-800" title="Enel">EN</span>
              <span className="w-7 h-7 rounded-full bg-amber-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-amber-800" title="Protege">SP</span>
            </div>
            <button 
              type="button"
              onClick={() => setIsExpensesModalOpen(true)} 
              className="text-xs font-bold text-emerald-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded px-1 cursor-pointer"
            >
              Ver todas ({expenses.length})
            </button>
          </div>
        </section>

        {/* BENTO CARD 6: Tabela Bento de Boletos e Cobranças (Data Tables Pattern) */}
        <section className="md:col-span-12 bg-white rounded-3xl p-6 lg:p-7 shadow-bento border border-slate-100 group hover:shadow-bento-hover transition-all duration-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Cobranças & Boletos Recentes</h3>
                <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-0.5 rounded-full font-bold tabular-nums">
                  {filteredInvoices.length} emissões
                </span>
              </div>
              <p className="text-xs font-medium text-slate-400 mt-0.5">Emissão via split bancário integrado com compensação instantânea via Pix QR Code</p>
            </div>
            
            {/* Filter Pills + Primary Action */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="bg-slate-100 p-1 rounded-full flex items-center gap-1 text-xs" role="group" aria-label="Filtro de boletos por bloco ou status">
                {(['Todos', 'Bloco A', 'Bloco B', 'Atrasados'] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBlockFilter(b)}
                    className={`px-3 py-1 rounded-full font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      blockFilter === b
                        ? 'bg-white text-slate-900 shadow-sm font-bold'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
              <button 
                type="button"
                onClick={() => {
                  setModalInitialSelection('none');
                  setIsCreateModalOpen(true);
                }}
                className="px-4 py-2 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-pill hover:bg-emerald-700 transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
              >
                <span>+</span> Nova Cobrança Extra
              </button>
            </div>
          </div>

          {/* Bulk Action Bar (Data Tables Skill) */}
          {selectedInvoices.length > 0 && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-between flex-wrap gap-2 animate-in fade-in duration-200">
              <span className="text-xs font-bold text-emerald-900">
                {selectedInvoices.length} {selectedInvoices.length === 1 ? 'boleto selecionado' : 'boletos selecionados'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBulkRemittance}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-full shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  Gerar Remessa CNAB ({selectedInvoices.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInvoices([])}
                  className="px-3 py-1.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 text-xs font-semibold rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  Desmarcar Todos
                </button>
              </div>
            </div>
          )}

          {/* Table or Empty State (Empty and Loading States Skill) */}
          {isLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <EmptyState
              title="Nenhum boleto encontrado"
              description={
                invoices.length === 0
                  ? "Nenhuma cobrança emitida para este condomínio ainda. Clique em 'Emitir Boletos em Lote' para começar."
                  : "Nenhum registro corresponde aos filtros selecionados. Tente alterar ou limpar os filtros."
              }
              actionLabel={invoices.length === 0 ? "Emitir Boletos em Lote" : "Ver Todos os Boletos"}
              onAction={() => {
                if (invoices.length === 0) {
                  setModalInitialSelection('all');
                  setIsCreateModalOpen(true);
                } else {
                  setBlockFilter('Todos');
                }
              }}
              className="my-6"
            />
          ) : (
            <div className="overflow-x-auto min-w-0">
              <table className="w-full text-left border-separate border-spacing-y-2.5">
                <thead>
                  <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-2 pl-4 pr-2 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0}
                        onChange={handleToggleSelectAll}
                        aria-label="Selecionar todos os boletos exibidos"
                        className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-2 px-4">Unidade / Morador</th>
                    <th className="py-2 px-4">Descrição da Cota</th>
                    <th className="py-2 px-4">Vencimento</th>
                    <th className="py-2 px-4">Valor</th>
                    <th className="py-2 px-4 text-center">Status</th>
                    <th className="py-2 px-4 text-center">Pix Instantâneo</th>
                    <th className="py-2 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {filteredInvoices.map((inv) => {
                    const isLiquidated = inv.status === 'liquidated' || inv.status === 'advance';
                    const isOverdue = inv.status === 'overdue';
                    const isDueToday = inv.status === 'due_today';
                    const isSelected = selectedInvoices.includes(inv.id);

                    return (
                      <tr 
                        key={inv.id} 
                        className={`transition-colors group/row ${
                          isSelected
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/40 ring-1 ring-emerald-500/30'
                            : isOverdue 
                            ? 'bg-rose-50/20 dark:bg-rose-950/25 hover:bg-rose-50/40 dark:hover:bg-rose-950/40' 
                            : 'bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        <td className="py-3 pl-4 pr-2 rounded-l-2xl text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(inv.id)}
                            aria-label={`Selecionar boleto da unidade ${inv.unitNumber}`}
                            className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center font-bold text-xs shadow-sm ${
                              isOverdue 
                                ? 'bg-white dark:bg-slate-800 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400' 
                                : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                            }`}>
                              {inv.unitNumber}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-slate-100 leading-tight">
                                Apto {inv.unitNumber} — {inv.block}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">{inv.residentName}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">{inv.description}</td>
                        <td className={`py-3 px-4 font-medium tabular-nums ${isOverdue ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-600 dark:text-slate-400'}`}>
                          {inv.dueDate}
                        </td>
                        <td className="py-3 px-4 font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                          {inv.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge
                            variant={isLiquidated ? 'emerald' : isOverdue ? 'rose' : isDueToday ? 'amber' : 'sky'}
                            dot
                          >
                            {inv.statusLabel}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleCopyPix(inv.id, inv.pixCode ?? `CONDOR-PIX-SIMULADO:${inv.id}:${inv.amount.toFixed(2)}`)}
                            title="Código Pix simulado (sem integração bancária)"
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-600 dark:hover:border-emerald-500 text-[11px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5H19ZM19 21H8V7H19V21Z"></path></svg>
                            {copiedPixId === inv.id ? 'Copiado!' : inv.pixAuthenticated ? 'Autenticado' : 'Copiar Pix'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right rounded-r-2xl">
                          {!isLiquidated ? (
                            <div className="flex items-center justify-end gap-2">
                              {!isMockMode && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkPaid(inv)}
                                  disabled={busyInvoiceId === inv.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 font-semibold text-[11px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 cursor-pointer"
                                  title="Registrar pagamento recebido"
                                >
                                  Dar baixa
                                </button>
                              )}
                              {(isOverdue || isDueToday) && (
                                <button
                                  type="button"
                                  onClick={() => handleWhatsAppReminder(inv)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
                                >
                                  <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
                                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.149.929 3.182 0 5.767-2.587 5.768-5.766 0-3.18-2.586-5.771-5.768-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.299.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.087-.177.181-.076.355.101.174.449.741.964 1.2.662.591 1.221.774 1.394.861.173.087.275.072.376-.044.101-.116.433-.506.549-.679.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.043.073.043.419-.101.824z" />
                                  </svg>
                                  <span>{inv.whatsappReminderSent ? 'Cobrar de novo' : 'Cobrar no WhatsApp'}</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Pago ✓</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 mt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Mostrando <b className="tabular-nums">{filteredInvoices.length}</b> de <b className="tabular-nums">{invoices.length}</b> boletos gerados
            </span>
            {isMockMode && (
              <span className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">Dados de demonstração</span>
            )}
          </div>
        </section>
      </div>

      {/* Create Invoice Modal */}
      <CreateInvoiceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        units={units}
        initialSelection={modalInitialSelection}
        onSubmit={handleCreateInvoices}
      />

      {/* Fundo de Reserva Modal */}
      <ReserveFundModal
        isOpen={isReserveModalOpen}
        onClose={() => setIsReserveModalOpen(false)}
        data={reserveFund}
        onAddAporte={handleAddAporte}
        onUpdateParams={handleUpdateReserveParams}
      />

      {/* Conciliação Bancária Modal */}
      <BankConciliationModal
        isOpen={isConciliationModalOpen}
        onClose={() => setIsConciliationModalOpen(false)}
      />

      {/* CONDOR AI Diagnóstico & Régua Inteligente Modal */}
      <AiSmartRuleModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        data={aiDiagnosis}
        onSave={handleUpdateAiDiagnosis}
      />

      {/* Despesas Operacionais Modal */}
      <OperationalExpensesModal
        isOpen={isExpensesModalOpen}
        onClose={() => setIsExpensesModalOpen(false)}
        expenses={expenses}
        monthlyBudget={monthlyBudget}
        onAddExpense={handleAddExpense}
        onDeleteExpense={handleDeleteExpense}
        onUpdateBudget={handleUpdateBudget}
      />
    </div>
  );
};
