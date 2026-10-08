import React, { useState } from 'react';
import { X, QrCode, Check, Share2, Shield } from 'lucide-react';

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
  onPassCreated: (pass: VisitorPassData) => void;
}

export const CreateVisitorPassModal: React.FC<CreateVisitorPassModalProps> = ({
  isOpen,
  onClose,
  onPassCreated,
}) => {
  const [unitNumber, setUnitNumber] = useState('Apto 204 • Bloco A');
  const [visitorName, setVisitorName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [visitDate, setVisitDate] = useState('2026-10-10');
  const [visitorType, setVisitorType] = useState<'Convidado Social' | 'Prestador de Serviço' | 'Delivery Autorizado'>('Convidado Social');
  const [vehiclePlate, setVehiclePlate] = useState('');
  
  const [createdPass, setCreatedPass] = useState<VisitorPassData | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorName.trim()) {
      setError('Informe o nome do visitante.');
      return;
    }

    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const passData: VisitorPassData = {
      unitNumber,
      visitorName: visitorName.trim(),
      documentNumber: documentNumber.trim() || 'Não informado',
      visitDate,
      visitorType,
      vehiclePlate: vehiclePlate.trim() || undefined,
      tokenCode: token,
    };

    setCreatedPass(passData);
    onPassCreated(passData);
    setError(null);
  };

  const handleCopyInvite = () => {
    if (!createdPass) return;
    const msg = `*Convite de Acesso - Condomínio Condor*\n\nOlá, ${createdPass.visitorName}!\nVocê foi pré-autorizado para acesso à unidade ${createdPass.unitNumber} no dia ${createdPass.visitDate}.\n\n*Código de Acesso na Portaria:* ${createdPass.tokenCode}\nApresente este código ou o QR Code na clausura de pedestres/veículos para liberação imediata.`;
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleReset = () => {
    setCreatedPass(null);
    setVisitorName('');
    setDocumentNumber('');
    setVehiclePlate('');
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="visitor-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 rounded-4xl max-w-lg w-full border border-slate-100 dark:border-slate-800 shadow-2xl p-6 sm:p-7 relative transition-all">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h3 id="visitor-modal-title" className="text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Pré-Autorização de Visitante
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Passe digital com QR Code e liberação expressa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReset}
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

        {createdPass ? (
          /* Success & QR Code Sharing Screen */
          <div className="space-y-5 animate-fadeIn">
            <div className="text-center p-5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800 rounded-3xl">
              <div className="inline-flex p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-emerald-100 dark:border-emerald-800 mb-3">
                {/* Simulated High-Res SVG QR Code */}
                <svg className="w-32 h-32 text-slate-900 dark:text-white" viewBox="0 0 100 100" fill="currentColor">
                  <path d="M10,10 h30 v30 h-30 z M15,15 v20 h20 v-20 z M22,22 h6 v6 h-6 z" />
                  <path d="M60,10 h30 v30 h-30 z M65,15 v20 h20 v-20 z M72,22 h6 v6 h-6 z" />
                  <path d="M10,60 h30 v30 h-30 z M15,65 v20 h20 v-20 z M22,72 h6 v6 h-6 z" />
                  <rect x="45" y="10" width="8" height="8" />
                  <rect x="45" y="25" width="8" height="8" />
                  <rect x="10" y="45" width="8" height="8" />
                  <rect x="25" y="45" width="8" height="8" />
                  <rect x="45" y="45" width="10" height="10" />
                  <rect x="60" y="45" width="8" height="8" />
                  <rect x="75" y="45" width="12" height="8" />
                  <rect x="45" y="60" width="8" height="12" />
                  <rect x="60" y="60" width="15" height="8" />
                  <rect x="80" y="60" width="10" height="15" />
                  <rect x="60" y="75" width="12" height="15" />
                  <rect x="78" y="80" width="12" height="10" />
                </svg>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">
                  Código de Acesso Expresso
                </span>
                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-widest">
                  {createdPass.tokenCode}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  {createdPass.visitorName} • {createdPass.unitNumber}
                </p>
                <p className="text-[11px] text-slate-400">
                  Data: {createdPass.visitDate} • {createdPass.visitorType}
                </p>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handleCopyInvite}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-pill transition cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copiado para o WhatsApp!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>Compartilhar Convite</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="py-3 px-5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl font-semibold text-xs transition cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        ) : (
          /* Form Screen */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Unidade Anfitriã *
                </label>
                <input
                  type="text"
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  placeholder="Ex: Apto 204 • Bloco A"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Nome Completo do Convidado *
                </label>
                <input
                  type="text"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo Silveira"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Documento (RG / CPF)
                </label>
                <input
                  type="text"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="Ex: 123.456.789-00"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Data da Visita *
                </label>
                <input
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Tipo de Visitante
                </label>
                <select
                  value={visitorType}
                  onChange={(e) => setVisitorType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Convidado Social">Convidado Social</option>
                  <option value="Prestador de Serviço">Prestador de Serviço</option>
                  <option value="Delivery Autorizado">Delivery Autorizado</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Placa do Veículo (Opcional)
                </label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                  placeholder="Ex: ABC-1234 / BRA2E19"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs flex items-center gap-3">
              <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                O código gerado autoriza acesso único ou diário pelo leitor de QR Code na clausura de pedestres ou portão da garagem.
              </span>
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
                className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-pill transition flex items-center gap-2 cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                <span>Gerar QR Code & Passe</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
