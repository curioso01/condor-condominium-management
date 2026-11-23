import React, { useState, useEffect } from 'react';
import type { NavigationTab } from '../../types/condominium';
import {
  X,
  Package,
  Wrench,
  Calendar,
  Copy,
  Check,
  ArrowRight,
  Megaphone,
  Wallet,
} from 'lucide-react';

export interface OperationalNotification {
  id: string;
  type: 'manutencao' | 'locker' | 'reserva' | 'comunicado' | 'financeiro';
  title: string;
  badge: string;
  badgeVariant: 'amber' | 'emerald' | 'slate' | 'rose';
  preview: string;
  detail: string;
  timestamp: string;
  data?: {
    pin?: string;
    lockerNumber?: string;
    spaceName?: string;
    date?: string;
    provider?: string;
    statusLabel?: string;
    unitLabel?: string;
  };
}

export interface NotificationDetailModalProps {
  notification: OperationalNotification | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: NavigationTab) => void;
  onOpenMural?: () => void;
  canAccessMaintenance?: boolean;
  canAccessFinance?: boolean;
  canAccessConcierge?: boolean;
}

export const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({
  notification,
  isOpen,
  onClose,
  onNavigateTab,
  onOpenMural,
  canAccessMaintenance = true,
  canAccessFinance = false,
  canAccessConcierge = false,
}) => {
  const [copiedPin, setCopiedPin] = useState(false);

  useEffect(() => {
    setCopiedPin(false);
  }, [notification?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !notification) return null;

  const handleCopyPin = (pin: string) => {
    navigator.clipboard?.writeText(pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 3000);
  };

  const headerTone =
    notification.type === 'manutencao'
      ? 'bg-amber-50/60 dark:bg-amber-950/30'
      : notification.type === 'locker'
      ? 'bg-emerald-50/60 dark:bg-emerald-950/30'
      : notification.type === 'financeiro'
      ? 'bg-rose-50/60 dark:bg-rose-950/30'
      : 'bg-sky-50/60 dark:bg-sky-950/30';

  const iconTone =
    notification.type === 'manutencao'
      ? 'bg-amber-600'
      : notification.type === 'locker'
      ? 'bg-emerald-600'
      : notification.type === 'financeiro'
      ? 'bg-rose-600'
      : 'bg-sky-600';

  const badgeTone =
    notification.badgeVariant === 'amber'
      ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-200'
      : notification.badgeVariant === 'emerald'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-200'
      : notification.badgeVariant === 'rose'
      ? 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900 dark:text-rose-200'
      : 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900 dark:text-sky-200';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-4xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header with category colors */}
        <div className={`p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between ${headerTone}`}>
          <div className="flex items-center gap-3.5 min-w-0">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-extrabold shadow-sm shrink-0 ${iconTone}`}>
              {notification.type === 'manutencao' ? (
                <Wrench className="w-6 h-6" />
              ) : notification.type === 'locker' ? (
                <Package className="w-6 h-6" />
              ) : notification.type === 'financeiro' ? (
                <Wallet className="w-6 h-6" />
              ) : notification.type === 'comunicado' ? (
                <Megaphone className="w-6 h-6" />
              ) : (
                <Calendar className="w-6 h-6" />
              )}
            </div>
            <div className="min-w-0">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${badgeTone}`}>
                {notification.badge}
              </span>
              <h3 id="notification-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 truncate">
                {notification.title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer border border-slate-200/60 dark:border-slate-700 shrink-0"
            aria-label="Fechar notificação"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed font-medium">
            {notification.detail}
          </p>

          {/* Encomenda real */}
          {notification.type === 'locker' && (
            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Local / Locker
                  </span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                    {notification.data?.lockerNumber || 'Portaria'}
                  </span>
                  {notification.data?.unitLabel && (
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Unidade: {notification.data.unitLabel}
                    </span>
                  )}
                </div>

                {notification.data?.pin && (
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      PIN de Retirada
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                      <span className="text-lg font-mono font-black text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900 px-2.5 py-0.5 rounded-xl border border-emerald-300 dark:border-emerald-700 tracking-widest">
                        {notification.data.pin}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyPin(notification.data!.pin!)}
                        className="p-1.5 rounded-xl bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition cursor-pointer"
                        title="Copiar código PIN"
                        aria-label="Copiar código PIN"
                      >
                        {copiedPin ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <p className="pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500">
                Recebido em: {notification.timestamp}
              </p>
            </div>
          )}

          {/* Manutenção real */}
          {notification.type === 'manutencao' && (
            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Responsável / Local</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {notification.data?.provider || 'Equipe Predial'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Registro</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {notification.data?.date || notification.timestamp}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reserva real */}
          {notification.type === 'reserva' && (
            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Espaço</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {notification.data?.spaceName || 'Área Comum'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Data</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {notification.data?.date || notification.timestamp}
                  </p>
                </div>
              </div>
              {notification.data?.statusLabel && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Situação atual:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {notification.data.statusLabel}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Financeiro ou Comunicado */}
          {(notification.type === 'financeiro' || notification.type === 'comunicado') && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Atualizado em</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">{notification.timestamp}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold text-xs cursor-pointer"
          >
            Fechar
          </button>

          {notification.type === 'reserva' && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateTab?.('reservations');
              }}
              className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <span>Abrir Reservas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {notification.type === 'manutencao' && canAccessMaintenance && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateTab?.('maintenance');
              }}
              className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <span>Abrir Manutenções</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {notification.type === 'financeiro' && canAccessFinance && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateTab?.('finance');
              }}
              className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <span>Abrir Financeiro</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {notification.type === 'locker' && canAccessConcierge && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateTab?.('concierge');
              }}
              className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <span>Abrir Portaria</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {notification.type === 'comunicado' && onOpenMural && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenMural();
              }}
              className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <span>Abrir Mural</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
