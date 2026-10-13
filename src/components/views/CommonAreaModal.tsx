import React, { useState, useEffect } from 'react';
import { X, Building2, Users, DollarSign, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import type { ExtendedCommonArea, UpsertCommonAreaInput } from '../../services/amenityService';

export interface CommonAreaModalProps {
  isOpen: boolean;
  onClose: () => void;
  areaToEdit?: ExtendedCommonArea | null;
  condominiumId: string;
  onSave: (data: UpsertCommonAreaInput) => Promise<{ success: boolean; error?: string }>;
}

export const CommonAreaModal: React.FC<CommonAreaModalProps> = ({
  isOpen,
  onClose,
  areaToEdit,
  condominiumId,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState<number>(50);
  const [fee, setFee] = useState<number>(0);
  const [rules, setRules] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [active, setActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronize initial data on open/change
  useEffect(() => {
    if (areaToEdit) {
      setName(areaToEdit.name || '');
      setDescription(areaToEdit.description || '');
      setCapacity(areaToEdit.capacity ?? 50);
      setFee(areaToEdit.fee ?? 0);
      setRules(areaToEdit.rules || areaToEdit.description || '');
      setRequiresApproval(areaToEdit.requires_approval ?? false);
      setActive(areaToEdit.active ?? true);
    } else {
      setName('');
      setDescription('');
      setCapacity(50);
      setFee(0);
      setRules('');
      setRequiresApproval(false);
      setActive(true);
    }
    setErrorMessage(null);
  }, [areaToEdit, isOpen]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('O nome da área comum é obrigatório.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const input: UpsertCommonAreaInput = {
      condominium_id: condominiumId,
      name: name.trim(),
      description: description.trim() || undefined,
      capacity: Number(capacity) || 1,
      fee: Number(fee) || 0,
      rules: rules.trim() || undefined,
      requires_approval: requiresApproval,
      active,
    };

    const res = await onSave(input);
    setIsSubmitting(false);

    if (res.success) {
      onClose();
    } else {
      setErrorMessage(res.error || 'Erro ao salvar área comum.');
    }
  };

  const isEditing = Boolean(areaToEdit);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity" 
        onClick={onClose}
        aria-hidden="true" 
      />

      {/* Modal Dialog Content */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-common-area-title"
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-float border border-slate-100 dark:border-slate-800 overflow-hidden z-10 my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 id="modal-common-area-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                {isEditing ? 'Editar Área Comum' : 'Cadastrar Nova Área Comum'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isEditing ? 'Atualize as regras e parâmetros do espaço' : 'Cadastre um novo espaço de lazer para reservas'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-5 sm:mx-6 mt-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Nome do Espaço */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Nome da Área Comum <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Salão de Festas Principal, Quadra de Tênis, Quiosque..."
              className="w-full h-11 px-3.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Descrição do Espaço
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Espaço climatizado com cozinha equipada, freezer e mesas..."
              className="w-full p-3 text-xs font-medium bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* Capacidade e Taxa de Locação em 2 colunas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-slate-400" /> Capacidade Máx. (pessoas)
                </span>
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full h-11 px-3.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                <span className="inline-flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400" /> Taxa de Limpeza / Uso (R$)
                </span>
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={fee}
                onChange={(e) => setFee(Number(e.target.value))}
                placeholder="0.00 (Isento)"
                className="w-full h-11 px-3.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Deixe 0 para uso gratuito/isento</span>
            </div>
          </div>

          {/* Regras e Horários de Uso */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Regras e Horários de Uso
              </span>
            </label>
            <textarea
              rows={2}
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              placeholder="Ex: Horário permitido: 08:00 às 23:00. Som alto permitido até 22:00..."
              className="w-full p-3 text-xs font-medium bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* Opções de Aprovação e Status Ativo */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 cursor-pointer">
              <div className="pr-3">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                  Requer Aprovação Prévia
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Reservas deste espaço precisarão de validação do síndico/administração
                </span>
              </div>
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 cursor-pointer">
              <div className="pr-3">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                  Espaço Ativo para Agendamentos
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Desmarque para pausar temporariamente novas reservas (ex: reforma)
                </span>
              </div>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-pill transition-all flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isEditing ? 'Salvar Alterações' : 'Cadastrar Espaço'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
