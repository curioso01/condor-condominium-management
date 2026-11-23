import React, { useState, useEffect, useMemo, useRef } from 'react';
import { z } from 'zod';
import { X, Receipt, CheckCircle2, AlertCircle, CalendarDays, Users, Landmark } from 'lucide-react';
import type { Unit } from '../../types/condominium';
import { toLocalIsoDate } from '../../services/invoiceService';
import { bankAccountService } from '../../services/bankAccountService';

const PRESET_DESCRIPTIONS = ['Condomínio Ordinário', 'Fundo de Reserva', 'Taxa Extra – Obras'];

export interface InvoiceSubmitPayload {
  description: string;
  amount: number;
  dueDateIso: string;
  targets: { unitId: string; residentName: string }[];
}

export interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  units: Unit[];
  initialSelection: 'all' | 'none';
  onSubmit: (payload: InvoiceSubmitPayload) => Promise<{ success: boolean; error?: string }>;
}

/** Converte "1.150,00" / "1150,5" / "1150.50" em número (ou NaN) */
function parseAmount(raw: string): number {
  const clean = raw.replace(/[^\d.,]/g, '').trim();
  if (!clean) return NaN;
  const normalized = clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean;
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : NaN;
}

const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const invoiceSchema = z.object({
  description: z.string().trim().min(3, 'Informe a descrição da cobrança').max(120, 'Descrição muito longa'),
  amount: z
    .number({ error: 'Informe um valor válido (ex: 1.150,00)' })
    .positive('O valor deve ser maior que zero')
    .max(1_000_000, 'Valor acima do limite permitido'),
  dueDateIso: z.string().min(10, 'Selecione a data de vencimento'),
  unitCount: z.number().min(1, 'Selecione ao menos uma unidade'),
});

