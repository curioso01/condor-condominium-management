import React from 'react';
import type { NavigationTab } from '../../types/condominium';
import { useAuth } from '../../contexts/AuthContext';
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
} from 'lucide-react';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onOpenSettings?: () => void;
  onOpenFaq?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab, onOpenSettings, onOpenFaq }) => {
  const { currentRole, memberships } = useAuth();

  const isSindicoOrAdmin = currentRole === 'sindico' || currentRole === 'superadmin';
  const isMorador = currentRole === 'morador';
  const hasMultipleCondos = memberships.length > 1;

  const navItems: { tab: NavigationTab; label: string; icon: React.ReactNode; visible: boolean }[] = [
    {
      tab: 'overview',
      label: 'Visão Geral',
      icon: <LayoutDashboard className="w-5 h-5" />,
      visible: true,
    },
    {
      tab: 'portfolio',
      label: `Carteira (${memberships.length} condomínios)`,
      icon: <Briefcase className="w-5 h-5" />,
      visible: isSindicoOrAdmin && hasMultipleCondos,
    },
    {
      tab: 'finance',
      label: 'Financeiro & Arrecadação',
      icon: <Wallet className="w-5 h-5" />,
      visible: isSindicoOrAdmin,
    },
    {
      tab: 'units',
      label: 'Unidades & Moradores',
      icon: <Building2 className="w-5 h-5" />,
      visible: isSindicoOrAdmin,
    },
    {
      tab: 'concierge',
      label: 'Portaria, Acessos & Encomendas',
      icon: <ShieldCheck className="w-5 h-5" />,
      visible: !isMorador,
    },
    {
      tab: 'reservations',
      label: 'Espaços & Reservas',
      icon: <CalendarDays className="w-5 h-5" />,
      visible: true,
    },
    {
      tab: 'maintenance',
      label: 'Manutenções & Chamados',
      icon: <Wrench className="w-5 h-5" />,
      visible: !isMorador,
    },
  ];

  const visibleNavItems = navItems.filter((item) => item.visible);

  return (
    <aside
      className="hidden xl:flex w-20 bg-white dark:bg-[#111827] rounded-4xl py-7 flex-col items-center justify-between shadow-floating-sidebar border border-slate-100/80 dark:border-slate-800 shrink-0 sticky top-6 h-[calc(100vh-3rem)] z-30 transition-colors duration-200"
      data-purpose="primary-sidebar"
    >
      {/* Brand Logo */}
      <button
        type="button"
        onClick={() => onSelectTab('overview')}
        aria-label="Condor — Início e Visão Geral"
        className="flex flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-2xl p-0.5 transition-all"
      >
        <Logo size="md" showText={true} />
      </button>

      {/* Navigation Icons */}
      <nav aria-label="Navegação principal" className="flex xl:flex-col items-center gap-2 sm:gap-2.5 my-auto">
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
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 relative cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-pill scale-105'
                  : 'text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
              }`}
            >
              {item.icon}
              {isActive && (
                <span className="hidden xl:block absolute -right-1.5 w-1.5 h-4 bg-emerald-600 rounded-full" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Support / Theme & Settings */}
      <div className="flex xl:flex-col items-center gap-2.5">
        <ThemeToggle
          variant="icon"
          className="w-10 h-10 border-0 shadow-none bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-amber-300"
        />
        <button
          type="button"
          aria-label="Instalar App CONDOR no Celular ou Computador"
          title="Instalar App no Celular / Computador (PWA)"
          onClick={() => window.dispatchEvent(new CustomEvent('condor:open-pwa-install'))}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Smartphone className="w-5 h-5" />
        </button>
        <button
          type="button"
          aria-label="Configurações"
          title="Configurações"
          onClick={() => onOpenSettings?.()}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Settings className="w-5 h-5" />
        </button>
        <button
          type="button"
          aria-label="Central de Ajuda & Perguntas Frequentes (FAQ)"
          title="Central de Ajuda & FAQ"
          onClick={() => onOpenFaq?.()}
          className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 flex items-center justify-center transition-colors cursor-pointer"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
