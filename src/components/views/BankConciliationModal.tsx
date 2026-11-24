import React, { useMemo } from 'react';
import { Download, Building2, ShieldCheck, X, ArrowDownLeft, ArrowUpRight, Info } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  financialDataService,
  type OperationalExpense,
} from '../../services/financialDataService';
import type { CondominiumBankSettings } from '../../services/bankAccountService';
import type { Invoice } from '../../types/condominium';

interface BankConciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices?: Invoice[];
  expenses?: OperationalExpense[];
  bankSettings?: CondominiumBankSettings;
}

export const BankConciliationModal: React.FC<BankConciliationModalProps> = ({
  isOpen,
  onClose,
  invoices = [],
  expenses = [],
  bankSettings,
}) => {
  const { currentCondominium } = useAuth();

  const ledgerEntries = useMemo(() => {
    const paidInflows = invoices
      .filter((inv) => inv.status === 'liquidated' || inv.status === 'advance')
      .map((inv) => ({
        date: inv.paidAtIso
          ? new Date(inv.paidAtIso).toLocaleDateString('pt-BR')
          : inv.dueDate,
        desc: `Recebimento Pix/Cota — Apto ${inv.unitNumber} (${inv.block}) • ${inv.residentName}`,
        doc: `REC-${inv.id.slice(0, 6).toUpperCase()}`,
        val: inv.amount,
        status: 'Baixa Confirmada',
      }));

    const paidOutflows = expenses
      .filter((exp) => exp.status === 'Pago')
      .map((exp) => ({
        date: exp.dueDate,
        desc: `Pgto ${exp.supplier} (${exp.category})`,
        doc: `DES-${exp.id.slice(0, 6).toUpperCase()}`,
        val: -Math.abs(exp.amount),
        status: 'Despesa Liquidada',
      }));

    return [...paidInflows, ...paidOutflows];
  }, [invoices, expenses]);

  const totals = useMemo(() => {
    const inflows = ledgerEntries
      .filter((e) => e.val > 0)
      .reduce((acc, e) => acc + e.val, 0);
    const outflows = ledgerEntries
      .filter((e) => e.val < 0)
      .reduce((acc, e) => acc + Math.abs(e.val), 0);
    return {
      inflows,
      outflows,
      net: inflows - outflows,
    };
  }, [ledgerEntries]);

  if (!isOpen) return null;

  const handleDownloadCsv = () => {
    financialDataService.downloadConciliationCsv(
      ledgerEntries.map((e) => ({
        date: e.date,
        description: e.desc,
        document: e.doc,
        amount: e.val,
        status: e.status,
      })),
      currentCondominium?.name || 'Condominio'
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="conciliation-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 relative">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="conciliation-modal-title"
                className="text-base font-extrabold text-slate-900 dark:text-slate-100"
              >
                Conciliação Financeira &amp; Conferência de Caixa
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {currentCondominium?.name || 'Condomínio'} — receitas Pix liquidadas vs. despesas pagas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar conciliação"
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        {/* Status real da conta configurada pela síndica */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">
              Domicílio Bancário
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mt-0.5 truncate">
              {bankSettings?.bankName || 'Não configurado'}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1 block truncate">
              {bankSettings
                ? `Ag ${bankSettings.agency} • C/C ${bankSettings.accountNumber}-${bankSettings.accountDigit}`
                : 'Configure em Banco & Pix'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/60">
            <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase block">
              Entradas Liquidadas
            </span>
            <span className="text-base font-extrabold text-emerald-900 dark:text-emerald-200 block mt-0.5 tabular-nums">
              {totals.inflows.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold mt-1 inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Baixa manual auditada
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">
              Saldo Líquido Conciliado
            </span>
            <span
              className={`text-base font-extrabold block mt-0.5 tabular-nums ${
                totals.net >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {totals.net.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold mt-1 block">
              {ledgerEntries.length} lançamentos reais
            </span>
          </div>
        </div>

        {/* Transparência operacional */}
        <div className="mb-4 p-3 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/70 dark:border-sky-800/60 text-[11px] text-sky-900 dark:text-sky-200 flex items-start gap-2">
          <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <span>
            Conferência baseada exclusivamente nos recebimentos com baixa confirmada no banco de dados e nas despesas marcadas como pagas deste condomínio (modo Pix + Baixa Manual).
          </span>
        </div>

        {/* Extrato Real */}
        <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden mb-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-200">
            <span>Lançamentos Liquidados do Condomínio</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
              {ledgerEntries.length} registros
            </span>
          </div>
          {ledgerEntries.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Nenhum recebimento liquidado ou despesa paga registrado ainda neste condomínio.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
              {ledgerEntries.map((t, i) => (
                <div
                  key={`${t.doc}-${i}`}
                  className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        t.val >= 0
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {t.val >= 0 ? (
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {t.desc}
                        </span>
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                          {t.doc}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">{t.date}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`font-bold tabular-nums block ${
                        t.val >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {t.val >= 0
                        ? `+ R$ ${t.val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : `- R$ ${Math.abs(t.val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      {t.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        </div>

        {/* Ações */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={ledgerEntries.length === 0}
            onClick={handleDownloadCsv}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Conciliação CSV</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
