import React, { useState } from 'react';
import { CheckCircle2, RefreshCw, Download, Building2, ShieldCheck, X } from 'lucide-react';
import { financialDataService } from '../../services/financialDataService';

interface BankConciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BankConciliationModal: React.FC<BankConciliationModalProps> = ({ isOpen, onClose }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedSuccess, setSyncedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSyncOpenFinance = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncedSuccess(true);
      setTimeout(() => setSyncedSuccess(false), 3000);
    }, 1200);
  };

  const handleDownloadCsv = () => {
    financialDataService.downloadConciliationCsv();
  };

  const transactions = [
    { date: '05/10/2026', desc: 'Recebimento Cotas Condominiais Pix Lote A', doc: 'PIX-84920', val: 94280.00, status: 'Conciliado Automático' },
    { date: '06/10/2026', desc: 'Recebimento Cotas Condominiais Boleto Lote B', doc: 'BOL-19283', val: 48520.00, status: 'Conciliado Automático' },
    { date: '07/10/2026', desc: 'Pgto Grupo Clean Portaria Remota', doc: 'TED-93021', val: -70200.00, status: 'Conciliado Automático' },
    { date: '08/10/2026', desc: 'Pgto Sabesp & Enel Água/Energia', doc: 'DEB-48192', val: -23190.00, status: 'Conciliado Automático' },
    { date: '09/10/2026', desc: 'Rendimento Aplicação Fundo de Reserva', doc: 'APL-00291', val: 3840.20, status: 'Conciliado Automático' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                Conciliação Bancária & Open Finance
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Auditoria de extrato bancário sincronizado em tempo real com o sistema Condor
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Conta Itaú PJ</span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mt-0.5">Ag 0492 C/C 19482-1</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> API Conectada
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/60">
            <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase block">Status de Auditoria</span>
            <span className="text-base font-extrabold text-emerald-900 dark:text-emerald-200 block mt-0.5">100% Conciliado</span>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold mt-1 block">Divergência: R$ 0,00</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Última Sincronização</span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mt-0.5">Hoje às 15:30</span>
            <span className="text-[10px] text-slate-400 font-semibold mt-1 block">5 lançamentos checados</span>
          </div>
        </div>

        {/* Sync message */}
        {syncedSuccess && (
          <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-2 mb-3 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Sincronização com Open Finance concluída! Todas as contas batem com o razão contábil.</span>
          </div>
        )}

        {/* Transactions Table */}
        <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden mb-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-200">
            <span>Extrato Auditado (Competência Atual)</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">Open Finance Ativo</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
            {transactions.map((t, i) => (
              <div key={i} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{t.desc}</span>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.2 rounded font-mono">{t.doc}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">{t.date}</span>
                </div>
                <div className="text-right">
                  <span className={`font-bold tabular-nums block ${t.val >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
                    {t.val >= 0 ? `+ R$ ${t.val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : `- R$ ${Math.abs(t.val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">{t.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={handleSyncOpenFinance}
            disabled={isSyncing}
            className="w-full sm:w-auto px-4 py-2.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando Banco...' : 'Sincronizar via Open Finance'}</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-pill flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Relatório CSV</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
