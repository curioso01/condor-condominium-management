import React, { useState, useEffect, useRef } from 'react';
import { z } from 'zod';
import { X, Calendar as CalendarIcon, Clock, User, Home, CheckCircle2, AlertCircle } from 'lucide-react';
import { checkReservationConflict, type CreateReservationInput } from '../../services/amenityService';
import type { CommonArea } from '../../types/database.types';
import type { AmenityReservation } from '../../types/condominium';

const TIME_OPTIONS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30',
  '23:00', '23:30', '23:59'
];

const PRESET_SLOTS = [
  { label: '🌅 Manhã', start: '08:00', end: '12:30' },
  { label: '☀️ Tarde', start: '13:00', end: '17:30' },
  { label: '🌙 Noite', start: '18:00', end: '23:30' },
  { label: '🌟 Dia Inteiro', start: '09:00', end: '22:00' },
];

const reservationSchema = z.object({
  spaceName: z.string().trim().min(2, 'Selecione o espaço comum'),
  date: z.string().trim().min(10, 'Selecione a data no calendário'),
  startTime: z.string().trim().min(5, 'Selecione o horário inicial'),
  endTime: z.string().trim().min(5, 'Selecione o horário final'),
  responsibleName: z.string().trim().min(2, 'Informe o nome do morador responsável'),
  unitNumber: z.string().trim().min(1, 'Informe a unidade solicitante'),
}).refine((data) => data.endTime > data.startTime, {
  message: 'O horário de término deve ser posterior ao horário de início',
  path: ['endTime'],
});

export interface CreateReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  condominiumId: string;
  commonAreas: CommonArea[];
  initialDate?: string;
  existingReservations?: AmenityReservation[];
  onReservationCreated: (input: CreateReservationInput) => Promise<{ success: boolean; error?: string }>;
}

