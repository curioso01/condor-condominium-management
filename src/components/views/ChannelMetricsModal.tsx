import React, { useState } from 'react';
import { BarChart3, X } from 'lucide-react';
import type { ChannelMetricsData } from '../../services/financialDataService';

interface ChannelMetricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ChannelMetricsData;
  onSave: (updated: ChannelMetricsData) => void;
}

export const ChannelMetricsModal: React.FC<ChannelMetricsModalProps> = ({
  isOpen,
  onClose,
  data,
  onSave,
}) => {
  const [appCount, setAppCount] = useState(data.appCount.toString());
  const [totemCount, setTotemCount] = useState(data.totemCount.toString());
  const [whatsappCount, setWhatsappCount] = useState(data.whatsappCount.toString());
  const [interfoneCount, setInterfoneCount] = useState(data.interfoneCount.toString());
  const [resolutionRate, setResolutionRate] = useState(data.resolutionRate24h.toString());
  const [satisfaction, setSatisfaction] = useState(data.satisfactionScore.toString());

  if (!isOpen) return null;

  const currentApp = parseInt(appCount) || 0;
  const currentTotem = parseInt(totemCount) || 0;
  const currentWhats = parseInt(whatsappCount) || 0;
  const currentInterf = parseInt(interfoneCount) || 0;
  const currentTotal = currentApp + currentTotem + currentWhats + currentInterf;

  const appPct = currentTotal > 0 ? Math.round((currentApp / currentTotal) * 100) : 0;
  const totemPct = currentTotal > 0 ? Math.round((currentTotem / currentTotal) * 100) : 0;
  const whatsPct = currentTotal > 0 ? Math.round((currentWhats / currentTotal) * 100) : 0;
  const interfPct = currentTotal > 0 ? Math.max(0, 100 - (appPct + totemPct + whatsPct)) : 0;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: ChannelMetricsData = {
      appCount: currentApp,
      totemCount: currentTotem,
      whatsappCount: currentWhats,
      interfoneCount: currentInterf,
      resolutionRate24h: parseFloat(resolutionRate) || data.resolutionRate24h,
      satisfactionScore: parseFloat(satisfaction) || data.satisfactionScore,
    };
    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                Canais de Abertura & Ocorrências
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ajuste das métricas de atendimento e origem dos chamados
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

        {/* Live Preview */}
        <div className="my-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase">Prévia em Tempo Real</span>
            <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
              Total {currentTotal.toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50">
              <span className="font-extrabold text-emerald-700 dark:text-emerald-300 block">{appPct}%</span>
              <span className="text-[10px] text-slate-500">App ({currentApp})</span>
            </div>
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200/50">
              <span className="font-extrabold text-teal-700 dark:text-teal-300 block">{totemPct}%</span>
              <span className="text-[10px] text-slate-500">Totem ({currentTotem})</span>
            </div>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/50">
              <span className="font-extrabold text-amber-700 dark:text-amber-300 block">{whatsPct}%</span>
              <span className="text-[10px] text-slate-500">Whats ({currentWhats})</span>
            </div>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/50">
              <span className="font-extrabold text-rose-700 dark:text-rose-300 block">{interfPct}%</span>
              <span className="text-[10px] text-slate-500">Interf ({currentInterf})</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Chamados via App
              </label>
              <input
                type="number"
                min="0"
                required
                value={appCount}
                onChange={(e) => setAppCount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Chamados via Totem
              </label>
              <input
                type="number"
                min="0"
                required
                value={totemCount}
                onChange={(e) => setTotemCount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Chamados via WhatsApp
              </label>
              <input
                type="number"
                min="0"
                required
                value={whatsappCount}
                onChange={(e) => setWhatsappCount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Chamados via Interfone
              </label>
              <input
                type="number"
                min="0"
                required
                value={interfoneCount}
                onChange={(e) => setInterfoneCount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Taxa de Resolução 24h (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                required
                value={resolutionRate}
                onChange={(e) => setResolutionRate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nota de Satisfação (0 a 5.0)
              </label>
              <input
                type="number"
                min="0"
                max="5"
                step="0.1"
                required
                value={satisfaction}
                onChange={(e) => setSatisfaction(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-3">
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
              Salvar Métricas
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
