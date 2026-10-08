import React, { useState, useEffect, useRef } from 'react';
import { z } from 'zod';
import { X, Wrench, CheckCircle2, AlertCircle, Calendar, Clock, MapPin, User, Building } from 'lucide-react';
import type { CreateMaintenanceOrderInput } from '../../services/maintenanceService';
import type { MaintenanceOrderDbPriority } from '../../types/database.types';

const PRESET_TITLES = [
  'Manutenção Preventiva de Bombas',
  'Troca de Lâmpadas / Painéis LED',
  'Reparo Hidráulico / Vazamento',
  'Inspeção Semestral de Elevadores',
  'Revisão Portões de Acesso e Eclusa',
];

const CATEGORIES = [
  'Elétrica',
  'Hidráulica',
  'Elevadores',
  'Predial & Alvenaria',
  'Segurança & CFTV',
  'Jardinagem & Áreas Comuns',
  'Prevenção de Incêndio (AVCB)',
];

const PRIORITIES: MaintenanceOrderDbPriority[] = [
  'Preventiva',
  'Normal',
  'Média',
  'Prioridade Máxima',
];

const maintenanceSchema = z.object({
  title: z.string().trim().min(3, 'Informe o título do chamado / OS').max(150, 'Título muito longo'),
  location: z.string().trim().min(3, 'Informe o local ou área afetada (ex: Torre A, Subsolo)'),
  category: z.string().trim().min(2, 'Selecione a categoria técnica'),
  priority: z.enum(['Prioridade Máxima', 'Média', 'Normal', 'Preventiva']),
  scheduledDate: z.string().min(10, 'Selecione a data prevista'),
  scheduledTime: z.string().trim().min(2, 'Informe o horário previsto (ex: 09:00 ou Manhã)'),
  description: z.string().trim().min(5, 'Descreva os serviços ou detalhes técnicos'),
  technicianName: z.string().trim().optional(),
  technicianCompany: z.string().trim().optional(),
  materialsReserved: z.boolean().optional(),
});

export interface CreateMaintenanceOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  condominiumId: string;
  onSubmit: (input: CreateMaintenanceOrderInput) => Promise<{ success: boolean; error?: string }>;
}

