import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  Package,
  QrCode,
  Copy,
  Check,
  Bell,
  BellRing,
  CheckCircle2,
  Clock,
  RefreshCw,
  FileText,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { invoiceService } from '../../services/invoiceService';
import { packageService, type PackageRecord } from '../../services/packageService';
import {
  bankAccountService,
  type CondominiumBankSettings,
} from '../../services/bankAccountService';
import {
  getBrowserNotificationPermission,
  requestPushPermissionAndRegister,
  type NotificationPermissionState,
} from '../../services/notificationPushService';
import type { Invoice } from '../../types/condominium';
import { Badge } from '../ui/Badge';
import { BoletoModal, type BoletoInvoiceData } from './BoletoModal';

interface ResidentPortalViewProps {
  mode: 'invoices' | 'packages';
}

export const ResidentPortalView: React.FC<ResidentPortalViewProps> = ({ mode }) => {
  const { user, profile, currentCondominium, currentMembership } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [bankSettings, setBankSettings] = useState<CondominiumBankSettings | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedPinId, setCopiedPinId] = useState<string | null>(null);
  const [activePixInvoice, setActivePixInvoice] = useState<BoletoInvoiceData | null>(null);
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'open' | 'paid'>('all');
  const [pushStatus, setPushStatus] = useState<NotificationPermissionState>(() =>
    getBrowserNotificationPermission()
  );

  const loadData = useCallback(async () => {
    if (!currentCondominium?.id) {
      setInvoices([]);
      setPackages([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const condoId = currentCondominium.id;
    const [invRes, pkgRes, bankRes] = await Promise.all([
      invoiceService.getInvoicesByCondominium(condoId),
      packageService.getPackagesByCondominium(condoId),
      bankAccountService.fetchSettings(condoId, currentCondominium.name, currentCondominium.cnpj),
    ]);
    setInvoices(invRes.data || []);
    setPackages(pkgRes.data || []);
    setBankSettings(bankRes.data);
    setIsLoading(false);
  }, [currentCondominium?.id, currentCondominium?.name, currentCondominium?.cnpj]);

  useEffect(() => {
    loadData();
    const handlePackagesUpdated = () => loadData();
    window.addEventListener('condor:packages-updated', handlePackagesUpdated);
    return () => window.removeEventListener('condor:packages-updated', handlePackagesUpdated);
  }, [loadData]);

  const handleEnablePush = async () => {
    const res = await requestPushPermissionAndRegister({
      userId: user?.id,
      condominiumId: currentCondominium?.id,
    });
    setPushStatus(res.status);
  };

  const condoName = currentCondominium?.name || 'Condomínio';
  const unitLabel = currentMembership?.unit_number
    ? `Unidade ${currentMembership.unit_number}${currentMembership.block ? ` • ${currentMembership.block}` : ''}`
    : 'Sua Unidade';

  // =========================================================================
  // MODO 1: MEUS BOLETOS & PIX (Exclusivo do Morador — RLS por unit_id)
  // =========================================================================
  if (mode === 'invoices') {
    const openInvoices = invoices.filter((i) => i.status !== 'liquidated' && i.status !== 'advance');
    const paidInvoices = invoices.filter((i) => i.status === 'liquidated' || i.status === 'advance');
    const totalPending = openInvoices.reduce((acc, i) => acc + Number(i.amount || 0), 0);

    const filteredInvoices = invoices.filter((inv) => {
      const isPaid = inv.status === 'liquidated' || inv.status === 'advance';
      if (invoiceFilter === 'open') return !isPaid;
      if (invoiceFilter === 'paid') return isPaid;
      return true;
    });

    return (
      <div className="flex flex-col gap-5 pb-6" data-purpose="resident-invoices-view">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/70 dark:border-slate-800 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  Meus Boletos &amp; Pagamentos Pix
                </h1>
                <Badge variant="emerald" dot>
                  {unitLabel}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                2ª via, QR Code Pix oficial e comprovantes exclusivos da sua unidade em {condoName}.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/70 dark:border-slate-800 shadow-soft">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Em Aberto
            </span>
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
              {openInvoices.length}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Cobranças aguardando pagamento</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/70 dark:border-slate-800 shadow-soft">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Pendente
            </span>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
              {totalPending.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Disponível via Pix Copia e Cola</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/70 dark:border-slate-800 shadow-soft">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Liquidados
            </span>
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
              {paidInvoices.length}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Pagamentos confirmados pela gestão</p>
          </div>
        </div>

        <section className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/70 dark:border-slate-800 shadow-soft space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              Histórico de Cobranças ({filteredInvoices.length})
            </h2>
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'all', label: 'Todos' },
                  { id: 'open', label: 'Em Aberto' },
                  { id: 'paid', label: 'Pagos' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setInvoiceFilter(tab.id)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                    invoiceFilter === tab.id
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="py-10 text-center text-xs text-slate-400">Carregando seus boletos...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
              Nenhuma cobrança encontrada neste filtro para a sua unidade.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredInvoices.map((inv) => {
                const isPaid = inv.status === 'liquidated' || inv.status === 'advance';
                const isOverdue = inv.status === 'overdue';
                return (
                  <div
                    key={inv.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          {inv.description}
                        </span>
                        <Badge
                          variant={isPaid ? 'emerald' : isOverdue ? 'rose' : 'amber'}
                          dot
                        >
                          {isPaid ? 'Pago' : isOverdue ? 'Em Atraso' : 'Em Aberto'}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        Vencimento: <strong className="text-slate-700 dark:text-slate-200">{inv.dueDate}</strong> • Valor:{' '}
                        <strong className="text-slate-900 dark:text-slate-100">
                          {inv.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </strong>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setActivePixInvoice({
                          id: inv.id,
                          unitNumber: inv.unitNumber,
                          block: inv.block,
                          residentName: inv.residentName,
                          description: inv.description,
                          dueDate: inv.dueDate,
                          amount: inv.amount,
                        })
                      }
                      className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition ${
                        isPaid
                          ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                      }`}
                    >
                      {isPaid ? <FileText className="w-3.5 h-3.5" /> : <QrCode className="w-3.5 h-3.5" />}
                      <span>{isPaid ? 'Ver Recibo / PDF' : 'Pagar Pix / PDF'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <BoletoModal
          isOpen={Boolean(activePixInvoice)}
          onClose={() => setActivePixInvoice(null)}
          invoice={activePixInvoice}
          customBankSettings={bankSettings}
        />
      </div>
    );
  }

  // =========================================================================
  // MODO 2: MINHAS ENCOMENDAS (Com notificação de chegada em seu nome e unidade)
  // =========================================================================
  const awaiting = packages.filter((p) => p.status === 'awaiting');
  const pickedUp = packages.filter((p) => p.status === 'picked_up');

  return (
    <div className="flex flex-col gap-5 pb-6" data-purpose="resident-packages-view">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/70 dark:border-slate-800 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Minhas Encomendas &amp; Retiradas
              </h1>
              <Badge variant={awaiting.length > 0 ? 'emerald' : 'slate'} dot>
                {awaiting.length} aguardando
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Acompanhe volumes registrados pela portaria no seu nome ({profile?.full_name || 'Morador'}) e {unitLabel}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {pushStatus !== 'granted' && pushStatus !== 'unsupported' && (
            <button
              type="button"
              onClick={handleEnablePush}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Ativar Notificações Push</span>
            </button>
          )}
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Banner de Notificação Destacada quando há encomenda registrada no nome/apto */}
      {awaiting.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
                {awaiting.length === 1
                  ? 'Nova encomenda registrada para você na Portaria!'
                  : `${awaiting.length} encomendas registradas para você aguardando retirada!`}
              </h2>
              <p className="text-xs text-emerald-50 mt-0.5 leading-relaxed">
                Destinatário: <strong>{awaiting[0].recipient_name}</strong> ({awaiting[0].unit_number}) • Transportadora:{' '}
                <strong>{awaiting[0].courier}</strong> • Local: <strong>{awaiting[0].locker_compartment}</strong>. Apresente o PIN abaixo na portaria.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 text-xs font-extrabold tracking-wider shrink-0 self-start sm:self-center">
            <Sparkles className="w-3.5 h-3.5" />
            PIN: {awaiting[0].pickup_pin}
          </span>
        </div>
      )}

      {/* Aguardando retirada */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/70 dark:border-slate-800 shadow-soft space-y-4">
        <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
          Disponíveis para Retirada ({awaiting.length})
        </h2>

        {isLoading ? (
          <div className="py-8 text-center text-xs text-slate-400">Verificando encomendas...</div>
        ) : awaiting.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
            Nenhuma encomenda pendente de retirada no momento. Assim que a portaria registrar um volume para o seu apartamento, você será notificado aqui e no aplicativo.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {awaiting.map((pkg) => (
              <div
                key={pkg.id}
                className="p-4 sm:p-5 rounded-3xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/70 flex flex-col justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-extrabold text-sm text-slate-900 dark:text-slate-100">
                      <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      {pkg.courier}
                    </span>
                    <Badge variant="emerald" dot>
                      {pkg.size}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Para: <strong>{pkg.recipient_name}</strong> • {pkg.unit_number}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    Recebida em {new Date(pkg.received_at).toLocaleString('pt-BR')} • {pkg.locker_compartment}
                  </p>
                  {pkg.tracking_code && pkg.tracking_code !== 'Sem código' && (
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      Rastreio: {pkg.tracking_code}
                    </p>
                  )}
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200/70 dark:border-emerald-800 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      PIN Único de Retirada
                    </span>
                    <span className="text-lg font-black font-mono text-emerald-700 dark:text-emerald-400 tracking-widest">
                      {pkg.pickup_pin}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(pkg.pickup_pin);
                      setCopiedPinId(pkg.id);
                      setTimeout(() => setCopiedPinId(null), 2500);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
                  >
                    {copiedPinId === pkg.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPinId === pkg.id ? 'Copiado' : 'Copiar PIN'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Histórico de retiradas */}
      {pickedUp.length > 0 && (
        <section className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/70 dark:border-slate-800 shadow-soft space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Histórico de Encomendas Retiradas ({pickedUp.length})
          </h2>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {pickedUp.map((pkg) => (
              <div
                key={pkg.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">
                      {pkg.courier} • {pkg.recipient_name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {pkg.locker_compartment} • Recebida em {new Date(pkg.received_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Retirada em {pkg.picked_up_at ? new Date(pkg.picked_up_at).toLocaleString('pt-BR') : '—'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
