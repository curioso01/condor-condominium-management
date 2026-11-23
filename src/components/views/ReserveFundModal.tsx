import React, { useState } from 'react';
import type { ReserveFundData } from '../../services/financialDataService';
import { Landmark, ArrowUpRight, CheckCircle2, X } from 'lucide-react';

interface ReserveFundModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ReserveFundData;
  onAddAporte: (amount: number, description: string, fromAccount: string) => void;
  onUpdateParams: (updated: ReserveFundData) => void;
}

export const ReserveFundModal: React.FC<ReserveFundModalProps> = ({
  isOpen,
  onClose,
  data,
  onAddAporte,
  onUpdateParams,
}) => {
  const [activeTab, setActiveTab] = useState<'aporte' | 'params'>('aporte');

  // Aporte Form
  const [aporteAmount, setAporteAmount] = useState<string>('50000');
  const [aporteDescription, setAporteDescription] = useState('Aporte Extraordinário para Fundo de Obras');
  const [aporteAccount, setAporteAccount] = useState('Conta Corrente Itaú PJ (Ag 0492 C/C 19482-1)');
  const [aporteSuccess, setAporteSuccess] = useState(false);

  // Params Form
  const [editBalance, setEditBalance] = useState(data.balance.toString());
  const [editMonthlyYield, setEditMonthlyYield] = useState(data.monthlyYield.toString());
  const [editBankName, setEditBankName] = useState(data.bankName);
  const [editCdiRate, setEditCdiRate] = useState(data.cdiRate);
  const [editTargetTitle, setEditTargetTitle] = useState(data.targetTitle);
  const [editTargetAmount, setEditTargetAmount] = useState(data.targetAmount.toString());

  if (!isOpen) return null;

  const handleAporteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(aporteAmount.replace(/\D/g, '')) || 0;
    if (val <= 0) return;

    onAddAporte(val, aporteDescription, aporteAccount);
    setAporteSuccess(true);
    setTimeout(() => {
      setAporteSuccess(false);
      onClose();
    }, 1500);
  };

  const handleParamsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: ReserveFundData = {
      ...data,
      balance: parseFloat(editBalance) || data.balance,
      monthlyYield: parseFloat(editMonthlyYield) || data.monthlyYield,
      bankName: editBankName,
      cdiRate: editCdiRate,
      targetTitle: editTargetTitle,
      targetAmount: parseFloat(editTargetAmount) || data.targetAmount,
    };
    onUpdateParams(updated);
    onClose();
  };

  const currentPercent = Math.min(100, Math.round((data.balance / (data.targetAmount || 1)) * 100));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                Fundo de Reserva & Obras
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gestão da conta aplicação e aportes extraordinários
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

        {/* Tab switch */}
        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl my-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('aporte')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'aporte'
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            + Aporte Adicional
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('params')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'params'
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Editar Parâmetros & Metas
          </button>
        </div>

        {/* Current status banner */}
        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/60 mb-4">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold">Saldo Atual da Reserva</span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{data.bankName}</span>
          </div>
          <div className="text-2xl font-black text-emerald-900 dark:text-emerald-200 mt-1 tabular-nums">
            {data.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
              <span>{data.targetTitle}</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                {currentPercent}% de {data.targetAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-600 h-full rounded-full transition-all" style={{ width: `${currentPercent}%` }} />
            </div>
          </div>
        </div>

        {activeTab === 'aporte' ? (
          <form onSubmit={handleAporteSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Valor do Aporte (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">R$</span>
                <input
                  type="number"
                  step="100"
                  min="100"
                  required
                  value={aporteAmount}
                  onChange={(e) => setAporteAmount(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="50000"
                />
              </div>
              <div className="flex gap-2 mt-2">
                {['5000', '10000', '25000', '50000'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAporteAmount(val)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
                  >
                    + R$ {parseInt(val).toLocaleString('pt-BR')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Conta de Origem
              </label>
              <input
                type="text"
                value={aporteAccount}
                onChange={(e) => setAporteAccount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Descrição / Finalidade
              </label>
              <input
                type="text"
                value={aporteDescription}
                onChange={(e) => setAporteDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {aporteSuccess && (
              <div className="p-3 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Aporte adicionado e saldo recalculado com sucesso!</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-pill transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Confirmar Transferência</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleParamsSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Saldo Real Atual (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editBalance}
                  onChange={(e) => setEditBalance(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Rendimento Mensal (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editMonthlyYield}
                  onChange={(e) => setEditMonthlyYield(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Banco / Instituição
                </label>
                <input
                  type="text"
                  required
                  value={editBankName}
                  onChange={(e) => setEditBankName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Rentabilidade CDI
                </label>
                <input
                  type="text"
                  required
                  value={editCdiRate}
                  onChange={(e) => setEditCdiRate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nome da Meta / Projeto
              </label>
              <input
                type="text"
                required
                value={editTargetTitle}
                onChange={(e) => setEditTargetTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Valor da Meta (R$)
              </label>
              <input
                type="number"
                step="1000"
                required
                value={editTargetAmount}
                onChange={(e) => setEditTargetAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-pill transition cursor-pointer"
              >
                Salvar Parâmetros
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
