import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { z } from 'zod';
import { X, Building, User, Hash, Layers, Car, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { CreateUnitInput } from '../../services/unitService';

const unitSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'Informe o número da unidade (ex: 101, 402)')
    .max(10, 'O número da unidade deve ter no máximo 10 caracteres'),
  block: z
    .string()
    .trim()
    .min(1, 'Selecione ou informe o bloco/torre'),
  floor: z
    .number()
    .int('O andar deve ser um número inteiro')
    .min(0, 'O andar deve ser 0 (térreo) ou superior')
    .max(50, 'Andar máximo permitido: 50')
    .nullable()
    .optional(),
  contactName: z
    .string()
    .trim()
    .min(2, 'Informe o nome do morador responsável (mínimo 2 caracteres)'),
  residentType: z.enum(['Proprietário', 'Inquilino']),
  parkingSpot: z
    .string()
    .trim()
    .optional(),
  hasPet: z.boolean().default(false),
});

export interface CreateUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  condominiumId: string;
  condominiumName: string;
  onUnitCreated: (unitData: CreateUnitInput) => Promise<{ success: boolean; error?: string }>;
}

export const CreateUnitModal: React.FC<CreateUnitModalProps> = ({
  isOpen,
  onClose,
  condominiumId,
  condominiumName,
  onUnitCreated,
}) => {
  const { canManageUsers } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [block, setBlock] = useState('Bloco A');
  const [floor, setFloor] = useState<number | ''>('');
  const [contactName, setContactName] = useState('');
  const [residentType, setResidentType] = useState<'Proprietário' | 'Inquilino'>('Proprietário');
  const [parkingSpot, setParkingSpot] = useState('');
  const [hasPet, setHasPet] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLInputElement>(null);

  // Focus trap and ESC key dismiss per accessible-components & modals-and-dialogs
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Focus initial input
    setTimeout(() => {
      initialFocusRef.current?.focus();
    }, 50);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setIdentifier('');
      setBlock('Bloco A');
      setFloor('');
      setContactName('');
      setResidentType('Proprietário');
      setParkingSpot('');
      setHasPet(false);
      setFieldErrors({});
      setFormError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  if (!canManageUsers) {
    return (
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Cadastro Restrito</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Apenas o Síndico Geral e o Super Administrador possuem autorização para cadastrar novas unidades e moradores.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageUsers) {
      setFormError('Acesso negado: apenas o Síndico e o Super Administrador podem cadastrar novas unidades e moradores.');
      return;
    }
    setFormError(null);
    setFieldErrors({});

    const parsedFloor = floor === '' ? null : Number(floor);

    const validation = unitSchema.safeParse({
      identifier,
      block,
      floor: parsedFloor,
      contactName,
      residentType,
      parkingSpot: parkingSpot.trim() || undefined,
      hasPet,
    });

    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          errors[issue.path[0] as string] = issue.message;
        }
      });
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    const result = await onUnitCreated({
      condominium_id: condominiumId,
      identifier: identifier.trim(),
      block: block.trim(),
      floor: parsedFloor,
      contactName: contactName.trim(),
      ownerName: contactName.trim(),
      residentType,
      parkingSpot: parkingSpot.trim() || `G-${identifier.trim()}`,
      hasPet,
    });
    setIsSubmitting(false);

    if (result.success) {
      onClose(); // Close only on success (as per modals-and-dialogs skill)
    } else {
      setFormError(result.error || 'Erro ao cadastrar unidade no banco.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-unit-modal-title"
    >
      {/* Click outside backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal Dialog Card */}
      <div
        ref={modalRef}
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-floating-sidebar border border-slate-200 p-6 sm:p-7 z-10 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Building className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 id="create-unit-modal-title" className="text-base font-bold text-slate-900">
                Cadastrar Nova Unidade
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {condominiumName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Error Alert */}
        {formError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Identifier / Number */}
            <div>
              <label
                htmlFor="unit-number-input"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1"
              >
                Número / Apto *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Hash className="w-3.5 h-3.5" />
                </div>
                <input
                  id="unit-number-input"
                  ref={initialFocusRef}
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (fieldErrors.identifier) setFieldErrors({ ...fieldErrors, identifier: '' });
                  }}
                  placeholder="Ex: 402"
                  className={`w-full pl-8 pr-3 py-2 bg-slate-50 border text-slate-900 text-xs rounded-xl focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 font-semibold ${
                    fieldErrors.identifier ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                  }`}
                />
              </div>
              {fieldErrors.identifier && (
                <p className="mt-1 text-[11px] text-rose-600 font-medium">{fieldErrors.identifier}</p>
              )}
            </div>

            {/* Block Selection */}
            <div>
              <label
                htmlFor="unit-block-input"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1"
              >
                Bloco / Torre *
              </label>
              <select
                id="unit-block-input"
                value={block}
                onChange={(e) => setBlock(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 font-semibold"
              >
                <option value="Bloco A">Bloco A (Cerejeiras)</option>
                <option value="Bloco B">Bloco B (Ipês)</option>
                <option value="Torre Única">Torre Única</option>
                <option value="Bloco C">Bloco C</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Floor */}
            <div>
              <label
                htmlFor="unit-floor-input"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1"
              >
                Andar
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <input
                  id="unit-floor-input"
                  type="number"
                  min="0"
                  max="50"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  placeholder="Ex: 4"
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                />
              </div>
            </div>

            {/* Parking Spot */}
            <div>
              <label
                htmlFor="unit-parking-input"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1"
              >
                Vaga de Garagem
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Car className="w-3.5 h-3.5" />
                </div>
                <input
                  id="unit-parking-input"
                  type="text"
                  value={parkingSpot}
                  onChange={(e) => setParkingSpot(e.target.value)}
                  placeholder="Ex: G-14 (Subsolo 1)"
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Contact Name */}
          <div>
            <label
              htmlFor="unit-contact-input"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1"
            >
              Morador Titular / Responsável *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-3.5 h-3.5" />
              </div>
              <input
                id="unit-contact-input"
                type="text"
                value={contactName}
                onChange={(e) => {
                  setContactName(e.target.value);
                  if (fieldErrors.contactName) setFieldErrors({ ...fieldErrors, contactName: '' });
                }}
                placeholder="Nome completo do morador principal"
                className={`w-full pl-8 pr-3 py-2 bg-slate-50 border text-slate-900 text-xs rounded-xl focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  fieldErrors.contactName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                }`}
              />
            </div>
            {fieldErrors.contactName && (
              <p className="mt-1 text-[11px] text-rose-600 font-medium">{fieldErrors.contactName}</p>
            )}
          </div>

          {/* Resident Type & Pet Checkbox */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700">Tipo:</span>
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="residentType"
                  checked={residentType === 'Proprietário'}
                  onChange={() => setResidentType('Proprietário')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                Proprietário
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="residentType"
                  checked={residentType === 'Inquilino'}
                  onChange={() => setResidentType('Inquilino')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                Inquilino
              </label>
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={hasPet}
                onChange={(e) => setHasPet(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded-sm border-slate-300 focus:ring-emerald-500"
              />
              Possui Animal (Pet)
            </label>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 rounded-xl shadow-pill transition-all flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Salvando no banco...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Cadastrar Unidade</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
