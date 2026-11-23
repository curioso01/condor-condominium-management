import React, { useState } from 'react';
import { Zap, X } from 'lucide-react';
import type { AiEnergyData } from '../../services/financialDataService';

interface AiEnergyModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AiEnergyData;
  onSave: (updated: AiEnergyData) => void;
}

export const AiEnergyModal: React.FC<AiEnergyModalProps> = ({
  isOpen,
  onClose,
  data,
  onSave,
}) => {
  const [percentage, setPercentage] = useState(data.percentage.toString());
  const [kwhPerDay, setKwhPerDay] = useState(data.kwhPerDay.toString());
  const [monthlySavings, setMonthlySavings] = useState(data.monthlySavings.toString());
  const [targetLocations, setTargetLocations] = useState(data.targetLocations);
  const [appliedToAllBlocks, setAppliedToAllBlocks] = useState(data.appliedToAllBlocks);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: AiEnergyData = {
      percentage: parseFloat(percentage) || data.percentage,
      kwhPerDay: parseFloat(kwhPerDay) || data.kwhPerDay,
      monthlySavings: parseFloat(monthlySavings) || data.monthlySavings,
      targetLocations: targetLocations.trim() || data.targetLocations,
      appliedToAllBlocks,
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
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                IA • Economia de Energia Projetada
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configuração dos sensores de presença e dimerização inteligente
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Economia Projetada (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                required
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Redução de Consumo (kWh/dia)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={kwhPerDay}
                onChange={(e) => setKwhPerDay(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Economia Financeira Estimada (R$/mês)
            </label>
            <input
              type="number"
              min="0"
              step="50"
              required
              value={monthlySavings}
              onChange={(e) => setMonthlySavings(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Locais com Sensores & Dimerização
            </label>
            <input
              type="text"
              required
              value={targetLocations}
              onChange={(e) => setTargetLocations(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Aplicar em todos os blocos
              </span>
              <span className="text-[11px] text-slate-400">
                Ativa os perfis de dimerização automática em todas as torres
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAppliedToAllBlocks(!appliedToAllBlocks)}
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                appliedToAllBlocks ? 'bg-emerald-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
            </button>
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
      </div>
    </div>
  );
};
