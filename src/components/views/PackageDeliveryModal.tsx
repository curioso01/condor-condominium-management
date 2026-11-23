import React, { useState, useEffect } from 'react';
import { X, Package } from 'lucide-react';
import type { Unit } from '../../types/condominium';

export interface PackageDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  units?: Unit[];
  onPackageRegistered: (pkg: {
    unitId?: string | null;
    unitNumber: string;
    recipientName: string;
    courier: string;
    trackingCode: string;
    lockerCompartment: string;
    size: 'Pequeno' | 'Médio' | 'Grande';
  }) => Promise<{ success: boolean; error?: string }> | void;
}

const COURIER_OPTIONS = [
  'Mercado Livre',
  'Amazon Prime',
  'Correios (Sedex / PAC)',
  'Shopee Xpress',
  'Loggi',
  'iFood / Rappi',
  'Outra Transportadora',
];

const COMPARTMENT_OPTIONS = [
  'Portaria Principal',
  'Locker #01',
  'Locker #02',
  'Locker #03',
  'Locker #04',
  'Locker #05',
  'Sala de Encomendas',
];

export const PackageDeliveryModal: React.FC<PackageDeliveryModalProps> = ({
  isOpen,
  onClose,
  units = [],
  onPackageRegistered,
}) => {
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [unitNumber, setUnitNumber] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [courier, setCourier] = useState('Mercado Livre');
  const [trackingCode, setTrackingCode] = useState('');
  const [lockerCompartment, setLockerCompartment] = useState('Portaria Principal');
  const [size, setSize] = useState<'Pequeno' | 'Médio' | 'Grande'>('Médio');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (units.length > 0 && !unitNumber) {
        const first = units[0];
        setSelectedUnitId(first.id);
        setUnitNumber(`Apto ${first.number} • ${first.block}`);
        setRecipientName(first.ownerName || first.contactName || '');
      }
    }
  }, [isOpen, units]);

  if (!isOpen) return null;

  const handleSelectUnit = (uId: string) => {
    setSelectedUnitId(uId);
    const found = units.find((u) => u.id === uId);
    if (found) {
      setUnitNumber(`Apto ${found.number} • ${found.block}`);
      if (found.ownerName || found.contactName) {
        setRecipientName(found.ownerName || found.contactName || '');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitNumber.trim()) {
      setError('Informe a unidade de destino.');
      return;
    }
    if (!recipientName.trim()) {
      setError('Informe o nome do destinatário.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await onPackageRegistered({
      unitId: selectedUnitId || null,
      unitNumber: unitNumber.trim(),
      recipientName: recipientName.trim(),
      courier,
      trackingCode: trackingCode.trim() || 'Sem código',
      lockerCompartment,
      size,
    });

    setIsSubmitting(false);

    if (result && !result.success) {
      setError(result.error || 'Falha ao persistir encomenda no banco de dados.');
      return;
    }

    setTrackingCode('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="package-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-100 dark:border-slate-800 shadow-2xl p-6 sm:p-7 relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h3
                id="package-modal-title"
                className="text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight"
              >
                Registrar Recebimento de Encomenda
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Gera PIN de retirada único e vincula diretamente ao painel do morador
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-semibold"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {units.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Selecionar Unidade Cadastrada
              </label>
              <select
                value={selectedUnitId}
                onChange={(e) => handleSelectUnit(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Informar manualmente...</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    Apto {u.number} • {u.block} — {u.ownerName || u.contactName || 'Morador'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Unidade de Destino *
              </label>
              <input
                type="text"
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                placeholder="Ex: Apto 101 • Bloco A"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Destinatário *
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Nome do morador"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Transportadora
              </label>
              <select
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {COURIER_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Local / Armário
              </label>
              <select
                value={lockerCompartment}
                onChange={(e) => setLockerCompartment(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {COMPARTMENT_OPTIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Código de Rastreio (Opcional)
              </label>
              <input
                type="text"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                placeholder="Ex: BR123456789"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                Porte do Volume
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['Pequeno', 'Médio', 'Grande'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      size === s
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              {isSubmitting ? 'Salvando no Banco...' : 'Confirmar Recebimento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
