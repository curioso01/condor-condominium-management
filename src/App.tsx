import React, { useState } from 'react';
import type { NavigationTab } from './types/condominium';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { OverviewView } from './components/views/OverviewView';
import { FinancialView } from './components/views/FinancialView';
import { UnitsView } from './components/views/UnitsView';
import { ConciergeView } from './components/views/ConciergeView';
import { ReservationsView } from './components/views/ReservationsView';
import { MaintenanceView } from './components/views/MaintenanceView';
import { SettingsModal, type SettingsTab } from './components/views/SettingsModal';

import { useAuth } from './contexts/AuthContext';
import { HelpFaqModal } from './components/views/HelpFaqModal';

const CondorAppShell: React.FC = () => {
  const { currentRole } = useAuth();
  const isSindicoOrAdmin = currentRole === 'sindico' || currentRole === 'superadmin';
  const isPorteiro = currentRole === 'porteiro';
  const isMorador = currentRole === 'morador';

  const [activeTab, setActiveTab] = useState<NavigationTab>('overview');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsDefaultTab, setSettingsDefaultTab] = useState<SettingsTab>('perfil');
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);

  const handleOpenSettings = (tab: SettingsTab = 'perfil') => {
    setSettingsDefaultTab(tab);
    setIsSettingsOpen(true);
  };

  const renderActiveView = () => {
    // RBAC Route Guarding:
    // 1 & 2: Apenas sindico e super admin acessam financeiro
    // 3: Morador só acessa dados/perfil, reservas, encomendas e murais
    if (isMorador && activeTab !== 'overview' && activeTab !== 'reservations') {
      return <OverviewView onNavigateTab={setActiveTab} onOpenSettings={() => handleOpenSettings('perfil')} />;
    }

    if (isPorteiro && (activeTab === 'finance' || activeTab === 'units')) {
      return <OverviewView onNavigateTab={setActiveTab} onOpenSettings={() => handleOpenSettings('perfil')} />;
    }

    switch (activeTab) {
      case 'overview':
        return <OverviewView onNavigateTab={setActiveTab} onOpenSettings={() => handleOpenSettings('perfil')} />;
      case 'finance':
        return <FinancialView />;
      case 'units':
        return <UnitsView />;
      case 'concierge':
        return <ConciergeView />;
      case 'reservations':
        return <ReservationsView />;
      case 'maintenance':
        return <MaintenanceView />;
      default:
        return <OverviewView onNavigateTab={setActiveTab} onOpenSettings={() => handleOpenSettings('perfil')} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] dark:bg-[#0B0F17] text-[#1E293B] dark:text-[#F8FAFC] p-3 sm:p-5 lg:p-6 overflow-x-hidden transition-colors duration-200 selection:bg-emerald-100 dark:selection:bg-emerald-950 selection:text-emerald-700 dark:selection:text-emerald-300">
      {/* MainAppContainer */}
      <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row gap-5">
        {/* Left Floating Sidebar (Desktop & Top Bar on Tablet) */}
        <Sidebar 
          activeTab={activeTab} 
          onSelectTab={setActiveTab} 
          onOpenSettings={() => handleOpenSettings('perfil')}
          onOpenFaq={() => setIsFaqModalOpen(true)}
        />

        {/* Main Content Zone */}
        <main className="flex-1 min-w-0 flex flex-col gap-6 w-full">
          {/* Top Bar Navigation */}
          <Header 
            activeTab={activeTab} 
            onSelectTab={setActiveTab} 
            onOpenSettings={() => handleOpenSettings('perfil')}
          />

          {/* Active Screen View */}
          <div className="w-full min-w-0">
            {renderActiveView()}
          </div>
        </main>
      </div>

      {/* Central Modal de Configurações do Sistema & Perfil */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        defaultTab={settingsDefaultTab}
      />

      {/* Central de Ajuda & Perguntas Frequentes (FAQ) + Suporte Técnico Condor */}
      <HelpFaqModal
        isOpen={isFaqModalOpen}
        onClose={() => setIsFaqModalOpen(false)}
      />

      {/* Mobile Floating Bottom Bar for quick tab switching on small screens (Filtrado por Papel RBAC) */}
      <nav className="xl:hidden fixed bottom-3 left-3 right-3 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md rounded-2xl shadow-float border border-slate-200/80 dark:border-slate-800 p-2 flex items-center justify-around z-40 transition-colors">
        <button
          onClick={() => setActiveTab('overview')}
          className={`p-2 rounded-xl flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'overview' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect height="7" rx="1.5" width="7" x="3" y="3"></rect>
            <rect height="7" rx="1.5" width="7" x="14" y="3"></rect>
            <rect height="7" rx="1.5" width="7" x="14" y="14"></rect>
            <rect height="7" rx="1.5" width="7" x="3" y="14"></rect>
          </svg>
          <span>Geral</span>
        </button>

        {isSindicoOrAdmin && (
          <button
            onClick={() => setActiveTab('finance')}
            className={`p-2 rounded-xl flex flex-col items-center gap-0.5 text-[10px] font-bold ${
              activeTab === 'finance' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <svg className="w-5 h-5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Financeiro</span>
          </button>
        )}

        {isSindicoOrAdmin && (
          <button
            onClick={() => setActiveTab('units')}
            className={`p-2 rounded-xl flex flex-col items-center gap-0.5 text-[10px] font-bold ${
              activeTab === 'units' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span>Unidades</span>
          </button>
        )}

        {!isMorador && (
          <button
            onClick={() => setActiveTab('concierge')}
            className={`p-2 rounded-xl flex flex-col items-center gap-0.5 text-[10px] font-bold ${
              activeTab === 'concierge' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Portaria</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('reservations')}
          className={`p-2 rounded-xl flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'reservations' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect height="18" rx="2" width="18" x="3" y="4"></rect>
            <line x1="16" x2="16" y1="2" y2="6"></line>
            <line x1="8" x2="8" y1="2" y2="6"></line>
            <line x1="3" x2="21" y1="10" y2="10"></line>
            <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"></path>
          </svg>
          <span>Reservas</span>
        </button>

        {!isMorador && (
          <button
            onClick={() => setActiveTab('maintenance')}
            className={`p-2 rounded-xl flex flex-col items-center gap-0.5 text-[10px] font-bold ${
              activeTab === 'maintenance' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
            <span>Manutenção</span>
          </button>
        )}
      </nav>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ProtectedRoute>
          <CondorAppShell />
        </ProtectedRoute>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