export const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({
  isOpen,
  onClose,
  units,
  initialSelection,
  onSubmit,
}) => {
  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [blockFilter, setBlockFilter] = useState<string>('Todos');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const firstFieldRef = useRef<HTMLInputElement>(null);
  const bankSettings = useMemo(() => bankAccountService.getSettings(), [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    const t = setTimeout(() => firstFieldRef.current?.focus(), 50);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(t);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const due = new Date();
    due.setDate(due.getDate() + 10);
    setDescription(initialSelection === 'all' ? 'Condomínio Ordinário' : '');
    setAmountText('');
    setDueDate(toLocalIsoDate(due));
    setSelected(initialSelection === 'all' ? new Set(units.map((u) => u.id)) : new Set());
    setBlockFilter('Todos');
    setFieldErrors({});
    setFormError(null);
  }, [isOpen, initialSelection, units]);

  const blocks = useMemo(
    () => Array.from(new Set(units.map((u) => u.block))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [units]
  );

  const visibleUnits = useMemo(
    () => (blockFilter === 'Todos' ? units : units.filter((u) => u.block === blockFilter)),
    [units, blockFilter]
  );

  const amountValue = parseAmount(amountText);
  const allVisibleSelected = visibleUnits.length > 0 && visibleUnits.every((u) => selected.has(u.id));
  const totalPreview = Number.isNaN(amountValue) ? 0 : amountValue * selected.size;

  if (!isOpen) return null;

  const clearError = (key: string) => {
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const toggleUnit = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    clearError('unitCount');
  };

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleUnits.forEach((u) => next.delete(u.id));
      else visibleUnits.forEach((u) => next.add(u.id));
      return next;
    });
    clearError('unitCount');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const validation = invoiceSchema.safeParse({
      description,
      amount: amountValue,
      dueDateIso: dueDate,
      unitCount: selected.size,
    });

    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        const key = issue.path[0] as string | undefined;
        if (key && !errors[key]) errors[key] = issue.message;
      });
      setFieldErrors(errors);
      return;
    }

    const targets = units
      .filter((u) => selected.has(u.id))
      .map((u) => ({ unitId: u.id, residentName: u.ownerName || `Unidade ${u.number}` }));

    setIsSubmitting(true);
    const result = await onSubmit({
      description: description.trim(),
      amount: validation.data.amount,
      dueDateIso: dueDate,
      targets,
    });
    setIsSubmitting(false);

    if (result.success) onClose();
    else setFormError(result.error || 'Erro ao emitir cobranças.');
  };

  const inputBase =
    'w-full px-3 py-2 bg-slate-50 border text-slate-900 text-xs rounded-xl focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 font-semibold';
  const errBorder = 'border-rose-400';
  const okBorder = 'border-slate-200';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-invoice-modal-title"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-3xl shadow-floating-sidebar border border-slate-200 p-6 sm:p-7 z-10">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 id="create-invoice-modal-title" className="text-base font-bold text-slate-900">
                {initialSelection === 'all' ? 'Emitir Boletos em Lote' : 'Nova Cobrança Extra'}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Defina valor, vencimento e as unidades cobradas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {formError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {/* Banner do Banco Emissor Cadastrado */}
        <div className="mb-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-800">
                Banco Emissor: {bankSettings.bankName}
              </p>
              <p className="text-[11px] text-slate-500">
                Agência {bankSettings.agency} • Conta {bankSettings.accountNumber}-{bankSettings.accountDigit} • Carteira {bankSettings.walletCode} • Pix: {bankSettings.pixKey}
              </p>
            </div>
          </div>
          <span className="hidden sm:inline text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            QR Code Pix + Código FEBRABAN
          </span>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Descrição */}
          <div>
            <label
              htmlFor="invoice-description"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1"
            >
              Descrição *
            </label>
            <input
              id="invoice-description"
              ref={firstFieldRef}
              type="text"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                clearError('description');
              }}
              placeholder="Ex: Condomínio Ordinário"
              maxLength={120}
              className={`${inputBase} ${fieldErrors.description ? errBorder : okBorder}`}
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PRESET_DESCRIPTIONS.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => {
                    setDescription(preset);
                    clearError('description');
                  }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                    description === preset
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            {fieldErrors.description && (
              <p className="mt-1 text-[11px] text-rose-600 font-medium">{fieldErrors.description}</p>
            )}
          </div>

          {/* Valor e vencimento */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="invoice-amount"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1"
              >
                Valor por unidade *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-slate-400 pointer-events-none">
                  R$
                </span>
                <input
                  id="invoice-amount"
                  type="text"
                  inputMode="decimal"
                  value={amountText}
                  onChange={(e) => {
                    setAmountText(e.target.value);
                    clearError('amount');
                  }}
                  placeholder="1.150,00"
                  className={`${inputBase} pl-9 ${fieldErrors.amount ? errBorder : okBorder}`}
                />
              </div>
              {fieldErrors.amount && (
                <p className="mt-1 text-[11px] text-rose-600 font-medium">{fieldErrors.amount}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="invoice-due-date"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1"
              >
                Vencimento *
              </label>
              <div className="relative">
                <input
                  id="invoice-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    clearError('dueDateIso');
                  }}
                  className={`${inputBase} cursor-pointer ${fieldErrors.dueDateIso ? errBorder : okBorder}`}
                />
              </div>
              {fieldErrors.dueDateIso && (
                <p className="mt-1 text-[11px] text-rose-600 font-medium">{fieldErrors.dueDateIso}</p>
              )}
            </div>
          </div>

          {/* Unidades */}
          <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                Unidades *
              </span>
              <button
                type="button"
                onClick={toggleAllVisible}
                disabled={visibleUnits.length === 0}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 disabled:opacity-50 cursor-pointer"
              >
                {allVisibleSelected ? 'Limpar seleção' : 'Selecionar todas'}
              </button>
            </div>

            {units.length === 0 ? (
              <p className="text-xs text-slate-500 font-medium py-3 text-center">
                Nenhuma unidade cadastrada. Cadastre unidades na aba “Unidades” para emitir cobranças.
              </p>
            ) : (
              <>
                {blocks.length > 1 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {['Todos', ...blocks].map((b) => (
                      <button
                        type="button"
                        key={b}
                        onClick={() => setBlockFilter(b)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                          blockFilter === b
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {b === 'Todos' ? 'Todos' : `Bloco ${b}`}
                      </button>
                    ))}
                  </div>
                )}

                <ul className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  {visibleUnits.map((u) => (
                    <li key={u.id}>
                      <label className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={selected.has(u.id)}
                          onChange={() => toggleUnit(u.id)}
                          className="w-3.5 h-3.5 accent-emerald-600 cursor-pointer"
                        />
                        <span className="font-bold text-slate-800">
                          Bloco {u.block} · {u.number}
                        </span>
                        <span className="text-slate-500 font-medium truncate">{u.ownerName}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {fieldErrors.unitCount && (
              <p className="mt-1 text-[11px] text-rose-600 font-medium">{fieldErrors.unitCount}</p>
            )}
          </div>

          {/* Prévia */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-emerald-800">
              <CalendarDays className="w-3.5 h-3.5" />
              {selected.size} {selected.size === 1 ? 'cobrança' : 'cobranças'}
            </span>
            <span className="font-bold text-emerald-800">Total: {formatBRL(totalPreview)}</span>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 rounded-xl shadow-pill transition-all flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Emitindo...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Emitir Cobranças</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
