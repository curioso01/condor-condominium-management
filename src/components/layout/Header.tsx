import React, { useState, useEffect } from 'react';
import type { NavigationTab } from '../../types/condominium';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, Building, Shield, ChevronDown, Camera, Settings } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { AnnouncementsModal } from '../views/AnnouncementsModal';
import { ReportsModal } from '../views/ReportsModal';
import { NotificationDetailModal, type OperationalNotification } from '../views/NotificationDetailModal';

interface HeaderProps {
  activeTab: NavigationTab;
  onSelectTab?: (tab: NavigationTab) => void;
  onSearch?: (query: string) => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  activeTab, 
  onSelectTab,
  onSearch,
  onOpenSettings,
}) => {
  const { profile, user, currentCondominium, currentRole, memberships, setCurrentCondominiumId, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(3);
  const [isAnnouncementsModalOpen, setIsAnnouncementsModalOpen] = useState(false);
  const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<OperationalNotification | null>(null);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);

  const modulePlaceholders: Record<NavigationTab, string> = {
    overview: 'Buscar no condomínio (unidade, morador, boleto)...',
    finance: 'Buscar boletos, cobranças, fornecedor...',
    units: 'Buscar unidade, morador, placa, bloco...',
    concierge: 'Buscar morador, visitante, encomenda...',
    reservations: 'Buscar reservas, espaços, moradores...',
    maintenance: 'Buscar OS, equipamento, fornecedor...',
  };

  // Keyboard shortcut ⌘K or Ctrl+K focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const input = document.getElementById('condor-search-input');
        input?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const operationalAlerts: OperationalNotification[] = [
    {
      id: 'notif-1',
      type: 'manutencao',
      title: 'Inspeção Elevador Atlas',
      badge: 'Amanhã',
      badgeVariant: 'amber',
      preview: 'Agendada preventiva semestral às 09:00.',
      detail: 'Inspeção preventiva técnica semestral dos elevadores Atlas (sociais e serviço) agendada com a equipe da Atlas Schindler. O elevador de serviço permanecerá operando alternadamente durante a manutenção.',
      timestamp: 'Amanhã, 09:00 - 13:00',
      data: {
        provider: 'Atlas Schindler Engenharia Predial',
        date: 'Amanhã • 09:00 às 13:00',
      },
    },
    {
      id: 'notif-2',
      type: 'locker',
      title: 'Smart Locker #08',
      badge: 'Entregue',
      badgeVariant: 'emerald',
      preview: 'Nova encomenda guardada para Apto 402.',
      detail: 'Uma nova encomenda entregue via transportadora parceira foi recebida pela portaria e guardada no armário inteligente #08. Digite o PIN de 4 dígitos ou aproxime o QR Code para retirar.',
      timestamp: 'Hoje às 10:45',
      data: {
        lockerNumber: '#08 (Portaria Principal)',
        pin: '8492',
        provider: 'Mercado Livre / Loggi Express',
      },
    },
    {
      id: 'notif-3',
      type: 'reserva',
      title: 'Reserva Confirmada',
      badge: '25 Abr',
      badgeVariant: 'slate',
      preview: 'Salão Gourmet Principal para sex, 20h.',
      detail: 'Sua reserva para uso do Salão Gourmet Principal foi confirmada e lançada no calendário oficial. Período autorizado das 18:00 às 02:00. O espaço conta com churrasqueira, climatização e utensílios completos.',
      timestamp: 'Sexta-feira, 25 de Abril',
      data: {
        spaceName: 'Salão Gourmet Principal (Bloco A)',
        date: '25 de Abril de 2026 • 18:00 às 02:00',
      },
    },
  ];

  const handleOpenNotification = (alert: OperationalNotification) => {
    setSelectedNotification(alert);
    setIsNotificationModalOpen(true);
    setNotificationsOpen(false);
    if (unreadNotifications > 0) {
      setUnreadNotifications((prev) => Math.max(0, prev - 1));
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    onSearch?.(e.target.value);
  };

  return (
    <header className="w-full flex items-center justify-between gap-3 sm:gap-4 py-1.5" data-purpose="top-navigation">
      {/* Omnibox Search Bar */}
      <div className="relative flex-1 max-w-sm sm:max-w-md lg:max-w-lg">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <input
          id="condor-search-input"
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder={modulePlaceholders[activeTab] || 'Buscar no sistema...'}
          className="w-full h-11 pl-11 pr-20 text-xs font-medium bg-white dark:bg-slate-900 rounded-full border border-slate-200/80 dark:border-slate-800 shadow-soft focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 placeholder-slate-400 dark:placeholder-slate-500 text-slate-700 dark:text-slate-100 transition-all"
        />
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 pointer-events-none select-none">
          Ctrl + K
        </span>
      </div>

      {/* Quick Actions (Theme Toggle + Notifications + Profile) */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">

        {/* Theme Toggle Button */}
        <ThemeToggle variant="icon" />

        {/* Notifications Icon with Badge */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            aria-label="Notificações"
            className="w-11 h-11 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-soft border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 relative transition-transform hover:scale-105"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {unreadNotifications > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-emerald-600 rounded-full ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>

          {/* Quick Notification Dropdown */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-3xl shadow-float border border-slate-100 dark:border-slate-800 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 mb-3">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Alertas Operacionais</span>
                <button 
                  onClick={() => setUnreadNotifications(0)} 
                  className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
                >
                  Marcar lidas
                </button>
              </div>
              <div className="space-y-2 text-xs">
                {operationalAlerts.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => handleOpenNotification(alert)}
                    className={`w-full text-left p-2.5 rounded-2xl border transition-all duration-150 cursor-pointer hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      alert.type === 'manutencao'
                        ? 'bg-amber-50/70 hover:bg-amber-100/70 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 border-amber-100/80 dark:border-amber-800/60'
                        : alert.type === 'locker'
                        ? 'bg-emerald-50/70 hover:bg-emerald-100/70 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 border-emerald-100/80 dark:border-emerald-800/60'
                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800/80 border-slate-100 dark:border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <p
                        className={`font-bold ${
                          alert.type === 'manutencao'
                            ? 'text-amber-950 dark:text-amber-200'
                            : alert.type === 'locker'
                            ? 'text-emerald-950 dark:text-emerald-200'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {alert.title}
                      </p>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          alert.badgeVariant === 'amber'
                            ? 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60'
                            : alert.badgeVariant === 'emerald'
                            ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60'
                            : 'text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700'
                        }`}
                      >
                        {alert.badge}
                      </span>
                    </div>
                    <p
                      className={`text-[11px] line-clamp-1 ${
                        alert.type === 'manutencao'
                          ? 'text-amber-800 dark:text-amber-300/80'
                          : alert.type === 'locker'
                          ? 'text-emerald-800 dark:text-emerald-300/80'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {alert.preview}
                    </p>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen(false);
                  setIsAnnouncementsModalOpen(true);
                }}
                className="w-full mt-3 py-2 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-xl transition cursor-pointer border border-emerald-100 dark:border-emerald-800/60"
              >
                Ver Mural de Comunicados Oficiais
              </button>
            </div>
          )}
        </div>

        {/* User Profile Pill & Dropdown (AuthContext Connected) */}
        <div className="relative">
          <button 
            type="button"
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            aria-expanded={profileMenuOpen}
            aria-label="Menu do Usuário"
            className="flex items-center gap-3 bg-white dark:bg-slate-900 pl-1.5 pr-4 py-1.5 rounded-full shadow-soft border border-slate-200/80 dark:border-slate-800 cursor-pointer hover:bg-slate-50/90 dark:hover:bg-slate-800 transition-all select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
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
            <div className="text-left hidden sm:block leading-tight">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                {profile?.full_name || user?.email || 'Usuário Condor'}
              </h4>
              <p className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                <span className="capitalize text-emerald-600 dark:text-emerald-400 font-bold">{currentRole || 'síndico'}</span>
                <span>•</span>
                <span className="truncate max-w-[130px]">{currentCondominium?.name || 'Condomínio'}</span>
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5 hidden sm:block" />
          </button>

          {/* Profile Dropdown Menu */}
          {profileMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 z-50 animate-fadeIn">
              <div className="p-3 border-b border-slate-100 dark:border-slate-800 mb-2">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {profile?.full_name || 'Usuário Condor'}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {user?.email || 'usuario@condor.com.br'}
                </p>
                <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-full text-[10px] font-bold border border-emerald-200/60 dark:border-emerald-800 uppercase">
                  <Shield className="w-3 h-3" />
                  <span>Papel: {currentRole || 'síndico'}</span>
                </div>
              </div>

              {/* Condominium Multi-tenant Switcher */}
              {memberships.length > 1 && (
                <div className="mb-2 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700/60">
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Building className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    Trocar Condomínio
                  </p>
                  <div className="space-y-1">
                    {memberships.map((m) => {
                      const isSelected = currentCondominium?.id === m.condominium.id;
                      return (
                        <button
                          key={m.condominium.id}
                          type="button"
                          onClick={() => {
                            setCurrentCondominiumId(m.condominium.id);
                            setProfileMenuOpen(false);
                          }}
                          className={`w-full text-left p-1.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                            isSelected
                              ? 'bg-emerald-600 text-white font-bold'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 font-medium'
                          }`}
                        >
                          <span className="truncate">{m.condominium.name}</span>
                          <span className="text-[10px] capitalize opacity-80">{m.membership.role}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick Actions: Profile & Settings */}
              <div className="space-y-1 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    onOpenSettings?.();
                  }}
                  className="w-full text-left p-2 rounded-2xl text-xs font-semibold flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Alterar Foto & Perfil</span>
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
                  <span>Configurações do Condomínio</span>
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
        canAccessMaintenance={currentRole !== 'morador'}
      />
    </header>
  );
};
