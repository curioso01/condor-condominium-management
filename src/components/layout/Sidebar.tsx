import React from 'react';
import type { NavigationTab } from '../../types/condominium';
import { useAuth } from '../../contexts/AuthContext';
import { Logo } from '../common/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onOpenSettings?: () => void;
  onOpenFaq?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab, onOpenSettings, onOpenFaq }) => {
  const { currentRole } = useAuth();

  const isSindicoOrAdmin = currentRole === 'sindico' || currentRole === 'superadmin';
  const isMorador = currentRole === 'morador';

  const navItems: { tab: NavigationTab; label: string; icon: React.ReactNode }[] = [
    {
      tab: 'overview',
      label: 'Visão Geral',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect height="7" rx="1.5" width="7" x="3" y="3"></rect>
          <rect height="7" rx="1.5" width="7" x="14" y="3"></rect>
          <rect height="7" rx="1.5" width="7" x="14" y="14"></rect>
          <rect height="7" rx="1.5" width="7" x="3" y="14"></rect>
        </svg>
      ),
    },
    {
      tab: 'finance',
      label: 'Financeiro & Arrecadação',
      icon: (
        <svg className="w-5 h-5 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      tab: 'units',
      label: 'Unidades & Moradores',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      ),
    },
    {
      tab: 'concierge',
      label: 'Portaria & Acessos',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      tab: 'reservations',
      label: 'Espaços & Reservas',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect height="18" rx="2" width="18" x="3" y="4"></rect>
          <line x1="16" x2="16" y1="2" y2="6"></line>
          <line x1="8" x2="8" y1="2" y2="6"></line>
          <line x1="3" x2="21" y1="10" y2="10"></line>
          <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"></path>
        </svg>
      ),
    },
    {
      tab: 'maintenance',
      label: 'Manutenções & Chamados',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
        </svg>
      ),
    },
  ];

  // RBAC Filter: morador só acessa overview e reservations; porteiro não acessa finance nem units
  const visibleNavItems = navItems.filter((item) => {
    if (item.tab === 'finance') {
      return isSindicoOrAdmin;
    }
    if (item.tab === 'units') {
      return isSindicoOrAdmin;
    }
    if (item.tab === 'concierge') {
      return !isMorador;
    }
    if (item.tab === 'maintenance') {
      return !isMorador;
    }
    return true;
  });

  return (
    <aside 
      className="w-full xl:w-20 bg-white dark:bg-[#111827] rounded-3xl xl:rounded-4xl p-3 xl:py-7 flex xl:flex-col items-center justify-between shadow-floating-sidebar border border-slate-100/80 dark:border-slate-800 shrink-0 sticky top-3 xl:top-6 xl:h-[calc(100vh-3rem)] z-30 transition-colors duration-200" 
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
      <nav className="flex xl:flex-col items-center gap-2 sm:gap-3 my-auto">
        {visibleNavItems.map((item) => {
          const isActive = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              onClick={() => onSelectTab(item.tab)}
              aria-label={item.label}
              title={item.label}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 relative ${
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
          aria-label="Configurações do Condomínio"
          title="Configurações do Condomínio"
          onClick={() => onOpenSettings?.()}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
          </svg>
        </button>
        <button
          aria-label="Central de Ajuda & Perguntas Frequentes (FAQ)"
          title="Central de Ajuda & FAQ"
          onClick={() => onOpenFaq?.()}
          className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-bold flex items-center justify-center transition-colors cursor-pointer"
        >
          ?
        </button>
      </div>
    </aside>
  );
};
