import React, { useState } from 'react';
import { X, Package, CheckCircle2, BellRing } from 'lucide-react';

export interface PackageDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPackageRegistered: (pkg: {
    unitNumber: string;
    recipientName: string;
    courier: string;
    trackingCode: string;
    lockerCompartment: string;
    size: 'Pequeno' | 'Médio' | 'Grande';
  }) => void;
}

const COURIER_OPTIONS = [
  'Mercado Livre',
  'Amazon Prime',
  'Correios (Sedex)',
  'Shopee Xpress',
  'Loggi',
  'iFood / Rappi',
  'Outra Transportadora',
];

const AVAILABLE_LOCKERS = ['Locker #04', 'Locker #12', 'Locker #17', 'Locker #23', 'Locker #31'];

export const PackageDeliveryModal: React.FC<PackageDeliveryModalProps> = ({
  isOpen,
  onClose,
  onPackageRegistered,
}) => {
  const [unitNumber, setUnitNumber] = useState('Apto 402 • Bloco B');
  const [recipientName, setRecipientName] = useState('Família Duarte');
  const [courier, setCourier] = useState('Mercado Livre');
  const [trackingCode, setTrackingCode] = useState('BR894210349');
  const [lockerCompartment, setLockerCompartment] = useState('Locker #04');
  const [size, setSize] = useState<'Pequeno' | 'Médio' | 'Grande'>('Médio');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
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

    setTimeout(() => {
      onPackageRegistered({
        unitNumber,
        recipientName,
        courier,
        trackingCode: trackingCode.trim() || `ML-${Math.floor(100000 + Math.random() * 900000)}`,
        lockerCompartment,
        size,
      });
      setIsSubmitting(false);
      onClose();
    }, 600);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="package-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 rounded-4xl max-w-lg w-full border border-slate-100 dark:border-slate-800 shadow-2xl p-6 sm:p-7 relative transition-all">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h3 id="package-modal-title" className="text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Recebimento de Encomenda
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Atribuição de Smart Locker & Notificação do Morador
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Unidade de Destino *
              </label>
              <input
                type="text"
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                placeholder="Ex: Apto 402 • Bloco B"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Destinatário / Morador *
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Nome do morador"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Transportadora
              </label>
              <select
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {COURIER_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Código / Rastreio
              </label>
              <input
                type="text"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                placeholder="Ex: BR894210349"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Compartimento Disponível
              </label>
              <select
                value={lockerCompartment}
                onChange={(e) => setLockerCompartment(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-emerald-700 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
              >
                {AVAILABLE_LOCKERS.map((l) => (
                  <option key={l} value={l}>{l} (Disponível)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Porte do Pacote
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['Pequeno', 'Médio', 'Grande'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    className={`py-2 text-[11px] font-bold rounded-xl border transition cursor-pointer text-center ${
                      size === s
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800 flex items-center gap-3">
            <BellRing className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <p className="text-[11px] text-emerald-900 dark:text-emerald-300 font-medium">
              O morador receberá automaticamente uma notificação push no app Condor com o QR Code para destravamento do compartimento.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-pill transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <span>Guardando & Notificando...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Guardar no Locker & Notificar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
