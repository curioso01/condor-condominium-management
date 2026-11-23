import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
import { unitService, type CreateUnitInput } from '../../services/unitService';
import type { CondominiumRole } from '../../types/database.types';
import { 
  X, 
  ShieldCheck, 
  UserPlus, 
  AlertCircle, 
  CheckCircle2, 
  Lock 
} from 'lucide-react';

export interface CreateUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  condominiumId: string;
  condominiumName: string;
  onUnitCreated?: (unitData: CreateUnitInput) => Promise<{ success: boolean; error?: string }>;
  onSuccess?: (message: string) => void;
}

export const CreateUnitModal: React.FC<CreateUnitModalProps> = ({
  isOpen,
  onClose,
  condominiumId,
  condominiumName,
  onUnitCreated,
  onSuccess,
}) => {
  const { canManageUsers, isSuperAdmin, currentRole } = useAuth();

  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [apartment, setApartment] = useState('');
  const [block, setBlock] = useState('Bloco A');
  const [residentType, setResidentType] = useState<'Proprietário' | 'Inquilino'>('Proprietário');
  const [hasPet, setHasPet] = useState(false);
  const [role, setRole] = useState<CondominiumRole>('morador');

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLInputElement>(null);

  // Esc key dismiss
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
      setFullName('');
      setCpf('');
      setEmail('');
      setPhone('');
      setApartment('');
      setBlock('Bloco A');
      setResidentType('Proprietário');
      setHasPet(false);
      setRole('morador');
      setFormError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Apenas o Síndico e o Superadmin podem fazer cadastro
  if (!canManageUsers) {
    return (
      <div 
        role="dialog" 
        aria-modal="true" 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn"
      >
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Acesso Restrito
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Apenas o <strong>Síndico Geral</strong> e o <strong>Super Administrador</strong> possuem permissão para cadastrar novos moradores, colaboradores ou unidades no sistema.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold transition cursor-pointer"
          >
            Entendido, fechar
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageUsers) {
      setFormError('Acesso negado: apenas o Síndico e o Super Administrador podem cadastrar novos usuários e unidades.');
      return;
    }

    if (!fullName.trim() || !email.trim()) {
      setFormError('Por favor, informe ao menos o Nome Completo e o E-mail de acesso.');
      return;
    }

    if (!apartment.trim()) {
      setFormError('Por favor, informe o número do Apartamento / Unidade.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const condoId = condominiumId || 'condo-imperial-001';
    const formattedUnit = `${apartment.trim()} (${block})`;

    // 1. Cadastrar usuário no controle RBAC de usuários
    const resUser = await userService.createUser(
      {
        condominium_id: condoId,
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        cpf: cpf.trim() || undefined,
        unit_number: formattedUnit,
        block: block.trim(),
        resident_type: residentType,
        has_pet: hasPet,
        role: role,
      },
      currentRole
    );

    if (resUser.error) {
      setIsSubmitting(false);
      setFormError(resUser.error.message);
      return;
    }

    // 2. Registrar ou atualizar a unidade no Censo e no diretório de unidades
    const resUnit = await unitService.registerOrUpdateResidentUnit({
      condominium_id: condoId,
      identifier: apartment.trim(),
      block: block.trim(),
      residentName: fullName.trim(),
      residentType: residentType,
      hasPet: hasPet,
      phone: phone.trim() || undefined,
      cpf: cpf.trim() || undefined,
      email: email.trim(),
    });

    // Se houver callback legado para compatibilidade
    if (onUnitCreated) {
      await onUnitCreated({
        condominium_id: condoId,
        identifier: apartment.trim(),
        block: block.trim(),
        ownerName: fullName.trim(),
        contactName: fullName.trim(),
        residentType: residentType,
        hasPet: hasPet,
      });
    }

    setIsSubmitting(false);

    if (resUnit.error) {
      setFormError(`Usuário cadastrado, mas ocorreu um alerta ao atualizar a unidade: ${resUnit.error.message}`);
      return;
    }

    // Dispara evento para atualização imediata do Censo e da lista de unidades
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('condor:units-updated'));
    }

    const successMsg = `Morador ${fullName.trim()} cadastrado com sucesso na unidade ${apartment.trim()} (${block}) e sincronizado com o Censo!`;
    if (onSuccess) {
      onSuccess(successMsg);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-resident-modal-title"
    >
      {/* Click outside backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal Dialog Card */}
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 z-10 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold border border-emerald-200 dark:border-emerald-800 shrink-0">
              <UserPlus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="create-resident-modal-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  Cadastrar Novo Morador ou Unidade
                </h2>
                <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 uppercase flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  RBAC
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {condominiumName} • Cadastro unificado de usuários, unidades e permissões
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Error Alert */}
        {formError && (
          <div
            role="alert"
            className="mb-4 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {/* Form - Exactly matching Usuarios e Privilégios */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Nome Completo */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Nome Completo *
              </label>
              <input
                ref={initialFocusRef}
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Beatriz Lima Duarte"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            {/* CPF */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                CPF
              </label>
              <input
                type="text"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="000.000.000-00"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* E-mail */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                E-mail de Acesso *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: beatriz@condor.com.br"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            {/* Telefone */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Telefone / WhatsApp
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 98765-4321"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Apartamento / Unidade */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Apartamento / Unidade *
              </label>
              <input
                type="text"
                value={apartment}
                onChange={(e) => setApartment(e.target.value)}
                placeholder="Ex: 402 ou 104"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            {/* Bloco / Torre */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Bloco / Torre *
              </label>
              <select
                value={block}
                onChange={(e) => setBlock(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="Bloco A">Bloco A (Torre A)</option>
                <option value="Bloco B">Bloco B (Torre B)</option>
                <option value="Bloco C">Bloco C</option>
                <option value="Torre Sul">Torre Sul</option>
                <option value="Torre Norte">Torre Norte</option>
              </select>
            </div>

            {/* Vínculo do Morador */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Vínculo do Morador *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setResidentType('Proprietário')}
                  className={`py-2 px-3 rounded-2xl text-xs font-semibold border transition text-center cursor-pointer ${
                    residentType === 'Proprietário'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-bold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  Proprietário
                </button>
                <button
                  type="button"
                  onClick={() => setResidentType('Inquilino')}
                  className={`py-2 px-3 rounded-2xl text-xs font-semibold border transition text-center cursor-pointer ${
                    residentType === 'Inquilino'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-bold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  Inquilino
                </button>
              </div>
            </div>

            {/* Possui Pet */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Possui Pet / Animal de Estimação? *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setHasPet(true)}
                  className={`py-2 px-3 rounded-2xl text-xs font-semibold border transition text-center cursor-pointer ${
                    hasPet
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-bold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  🐾 Sim (Tem Pet)
                </button>
                <button
                  type="button"
                  onClick={() => setHasPet(false)}
                  className={`py-2 px-3 rounded-2xl text-xs font-semibold border transition text-center cursor-pointer ${
                    !hasPet
                      ? 'border-slate-800 dark:border-slate-300 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  Não possui
                </button>
              </div>
            </div>
          </div>

          {/* Privilégio / Papel Concedido (RBAC) */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 mt-2">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                Privilégio / Papel Concedido *
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                Avaliação de permissões pelo Síndico
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label
                className={`p-2.5 rounded-xl border flex flex-col cursor-pointer transition ${
                  role === 'morador'
                    ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 font-bold'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100/60 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="create-unit-user-role"
                    value="morador"
                    checked={role === 'morador'}
                    onChange={() => setRole('morador')}
                    className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-xs">Morador</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 pl-5">Reservas, avisos e boletos</span>
              </label>

              <label
                className={`p-2.5 rounded-xl border flex flex-col cursor-pointer transition ${
                  role === 'porteiro'
                    ? 'border-sky-600 bg-sky-50/60 dark:bg-sky-950/40 text-sky-950 dark:text-sky-200 font-bold'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100/60 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="create-unit-user-role"
                    value="porteiro"
                    checked={role === 'porteiro'}
                    onChange={() => setRole('porteiro')}
                    className="text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                  <span className="text-xs">Portaria & Acessos</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 pl-5">Guarita, encomendas e lockers</span>
              </label>

              <label
                className={`p-2.5 rounded-xl border flex flex-col cursor-pointer transition ${
                  role === 'sindico'
                    ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 font-bold'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100/60 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="create-unit-user-role"
                    value="sindico"
                    checked={role === 'sindico'}
                    onChange={() => setRole('sindico')}
                    className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-xs">Síndico Geral</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 pl-5">Gestão total e novos cadastros</span>
              </label>

              {isSuperAdmin && (
                <label
                  className={`p-2.5 rounded-xl border flex flex-col cursor-pointer transition sm:col-span-3 ${
                    role === 'superadmin'
                      ? 'border-purple-600 bg-purple-50/60 dark:bg-purple-950/40 text-purple-950 dark:text-purple-200 font-bold'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100/60 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="create-unit-user-role"
                      value="superadmin"
                      checked={role === 'superadmin'}
                      onChange={() => setRole('superadmin')}
                      className="text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                      Super Administrador (Acesso Geral Multi-Condomínios)
                    </span>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 rounded-xl shadow-pill transition-all flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Cadastrando no sistema...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirmar e Cadastrar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
