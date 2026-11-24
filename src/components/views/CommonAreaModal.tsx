import React, { useState, useEffect } from 'react';
import { X, Building2, Users, DollarSign, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import type { ExtendedCommonArea, UpsertCommonAreaInput } from '../../services/amenityService';
import { PremiumSelect } from '../ui/PremiumSelect';

const HOUR_SLOTS = [
  '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00',
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00',
  '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '23:59',
];

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
  const [enforceTimeLimit, setEnforceTimeLimit] = useState(false);
  const [availableStartTime, setAvailableStartTime] = useState('08:00');
  const [availableEndTime, setAvailableEndTime] = useState('22:00');
  const [maxDurationHours, setMaxDurationHours] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (areaToEdit) {
      setName(areaToEdit.name || '');
      setDescription(areaToEdit.description || '');
      setCapacity(areaToEdit.capacity ?? 50);
      setFee(areaToEdit.fee ?? 0);
      setRules(areaToEdit.rules || areaToEdit.description || '');
      setRequiresApproval(areaToEdit.requires_approval ?? false);
      setActive(areaToEdit.active ?? true);
      setEnforceTimeLimit(Boolean(areaToEdit.enforce_time_limit));
      setAvailableStartTime(areaToEdit.available_start_time || '08:00');
      setAvailableEndTime(areaToEdit.available_end_time || '22:00');
      setMaxDurationHours(
        areaToEdit.max_duration_hours !== null && areaToEdit.max_duration_hours !== undefined
          ? String(areaToEdit.max_duration_hours)
          : ''
      );
    } else {
      setName('');
      setDescription('');
      setCapacity(50);
      setFee(0);
      setRules('');
      setRequiresApproval(false);
      setActive(true);
      setEnforceTimeLimit(false);
      setAvailableStartTime('08:00');
      setAvailableEndTime('22:00');
      setMaxDurationHours('');
    }
    setErrorMessage(null);
  }, [areaToEdit, isOpen]);

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

    if (enforceTimeLimit && availableEndTime <= availableStartTime) {
      setErrorMessage('O horário de encerramento deve ser posterior ao horário de abertura.');
      return;
    }

    const parsedMaxDuration = maxDurationHours.trim() ? Number(maxDurationHours) : null;
    if (enforceTimeLimit && parsedMaxDuration !== null && (!Number.isFinite(parsedMaxDuration) || parsedMaxDuration <= 0)) {
      setErrorMessage('Informe uma duração máxima válida em horas ou deixe em branco.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const formattedHours = enforceTimeLimit
      ? `${availableStartTime} às ${availableEndTime}${parsedMaxDuration ? ` (máx. ${parsedMaxDuration}h)` : ''}`
      : 'Horário livre (sem limite)';

    const input: UpsertCommonAreaInput = {
      condominium_id: condominiumId,
      name: name.trim(),
      description: description.trim() || undefined,
      capacity: Number(capacity) || 1,
      fee: Number(fee) || 0,
      rules: rules.trim() || undefined,
      requires_approval: requiresApproval,
      enforce_time_limit: enforceTimeLimit,
      available_start_time: availableStartTime,
      available_end_time: availableEndTime,
      max_duration_hours: enforceTimeLimit ? parsedMaxDuration : null,
      hours: formattedHours,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-common-area-title"
        className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-float border border-slate-100 dark:border-slate-800 overflow-hidden z-10"
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 id="modal-common-area-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                {isEditing ? 'Editar Área Comum' : 'Cadastrar Nova Área Comum'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isEditing ? 'Atualize regras, taxa e limites de horário do espaço' : 'Cadastre um novo espaço de lazer para reservas'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form wrapper with internal scrollable body and fixed footer */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

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

            {/* Capacidade e Taxa */}
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

            {/* Regra Opcional de Limite de Horário */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-3">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Definir limite de horário para uso deste espaço
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {enforceTimeLimit
                      ? 'Reservas fora da faixa abaixo serão bloqueadas automaticamente.'
                      : 'Desativado: moradores podem reservar em qualquer horário (sem limite).'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={enforceTimeLimit}
                  onChange={(e) => setEnforceTimeLimit(e.target.checked)}
                  className="w-4 h-4 rounded accent-emerald-600 cursor-pointer shrink-0"
                />
              </label>

              {enforceTimeLimit && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Início Permitido
                    </label>
                    <PremiumSelect
                      size="sm"
                      ariaLabel="Horário inicial permitido"
                      value={availableStartTime}
                      onChange={setAvailableStartTime}
                      options={HOUR_SLOTS.slice(0, -1)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Término Limite
                    </label>
                    <PremiumSelect
                      size="sm"
                      ariaLabel="Horário limite de término"
                      value={availableEndTime}
                      onChange={setAvailableEndTime}
                      options={HOUR_SLOTS.slice(1)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Máx. Horas (Opcional)
                    </label>
                    <input
                      type="number"
                      min={0.5}
                      max={24}
                      step="0.5"
                      value={maxDurationHours}
                      onChange={(e) => setMaxDurationHours(e.target.value)}
                      placeholder="Sem limite"
                      className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Regras Gerais */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Regras e Recomendações do Regimento
              </label>
              <textarea
                rows={2}
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                placeholder="Ex: Som moderado após 22:00. Entregar o espaço limpo e recolher o lixo..."
                className="w-full p-3 text-xs font-medium bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 resize-none"
              />
            </div>

            {/* Opções de Aprovação e Status Ativo */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 cursor-pointer">
                <div className="pr-3">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                    Requer Aprovação Prévia
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    Reservas deste espaço precisarão de validação da administração
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                  className="w-4 h-4 rounded accent-emerald-600 cursor-pointer shrink-0"
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
                  className="w-4 h-4 rounded accent-emerald-600 cursor-pointer shrink-0"
                />
              </label>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