export const CreateReservationModal: React.FC<CreateReservationModalProps> = ({
  isOpen,
  onClose,
  condominiumId,
  commonAreas,
  initialDate,
  existingReservations = [],
  onReservationCreated,
}) => {
  const [spaceName, setSpaceName] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('23:00');
  const [responsibleName, setResponsibleName] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [emoji, setEmoji] = useState('🎉');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialFocusRef = useRef<HTMLSelectElement>(null);

  // Focus trap and ESC key dismiss
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    setTimeout(() => {
      initialFocusRef.current?.focus();
    }, 50);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSpaceName(commonAreas[0]?.name || 'Salão de Festas Principal');
      
      // Default to initialDate if provided, or next Saturday by default
      if (initialDate) {
        setDate(initialDate);
      } else {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        setDate(`${year}-${month}-${day}`);
      }

      setStartTime('18:00');
      setEndTime('23:00');
      setResponsibleName('');
      setUnitNumber('');
      setEmoji('🎉');
      setFieldErrors({});
      setFormError(null);
    }
  }, [isOpen, commonAreas, initialDate]);

  if (!isOpen) return null;

  // Format readable preview date
  const getReadableDatePreview = () => {
    if (!date) return '';
    try {
      const [y, m, d] = date.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return date;
    }
  };

  const handleApplyPreset = (start: string, end: string) => {
    setStartTime(start);
    setEndTime(end);
    if (fieldErrors.endTime) {
      const updated = { ...fieldErrors };
      delete updated.endTime;
      setFieldErrors(updated);
    }
  };

  // Find all existing bookings for the selected space and date
  const conflictingReservationsForDate = existingReservations.filter((r) => {
    const sameSpace = r.spaceName.trim().toLowerCase() === spaceName.trim().toLowerCase();
    const sameDate = r.date === date;
    return sameSpace && sameDate;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const validation = reservationSchema.safeParse({
      spaceName,
      date,
      startTime,
      endTime,
      responsibleName,
      unitNumber,
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

    // Double-booking prevention check:
    const conflict = checkReservationConflict(
      spaceName,
      date,
      startTime,
      endTime,
      existingReservations
    );

    if (conflict) {
      setFormError(
        `Conflito de agendamento: O espaço "${spaceName}" já está reservado no dia ${getReadableDatePreview()} das ${conflict.startTime} às ${conflict.endTime} por ${conflict.responsibleName} (${conflict.unitNumber}). Escolha outro horário ou espaço comum.`
      );
      return;
    }

    setIsSubmitting(true);
    const result = await onReservationCreated({
      condominium_id: condominiumId,
      spaceName: spaceName.trim(),
      emoji,
      date,
      startTime,
      endTime,
      responsibleName: responsibleName.trim(),
      unitNumber: unitNumber.trim(),
      status: 'Aprovado / Taxa Paga',
      statusType: 'success',
    });
    setIsSubmitting(false);

    if (result.success) {
      onClose();
    } else {
      setFormError(result.error || 'Erro ao agendar reserva.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-reservation-modal-title"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-floating-sidebar border border-slate-200 dark:border-slate-800 p-6 sm:p-7 z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold">
              <CalendarIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 id="create-reservation-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                Nova Reserva de Espaço Comum
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Selecione a data no calendário e o horário do evento
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Error Alert */}
        {formError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* 1. Space Selection */}
          <div>
            <label
              htmlFor="reservation-space-input"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
            >
              Espaço Comum *
            </label>
            <div className="flex gap-2">
              <select
                id="reservation-space-input"
                ref={initialFocusRef}
                value={spaceName}
                onChange={(e) => {
                  setSpaceName(e.target.value);
                  if (e.target.value.includes('Gourmet') || e.target.value.includes('Churrasco')) setEmoji('🥩');
                  else if (e.target.value.includes('Piscina')) setEmoji('🏊‍♂️');
                  else if (e.target.value.includes('Academia')) setEmoji('🏋️');
                  else setEmoji('🎉');
                }}
                className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 font-semibold"
              >
                {commonAreas.length > 0 ? (
                  commonAreas.map((area) => (
                    <option key={area.id} value={area.name}>
                      {area.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Salão de Festas Principal">Salão de Festas Principal</option>
                    <option value="Espaço Gourmet & Churrasqueira">Espaço Gourmet & Churrasqueira</option>
                    <option value="Quiosque da Piscina">Quiosque da Piscina</option>
                    <option value="Academia & Fitness Center">Academia & Fitness Center</option>
                  </>
                )}
              </select>
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-base border border-slate-200 dark:border-slate-700 shrink-0">
                {emoji}
              </div>
            </div>
            {fieldErrors.spaceName && (
              <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.spaceName}</p>
            )}
          </div>

          {/* 2. Date Picker (Interactive Calendar) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="reservation-date-input"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
              >
                Data da Reserva (Selecione no Calendário) *
              </label>
              {date && (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 capitalize">
                  {getReadableDatePreview()}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="reservation-date-input"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (fieldErrors.date) setFieldErrors({ ...fieldErrors, date: '' });
                }}
                className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border text-slate-900 dark:text-slate-100 text-xs rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 font-semibold cursor-pointer ${
                  fieldErrors.date ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 dark:border-slate-700'
                }`}
              />
            </div>
            {fieldErrors.date && (
              <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.date}</p>
            )}
          </div>

          {/* 3. Time Selection (Interactive Pickers & Presets) */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                Horário do Evento *
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {startTime} às {endTime}
              </span>
            </div>

            {/* Quick Shift Presets */}
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {PRESET_SLOTS.map((slot) => {
                const isActive = startTime === slot.start && endTime === slot.end;
                return (
                  <button
                    type="button"
                    key={slot.label}
                    onClick={() => handleApplyPreset(slot.start, slot.end)}
                    className={`py-1 px-1.5 rounded-lg text-[10px] font-bold transition-all text-center cursor-pointer border ${
                      isActive
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>

            {/* Dropdown Selectors for Custom Hours */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="reservation-start-time"
                  className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1"
                >
                  Início
                </label>
                <select
                  id="reservation-start-time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {TIME_OPTIONS.slice(0, -1).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="reservation-end-time"
                  className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1"
                >
                  Término
                </label>
                <select
                  id="reservation-end-time"
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    if (fieldErrors.endTime) setFieldErrors({ ...fieldErrors, endTime: '' });
                  }}
                  className={`w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border text-slate-900 dark:text-slate-100 text-xs rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    fieldErrors.endTime ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {TIME_OPTIONS.slice(1).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {fieldErrors.endTime && (
              <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.endTime}</p>
            )}

            {/* Occupied slots indicator for the selected space and date */}
            {conflictingReservationsForDate.length > 0 && (
              <div className="mt-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-[11px]">
                <span className="font-bold block mb-1">
                  ⚠️ Atenção: Horários já agendados para este espaço nesta data:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {conflictingReservationsForDate.map((r) => (
                    <span
                      key={r.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-200/70 dark:bg-amber-900/60 font-semibold text-[10px]"
                    >
                      <span>{r.startTime} às {r.endTime}</span>
                      <span className="opacity-75">({r.responsibleName} - {r.unitNumber})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 4. Responsible & Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="reservation-responsible-input"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
              >
                Morador Responsável *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="reservation-responsible-input"
                  type="text"
                  value={responsibleName}
                  onChange={(e) => {
                    setResponsibleName(e.target.value);
                    if (fieldErrors.responsibleName) setFieldErrors({ ...fieldErrors, responsibleName: '' });
                  }}
                  placeholder="Nome do morador"
                  className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border text-slate-900 dark:text-slate-100 text-xs rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    fieldErrors.responsibleName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
              </div>
              {fieldErrors.responsibleName && (
                <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.responsibleName}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="reservation-unit-input"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
              >
                Unidade / Apartamento *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Home className="w-4 h-4" />
                </div>
                <input
                  id="reservation-unit-input"
                  type="text"
                  value={unitNumber}
                  onChange={(e) => {
                    setUnitNumber(e.target.value);
                    if (fieldErrors.unitNumber) setFieldErrors({ ...fieldErrors, unitNumber: '' });
                  }}
                  placeholder="Ex: 101, 402"
                  className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border text-slate-900 dark:text-slate-100 text-xs rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 font-semibold ${
                    fieldErrors.unitNumber ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
              </div>
              {fieldErrors.unitNumber && (
                <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.unitNumber}</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer"
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
                  <span>Confirmando reserva...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Aprovar & Confirmar Reserva</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
