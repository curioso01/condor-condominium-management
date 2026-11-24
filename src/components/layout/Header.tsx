import React, { useState, useEffect, useCallback } from 'react';
import type { NavigationTab } from '../../types/condominium';
import { useAuth } from '../../contexts/AuthContext';
import {
  LogOut,
  Building2,
  Shield,
  ChevronDown,
  Camera,
  Settings,
  Smartphone,
  HelpCircle,
  Search,
  Bell,
  FileBarChart2,
  Briefcase,
  Check,
  Inbox,
} from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Logo } from '../common/Logo';
import { AnnouncementsModal } from '../views/AnnouncementsModal';
import { ReportsModal } from '../views/ReportsModal';
import { NotificationDetailModal, type OperationalNotification } from '../views/NotificationDetailModal';
import { announcementService } from '../../services/announcementService';
import { amenityService } from '../../services/amenityService';
import { invoiceService } from '../../services/invoiceService';
import { packageService } from '../../services/packageService';
import { maintenanceService } from '../../services/maintenanceService';
import { formatRoleLabel } from '../../types/database.types';
import {
  getBrowserNotificationPermission,
  requestPushPermissionAndRegister,
  type NotificationPermissionState,
} from '../../services/notificationPushService';

interface HeaderProps {
  activeTab: NavigationTab;
  onSelectTab?: (tab: NavigationTab) => void;
  onOpenCommandPalette?: () => void;
  onOpenSettings?: () => void;
  onOpenFaq?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  onOpenCommandPalette,
  onOpenSettings,
  onOpenFaq,
}) => {
  const {
    profile,
    user,
    currentCondominium,
    currentRole,
    memberships,
    setCurrentCondominiumId,
    signOut,
  } = useAuth();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [condoSwitcherOpen, setCondoSwitcherOpen] = useState(false);
  const [alerts, setAlerts] = useState<OperationalNotification[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [isAnnouncementsModalOpen, setIsAnnouncementsModalOpen] = useState(false);
  const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<OperationalNotification | null>(null);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermissionState>(() =>
    getBrowserNotificationPermission()
  );

  const isSindicoOrAdmin = currentRole === 'sindico' || currentRole === 'superadmin';
  const isMorador = currentRole === 'morador';
  const hasMultipleCondos = memberships.length > 1;

  const modulePlaceholders: Record<NavigationTab, string> = {
    overview: 'Buscar módulos, unidades, OS ou condomínios...',
    portfolio: 'Buscar condomínio na carteira...',
    finance: 'Buscar cobranças, Pix, relatórios...',
    units: 'Buscar unidade, morador, placa...',
    concierge: 'Buscar portaria, encomendas, visitantes...',
    reservations: 'Buscar espaços, reservas, calendário...',
    maintenance: 'Buscar ordens de serviço, equipamentos...',
    my_invoices: 'Buscar seus boletos e pagamentos Pix...',
    my_packages: 'Buscar suas encomendas e PINs de retirada...',
  };

  // Escuta evento global para abrir o Mural de Comunicados (usado por ?mural=open e CommandPalette)
  useEffect(() => {
    const openMural = () => setIsAnnouncementsModalOpen(true);
    window.addEventListener('condor:open-mural', openMural);
    return () => window.removeEventListener('condor:open-mural', openMural);
  }, []);

  // Carrega notificações reais do condomínio ativo (zero mocks fixos)
  const loadRealAlerts = useCallback(async () => {
    if (!currentCondominium?.id) {
      setAlerts([]);
      return;
    }

    const condoId = currentCondominium.id;
    const nextAlerts: OperationalNotification[] = [];

    try {
      const [ancRes, resRes, pkgRes, invRes, ordRes] = await Promise.all([
        announcementService.fetchAnnouncements(condoId),
        amenityService.getReservations(condoId),
        packageService.getPackagesByCondominium(condoId),
        invoiceService.getInvoicesByCondominium(condoId),
        !isMorador ? maintenanceService.getOrdersByCondominium(condoId) : Promise.resolve({ data: [] }),
      ]);

      // 1. Encomendas aguardando retirada
      const awaitingPackages = (pkgRes.data || []).filter((p) => p.status === 'awaiting');
      awaitingPackages.slice(0, 2).forEach((pkg) => {
        nextAlerts.push({
          id: `pkg-${pkg.id}`,
          type: 'locker',
          title: `Encomenda: ${pkg.courier}`,
          badge: 'Aguardando',
          badgeVariant: 'emerald',
          preview: `Apto ${pkg.unit_number} • ${pkg.locker_compartment || 'Portaria'}`,
          detail: `Encomenda (${pkg.size}) para ${pkg.recipient_name} via ${pkg.courier}.${pkg.tracking_code ? ` Rastreio: ${pkg.tracking_code}.` : ''} Retire apresentando o código PIN na portaria.`,
          timestamp: new Date(pkg.received_at).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }),
          data: {
            pin: pkg.pickup_pin,
            lockerNumber: pkg.locker_compartment || 'Portaria',
            unitLabel: `Unidade ${pkg.unit_number}`,
          },
        });
      });

      // 2. Reservas pendentes de aprovação (para síndico/admin)
      const pendingReservations = (resRes.data || []).filter((r) => r.statusType === 'warning');
      if (isSindicoOrAdmin && pendingReservations.length > 0) {
        const first = pendingReservations[0];
        const horario = first.startTime && first.endTime ? `${first.startTime}–${first.endTime}` : first.dateStr;
        nextAlerts.push({
          id: `res-${first.id}`,
          type: 'reserva',
          title:
            pendingReservations.length === 1
              ? `Aprovar reserva: ${first.spaceName}`
              : `${pendingReservations.length} reservas aguardando aprovação`,
          badge: 'Aprovação',
          badgeVariant: 'amber',
          preview: `${first.responsibleName} (${first.unitNumber}) • ${first.dateStr}`,
          detail: `Há ${pendingReservations.length} solicitação(ões) de reserva aguardando análise da administração em Espaços & Reservas.`,
          timestamp: `${first.dateStr} • ${horario}`,
          data: {
            spaceName: first.spaceName,
            date: `${first.dateStr}${first.startTime ? ` • ${first.startTime}–${first.endTime || ''}` : ''}`,
            statusLabel: first.status,
          },
        });
      }

      // 3. Cobranças em atraso ou vencendo hoje
      const urgentInvoices = (invRes.data || []).filter(
        (inv) => inv.status === 'overdue' || inv.status === 'due_today'
      );
      if (urgentInvoices.length > 0) {
        const overdueCount = urgentInvoices.filter((i) => i.status === 'overdue').length;
        const totalUrgent = urgentInvoices.reduce((acc, i) => acc + i.amount, 0);
        nextAlerts.push({
          id: `fin-${condoId}-${urgentInvoices.length}`,
          type: 'financeiro',
          title:
            overdueCount > 0
              ? `${overdueCount} cobrança(s) em atraso`
              : `${urgentInvoices.length} cobrança(s) vencendo hoje`,
          badge: overdueCount > 0 ? 'Em Atraso' : 'Vence Hoje',
          badgeVariant: overdueCount > 0 ? 'rose' : 'amber',
          preview: `Total pendente: ${totalUrgent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
          detail: isSindicoOrAdmin
            ? `Existem ${urgentInvoices.length} cobrança(s) pendentes totalizando ${totalUrgent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Acesse o módulo Financeiro para emitir Pix ou registrar baixa manual.`
            : `Você possui ${urgentInvoices.length} cobrança(s) pendente(s) totalizando ${totalUrgent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Abra o QR Code Pix em Visão Geral.`,
          timestamp: new Date().toLocaleDateString('pt-BR'),
        });
      }

      // 4. Ordens de manutenção urgentes/abertas (síndico e porteiro)
      const openOrders = (ordRes.data || []).filter(
        (o) => o.statusType !== 'completed' && o.statusType !== 'certified'
      );
      if (!isMorador && openOrders.length > 0) {
        const topOrder = openOrders[0];
        nextAlerts.push({
          id: `os-${topOrder.id}`,
          type: 'manutencao',
          title: `${topOrder.code} — ${topOrder.title}`,
          badge: topOrder.priority,
          badgeVariant: topOrder.priority === 'Prioridade Máxima' ? 'rose' : 'amber',
          preview: `${topOrder.location} • ${topOrder.status}`,
          detail: topOrder.description || `Ordem de serviço em aberto no local ${topOrder.location}.`,
          timestamp: topOrder.scheduledDate || topOrder.scheduledTime,
          data: {
            provider: topOrder.technicianCompany || topOrder.location,
            date: topOrder.scheduledDate || topOrder.scheduledTime,
          },
        });
      }

      // 5. Último comunicado oficial do mural
      const latestAnnouncement = (ancRes.data || [])[0];
      if (latestAnnouncement) {
        nextAlerts.push({
          id: `anc-${latestAnnouncement.id}`,
          type: 'comunicado',
          title: latestAnnouncement.title,
          badge: latestAnnouncement.category,
          badgeVariant: latestAnnouncement.category === 'Urgente' ? 'rose' : 'slate',
          preview: latestAnnouncement.content,
          detail: latestAnnouncement.content,
          timestamp: latestAnnouncement.date || new Date(latestAnnouncement.createdAtIso).toLocaleDateString('pt-BR'),
        });
      }
    } catch (err) {
      console.warn('[Header] Erro ao carregar alertas operacionais:', err);
    }

    setAlerts(nextAlerts);
  }, [currentCondominium?.id, isMorador, isSindicoOrAdmin]);

  useEffect(() => {
    setDismissedIds([]);
    loadRealAlerts();
    const handleRefresh = () => {
      void loadRealAlerts();
    };
    window.addEventListener('condor:announcements-updated', handleRefresh);
    window.addEventListener('condor:packages-updated', handleRefresh);
    return () => {
      window.removeEventListener('condor:announcements-updated', handleRefresh);
      window.removeEventListener('condor:packages-updated', handleRefresh);
    };
  }, [loadRealAlerts]);

  const handleEnablePushNotifications = async () => {
    const res = await requestPushPermissionAndRegister({
      userId: user?.id,
      condominiumId: currentCondominium?.id,
    });
    setPushPermission(res.status);
  };

  const unreadCount = alerts.filter((a) => !dismissedIds.includes(a.id)).length;

  const handleOpenNotification = (alert: OperationalNotification) => {
    setSelectedNotification(alert);
    setIsNotificationModalOpen(true);
    setNotificationsOpen(false);
    setDismissedIds((prev) => (prev.includes(alert.id) ? prev : [...prev, alert.id]));
  };

  const handleMarkAllRead = () => {
    setDismissedIds(alerts.map((a) => a.id));
  };

  return (
    <header className="w-full flex items-center justify-between gap-2 sm:gap-3 py-1.5" data-purpose="top-navigation">
      {/* Left group: Mobile Logo + Prominent Condo Switcher Pill + Omnibox Trigger */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
        {/* Logo (mobile/tablet, sidebar só aparece em xl) */}
        <button
          type="button"
          onClick={() => onSelectTab?.('overview')}
          aria-label="Condor — Início e Visão Geral"
          className="xl:hidden shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-2xl cursor-pointer"
        >
          <Logo size="sm" showText={false} />
        </button>

        {/* Seletor Proeminente de Condomínio (Sempre Visível no Topo) */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              if (hasMultipleCondos) {
                setCondoSwitcherOpen(!condoSwitcherOpen);
                setNotificationsOpen(false);
                setProfileMenuOpen(false);
              } else {
                onSelectTab?.('overview');
              }
            }}
            aria-expanded={hasMultipleCondos ? condoSwitcherOpen : undefined}
            aria-label={`Condomínio ativo: ${currentCondominium?.name || 'Condomínio'}`}
            className="h-10 sm:h-11 px-3 sm:px-3.5 bg-white dark:bg-slate-900 rounded-full border border-slate-200/80 dark:border-slate-800 shadow-soft hover:border-emerald-400 dark:hover:border-emerald-700 transition flex items-center gap-2 max-w-[165px] sm:max-w-[240px] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <span className="w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Building2 className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate">
              {currentCondominium?.name || 'Condomínio'}
            </span>
            {hasMultipleCondos && (
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${
                  condoSwitcherOpen ? 'rotate-180' : ''
                }`}
              />
            )}
          </button>

          {hasMultipleCondos && condoSwitcherOpen && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/10 dark:bg-black/30 sm:bg-transparent"
                onClick={() => setCondoSwitcherOpen(false)}
              />
              <div className="fixed left-3 right-3 top-[calc(4.75rem+env(safe-area-inset-top))] sm:absolute sm:left-0 sm:right-auto sm:top-auto sm:mt-2 sm:w-80 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 z-50 animate-fadeIn">
                <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Seus Condomínios ({memberships.length})
                  </span>
                  {isSindicoOrAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setCondoSwitcherOpen(false);
                        onSelectTab?.('portfolio');
                      }}
                      className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Briefcase className="w-3 h-3" />
                      Ver Carteira
                    </button>
                  )}
                </div>

                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {memberships.map((m) => {
                    const isSelected = currentCondominium?.id === m.condominium.id;
                    return (
                      <button
                        key={m.condominium.id}
                        type="button"
                        onClick={() => {
                          setCurrentCondominiumId(m.condominium.id);
                          setCondoSwitcherOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-2xl text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white font-bold shadow-sm'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate">{m.condominium.name}</p>
                          <p
                            className={`text-[10px] capitalize ${
                              isSelected ? 'text-emerald-100' : 'text-slate-400'
                            }`}
                          >
                            Papel: {m.membership.role}
                            {m.condominium.city ? ` • ${m.condominium.city}` : ''}
                          </p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Omnibox Search Trigger (Opens Command Palette Ctrl+K) */}
        <button
          type="button"
          onClick={() => onOpenCommandPalette?.()}
          aria-label="Abrir busca rápida (Ctrl+K)"
          className="relative flex-1 min-w-0 sm:max-w-sm lg:max-w-md h-10 sm:h-11 pl-3.5 sm:pl-4 pr-3 sm:pr-20 bg-white dark:bg-slate-900 rounded-full border border-slate-200/80 dark:border-slate-800 shadow-soft hover:border-emerald-400 dark:hover:border-emerald-700 text-left flex items-center gap-2.5 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500 truncate">
            {modulePlaceholders[activeTab] || 'Buscar no sistema...'}
          </span>
          <kbd className="hidden sm:inline-flex items-center absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 select-none">
            Ctrl + K
          </kbd>
        </button>
      </div>

      {/* Right Quick Actions (Theme Toggle + FAQ + Notifications + Profile) */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Theme Toggle Button */}
        <div className="hidden sm:block">
          <ThemeToggle variant="icon" />
        </div>

        {/* Central de Ajuda & FAQ */}
        <button
          type="button"
          onClick={() => onOpenFaq?.()}
          aria-label="Central de Ajuda & Perguntas Frequentes (FAQ)"
          title="Central de Ajuda & FAQ"
          className="w-10 h-10 sm:w-11 sm:h-11 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 shadow-soft border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 relative transition-transform hover:scale-105 cursor-pointer shrink-0"
        >
          <HelpCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </button>

        {/* Notifications Icon with Real Count Badge */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              setProfileMenuOpen(false);
              setCondoSwitcherOpen(false);
            }}
            aria-label="Notificações operacionais"
            aria-expanded={notificationsOpen}
            className="w-10 h-10 sm:w-11 sm:h-11 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-soft border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 relative transition-transform hover:scale-105 cursor-pointer"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-emerald-600 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 tabular-nums">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Real Notification Dropdown */}
          {notificationsOpen && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/10 dark:bg-black/30 backdrop-blur-[1px] sm:bg-transparent"
                onClick={() => setNotificationsOpen(false)}
              />
              <div className="fixed left-3 right-3 top-[calc(4.75rem+env(safe-area-inset-top))] sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80 max-h-[70vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl shadow-float border border-slate-100 dark:border-slate-800 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 mb-3">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Alertas de {currentCondominium?.name || 'Condomínio'}
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
                    >
                      Marcar lidas
                    </button>
                  )}
                </div>

                {alerts.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                    <Inbox className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                    <p>Nenhum alerta operacional pendente neste condomínio.</p>
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    {alerts.map((alert) => {
                      const isRead = dismissedIds.includes(alert.id);
                      return (
                        <button
                          key={alert.id}
                          type="button"
                          onClick={() => handleOpenNotification(alert)}
                          className={`w-full text-left p-2.5 rounded-2xl border transition-all duration-150 cursor-pointer hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                            isRead ? 'opacity-70' : ''
                          } ${
                            alert.badgeVariant === 'rose'
                              ? 'bg-rose-50/70 hover:bg-rose-100/70 dark:bg-rose-950/30 border-rose-100 dark:border-rose-800/60'
                              : alert.badgeVariant === 'amber'
                              ? 'bg-amber-50/70 hover:bg-amber-100/70 dark:bg-amber-950/40 border-amber-100/80 dark:border-amber-800/60'
                              : alert.badgeVariant === 'emerald'
                              ? 'bg-emerald-50/70 hover:bg-emerald-100/70 dark:bg-emerald-950/40 border-emerald-100/80 dark:border-emerald-800/60'
                              : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 border-slate-100 dark:border-slate-700/60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                              {alert.title}
                            </p>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                                alert.badgeVariant === 'rose'
                                  ? 'text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/60'
                                  : alert.badgeVariant === 'amber'
                                  ? 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60'
                                  : alert.badgeVariant === 'emerald'
                                  ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60'
                                  : 'text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700'
                              }`}
                            >
                              {alert.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1">
                            {alert.preview}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}

                {pushPermission !== 'granted' && pushPermission !== 'unsupported' && (
                  <button
                    type="button"
                    onClick={handleEnablePushNotifications}
                    className="w-full mt-3 py-2 text-center text-[11px] font-bold text-slate-800 dark:text-slate-100 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-xl transition cursor-pointer border border-amber-200 dark:border-amber-800/60"
                  >
                    Ativar alertas push neste dispositivo
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen(false);
                    setIsAnnouncementsModalOpen(true);
                  }}
                  className="w-full mt-2 py-2 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-xl transition cursor-pointer border border-emerald-100 dark:border-emerald-800/60"
                >
                  Ver Mural de Comunicados Oficiais
                </button>
              </div>
            </>
          )}
        </div>

        {/* User Profile Pill & Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setProfileMenuOpen(!profileMenuOpen);
              setNotificationsOpen(false);
              setCondoSwitcherOpen(false);
            }}
            aria-expanded={profileMenuOpen}
            aria-label="Menu do Usuário"
            className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 sm:pl-1.5 sm:pr-3 sm:py-1.5 rounded-full shadow-soft border border-slate-200/80 dark:border-slate-800 cursor-pointer hover:bg-slate-50/90 dark:hover:bg-slate-800 transition-all select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <div className="relative w-8 h-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 ring-2 ring-emerald-500/30 shrink-0">
              {profile?.avatar_url ? (
                <img
                  alt={profile?.full_name || 'Usuário'}
                  className="w-full h-full object-cover"
                  src={profile.avatar_url}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-xs bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                  {(profile?.full_name || user?.email || 'CO').slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="text-left hidden md:block leading-tight">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight max-w-[120px] truncate">
                {profile?.full_name || user?.email || 'Usuário Condor'}
              </h4>
              <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                {formatRoleLabel(currentRole)}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          {/* Profile Dropdown Menu */}
          {profileMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/10 dark:bg-black/30 backdrop-blur-[1px] sm:bg-transparent"
                onClick={() => setProfileMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] max-h-[78vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 z-50 animate-fadeIn">
                <div className="p-3 border-b border-slate-100 dark:border-slate-800 mb-2">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {profile?.full_name || 'Usuário Condor'}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {user?.email || ''}
                  </p>
                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-full text-[10px] font-bold border border-emerald-200/60 dark:border-emerald-800 uppercase">
                    <Shield className="w-3 h-3" />
                    <span>Papel: {currentRole || 'sem vínculo'}</span>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-1 mb-2">
                  {isSindicoOrAdmin && hasMultipleCondos && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onSelectTab?.('portfolio');
                      }}
                      className="w-full text-left p-2 rounded-2xl text-xs font-semibold flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100/70 transition-colors cursor-pointer"
                    >
                      <Briefcase className="w-4 h-4 shrink-0" />
                      <span>Carteira ({memberships.length} Condomínios)</span>
                    </button>
                  )}

                  {isSindicoOrAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setIsReportsModalOpen(true);
                      }}
                      className="w-full text-left p-2 rounded-2xl text-xs font-semibold flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer"
                    >
                      <FileBarChart2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Central de Relatórios & CSV</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onOpenSettings?.();
                    }}
                    className="w-full text-left p-2 rounded-2xl text-xs font-semibold flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Foto, Perfil & Senha</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onOpenSettings?.();
                    }}
                    className="w-full text-left p-2 rounded-2xl text-xs font-semibold flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                    <span>Configurações</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      window.dispatchEvent(new CustomEvent('condor:open-pwa-install'));
                    }}
                    className="w-full text-left p-2 rounded-2xl text-xs font-semibold flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Instalar App no Celular (PWA)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onOpenFaq?.();
                    }}
                    className="w-full text-left p-2 rounded-2xl text-xs font-semibold flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Central de Ajuda & FAQ</span>
                  </button>
                </div>

                {/* Theme Preference Switcher */}
                <div className="mb-2 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700/60">
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 px-1">
                    Tema da Interface
                  </p>
                  <ThemeToggle variant="segmented" className="w-full justify-between" />
                </div>

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={async () => {
                    setProfileMenuOpen(false);
                    await signOut();
                  }}
                  className="w-full mt-1 p-2.5 rounded-2xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-bold flex items-center justify-center gap-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair da Conta (Logout)</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal de Mural de Avisos & Comunicados */}
      <AnnouncementsModal
        isOpen={isAnnouncementsModalOpen}
        onClose={() => setIsAnnouncementsModalOpen(false)}
        condominiumName={currentCondominium?.name || 'Condomínio'}
      />

      {/* Modal da Central de Relatórios & Exportação */}
      <ReportsModal
        isOpen={isReportsModalOpen}
        onClose={() => setIsReportsModalOpen(false)}
        condominiumName={currentCondominium?.name || 'Condomínio'}
      />

      {/* Modal de Detalhes da Notificação Operacional */}
      <NotificationDetailModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        notification={selectedNotification}
        onNavigateTab={onSelectTab}
        onOpenMural={() => setIsAnnouncementsModalOpen(true)}
        canAccessMaintenance={!isMorador}
        canAccessFinance={isSindicoOrAdmin}
        canAccessConcierge={!isMorador}
      />
    </header>
  );
};
