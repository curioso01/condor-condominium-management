import React, { useState, useEffect, useCallback } from 'react';
import type { NavigationTab } from '../../types/condominium';
import { useAuth } from '../../contexts/AuthContext';
import { packageService } from '../../services/packageService';
import { announcementService } from '../../services/announcementService';
import { Logo } from '../common/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';
import {
  LayoutDashboard,
  Briefcase,
  Wallet,
  Building2,
  ShieldCheck,
  CalendarDays,
  Wrench,
  Settings,
  HelpCircle,
  Smartphone,
  Package,
  Megaphone,
} from 'lucide-react';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onOpenSettings?: () => void;
  onOpenFaq?: () => void;
  onOpenMural?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenSettings,
  onOpenFaq,
  onOpenMural,
}) => {
  const {
    currentCondominium,
    currentRole,
    memberships,
    isSindico,
    isSuperAdmin,
    isMorador,
    isPorteiro,
    canAccessFinance,
    canManageUnits,
    canAccessConcierge,
    canManageMaintenance,
  } = useAuth();

  const [pendingPackagesCount, setPendingPackagesCount] = useState(0);
  const [announcementsCount, setAnnouncementsCount] = useState(0);

  const isSindicoOrAdmin = isSindico || isSuperAdmin;
  const hasMultipleCondos = memberships.length > 1;
  const canSeeMaintenance =
    isSindicoOrAdmin || currentRole === 'porteiro' || canManageMaintenance;

  const refreshBadges = useCallback(async () => {
    if (!currentCondominium?.id) {
      setPendingPackagesCount(0);
      setAnnouncementsCount(0);
      return;
    }
    try {
      const [pkgRes, ancRes] = await Promise.all([
        packageService.getPackagesByCondominium(currentCondominium.id),
        announcementService.fetchAnnouncements(currentCondominium.id),
      ]);
      setPendingPackagesCount((pkgRes.data || []).filter((p) => p.status === 'awaiting').length);
      setAnnouncementsCount((ancRes.data || []).length);
    } catch {
      // ignore badge fetch errors
    }
  }, [currentCondominium?.id]);

  useEffect(() => {
    refreshBadges();
    const onRefresh = () => {
      void refreshBadges();
    };
    window.addEventListener('condor:packages-updated', onRefresh);
    window.addEventListener('condor:announcements-updated', onRefresh);
    return () => {
      window.removeEventListener('condor:packages-updated', onRefresh);
      window.removeEventListener('condor:announcements-updated', onRefresh);
    };
  }, [refreshBadges]);

  const navItems: {
    tab: NavigationTab;
    label: string;
    icon: React.ReactNode;
    visible: boolean;
    badgeCount?: number;
  }[] = [
    {
      tab: 'overview',
      label: 'Visão Geral',
      icon: <LayoutDashboard className="w-[18px] h-[18px] 2xl:w-5 2xl:h-5" />,
      visible: true,
    },
    {
      tab: 'portfolio',
      label: `Carteira (${memberships.length} condomínios)`,
      icon: <Briefcase className="w-[18px] h-[18px] 2xl:w-5 2xl:h-5" />,
      visible: isSindicoOrAdmin && hasMultipleCondos,
    },
    // Atalhos dedicados do Morador
    {
      tab: 'my_invoices',
      label: 'Meus Boletos & Pix',
      icon: <Wallet className="w-[18px] h-[18px] 2xl:w-5 2xl:h-5" />,
      visible: isMorador,
    },
    {
      tab: 'my_packages',
      label:
        pendingPackagesCount > 0
          ? `Minhas Encomendas (${pendingPackagesCount} aguardando)`
          : 'Minhas Encomendas',
      icon: <Package className="w-[18px] h-[18px] 2xl:w-5 2xl:h-5" />,
      visible: isMorador,
      badgeCount: pendingPackagesCount,
    },
    // Módulos administrativos / equipe / sub-síndico autorizado
    {
      tab: 'finance',
      label: 'Financeiro & Arrecadação',
      icon: <Wallet className="w-[18px] h-[18px] 2xl:w-5 2xl:h-5" />,
      visible: !isMorador && canAccessFinance,
    },
    {
      tab: 'units',
      label: 'Unidades & Moradores',
      icon: <Building2 className="w-[18px] h-[18px] 2xl:w-5 2xl:h-5" />,
      visible: !isMorador && canManageUnits,
    },
    {
      tab: 'concierge',
      label: 'Portaria, Acessos & Encomendas',
      icon: <ShieldCheck className="w-[18px] h-[18px] 2xl:w-5 2xl:h-5" />,
      visible: !isMorador && (isPorteiro || canAccessConcierge),
      badgeCount: !isMorador ? pendingPackagesCount : 0,
    },
    {
      tab: 'reservations',
      label: 'Espaços & Reservas',
      icon: <CalendarDays className="w-[18px] h-[18px] 2xl:w-5 2xl:h-5" />,
      visible: true,
    },
    {
      tab: 'maintenance',
      label: 'Manutenções & Chamados',
      icon: <Wrench className="w-[18px] h-[18px] 2xl:w-5 2xl:h-5" />,
      visible: !isMorador && canSeeMaintenance,
    },
  ];

  const visibleNavItems = navItems.filter((item) => item.visible);

  return (
    <aside
      className="hidden xl:flex w-20 bg-white dark:bg-[#111827] rounded-4xl py-4 2xl:py-6 px-2 flex-col items-center justify-between gap-2 shadow-floating-sidebar border border-slate-100/80 dark:border-slate-800 shrink-0 sticky top-4 h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto overflow-x-hidden no-scrollbar z-30 transition-colors duration-200"
      data-purpose="primary-sidebar"
    >
      {/* Brand Logo */}
      <button
        type="button"
        onClick={() => onSelectTab('overview')}
        aria-label="Condor — Início e Visão Geral"
        className="flex flex-col items-center shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-2xl p-0.5 transition-all cursor-pointer"
      >
        <Logo size="sm" showText={true} />
      </button>

      {/* Navigation Icons */}
      <nav
        aria-label="Navegação principal"
        className="flex flex-col items-center justify-center gap-1.5 2xl:gap-2.5 my-auto py-1 shrink-0 w-full"
      >
        {visibleNavItems.map((item) => {
          const isActive = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => onSelectTab(item.tab)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              title={item.label}
              className={`w-10 h-10 2xl:w-11 2xl:h-11 shrink-0 rounded-2xl flex items-center justify-center transition-all duration-200 relative cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-pill'
                  : 'text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
              }`}
            >
              {item.icon}
              {item.badgeCount && item.badgeCount > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center ring-2 ring-white dark:ring-[#111827] tabular-nums">
                  {item.badgeCount > 9 ? '9+' : item.badgeCount}
                </span>
              ) : null}
              {isActive && (
                <span className="absolute -right-1 w-1 h-4 bg-emerald-500 rounded-full" />
              )}
            </button>
          );
        })}

        {/* Atalho Rápido: Mural de Comunicados (disponível especialmente para o Morador em modo leitura e para todos) */}
        <button
          type="button"
          onClick={() => {
            if (onOpenMural) {
              onOpenMural();
            } else {
              window.dispatchEvent(new CustomEvent('condor:open-mural'));
            }
          }}
          aria-label="Mural de Comunicados e Notificações"
          title={
            announcementsCount > 0
              ? `Mural de Comunicados (${announcementsCount} avisos)`
              : 'Mural de Comunicados'
          }
          className="w-10 h-10 2xl:w-11 2xl:h-11 shrink-0 rounded-2xl flex items-center justify-center transition-all duration-200 relative cursor-pointer text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <Megaphone className="w-[18px] h-[18px] 2xl:w-5 2xl:h-5" />
          {announcementsCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-emerald-600 text-white text-[9px] font-extrabold flex items-center justify-center ring-2 ring-white dark:ring-[#111827] tabular-nums">
              {announcementsCount > 9 ? '9+' : announcementsCount}
            </span>
          )}
        </button>
      </nav>

      {/* Separator + Footer Utilities */}
      <div className="flex flex-col items-center gap-1.5 2xl:gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 shrink-0 w-full">
        <ThemeToggle
          variant="icon"
          className="w-9 h-9 2xl:w-10 2xl:h-10 shrink-0 border-0 shadow-none bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-amber-300"
        />
        <button
          type="button"
          aria-label="Instalar App CONDOR no Celular ou Computador"
          title="Instalar App no Celular / Computador (PWA)"
          onClick={() => window.dispatchEvent(new CustomEvent('condor:open-pwa-install'))}
          className="w-9 h-9 2xl:w-10 2xl:h-10 shrink-0 rounded-full flex items-center justify-center text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Smartphone className="w-[18px] h-[18px]" />
        </button>
        <button
          type="button"
          aria-label="Configurações"
          title="Configurações"
          onClick={() => onOpenSettings?.()}
          className="w-9 h-9 2xl:w-10 2xl:h-10 shrink-0 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Settings className="w-[18px] h-[18px]" />
        </button>
        <button
          type="button"
          aria-label="Central de Ajuda & Perguntas Frequentes (FAQ)"
          title="Central de Ajuda & FAQ"
          onClick={() => onOpenFaq?.()}
          className="w-8 h-8 2xl:w-9 2xl:h-9 shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 flex items-center justify-center transition-colors cursor-pointer"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
