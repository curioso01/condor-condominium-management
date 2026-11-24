import React, { useState, useEffect } from 'react';
import { X, QrCode, Check, Share2, Shield } from 'lucide-react';
import { generateSecurePin } from '../../services/packageService';
import { QrCodeDisplay } from '../common/QrCodeDisplay';
import { PremiumSelect } from '../ui/PremiumSelect';
import { PremiumDatePicker } from '../ui/PremiumDatePicker';
import type { Unit } from '../../types/condominium';

export interface VisitorPassData {
  unitNumber: string;
  visitorName: string;
  documentNumber: string;
  visitDate: string;
  visitorType: 'Convidado Social' | 'Prestador de Serviço' | 'Delivery Autorizado';
  vehiclePlate?: string;
  tokenCode: string;
}

export interface CreateVisitorPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  units?: Unit[];
  onPassCreated: (pass: VisitorPassData) => Promise<{ success: boolean; error?: string }> | void;
}

export const CreateVisitorPassModal: React.FC<CreateVisitorPassModalProps> = ({
  isOpen,
  onClose,
  units = [],
  onPassCreated,
}) => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [unitNumber, setUnitNumber] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [visitDate, setVisitDate] = useState(todayIso);
  const [visitorType, setVisitorType] = useState<
    'Convidado Social' | 'Prestador de Serviço' | 'Delivery Autorizado'
  >('Convidado Social');
  const [vehiclePlate, setVehiclePlate] = useState('');

  const [createdPass, setCreatedPass] = useState<VisitorPassData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setVisitDate(new Date().toISOString().slice(0, 10));
      if (!unitNumber && units.length > 0) {
        setUnitNumber(`Apto ${units[0].number} • ${units[0].block}`);
      }
    }
  }, [isOpen, units]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorName.trim()) {
      setError('Informe o nome completo do visitante.');
      return;
    }
    if (!unitNumber.trim()) {
      setError('Informe a unidade de destino.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    const token = generateSecurePin(6);
    const passData: VisitorPassData = {
      unitNumber: unitNumber.trim(),
      visitorName: visitorName.trim(),
      documentNumber: documentNumber.trim() || 'Não informado',
      visitDate,
      visitorType,
      vehiclePlate: vehiclePlate.trim().toUpperCase() || undefined,
      tokenCode: token,
    };

    const result = await onPassCreated(passData);
    setIsSubmitting(false);

    if (result && !result.success) {
      setError(result.error || 'Não foi possível confirmar o passe no banco de dados.');
      return;
    }

    setCreatedPass(passData);
  };

  const handleCopyInvite = () => {
    if (!createdPass) return;
    const msg = `*Convite de Acesso - Condor*\n\nOlá, ${createdPass.visitorName}!\nVocê foi pré-autorizado para acesso à unidade ${createdPass.unitNumber} no dia ${createdPass.visitDate}.\n\n*Código de Acesso na Portaria:* ${createdPass.tokenCode}\nApresente este código ou o QR Code na portaria.`;
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleReset = () => {
    setCreatedPass(null);
    setVisitorName('');
    setDocumentNumber('');
    setVehiclePlate('');
    setError(null);
    onClose();
  };

  const qrPayload = createdPass
    ? JSON.stringify({
        type: 'CONDOR_VISITOR_PASS',
        token: createdPass.tokenCode,
        visitor: createdPass.visitorName,
        unit: createdPass.unitNumber,
        date: createdPass.visitDate,
      })
    : '';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="visitor-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) handleReset();
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800 shadow-2xl relative">
        <div className="flex items-center justify-between px-6 sm:px-7 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h3
                id="visitor-modal-title"
                className="text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight"
              >
                Pré-Autorização de Visitante
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Passe digital auditado no banco com QR Code dinâmico
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleReset}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-7 py-5">
          {error && (
            <div
              role="alert"
              className="mb-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-semibold"
            >
              {error}
            </div>
          )}

          {createdPass ? (
          <div className="space-y-5 animate-fadeIn">
            <div className="text-center p-5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800 rounded-3xl">
              <div className="inline-flex p-3 bg-white rounded-2xl shadow-sm border border-emerald-100 mb-3">
                <QrCodeDisplay
                  value={qrPayload}
                  size={140}
                  alt={`QR Code do passe ${createdPass.tokenCode}`}
                />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider mb-2">
                <Shield className="w-3 h-3" />
                <span>Passe Registrado &amp; Confirmado</span>
              </div>

              <h4 className="text-lg font-black text-slate-900 dark:text-slate-100">
                {createdPass.visitorName}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Destino: <strong>{createdPass.unitNumber}</strong> • Data: <strong>{createdPass.visitDate}</strong>
              </p>

              <div className="mt-4 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/60 dark:border-emerald-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Token de Validação na Portaria
                </span>
                <span className="text-2xl font-black font-mono tracking-widest text-emerald-600 dark:text-emerald-400">
                  #{createdPass.tokenCode}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleCopyInvite}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                <span>{copied ? 'Convite Copiado!' : 'Copiar Convite (WhatsApp)'}</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Nome do Visitante *
                </label>
                <input
                  type="text"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="Nome completo"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Unidade de Destino *
                </label>
                <input
                  type="text"
                  list="condor-visitor-units"
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  placeholder="Ex: Apto 101 • Bloco A"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {units.length > 0 && (
                  <datalist id="condor-visitor-units">
                    {units.map((u) => (
                      <option key={u.id} value={`Apto ${u.number} • ${u.block}`} />
                    ))}
                  </datalist>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Data da Visita *
                </label>
                <PremiumDatePicker
                  ariaLabel="Data da visita"
                  size="sm"
                  value={visitDate}
                  min={todayIso}
                  onChange={setVisitDate}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Categoria
                </label>
                <PremiumSelect
                  ariaLabel="Categoria do visitante"
                  size="sm"
                  value={visitorType}
                  onChange={(val) => setVisitorType(val as any)}
                  options={[
                    'Convidado Social',
                    'Prestador de Serviço',
                    'Delivery Autorizado',
                  ]}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Documento (RG/CPF — Opcional)
                </label>
                <input
                  type="text"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="Somente conferência na portaria"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Placa do Veículo (Opcional)
                </label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="ABC-1D23"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs uppercase text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleReset}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition cursor-pointer"
              >
                {isSubmitting ? 'Registrando no Banco...' : 'Emitir Passe QR'}
              </button>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  );
};
