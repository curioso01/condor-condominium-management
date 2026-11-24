import React, { useState, useEffect, useMemo } from 'react';
import type {
  NavigationTab,
  Unit,
  Invoice,
  MaintenanceOrder,
  AmenityReservation,
  AccessEntry,
} from '../../types/condominium';
import { useAuth } from '../../contexts/AuthContext';
import { unitService } from '../../services/unitService';
import { invoiceService } from '../../services/invoiceService';
import { maintenanceService } from '../../services/maintenanceService';
import { amenityService } from '../../services/amenityService';
import { conciergeService } from '../../services/conciergeService';
import { packageService, type PackageRecord } from '../../services/packageService';
import {
  bankAccountService,
  type CondominiumBankSettings,
} from '../../services/bankAccountService';
import { Badge } from '../ui/Badge';
import { DynamicTelemetryChart, type ChartDataPoint } from '../common/DynamicTelemetryChart';
import { AnnouncementsModal } from './AnnouncementsModal';
import { BoletoModal, type BoletoInvoiceData } from './BoletoModal';
import { announcementService, type Announcement } from '../../services/announcementService';
import {
  financialDataService,
  type ChannelMetricsData,
  type AiEnergyData,
  type ReserveFundData,
  type OperationalExpense,
} from '../../services/financialDataService';
import { ChannelMetricsModal } from './ChannelMetricsModal';
import { AiEnergyModal } from './AiEnergyModal';
import {
  Megaphone,
  Pin,
  Package,
  Calendar,
  Camera,
  Copy,
  Check,
  ArrowRight,
  Clock,
  Sliders,
  QrCode,
  Wrench,
  Building2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface OverviewViewProps {
  onNavigateTab: (tab: NavigationTab) => void;
  onOpenSettings?: () => void;
  initialOpenMural?: boolean;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  onNavigateTab,
  onOpenSettings,
  initialOpenMural = false,
}) => {
  const {
    profile,
    user,
    currentCondominium,
    currentRole,
    canManageAnnouncements,
    canAccessFinance,
    canManageUnits,
    canAccessConcierge,
  } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [realUnitsCount, setRealUnitsCount] = useState<number>(0);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [maintenanceOrders, setMaintenanceOrders] = useState<MaintenanceOrder[]>([]);
  const [reservations, setReservations] = useState<AmenityReservation[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessEntry[]>([]);
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [bankSettings, setBankSettings] = useState<CondominiumBankSettings | undefined>(undefined);

  const [isAnnouncementsOpen, setIsAnnouncementsOpen] = useState(initialOpenMural);
  const [copiedPinId, setCopiedPinId] = useState<string | null>(null);
  const [activePixInvoice, setActivePixInvoice] = useState<BoletoInvoiceData | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const [channels, setChannels] = useState<ChannelMetricsData>(() =>
    financialDataService.getChannels(currentCondominium?.id)
  );
  const [aiEnergy, setAiEnergy] = useState<AiEnergyData>(() =>
    financialDataService.getAiEnergy(currentCondominium?.id)
  );
  const [reserveFund, setReserveFund] = useState<ReserveFundData>(() =>
    financialDataService.getReserveFund(currentCondominium?.id)
  );
  const [expenses, setExpenses] = useState<OperationalExpense[]>([]);

  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [isAiEnergyModalOpen, setIsAiEnergyModalOpen] = useState(false);

  const isSindicoOrAdmin = currentRole === 'sindico' || currentRole === 'superadmin';
  const isPorteiro = currentRole === 'porteiro';
  const isMorador = currentRole === 'morador';

  useEffect(() => {
    if (initialOpenMural) {
      setIsAnnouncementsOpen(true);
    }
  }, [initialOpenMural]);

  useEffect(() => {
    let cancelled = false;
    const condoId = currentCondominium?.id;

    // Limpa imediatamente o estado do condomínio anterior ao trocar de contexto
    setRealUnitsCount(0);
    setUnits([]);
    setInvoices([]);
    setMaintenanceOrders([]);
    setReservations([]);
    setAccessLogs([]);
    setPackages([]);
    setAnnouncements([]);
    setChannels(financialDataService.getChannels(condoId));
    setAiEnergy(financialDataService.getAiEnergy(condoId));
    setReserveFund(financialDataService.getReserveFund(condoId));
    setExpenses([]);

    const fetchOverviewData = async () => {
      if (!condoId) return;

      const [
        unitsRes,
        announcementsRes,
        financialsRes,
        invoicesRes,
        ordersRes,
        reservationsRes,
        logsRes,
        packagesRes,
        bankRes,
      ] = await Promise.all([
        unitService.getUnitsByCondominium(condoId),
        announcementService.fetchAnnouncements(condoId),
        canAccessFinance
          ? financialDataService.loadCondominiumFinancials(condoId)
          : Promise.resolve(null),
        canAccessFinance || isMorador
          ? invoiceService.getInvoicesByCondominium(condoId)
          : Promise.resolve({ data: [], error: null }),
        maintenanceService.getOrdersByCondominium(condoId),
        amenityService.getReservations(condoId),
        canAccessConcierge
          ? conciergeService.getAccessLogs(condoId)
          : Promise.resolve({ data: [], error: null }),
        packageService.getPackagesByCondominium(condoId),
        bankAccountService.fetchSettings(condoId, currentCondominium?.name, currentCondominium?.cnpj),
      ]);

      if (cancelled) return;

      const loadedUnits = unitsRes.data || [];
      setUnits(loadedUnits);
      setRealUnitsCount(loadedUnits.length);
      setAnnouncements(announcementsRes.data || []);
      setInvoices(invoicesRes.data || []);
      setMaintenanceOrders(ordersRes.data || []);
      setReservations(reservationsRes.data || []);
      setAccessLogs(logsRes.data || []);
      setPackages(packagesRes.data || []);
      setBankSettings(bankRes.data);

      if (financialsRes) {
        setReserveFund(financialsRes.reserveFund);
        setExpenses(financialsRes.expenses);
        setChannels(financialsRes.channels);
        setAiEnergy(financialsRes.aiEnergy);
      }
    };

    fetchOverviewData();
    window.addEventListener('condor:units-updated', fetchOverviewData);
    window.addEventListener('condor:announcements-updated', fetchOverviewData);
    window.addEventListener('condor:packages-updated', fetchOverviewData);
    return () => {
      cancelled = true;
      window.removeEventListener('condor:units-updated', fetchOverviewData);
      window.removeEventListener('condor:announcements-updated', fetchOverviewData);
      window.removeEventListener('condor:packages-updated', fetchOverviewData);
    };
  }, [currentCondominium?.id, currentCondominium?.name, currentCondominium?.cnpj, canAccessFinance, canAccessConcierge, isMorador]);

  const handleSaveChannels = async (updated: ChannelMetricsData) => {
    await financialDataService.updateChannelsAsync(updated, currentCondominium?.id);
    setChannels(updated);
  };

  const handleSaveAiEnergy = async (updated: AiEnergyData) => {
    await financialDataService.updateAiEnergyAsync(updated, currentCondominium?.id);
    setAiEnergy(updated);
  };

  const totalChannelsCount =
    channels.appCount + channels.totemCount + channels.whatsappCount + channels.interfoneCount;
  const appPercent = totalChannelsCount > 0 ? Math.round((channels.appCount / totalChannelsCount) * 100) : 0;
  const totemPercent = totalChannelsCount > 0 ? Math.round((channels.totemCount / totalChannelsCount) * 100) : 0;
  const whatsPercent = totalChannelsCount > 0 ? Math.round((channels.whatsappCount / totalChannelsCount) * 100) : 0;
  const interfPercent = totalChannelsCount > 0 ? Math.max(0, 100 - (appPercent + totemPercent + whatsPercent)) : 0;

  const totalExpensesAmount = useMemo(
    () => expenses.reduce((acc, e) => acc + e.amount, 0),
    [expenses]
  );
  const reserveGoalPercent = Math.min(
    100,
    Math.round((reserveFund.balance / (reserveFund.targetAmount || 1)) * 100)
  );

  // KPIs reais derivados do banco de dados
  const realStats = useMemo(() => {
    const paidInvoices = invoices.filter(
      (i) => i.status === 'liquidated' || i.status === 'advance'
    );
    const pendingInvoices = invoices.filter(
      (i) => i.status === 'upcoming' || i.status === 'due_today' || i.status === 'overdue'
    );
    const complianceRate =
      invoices.length > 0 ? ((paidInvoices.length / invoices.length) * 100).toFixed(1) : '—';
    const parkedCount = units.filter((u) => Boolean(u.parkingSpot)).length;
    const distinctBlocks = Array.from(new Set(units.map((u) => u.block).filter(Boolean)));

    // Próximo vencimento real
    const sortedUpcoming = [...pendingInvoices]
      .filter((i) => i.dueDateIso)
      .sort((a, b) => (a.dueDateIso || '').localeCompare(b.dueDateIso || ''));
    const nextDue = sortedUpcoming[0];

    let nextDueDay = '—';
    let nextDueMonth = 'Sem vencimentos';
    if (nextDue?.dueDateIso) {
      const d = new Date(`${nextDue.dueDateIso.slice(0, 10)}T12:00:00`);
      if (!Number.isNaN(d.getTime())) {
        nextDueDay = String(d.getDate()).padStart(2, '0');
        const m = d.toLocaleDateString('pt-BR', { month: 'long' });
        nextDueMonth = m.charAt(0).toUpperCase() + m.slice(1);
      }
    }

    return {
      complianceRate,
      parkedCount,
      blocksLabel: distinctBlocks.length > 0 ? distinctBlocks.slice(0, 2).join(' • ') : 'Sem blocos cadastrados',
      nextDueDay,
      nextDueMonth,
      nextDueDescription: nextDue?.description || 'Nenhuma cobrança pendente no momento',
      pendingInvoicesCount: pendingInvoices.length,
    };
  }, [invoices, units]);

  // Série real para o gráfico da Visão Geral
  const accessChartData: ChartDataPoint[] = useMemo(() => {
    if (accessLogs.length === 0 && reservations.length === 0 && maintenanceOrders.length === 0) {
      return [];
    }
    return [
      {
        label: 'Unidades',
        primaryValue: units.length,
        secondaryValue: units.filter((u) => u.hasPet).length,
      },
      {
        label: 'Acessos',
        primaryValue: accessLogs.length,
        secondaryValue: accessLogs.filter((l) => l.authType === 'qr_code').length,
      },
      {
        label: 'Reservas',
        primaryValue: reservations.length,
        secondaryValue: reservations.filter((r) => r.statusType === 'warning').length,
      },
      {
        label: 'Manutenções',
        primaryValue: maintenanceOrders.length,
        secondaryValue: maintenanceOrders.filter(
          (o) => o.statusType === 'completed' || o.statusType === 'certified'
        ).length,
      },
    ];
  }, [units, accessLogs, reservations, maintenanceOrders]);

  const userName =
    profile?.full_name ||
    (isMorador
      ? 'Morador Residente'
      : isPorteiro
      ? 'Portaria'
      : currentRole === 'subsindico'
      ? 'Sub-Síndico(a)'
      : 'Síndico(a)');
  const condoName = currentCondominium?.name || 'Condomínio';

  // =========================================================================
  // PAINEL DO MORADOR — 100% DADOS REAIS DO SUPABASE (ZERO MOCKS HARDCODED)
  // =========================================================================
  if (isMorador) {
    const myUnit = units[0] || null;
    const myAwaitingPackages = packages.filter((p) => p.status === 'awaiting');
    const myPickedPackages = packages.filter((p) => p.status === 'picked_up');
    const myOpenInvoices = invoices.filter(
      (i) => i.status !== 'liquidated' && i.status !== 'advance'
    );

    return (
      <div className="flex flex-col gap-6 min-w-0" data-purpose="resident-overview">
        {/* Saudação */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/70 dark:border-slate-800 shadow-soft">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Olá, {userName}
              </h1>
              <Badge variant="emerald" dot>
                {myUnit ? `Unidade ${myUnit.number} • ${myUnit.block}` : 'Morador Ativo'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Painel do morador no <strong className="text-slate-700 dark:text-slate-200">{condoName}</strong> — acompanhe sua unidade, boletos Pix, encomendas, reservas e comunicados.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onNavigateTab('my_invoices')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-xs border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Meus Boletos</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('my_packages')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-xs border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              <Package className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Encomendas ({myAwaitingPackages.length})</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenSettings?.()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-xs border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Perfil &amp; Privacidade</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('reservations')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs shadow-sm transition cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>+ Nova Reserva</span>
            </button>
          </div>
        </div>

        {/* Alerta imediato de encomenda registrada no nome/unidade do morador */}
        {myAwaitingPackages.length > 0 && (
          <div
            role="status"
            aria-live="polite"
            className="p-4 rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-extrabold">
                  Você tem {myAwaitingPackages.length}{' '}
                  {myAwaitingPackages.length === 1 ? 'encomenda registrada' : 'encomendas registradas'} na portaria em seu nome!
                </p>
                <p className="text-[11px] text-emerald-50">
                  {myAwaitingPackages[0].courier} • {myAwaitingPackages[0].locker_compartment} • PIN de retirada:{' '}
                  <strong className="font-mono tracking-wider">{myAwaitingPackages[0].pickup_pin}</strong>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('my_packages')}
              className="px-4 py-2 rounded-xl bg-white text-emerald-700 hover:bg-emerald-50 font-extrabold text-xs shrink-0 transition cursor-pointer self-start sm:self-center"
            >
              Ver Minhas Encomendas →
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full min-w-0">
          {/* CARD 1: Minha Unidade (Real) */}
          <article className="col-span-1 lg:col-span-4 w-full min-w-0 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-soft border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Minha Unidade
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] border border-emerald-200 dark:border-emerald-800">
                  {myOpenInvoices.some((i) => i.status === 'overdue') ? 'Pendência' : 'Regular'}
                </span>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <button
                  type="button"
                  onClick={() => onOpenSettings?.()}
                  className="relative group cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  aria-label="Editar foto de perfil"
                >
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 ring-2 ring-emerald-500/40 shrink-0">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt={userName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-extrabold text-emerald-600 text-lg bg-emerald-50 dark:bg-emerald-950/50">
                        {userName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                </button>

                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                    {userName}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium truncate">
                    {user?.email || '—'}
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                    {myUnit ? `Apto ${myUnit.number} • ${myUnit.block}` : 'Unidade não vinculada'}
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/60">
                  <span className="text-slate-400">Vaga Garagem</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {myUnit?.parkingSpot || 'Não informada'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/60">
                  <span className="text-slate-400">Veículo / Placa</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {myUnit?.vehiclePlate || myUnit?.vehicleModel || 'Não cadastrado'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Telefone</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {profile?.phone || 'Não informado'}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenSettings?.()}
              className="mt-4 w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Editar Meus Dados</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </article>

          {/* CARD 2: Meus Boletos & Pix (Real — RLS por unit_id) */}
          <article className="col-span-1 lg:col-span-4 w-full min-w-0 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-soft border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Minhas Cobranças &amp; Pix
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-[10px]">
                  {myOpenInvoices.length} em aberto
                </span>
              </div>

              {invoices.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
                  Nenhuma cobrança vinculada à sua unidade neste condomínio.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {invoices.slice(0, 4).map((inv) => {
                    const isPaid = inv.status === 'liquidated' || inv.status === 'advance';
                    return (
                      <div
                        key={inv.id}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                            {inv.description}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                            Venc. {inv.dueDate} •{' '}
                            <strong className="text-slate-800 dark:text-slate-200">
                              {inv.amount.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </strong>
                          </p>
                        </div>
                        {isPaid ? (
                          <Badge variant="emerald" dot>
                            Pago
                          </Badge>
                        ) : (
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
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Pagar Pix</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-3">
              QR Code Pix gerado diretamente para a chave cadastrada pela síndica.
            </p>
          </article>

          {/* CARD 3: Minhas Encomendas (Real — public.packages) */}
          <article className="col-span-1 lg:col-span-4 w-full min-w-0 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-soft border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Minhas Encomendas
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                  {myAwaitingPackages.length} aguardando
                </span>
              </div>

              {myAwaitingPackages.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
                  Nenhuma encomenda aguardando retirada na portaria.
                  {myPickedPackages.length > 0 && (
                    <span className="block mt-1 text-[11px] text-slate-400">
                      ({myPickedPackages.length} retirada(s) no histórico)
                    </span>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {myAwaitingPackages.slice(0, 3).map((pkg) => (
                    <div
                      key={pkg.id}
                      className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                            {pkg.locker_compartment} • {pkg.courier}
                          </span>
                        </div>
                      </div>
                      <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200/60 dark:border-emerald-800 flex items-center justify-between">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">
                            PIN de Retirada
                          </span>
                          <span className="text-sm font-extrabold font-mono text-emerald-700 dark:text-emerald-400 tracking-wider">
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
                          className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          {copiedPinId === pkg.id ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedPinId === pkg.id ? 'Copiado' : 'Copiar'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-3">
              Informe o PIN na portaria para confirmar a retirada.
            </p>
          </article>

          {/* CARD 4: Minhas Reservas (Real) */}
          <article className="col-span-1 lg:col-span-5 w-full min-w-0 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-soft border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Agenda de Reservas
                </span>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {reservations.length} agendada(s)
                </span>
              </div>

              {reservations.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
                  Nenhuma reserva registrada ainda neste condomínio.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-48 overflow-y-auto">
                  {reservations.slice(0, 3).map((res) => (
                    <div
                      key={res.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                          {res.spaceName}
                        </h4>
                        <Badge variant={res.statusType === 'warning' ? 'amber' : 'emerald'} dot>
                          {res.statusType === 'warning' ? 'Pendente' : 'Confirmada'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>{res.dateStr || res.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('reservations')}
              className="mt-4 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Abrir Calendário de Reservas</span>
            </button>
          </article>

          {/* CARD 5: Mural Oficial (Real) */}
          <article className="col-span-1 lg:col-span-7 w-full min-w-0 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-soft border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                    <Megaphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                      Mural Oficial de Comunicados
                    </h3>
                    <p className="text-xs text-slate-400">
                      {announcements.length} comunicado(s) em {condoName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAnnouncementsOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs cursor-pointer"
                >
                  Ver Mural
                </button>
              </div>

              {announcements.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
                  Nenhum comunicado oficial publicado ainda pela administração.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {announcements.slice(0, 2).map((anc) => (
                    <button
                      key={anc.id}
                      type="button"
                      onClick={() => setIsAnnouncementsOpen(true)}
                      className="text-left p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-700/60 transition cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          {anc.category}
                        </span>
                        <span className="text-slate-400">{anc.date}</span>
                      </div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 line-clamp-1">
                        {anc.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                        {anc.content}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </article>
        </div>

        <AnnouncementsModal
          isOpen={isAnnouncementsOpen}
          onClose={() => setIsAnnouncementsOpen(false)}
          condominiumName={condoName}
        />

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
  // PAINEL SÍNDICO / SUPER ADMIN / PORTARIA — 100% DADOS REAIS DO SUPABASE
  // =========================================================================
  return (
    <div className="flex flex-col gap-6 min-w-0" data-purpose="overview-view">
      {/* Top Action & Greeting Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/70 dark:border-slate-800 shadow-soft">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              Olá, {userName}
            </h1>
            <Badge variant="emerald" dot>
              {condoName}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isPorteiro
              ? `Painel operacional da portaria — ${accessLogs.length} registro(s) de acesso e ${packages.filter((p) => p.status === 'awaiting').length} encomenda(s) aguardando.`
              : `Resumo operacional e financeiro em tempo real de ${condoName}.`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canAccessFinance && (
            <button
              type="button"
              onClick={() => onNavigateTab('finance')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-xs border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">+</span>
              <span>Emitir Cobrança Pix</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigateTab('maintenance')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs shadow-sm transition cursor-pointer"
          >
            <span className="font-bold">+</span>
            <span>Nova Ordem de Serviço</span>
          </button>
        </div>
      </div>

      {/* Bento Grid Dashboard */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full min-w-0" data-purpose="bento-grid">
        {/* CARD 1: Unidades e Indicadores Reais */}
        <article className="col-span-1 lg:col-span-4 w-full min-w-0 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-soft border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Censo Predial
              </span>
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
                {realUnitsCount ?? 0}{' '}
                <span className="text-base font-semibold text-slate-400">
                  {realUnitsCount === 1 ? 'Unidade' : 'Unidades'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                {realStats.blocksLabel}
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          <div className="my-5 grid grid-cols-2 gap-2.5 text-center">
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-100 dark:border-slate-700/60">
              <span className="text-[11px] text-slate-400 font-medium block">Adimplência Real</span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                {realStats.complianceRate === '—' ? '—' : `${realStats.complianceRate}%`}
              </span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-100 dark:border-slate-700/60">
              <span className="text-[11px] text-slate-400 font-medium block">Vagas Cadastradas</span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                {realStats.parkedCount}
              </span>
            </div>
          </div>

          {canManageUnits && (
            <button
              type="button"
              onClick={() => onNavigateTab('units')}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Gerenciar Unidades</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </article>

        {/* CARD 2: Gráfico Analítico Real (Recharts) */}
        <article className="col-span-1 lg:col-span-5 w-full min-w-0 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-soft border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between overflow-hidden">
          <DynamicTelemetryChart
            title="Resumo Operacional do Condomínio"
            subtitle="Volume real de unidades, acessos, reservas e ordens de serviço"
            primaryLabel="Total Registrado"
            secondaryLabel="Destaques / Concluídos"
            primaryColor="#059669"
            secondaryColor="#F59E0B"
            height={175}
            dataPoints={accessChartData}
            emptyMessage="Cadastre unidades, acessos, reservas ou chamados para visualizar os indicadores reais deste condomínio."
          />
          {canAccessConcierge && (
            <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => onNavigateTab('concierge')}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                Abrir Portaria &amp; Acessos →
              </button>
            </div>
          )}
        </article>

        {/* CARD 3: Próxima Arrecadação & Fundo de Reserva (Real) */}
        {canAccessFinance ? (
          <article className="col-span-1 lg:col-span-3 w-full min-w-0 bg-slate-900 dark:bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-soft flex flex-col justify-between border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Próximo Vencimento
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                {realStats.pendingInvoicesCount} aberta(s)
              </span>
            </div>

            <div className="my-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-white tabular-nums">
                  {realStats.nextDueDay}
                </span>
                <span className="text-base font-semibold text-slate-300 truncate">
                  {realStats.nextDueMonth}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                {realStats.nextDueDescription}
              </p>
            </div>

            <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-slate-300 font-medium">Fundo Reserva</span>
                <span className="font-bold text-emerald-400 tabular-nums">
                  {reserveFund.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all"
                  style={{ width: `${reserveGoalPercent}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 block mt-1.5 truncate">
                {reserveFund.targetTitle}: {reserveGoalPercent}% da meta
              </span>
            </div>
          </article>
        ) : (
          <article className="col-span-1 lg:col-span-3 w-full min-w-0 bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-soft flex flex-col justify-between border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Portaria em Turno
              </span>
              <Badge variant="emerald" dot>
                Ativo
              </Badge>
            </div>
            <div className="my-4 space-y-1">
              <span className="text-2xl font-extrabold block text-white tabular-nums">
                {packages.filter((p) => p.status === 'awaiting').length} encomenda(s)
              </span>
              <p className="text-xs text-slate-400">
                Aguardando retirada • {accessLogs.length} acesso(s) auditado(s)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('concierge')}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition text-center cursor-pointer"
            >
              Acessar Portaria →
            </button>
          </article>
        )}

        {/* CARD: Mural Oficial de Comunicados (Real) */}
        <article
          className="col-span-1 lg:col-span-12 w-full min-w-0 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-soft border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between"
          data-purpose="announcements-wall"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
                    Mural Oficial de Comunicados
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800">
                    {announcements.length} {announcements.length === 1 ? 'comunicado' : 'comunicados'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Avisos prediais, convocações de assembleias e informes exclusivos de {condoName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {canManageAnnouncements && (
                <button
                  type="button"
                  onClick={() => setIsAnnouncementsOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer"
                >
                  <span>+ Novo Comunicado</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsAnnouncementsOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 font-bold text-xs transition cursor-pointer"
              >
                <span>Abrir Mural</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {announcements.length === 0 ? (
            <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
              Nenhum comunicado oficial publicado ainda para este condomínio.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {announcements.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  onClick={() => setIsAnnouncementsOpen(true)}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 transition cursor-pointer flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                        {item.category}
                      </span>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        {item.isPinned && (
                          <Pin className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        )}
                        <span>{item.date}</span>
                      </div>
                    </div>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 line-clamp-2">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {item.content}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="truncate max-w-[170px]">{item.author}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">
                      Ler →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        {/* CARD 4: Atividades de Manutenção REAIS (public.maintenance_orders) */}
        <article className="col-span-1 lg:col-span-7 w-full min-w-0 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-soft border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Gestão Operacional
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
                  Ordens de Serviço Recentes
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('maintenance')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold self-start sm:self-auto cursor-pointer border border-transparent dark:border-slate-700"
              >
                <span>+ Novo Chamado</span>
              </button>
            </div>

            {maintenanceOrders.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400 my-2">
                Nenhuma ordem de serviço registrada para {condoName}.
              </div>
            ) : (
              <div className="space-y-3 my-2" data-purpose="maintenance-task-list">
                {maintenanceOrders.slice(0, 3).map((order) => {
                  const isDone =
                    order.statusType === 'completed' || order.statusType === 'certified';
                  return (
                    <div
                      key={order.id}
                      className="bg-slate-50 dark:bg-slate-800/70 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isDone
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                              : order.priority === 'Prioridade Máxima'
                              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                              : 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400'
                          }`}
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : order.priority === 'Prioridade Máxima' ? (
                            <AlertCircle className="w-4 h-4" />
                          ) : (
                            <Wrench className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {order.code} • {order.title}
                          </h4>
                          <span className="text-[11px] text-slate-400 block truncate">
                            {order.location} • {order.scheduledTime}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant={isDone ? 'emerald' : order.priority === 'Prioridade Máxima' ? 'rose' : 'amber'}
                        dot
                      >
                        {order.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>{maintenanceOrders.length} ordem(ns) registrada(s) no banco</span>
            <button
              type="button"
              onClick={() => onNavigateTab('maintenance')}
              className="font-bold text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
            >
              Ver Todas as OS →
            </button>
          </div>
        </article>

        {/* CARD 5: Canais & Indicadores Configuráveis por Condomínio */}
        <article className="col-span-1 lg:col-span-5 w-full min-w-0 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-soft border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Atendimento &amp; Ocorrências
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
                  Canais de Abertura
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl tabular-nums">
                  Total {totalChannelsCount.toLocaleString('pt-BR')}
                </span>
                {isSindicoOrAdmin && (
                  <button
                    type="button"
                    onClick={() => setIsChannelModalOpen(true)}
                    className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    title="Editar Canais de Abertura"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-end justify-between gap-3 h-32 pt-4 pb-2 px-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700/60">
              {[
                { label: 'App', pct: appPercent, color: 'bg-emerald-500' },
                { label: 'Totem', pct: totemPercent, color: 'bg-teal-500' },
                { label: 'Whats', pct: whatsPercent, color: 'bg-amber-400' },
                { label: 'Interf.', pct: interfPercent, color: 'bg-slate-400' },
              ].map((bar) => (
                <div key={bar.label} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300 tabular-nums">
                    {bar.pct}%
                  </span>
                  <div
                    className={`w-full ${bar.color} rounded-lg transition-all`}
                    style={{ height: `${Math.max(8, (bar.pct / 100) * 80)}px` }}
                  />
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    {bar.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {isSindicoOrAdmin && (
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Despesas Lançadas</span>
                <span className="font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                  {totalExpensesAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAiEnergyModalOpen(true)}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Metas &amp; Eficiência →
              </button>
            </div>
          )}
        </article>
      </section>

      <AnnouncementsModal
        isOpen={isAnnouncementsOpen}
        onClose={() => setIsAnnouncementsOpen(false)}
        condominiumName={condoName}
      />

      <ChannelMetricsModal
        isOpen={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
        data={channels}
        onSave={handleSaveChannels}
      />

      <AiEnergyModal
        isOpen={isAiEnergyModalOpen}
        onClose={() => setIsAiEnergyModalOpen(false)}
        data={aiEnergy}
        onSave={handleSaveAiEnergy}
      />
    </div>
  );
};
