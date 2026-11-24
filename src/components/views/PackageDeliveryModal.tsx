import React, { useState, useEffect } from 'react';
import { X, Package, Truck } from 'lucide-react';
import type { Unit } from '../../types/condominium';
import { PremiumSelect } from '../ui/PremiumSelect';

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

const OTHER_COURIER_OPTION = 'Outra Transportadora';

const COURIER_OPTIONS = [
  'Mercado Livre',
  'Amazon Prime',
  'Correios (Sedex / PAC)',
  'Shopee Xpress',
  'Loggi',
  'iFood / Rappi',
  OTHER_COURIER_OPTION,
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
  const [customCourier, setCustomCourier] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [lockerCompartment, setLockerCompartment] = useState('Portaria Principal');
  const [size, setSize] = useState<'Pequeno' | 'Médio' | 'Grande'>('Médio');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setCustomCourier('');
      if (units.length > 0 && !unitNumber) {
        const first = units[0];
        setSelectedUnitId(first.id);
        setUnitNumber(`Apto ${first.number} • ${first.block}`);
        setRecipientName(first.ownerName || first.contactName || '');
      }
    }
  }, [isOpen, units]);

  if (!isOpen) return null;

  const isOtherCourier = courier === OTHER_COURIER_OPTION;

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
    if (isOtherCourier && !customCourier.trim()) {
      setError('Informe o nome da transportadora.');
      return;
    }

    const finalCourier = isOtherCourier ? customCourier.trim() : courier;

    setIsSubmitting(true);
    setError(null);

    const result = await onPackageRegistered({
      unitId: selectedUnitId || null,
      unitNumber: unitNumber.trim(),
      recipientName: recipientName.trim(),
      courier: finalCourier,
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
    setCustomCourier('');
    window.dispatchEvent(new CustomEvent('condor:packages-updated'));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="package-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden relative">
        {/* Fixed Header */}
        <div className="flex items-center justify-between px-6 py-4 sm:px-7 sm:py-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
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
                Gera PIN único e notifica imediatamente o morador no app
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form with internal scroll and fixed footer */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 sm:px-7 space-y-4">
            {error && (
              <div
                role="alert"
                className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-semibold"
              >
                {error}
              </div>
            )}

            {units.length > 0 && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Selecionar Unidade Cadastrada
                </label>
                <PremiumSelect
                  ariaLabel="Selecionar unidade cadastrada"
                  size="sm"
                  value={selectedUnitId}
                  onChange={handleSelectUnit}
                  options={[
                    { value: '', label: 'Informar manualmente...' },
                    ...units.map((u) => ({
                      value: u.id,
                      label: `Apto ${u.number} • ${u.block}`,
                      description: u.ownerName || u.contactName || 'Morador',
                    })),
                  ]}
                />
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
                <PremiumSelect
                  ariaLabel="Transportadora"
                  size="sm"
                  value={courier}
                  onChange={(val) => {
                    setCourier(val);
                    if (val !== OTHER_COURIER_OPTION) setCustomCourier('');
                  }}
                  options={COURIER_OPTIONS}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Local / Armário
                </label>
                <PremiumSelect
                  ariaLabel="Local ou armário da encomenda"
                  size="sm"
                  value={lockerCompartment}
                  onChange={setLockerCompartment}
                  options={COMPARTMENT_OPTIONS}
                />
              </div>
            </div>

            {/* Campo obrigatório quando "Outra Transportadora" é selecionada */}
            {isOtherCourier && (
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/70 space-y-1.5 animate-fadeIn">
                <label
                  htmlFor="custom-courier-input"
                  className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase flex items-center gap-1.5"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Nome da Transportadora *</span>
                </label>
                <input
                  id="custom-courier-input"
                  type="text"
                  value={customCourier}
                  onChange={(e) => setCustomCourier(e.target.value)}
                  placeholder="Ex: Jadlog, Azul Cargo, Total Express, FedEx..."
                  required
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}

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
          </div>

          {/* Fixed Footer */}
          <div className="px-6 py-4 sm:px-7 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
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