export const CreateMaintenanceOrderModal: React.FC<CreateMaintenanceOrderModalProps> = ({
  isOpen,
  onClose,
  condominiumId,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('Elétrica');
  const [priority, setPriority] = useState<MaintenanceOrderDbPriority>('Normal');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [description, setDescription] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [technicianCompany, setTechnicianCompany] = useState('');
  const [materialsReserved, setMaterialsReserved] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialFocusRef = useRef<HTMLInputElement>(null);

  // Focus and ESC handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    const t = setTimeout(() => initialFocusRef.current?.focus(), 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(t);
    };
  }, [isOpen, onClose]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().slice(0, 10);
      setTitle('');
      setLocation('');
      setCategory('Elétrica');
      setPriority('Normal');
      setScheduledDate(today);
      setScheduledTime('09:00');
      setDescription('');
      setTechnicianName('');
      setTechnicianCompany('');
      setMaterialsReserved(false);
      setFieldErrors({});
      setFormError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const clearError = (key: string) => {
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const validation = maintenanceSchema.safeParse({
      title,
      location,
      category,
      priority,
      scheduledDate,
      scheduledTime,
      description,
      technicianName,
      technicianCompany,
      materialsReserved,
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

    setIsSubmitting(true);
    const result = await onSubmit({
      condominium_id: condominiumId,
      title: title.trim(),
      location: location.trim(),
      category,
      priority,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime.trim(),
      description: description.trim(),
      technician_name: technicianName.trim() || undefined,
      technician_company: technicianCompany.trim() || undefined,
      materials_reserved: materialsReserved,
    });
    setIsSubmitting(false);

    if (result.success) {
      onClose();
    } else {
      setFormError(result.error || 'Erro ao criar ordem de serviço.');
    }
  };

  const inputBase =
    'w-full py-2.5 bg-slate-50 dark:bg-slate-800 border text-slate-900 dark:text-slate-100 text-xs rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 font-semibold transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500';
  const errBorder = 'border-rose-400 dark:border-rose-500';
  const okBorder = 'border-slate-200 dark:border-slate-700';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-maintenance-modal-title"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl shadow-floating-sidebar border border-slate-200 dark:border-slate-800 p-6 sm:p-7 z-10">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 id="create-maintenance-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                Nova Ordem de Serviço (OS)
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Abra chamados para manutenções preventivas ou reparos emergenciais
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

        {/* Error Alert */}
        {formError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Título & Atalhos */}
          <div>
            <label
              htmlFor="os-title"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
            >
              Título da Ordem de Serviço *
            </label>
            <input
              id="os-title"
              ref={initialFocusRef}
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                clearError('title');
              }}
              placeholder="Ex: Inspeção Preventiva Elevadores"
              className={`${inputBase} px-3.5 ${fieldErrors.title ? errBorder : okBorder}`}
            />
            {fieldErrors.title && (
              <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.title}</p>
            )}

            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PRESET_TITLES.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => {
                    setTitle(preset);
                    if (preset.includes('Elevadores')) setCategory('Elevadores');
                    else if (preset.includes('Lâmpadas') || preset.includes('LED')) setCategory('Elétrica');
                    else if (preset.includes('Hidráulico') || preset.includes('Bombas')) setCategory('Hidráulica');
                    else if (preset.includes('Portões')) setCategory('Segurança & CFTV');
                    clearError('title');
                  }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                    title === preset
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Categoria & Prioridade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="os-category"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
              >
                Categoria Técnica *
              </label>
              <select
                id="os-category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  clearError('category');
                }}
                className={`${inputBase} px-3.5 ${fieldErrors.category ? errBorder : okBorder}`}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {fieldErrors.category && (
                <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.category}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="os-priority"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
              >
                Nível de Prioridade *
              </label>
              <select
                id="os-priority"
                value={priority}
                onChange={(e) => {
                  setPriority(e.target.value as MaintenanceOrderDbPriority);
                  clearError('priority');
                }}
                className={`${inputBase} px-3.5 ${fieldErrors.priority ? errBorder : okBorder}`}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              {fieldErrors.priority && (
                <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.priority}</p>
              )}
            </div>
          </div>

          {/* Localização / Área Afetada */}
          <div>
            <label
              htmlFor="os-location"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
            >
              Localização / Área Afetada *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none">
                <MapPin className="w-4 h-4" />
              </span>
              <input
                id="os-location"
                type="text"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  clearError('location');
                }}
                placeholder="Ex: Torre A • Subsolo 2 • Casa de Máquinas"
                className={`${inputBase} pl-10 pr-3.5 ${fieldErrors.location ? errBorder : okBorder}`}
              />
            </div>
            {fieldErrors.location && (
              <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.location}</p>
            )}
          </div>

          {/* Data Prevista & Horário */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="os-scheduled-date"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
              >
                Data Prevista *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none">
                  <Calendar className="w-4 h-4" />
                </span>
                <input
                  id="os-scheduled-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => {
                    setScheduledDate(e.target.value);
                    clearError('scheduledDate');
                  }}
                  className={`${inputBase} pl-10 pr-3.5 cursor-pointer ${fieldErrors.scheduledDate ? errBorder : okBorder}`}
                />
              </div>
              {fieldErrors.scheduledDate && (
                <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.scheduledDate}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="os-scheduled-time"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
              >
                Horário / Previsão *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none">
                  <Clock className="w-4 h-4" />
                </span>
                <input
                  id="os-scheduled-time"
                  type="text"
                  value={scheduledTime}
                  onChange={(e) => {
                    setScheduledTime(e.target.value);
                    clearError('scheduledTime');
                  }}
                  placeholder="Ex: 09:00 ou Manhã (08h às 12h)"
                  className={`${inputBase} pl-10 pr-3.5 ${fieldErrors.scheduledTime ? errBorder : okBorder}`}
                />
              </div>
              {fieldErrors.scheduledTime && (
                <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.scheduledTime}</p>
              )}
            </div>
          </div>

          {/* Técnico & Empresa Prestadora */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="os-technician-name"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
              >
                Técnico Responsável
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none">
                  <User className="w-4 h-4" />
                </span>
                <input
                  id="os-technician-name"
                  type="text"
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  placeholder="Ex: Eng. Marcos Fonseca"
                  className={`${inputBase} pl-10 pr-3.5 ${okBorder}`}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="os-technician-company"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
              >
                Empresa Prestadora
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none">
                  <Building className="w-4 h-4" />
                </span>
                <input
                  id="os-technician-company"
                  type="text"
                  value={technicianCompany}
                  onChange={(e) => setTechnicianCompany(e.target.value)}
                  placeholder="Ex: Atlas Schindler, Sabesp"
                  className={`${inputBase} pl-10 pr-3.5 ${okBorder}`}
                />
              </div>
            </div>
          </div>

          {/* Descrição dos Serviços */}
          <div>
            <label
              htmlFor="os-description"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
            >
              Descrição & Instruções Técnicas *
            </label>
            <textarea
              id="os-description"
              rows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                clearError('description');
              }}
              placeholder="Descreva o escopo do serviço, procedimentos de segurança e laudos necessários..."
              className={`${inputBase} px-3.5 resize-none ${fieldErrors.description ? errBorder : okBorder}`}
            />
            {fieldErrors.description && (
              <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.description}</p>
            )}
          </div>

          {/* Checkbox Materiais Reservados */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-800">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={materialsReserved}
                onChange={(e) => setMaterialsReserved(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 cursor-pointer rounded"
              />
              <span>Materiais e peças já reservados no almoxarifado do condomínio</span>
            </label>
          </div>

          {/* Botões */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer"
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
                  <span>Registrando OS...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Abrir Ordem de Serviço</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
