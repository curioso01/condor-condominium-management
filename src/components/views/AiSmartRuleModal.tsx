import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import type { AiDiagnosisData } from '../../services/financialDataService';

interface AiSmartRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AiDiagnosisData;
  onSave: (updated: AiDiagnosisData) => void;
}

export const AiSmartRuleModal: React.FC<AiSmartRuleModalProps> = ({
  isOpen,
  onClose,
  data,
  onSave,
}) => {
  const [active, setActive] = useState(data.smartRuleActive);
  const [recoveryAmount, setRecoveryAmount] = useState(data.predictedRecoveryAmount.toString());
  const [energySavings, setEnergySavings] = useState(data.energySavingsRate.toString());
  const [punctualityDiscount, setPunctualityDiscount] = useState(data.punctualityDiscount.toString());
  const [trendDesc, setTrendDesc] = useState(data.trendDescription);
  const [channels, setChannels] = useState({ ...data.channels });

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: AiDiagnosisData = {
      predictedRecoveryAmount: parseFloat(recoveryAmount) || data.predictedRecoveryAmount,
      energySavingsRate: parseFloat(energySavings) || data.energySavingsRate,
      trendDescription: trendDesc,
      punctualityDiscount: parseFloat(punctualityDiscount) || data.punctualityDiscount,
      smartRuleActive: active,
      channels,
    };
    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                CONDOR AI • Diagnóstico & Régua Inteligente
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configuração preditiva de inadimplência e automação preventiva
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

        <form onSubmit={handleSave} className="space-y-4 mt-4">
          {/* Toggle Switch */}
          <div className="p-4 rounded-2xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-800/60 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-teal-900 dark:text-teal-200 block">
                Status da Régua Inteligente
              </span>
              <p className="text-[11px] text-teal-700 dark:text-teal-400">
                Disparo automatizado de notificações e Pix preventivo com desconto
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActive(!active)}
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                active ? 'bg-emerald-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
            </button>
          </div>

          {/* Edit Forecasts */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Recuperação Estimada (R$)
              </label>
              <input
                type="number"
                step="100"
                required
                value={recoveryAmount}
                onChange={(e) => setRecoveryAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Economia Energia Prevista (%)
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={energySavings}
                onChange={(e) => setEnergySavings(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Desconto de Pontualidade (%)
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="20"
              required
              value={punctualityDiscount}
              onChange={(e) => setPunctualityDiscount(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Diagnóstico / Texto do Modelo de IA
            </label>
            <textarea
              rows={2}
              value={trendDesc}
              onChange={(e) => setTrendDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Cronograma Automatizado */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-2 bg-slate-50 dark:bg-slate-800/40">
            <span className="text-[11px] font-extrabold uppercase text-slate-500 dark:text-slate-400 block">
              Gatilhos da Régua Automatizada
            </span>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-[10px]">
                  D-5
                </span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">Lembrete amigável via Push no App Condor</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-[10px]">
                  D-1
                </span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">WhatsApp com Pix Copia e Cola & Desconto</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-[10px]">
                  D+0
                </span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">Aviso de vencimento no dia</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 flex items-center justify-center font-bold text-[10px]">
                  D+3
                </span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">Notificação de atraso com link de renegociação</span>
              </div>
            </div>
          </div>

          {/* Channel selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-2">
              Canais Habilitados
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={channels.whatsapp}
                  onChange={(e) => setChannels({ ...channels, whatsapp: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span className="font-semibold text-slate-800 dark:text-slate-200">WhatsApp Oficial</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={channels.appPush}
                  onChange={(e) => setChannels({ ...channels, appPush: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span className="font-semibold text-slate-800 dark:text-slate-200">Notificação Push App</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={channels.email}
                  onChange={(e) => setChannels({ ...channels, email: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span className="font-semibold text-slate-800 dark:text-slate-200">E-mail com Boleto</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={channels.sms}
                  onChange={(e) => setChannels({ ...channels, sms: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span className="font-semibold text-slate-800 dark:text-slate-200">SMS Alerta</span>
              </label>
            </div>
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
              className="flex-1 py-2.5 rounded-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-pill transition cursor-pointer"
            >
              Salvar Diagnóstico
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
