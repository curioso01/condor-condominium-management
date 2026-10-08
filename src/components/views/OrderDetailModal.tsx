import React, { useEffect, useRef } from 'react';
import { 
  X, 
  Wrench, 
  MapPin, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Building, 
  FileText, 
  ArrowRight
} from 'lucide-react';
import type { MaintenanceOrder } from '../../types/condominium';
import { Badge } from '../ui/Badge';

export interface OrderDetailModalProps {
  order: MaintenanceOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onAdvanceStatus?: (order: MaintenanceOrder) => void;
  isUpdating?: boolean;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  isOpen,
  onClose,
  onAdvanceStatus,
  isUpdating = false,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !order) return null;

  const isCompleted = order.statusType === 'completed' || order.statusType === 'certified';
  const isInProgress = order.statusType === 'in_progress';
  const isScheduled = order.statusType === 'scheduled';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-detail-title"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div
        ref={modalRef}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl shadow-floating-sidebar border border-slate-200 dark:border-slate-800 p-6 sm:p-7 z-10 animate-scaleUp"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {order.code}
                </span>
                {order.category && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                    {order.category}
                  </span>
                )}
                <Badge
                  variant={isCompleted ? 'emerald' : isInProgress ? 'sky' : 'amber'}
                  dot
                >
                  {order.status}
                </Badge>
              </div>
              <h2 id="order-detail-title" className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
                {order.title}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-5 space-y-5">
          {/* Progress Bar (if in progress or completed) */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-700 dark:text-slate-300">Progresso Operacional</span>
              <span className={isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-sky-600 dark:text-sky-400'}>
                {order.progressPercentage}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  isCompleted ? 'bg-emerald-500' : 'bg-sky-500'
                }`}
                style={{ width: `${Math.max(5, order.progressPercentage)}%` }}
              />
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-start gap-3">
              <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Localização</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{order.location}</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Nível de Prioridade</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{order.priority}</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-start gap-3">
              <Calendar className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Data Prevista</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {order.scheduledDate ? new Date(order.scheduledDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Hoje'}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-start gap-3">
              <Clock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Horário / Cronograma</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{order.scheduledTime}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          {order.description && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Escopo & Procedimentos Técnicos
                </h4>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {order.description}
              </p>
            </div>
          )}

          {/* Technicians & Company */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {order.technicians[0]?.initials || 'OS'}
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Técnico Responsável</span>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {order.technicians[0]?.name || 'Equipe Especializada do Condomínio'}
                </p>
                {order.technicianCompany && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                    <Building className="w-3 h-3 text-slate-400" />
                    <span>{order.technicianCompany}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {order.materialsReserved && (
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Materiais Separados ✓
                </span>
              )}
              {order.hasCertificate && (
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> ART / Laudo Emitido
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            Fechar
          </button>

          {onAdvanceStatus && (
            <div className="w-full sm:w-auto flex items-center gap-2">
              {isScheduled && (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => onAdvanceStatus(order)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-pill"
                >
                  <span>Iniciar Atendimento</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              {isInProgress && (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => onAdvanceStatus(order)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-pill"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Concluir Execução (100%)</span>
                </button>
              )}
              {isCompleted && !order.hasCertificate && (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => onAdvanceStatus(order)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-pill"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Emitir Certificado / Laudo</span>
                </button>
              )}
              {order.hasCertificate && (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ordem Totalmente Finalizada
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
