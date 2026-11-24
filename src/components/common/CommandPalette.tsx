import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Building2,
  LayoutDashboard,
  Wallet,
  Home,
  ShieldCheck,
  CalendarDays,
  Wrench,
  Settings,
  HelpCircle,
  Megaphone,
  Briefcase,
  X,
  CornerDownLeft,
  Package,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { NavigationTab } from '../../types/condominium';
import { formatRoleLabel } from '../../types/database.types';
import { unitService } from '../../services/unitService';
import { maintenanceService } from '../../services/maintenanceService';
import { announcementService } from '../../services/announcementService';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: NavigationTab) => void;
  onOpenSettings: () => void;
  onOpenFaq: () => void;
  onOpenMural: () => void;
}

interface CommandItem {
  id: string;
  group: 'Navegação' | 'Trocar Condomínio' | 'Registros do Condomínio';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectTab,
  onOpenSettings,
  onOpenFaq,
  onOpenMural,
}) => {
  const {
    currentRole,
    currentCondominium,
    memberships,
    setCurrentCondominiumId,
    canAccessFinance,
    canManageUnits,
    canAccessConcierge,
    canManageMaintenance,
  } = useAuth();
  const [query, setQuery] = useState('');
  const [liveItems, setLiveItems] = useState<CommandItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const isSindicoOrAdmin = currentRole === 'sindico' || currentRole === 'superadmin';
  const isMorador = currentRole === 'morador';
  const isPorteiro = currentRole === 'porteiro';
  const canOpenMaintenance = canManageMaintenance || isPorteiro;

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return;
    }
    setTimeout(() => inputRef.current?.focus(), 30);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Busca dados reais do condomínio ativo para indexação instantânea no Command Palette
  useEffect(() => {
    if (!isOpen || !currentCondominium?.id) return;
    let cancelled = false;

    Promise.all([
      canManageUnits
        ? unitService.getUnitsByCondominium(currentCondominium.id)
        : Promise.resolve({ data: [] }),
      canOpenMaintenance
        ? maintenanceService.getOrdersByCondominium(currentCondominium.id)
        : Promise.resolve({ data: [] }),
      announcementService.fetchAnnouncements(currentCondominium.id),
    ]).then(([unitsRes, ordersRes, ancRes]) => {
      if (cancelled) return;
      const items: CommandItem[] = [];

      (unitsRes.data || []).slice(0, 20).forEach((u) => {
        items.push({
          id: `unit-${u.id}`,
          group: 'Registros do Condomínio',
          title: `Unidade ${u.number} • ${u.block}`,
          subtitle: [u.ownerName, u.vehiclePlate].filter(Boolean).join(' • ') || 'Unidade cadastrada',
          icon: <Home className="w-4 h-4 text-emerald-600" />,
          onSelect: () => {
            onSelectTab('units');
            onClose();
          },
        });
      });

      (ordersRes.data || []).slice(0, 15).forEach((o) => {
        items.push({
          id: `os-${o.id}`,
          group: 'Registros do Condomínio',
          title: `${o.code} — ${o.title}`,
          subtitle: `${o.location} • ${o.status}`,
          icon: <Wrench className="w-4 h-4 text-sky-600" />,
          onSelect: () => {
            onSelectTab('maintenance');
            onClose();
          },
        });
      });

      (ancRes.data || []).slice(0, 10).forEach((a) => {
        items.push({
          id: `anc-${a.id}`,
          group: 'Registros do Condomínio',
          title: a.title,
          subtitle: `Comunicado • ${a.category}`,
          icon: <Megaphone className="w-4 h-4 text-amber-600" />,
          onSelect: () => {
            onOpenMural();
            onClose();
          },
        });
      });

      setLiveItems(items);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, currentCondominium?.id, canManageUnits, canOpenMaintenance, onSelectTab, onOpenMural, onClose]);

  const allItems: CommandItem[] = useMemo(() => {
    const nav: CommandItem[] = [
      {
        id: 'nav-overview',
        group: 'Navegação',
        title: 'Visão Geral',
        subtitle: `Painel principal de ${currentCondominium?.name || 'Condomínio'}`,
        icon: <LayoutDashboard className="w-4 h-4 text-emerald-600" />,
        onSelect: () => {
          onSelectTab('overview');
          onClose();
        },
      },
    ];

    if (isSindicoOrAdmin && memberships.length > 1) {
      nav.push({
        id: 'nav-portfolio',
        group: 'Navegação',
        title: 'Carteira de Condomínios',
        subtitle: `Comparar todos os ${memberships.length} condomínios sob gestão`,
        icon: <Briefcase className="w-4 h-4 text-emerald-600" />,
        onSelect: () => {
          onSelectTab('portfolio');
          onClose();
        },
      });
    }

    if (canAccessFinance) {
      nav.push({
        id: 'nav-finance',
        group: 'Navegação',
        title: 'Financeiro & Cobranças Pix',
        subtitle: 'Emitir cobranças, baixar pagamentos e conciliar caixa',
        icon: <Wallet className="w-4 h-4 text-emerald-600" />,
        onSelect: () => {
          onSelectTab('finance');
          onClose();
        },
      });
    }

    if (canManageUnits) {
      nav.push({
        id: 'nav-units',
        group: 'Navegação',
        title: 'Unidades & Moradores',
        subtitle: 'Censo predial, blocos, veículos, vagas e moradores',
        icon: <Home className="w-4 h-4 text-emerald-600" />,
        onSelect: () => {
          onSelectTab('units');
          onClose();
        },
      });
    }

    if (isMorador) {
      nav.push(
        {
          id: 'nav-my-invoices',
          group: 'Navegação',
          title: 'Meus Boletos & Pix',
          subtitle: 'Consultar cotas condominiais e pagar via QR Code Pix',
          icon: <Wallet className="w-4 h-4 text-emerald-600" />,
          onSelect: () => {
            onSelectTab('my_invoices');
            onClose();
          },
        },
        {
          id: 'nav-my-packages',
          group: 'Navegação',
          title: 'Minhas Encomendas',
          subtitle: 'Acompanhar entregas recebidas na portaria e código PIN',
          icon: <Package className="w-4 h-4 text-emerald-600" />,
          onSelect: () => {
            onSelectTab('my_packages');
            onClose();
          },
        }
      );
    }

    if (canAccessConcierge) {
      nav.push({
        id: 'nav-concierge',
        group: 'Navegação',
        title: 'Portaria, Acessos & Encomendas',
        subtitle: 'Passes QR, encomendas com PIN e logs auditados',
        icon: <ShieldCheck className="w-4 h-4 text-emerald-600" />,
        onSelect: () => {
          onSelectTab('concierge');
          onClose();
        },
      });
    }

    if (canOpenMaintenance) {
      nav.push({
        id: 'nav-maintenance',
        group: 'Navegação',
        title: 'Manutenções & Ordens de Serviço',
        subtitle: 'Abrir e acompanhar OS do condomínio',
        icon: <Wrench className="w-4 h-4 text-emerald-600" />,
        onSelect: () => {
          onSelectTab('maintenance');
          onClose();
        },
      });
    }

    nav.push(
      {
        id: 'nav-reservations',
        group: 'Navegação',
        title: 'Espaços & Reservas',
        subtitle: 'Calendário de 60 dias e áreas comuns',
        icon: <CalendarDays className="w-4 h-4 text-emerald-600" />,
        onSelect: () => {
          onSelectTab('reservations');
          onClose();
        },
      },
      {
        id: 'nav-mural',
        group: 'Navegação',
        title: 'Mural de Comunicados Oficiais',
        subtitle: 'Ler ou publicar avisos do condomínio',
        icon: <Megaphone className="w-4 h-4 text-emerald-600" />,
        onSelect: () => {
          onOpenMural();
          onClose();
        },
      },
      {
        id: 'nav-settings',
        group: 'Navegação',
        title: 'Configurações, Chave Pix & LGPD',
        subtitle: 'Perfil, senha, usuários, dados bancários e auditoria',
        icon: <Settings className="w-4 h-4 text-slate-500" />,
        onSelect: () => {
          onOpenSettings();
          onClose();
        },
      },
      {
        id: 'nav-faq',
        group: 'Navegação',
        title: 'Central de Ajuda & Suporte',
        subtitle: 'Perguntas frequentes e abertura de chamado técnico',
        icon: <HelpCircle className="w-4 h-4 text-slate-500" />,
        onSelect: () => {
          onOpenFaq();
          onClose();
        },
      }
    );

    const condos: CommandItem[] =
      memberships.length > 1
        ? memberships.map((m) => ({
            id: `condo-${m.condominium.id}`,
            group: 'Trocar Condomínio',
            title: m.condominium.name,
            subtitle: `${formatRoleLabel(m.membership.role)} • ${m.condominium.cnpj || 'Trocar contexto ativo'}`,
            icon: <Building2 className="w-4 h-4 text-emerald-600" />,
            onSelect: () => {
              setCurrentCondominiumId(m.condominium.id);
              onClose();
            },
          }))
        : [];

    return [...nav, ...condos, ...liveItems];
  }, [
    currentCondominium?.name,
    isSindicoOrAdmin,
    isMorador,
    canAccessFinance,
    canManageUnits,
    canAccessConcierge,
    canOpenMaintenance,
    memberships,
    liveItems,
    onSelectTab,
    onOpenMural,
    onOpenSettings,
    onOpenFaq,
    setCurrentCondominiumId,
    onClose,
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems.slice(0, 14);
    return allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle || '').toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q)
    );
  }, [allItems, query]);

  if (!isOpen) return null;

  const groups = Array.from(new Set(filtered.map((i) => i.group)));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos e busca global"
      className="fixed inset-0 z-[65] bg-slate-950/60 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-3 sm:px-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered.length > 0) {
                e.preventDefault();
                filtered[0].onSelect();
              }
            }}
            placeholder="Buscar módulos, unidades, OS, comunicados ou trocar condomínio..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar busca"
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2.5 space-y-3">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Nenhum resultado encontrado para &ldquo;{query}&rdquo;.
            </div>
          ) : (
            groups.map((grp) => (
              <div key={grp}>
                <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {grp}
                </p>
                <div className="space-y-0.5">
                  {filtered
                    .filter((i) => i.group === grp)
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={item.onSelect}
                        className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-3 transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 flex items-center justify-center shrink-0">
                            {item.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {item.title}
                            </p>
                            {item.subtitle && (
                              <p className="text-[11px] text-slate-400 truncate">{item.subtitle}</p>
                            )}
                          </div>
                        </div>
                        <CornerDownLeft className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 shrink-0" />
                      </button>
                    ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between text-[11px] text-slate-400">
          <span>Enter para abrir o primeiro item • Esc para fechar</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            {currentCondominium?.name}
          </span>
        </div>
      </div>
    </div>
  );
};
