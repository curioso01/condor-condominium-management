import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Toaster } from 'sonner';
import {
  LayoutDashboard,
  Wallet,
  Building2,
  ShieldCheck,
  CalendarDays,
  Wrench,
} from 'lucide-react';
import type { NavigationTab } from './types/condominium';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { PwaInstallPrompt } from './components/common/PwaInstallPrompt';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { CommandPalette } from './components/common/CommandPalette';
import type { SettingsTab } from './components/views/SettingsModal';

// Code-splitting por rota/módulo (reduz drasticamente o bundle inicial)
const OverviewView = lazy(() =>
  import('./components/views/OverviewView').then((m) => ({ default: m.OverviewView }))
);
const PortfolioView = lazy(() =>
  import('./components/views/PortfolioView').then((m) => ({ default: m.PortfolioView }))
);
const FinancialView = lazy(() =>
  import('./components/views/FinancialView').then((m) => ({ default: m.FinancialView }))
);
const UnitsView = lazy(() =>
  import('./components/views/UnitsView').then((m) => ({ default: m.UnitsView }))
);
const ConciergeView = lazy(() =>
  import('./components/views/ConciergeView').then((m) => ({ default: m.ConciergeView }))
);
const ReservationsView = lazy(() =>
  import('./components/views/ReservationsView').then((m) => ({ default: m.ReservationsView }))
);
const MaintenanceView = lazy(() =>
  import('./components/views/MaintenanceView').then((m) => ({ default: m.MaintenanceView }))
);
const SettingsModal = lazy(() =>
  import('./components/views/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const HelpFaqModal = lazy(() =>
  import('./components/views/HelpFaqModal').then((m) => ({ default: m.HelpFaqModal }))
);

const VALID_TABS: NavigationTab[] = [
  'overview',
  'portfolio',
  'finance',
  'units',
  'concierge',
  'reservations',
  'maintenance',
];

function getInitialTabFromUrl(): NavigationTab {
  if (typeof window === 'undefined') return 'overview';
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab') as NavigationTab | null;
  if (tab && VALID_TABS.includes(tab)) {
    return tab;
  }
  return 'overview';
}

const ViewLoadingFallback: React.FC = () => (
  <div className="space-y-4 animate-pulse py-4" aria-busy="true" aria-label="Carregando módulo">
    <div className="h-24 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="h-32 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800" />
      <div className="h-32 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800" />
      <div className="h-32 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800" />
    </div>
    <div className="h-64 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800" />
  </div>
);

const CondorAppShell: React.FC = () => {
  const { currentRole, isDemoSession, setCurrentCondominiumId } = useAuth();
  const isSindicoOrAdmin = currentRole === 'sindico' || currentRole === 'superadmin';
  const isPorteiro = currentRole === 'porteiro';
  const isMorador = currentRole === 'morador';

  const [activeTab, setActiveTab] = useState<NavigationTab>(getInitialTabFromUrl);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsDefaultTab, setSettingsDefaultTab] = useState<SettingsTab>('perfil');
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Navegação sincronizada com a URL (?tab=...) + suporte ao botão Voltar do navegador e atalhos PWA
  const navigateToTab = useCallback((tab: NavigationTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (tab === 'overview') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', tab);
      }
      url.searchParams.delete('mural');
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      if (nextUrl !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
        window.history.pushState({ tab }, '', nextUrl);
      }
    }
  }, []);

  // Reage ao botão Voltar / Avançar do navegador
  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getInitialTabFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Atalho PWA /?mural=open (manifest.json)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('mural') === 'open') {
      const timer = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('condor:open-mural'));
      }, 250);
      return () => clearTimeout(timer);
    }
  }, []);

  // Atalho global Ctrl+K / Cmd+K para abrir o Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Ao trocar de módulo/página, a nova tela sempre começa do topo
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const rafId = requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
    return () => cancelAnimationFrame(rafId);
  }, [activeTab]);

  const handleOpenSettings = useCallback((tab: SettingsTab = 'perfil') => {
    setSettingsDefaultTab(tab);
    setIsSettingsOpen(true);
  }, []);

  const handleOpenCondominiumFromPortfolio = useCallback(
    (condoId: string, tab: NavigationTab = 'overview') => {
      setCurrentCondominiumId(condoId);
      navigateToTab(tab);
    },
    [setCurrentCondominiumId, navigateToTab]
  );

  const renderActiveView = () => {
    // RBAC Route Guarding:
    // 1. Morador só acessa overview e reservations
    if (isMorador && activeTab !== 'overview' && activeTab !== 'reservations') {
      return <OverviewView onNavigateTab={navigateToTab} onOpenSettings={() => handleOpenSettings('perfil')} />;
    }

    // 2. Porteiro não acessa finance, units nem portfolio
    if (isPorteiro && (activeTab === 'finance' || activeTab === 'units' || activeTab === 'portfolio')) {
      return <OverviewView onNavigateTab={navigateToTab} onOpenSettings={() => handleOpenSettings('perfil')} />;
    }

    switch (activeTab) {
      case 'portfolio':
        return <PortfolioView onOpenCondominium={handleOpenCondominiumFromPortfolio} />;
      case 'overview':
        return <OverviewView onNavigateTab={navigateToTab} onOpenSettings={() => handleOpenSettings('perfil')} />;
      case 'finance':
        return <FinancialView onOpenSettings={(tab) => handleOpenSettings(tab)} />;
      case 'units':
        return <UnitsView />;
      case 'concierge':
        return <ConciergeView />;
      case 'reservations':
        return <ReservationsView />;
      case 'maintenance':
        return <MaintenanceView />;
      default:
        return <OverviewView onNavigateTab={navigateToTab} onOpenSettings={() => handleOpenSettings('perfil')} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] dark:bg-[#0B0F17] text-[#1E293B] dark:text-[#F8FAFC] p-3 sm:p-5 lg:p-6 pt-[max(env(safe-area-inset-top),0.75rem)] sm:pt-[max(env(safe-area-inset-top),1.25rem)] pb-28 xl:pb-6 overflow-x-hidden transition-colors duration-200 selection:bg-emerald-100 dark:selection:bg-emerald-950 selection:text-emerald-700 dark:selection:text-emerald-300">
      {/* Identificação Visual Permanente de MODO DEMONSTRAÇÃO */}
      {isDemoSession && (
        <div
          role="status"
          aria-live="polite"
          data-testid="demo-mode-banner"
          className="max-w-[1600px] mx-auto mb-3 px-4 py-2.5 rounded-2xl bg-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center justify-between gap-3 shadow-md border border-amber-600"
        >
          <span>
            ⚠️ MODO DEMONSTRAÇÃO ATIVO — SESSÃO SIMULADA (Alterações salvas apenas localmente neste navegador; sem persistência no Supabase)
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-950 text-amber-300 text-[10px] uppercase tracking-wider shrink-0">
            DEMO PREVIEW
          </span>
        </div>
      )}

      {/* MainAppContainer */}
      <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row gap-5">
        {/* Left Floating Sidebar (Desktop) */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={navigateToTab}
          onOpenSettings={() => handleOpenSettings('perfil')}
          onOpenFaq={() => setIsFaqModalOpen(true)}
        />

        {/* Main Content Zone */}
        <main className="flex-1 min-w-0 flex flex-col gap-5 w-full">
          {/* Top Bar Navigation */}
          <Header
            activeTab={activeTab}
            onSelectTab={navigateToTab}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            onOpenSettings={() => handleOpenSettings('perfil')}
            onOpenFaq={() => setIsFaqModalOpen(true)}
          />

          {/* Active Screen View wrapped in ErrorBoundary + Suspense */}
          <div className="w-full min-w-0">
            <ErrorBoundary moduleName={activeTab}>
              <Suspense fallback={<ViewLoadingFallback />}>{renderActiveView()}</Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Global Command Palette (Ctrl + K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={navigateToTab}
        onOpenSettings={() => handleOpenSettings('perfil')}
        onOpenFaq={() => setIsFaqModalOpen(true)}
        onOpenMural={() => window.dispatchEvent(new CustomEvent('condor:open-mural'))}
      />

      {/* Central Modal de Configurações do Sistema & Perfil (Lazy) */}
      {isSettingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            defaultTab={settingsDefaultTab}
          />
        </Suspense>
      )}

      {/* Central de Ajuda & Perguntas Frequentes (FAQ) + Suporte Técnico Condor (Lazy) */}
      {isFaqModalOpen && (
        <Suspense fallback={null}>
          <HelpFaqModal
            isOpen={isFaqModalOpen}
            onClose={() => setIsFaqModalOpen(false)}
          />
        </Suspense>
      )}

      {/* PWA Mobile & Web Install Prompt Banner & Modal */}
      <PwaInstallPrompt />

      {/* Mobile Floating Bottom Bar for quick tab switching on small screens (RBAC Filtered) */}
      <nav
        aria-label="Navegação inferior"
        className="xl:hidden fixed bottom-[max(env(safe-area-inset-bottom),0.75rem)] left-2 right-2 sm:left-4 sm:right-4 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md rounded-2xl shadow-float border border-slate-200/80 dark:border-slate-800 p-1 sm:p-1.5 flex items-center justify-between z-40 transition-colors overflow-hidden"
      >
        <button
          type="button"
          onClick={() => navigateToTab('overview')}
          aria-current={activeTab === 'overview' ? 'page' : undefined}
          className={`flex-1 min-w-0 py-1.5 px-0.5 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 shrink-0" />
          <span className="text-[9px] sm:text-[10px] font-bold truncate max-w-full text-center leading-tight tracking-tight">
            Geral
          </span>
        </button>

        {isSindicoOrAdmin && (
          <button
            type="button"
            onClick={() => navigateToTab('finance')}
            aria-current={activeTab === 'finance' ? 'page' : undefined}
            className={`flex-1 min-w-0 py-1.5 px-0.5 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
              activeTab === 'finance'
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Wallet className="w-5 h-5 shrink-0" />
            <span className="text-[9px] sm:text-[10px] font-bold truncate max-w-full text-center leading-tight tracking-tight">
              <span className="inline sm:hidden">Finanças</span>
              <span className="hidden sm:inline">Financeiro</span>
            </span>
          </button>
        )}

        {isSindicoOrAdmin && (
          <button
            type="button"
            onClick={() => navigateToTab('units')}
            aria-current={activeTab === 'units' ? 'page' : undefined}
            className={`flex-1 min-w-0 py-1.5 px-0.5 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
              activeTab === 'units'
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Building2 className="w-5 h-5 shrink-0" />
            <span className="text-[9px] sm:text-[10px] font-bold truncate max-w-full text-center leading-tight tracking-tight">
              Unidades
            </span>
          </button>
        )}

        {!isMorador && (
          <button
            type="button"
            onClick={() => navigateToTab('concierge')}
            aria-current={activeTab === 'concierge' ? 'page' : undefined}
            className={`flex-1 min-w-0 py-1.5 px-0.5 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
              activeTab === 'concierge'
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <span className="text-[9px] sm:text-[10px] font-bold truncate max-w-full text-center leading-tight tracking-tight">
              Portaria
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => navigateToTab('reservations')}
          aria-current={activeTab === 'reservations' ? 'page' : undefined}
          className={`flex-1 min-w-0 py-1.5 px-0.5 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
            activeTab === 'reservations'
              ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <CalendarDays className="w-5 h-5 shrink-0" />
          <span className="text-[9px] sm:text-[10px] font-bold truncate max-w-full text-center leading-tight tracking-tight">
            Reservas
          </span>
        </button>

        {!isMorador && (
          <button
            type="button"
            onClick={() => navigateToTab('maintenance')}
            aria-current={activeTab === 'maintenance' ? 'page' : undefined}
            className={`flex-1 min-w-0 py-1.5 px-0.5 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
              activeTab === 'maintenance'
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Wrench className="w-5 h-5 shrink-0" />
            <span className="text-[9px] sm:text-[10px] font-bold truncate max-w-full text-center leading-tight tracking-tight">
              <span className="inline sm:hidden">Manut.</span>
              <span className="hidden sm:inline">Manutenção</span>
            </span>
          </button>
        )}
      </nav>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary moduleName="Condor">
      <ThemeProvider>
        <AuthProvider>
          <Toaster richColors position="top-right" closeButton />
          <ProtectedRoute>
            <CondorAppShell />
          </ProtectedRoute>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
