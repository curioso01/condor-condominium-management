import React, { useState, useEffect } from 'react';
import type { NavigationTab } from '../../types/condominium';
import { useAuth } from '../../contexts/AuthContext';
import { unitService } from '../../services/unitService';
import { Badge } from '../ui/Badge';
import { DynamicTelemetryChart } from '../common/DynamicTelemetryChart';

import {
  Camera,
  Calendar,
  Package,
  Megaphone,
  Copy,
  Check,
  ArrowRight,
  Clock,
  Sliders,
  Zap,
  Edit,
} from 'lucide-react';
import { AnnouncementsModal } from './AnnouncementsModal';
import { ChannelMetricsModal } from './ChannelMetricsModal';
import { AiEnergyModal } from './AiEnergyModal';
import {
  financialDataService,
  type ChannelMetricsData,
  type AiEnergyData,
  type ReserveFundData,
  type CondominiumHealthData,
  type OperationalExpense,
} from '../../services/financialDataService';

interface OverviewViewProps {
  onNavigateTab: (tab: NavigationTab) => void;
  onOpenSettings?: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ onNavigateTab, onOpenSettings }) => {
  const { profile, user, currentCondominium, currentRole } = useAuth();
  const [realUnitsCount, setRealUnitsCount] = useState<number | null>(null);
  const [isAnnouncementsOpen, setIsAnnouncementsOpen] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

  // Financial & Operational Metrics
  const [channels, setChannels] = useState<ChannelMetricsData>(() => financialDataService.getChannels());
  const [aiEnergy, setAiEnergy] = useState<AiEnergyData>(() => financialDataService.getAiEnergy());
  const [reserveFund] = useState<ReserveFundData>(() => financialDataService.getReserveFund());
  const [health] = useState<CondominiumHealthData>(() => financialDataService.getHealth());
  const [expenses] = useState<OperationalExpense[]>(() => financialDataService.getExpenses());

  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [isAiEnergyModalOpen, setIsAiEnergyModalOpen] = useState(false);

  const totalChannelsCount = channels.appCount + channels.totemCount + channels.whatsappCount + channels.interfoneCount;
  const appPercent = totalChannelsCount > 0 ? Math.round((channels.appCount / totalChannelsCount) * 100) : 0;
  const totemPercent = totalChannelsCount > 0 ? Math.round((channels.totemCount / totalChannelsCount) * 100) : 0;
  const whatsPercent = totalChannelsCount > 0 ? Math.round((channels.whatsappCount / totalChannelsCount) * 100) : 0;
  const interfPercent = totalChannelsCount > 0 ? Math.max(0, 100 - (appPercent + totemPercent + whatsPercent)) : 0;

  const totalExpensesAmount = expenses.reduce((acc, e) => acc + e.amount, 0);
  const reserveGoalPercent = Math.min(100, Math.round((reserveFund.balance / (reserveFund.targetAmount || 1)) * 100));

  const handleSaveChannels = (updated: ChannelMetricsData) => {
    financialDataService.updateChannels(updated);
    setChannels(updated);
  };

  const handleSaveAiEnergy = (updated: AiEnergyData) => {
    financialDataService.updateAiEnergy(updated);
    setAiEnergy(updated);
  };

  const isSindicoOrAdmin = currentRole === 'sindico' || currentRole === 'superadmin';
  const isPorteiro = currentRole === 'porteiro';
  const isMorador = currentRole === 'morador';

  useEffect(() => {
    if (currentCondominium?.id) {
      unitService.getUnitsByCondominium(currentCondominium.id).then(({ data }) => {
        if (data && data.length > 0) {
          setRealUnitsCount(data.length);
        }
      });
    }
  }, [currentCondominium?.id]);

  const userName = profile?.full_name || (isMorador ? 'Morador Residente' : isPorteiro ? 'Portaria' : 'Síndico(a)');
  const condoName = currentCondominium?.name || 'Reserva Imperial';

  // DASHBOARD EXCLUSIVO PARA MORADOR (Requirement 3: Morador acessa apenas dados, foto, reservas, encomendas e notícias)
  if (isMorador) {
    return (
      <div className="flex flex-col gap-6 min-w-0" data-purpose="resident-overview">
        {/* Top Greeting */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/70 dark:bg-slate-900/80 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-xs">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Olá, {userName}
              </h1>
              <Badge variant="emerald" dot>
                Unidade {(profile as any)?.unit_number || '302-B'} • Regularizada
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Painel do morador no <strong className="text-slate-700 dark:text-slate-200">{condoName}</strong> — acompanhe seus dados, reservas, encomendas e comunicados.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onOpenSettings?.()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-xs shadow-xs border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Alterar Foto & Perfil</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('reservations')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs shadow-pill transition cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>+ Nova Reserva</span>
            </button>
          </div>
        </div>

        {/* Resident Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* CARD 1: Minha Unidade & Cadastro */}
          <article className="md:col-span-12 lg:col-span-4 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-soft border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Minha Unidade
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] border border-emerald-200 dark:border-emerald-800">
                  Adimplente ✓
                </span>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div className="relative group cursor-pointer" onClick={() => onOpenSettings?.()}>
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 ring-2 ring-emerald-500/40 shrink-0">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={userName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-extrabold text-emerald-600 text-lg bg-emerald-50 dark:bg-emerald-950/50">
                        {userName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <Camera className="w-2.5 h-2.5" />
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{userName}</h3>
                  <p className="text-xs text-slate-400 font-medium">{user?.email || 'morador@condor.com.br'}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                    Apto {(profile as any)?.unit_number || '302-B'} • Bloco A
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/60">
                  <span className="text-slate-400">Vaga Garagem</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">G1 - Vaga #42 (Privativa)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/60">
                  <span className="text-slate-400">BioSync AI</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Face Cadastrada (Ativa)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Telefone</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{profile?.phone || '(11) 97123-4567'}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenSettings?.()}
              className="mt-4 w-full py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Editar Foto & Meus Dados</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </article>

          {/* CARD 2: Encomendas no Smart Locker */}
          <article className="md:col-span-12 lg:col-span-4 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-soft border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Minhas Encomendas
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white font-bold text-[10px]">
                  1 Disponível
                </span>
              </div>

              {/* Pacote ativo */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100">Smart Locker #08</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                    Pronto
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Pacote Mercado Livre / Loggi entregue hoje às 10:45 na portaria.
                </p>

                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200/60 dark:border-emerald-800 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">PIN de Retirada</span>
                    <span className="text-base font-extrabold font-mono text-emerald-700 dark:text-emerald-400 tracking-wider">
                      8492
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText('8492');
                      setCopiedPin(true);
                      setTimeout(() => setCopiedPin(false), 2500);
                    }}
                    className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    {copiedPin ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPin ? 'Copiado!' : 'Copiar PIN'}</span>
                  </button>
                </div>
              </div>

              {/* Pacote anterior */}
              <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Smart Locker #02 (Amazon)</p>
                  <span className="text-[10px] text-slate-400">Retirado há 3 dias</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-200/60 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                  Entregue
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-3 text-center">
              Aproxime seu PIN ou QR Code do armário para destravamento instantâneo.
            </p>
          </article>

          {/* CARD 3: Minhas Reservas de Espaços */}
          <article className="md:col-span-12 lg:col-span-4 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-soft border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Minhas Reservas
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-[10px]">
                  Agenda Ativa
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/60 via-teal-50/40 to-white dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 border border-emerald-100 dark:border-emerald-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                    Salão Gourmet Principal
                  </h4>
                  <Badge variant="emerald" dot>
                    Confirmada
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Sexta, 25 de Abril de 2026</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>18:00 às 02:00 (Período Noturno)</span>
                </div>
              </div>

              <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Churrasqueira 02 (Piscina)</p>
                  <span className="text-[10px] text-slate-400">Disponível para agendamento no sábado</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('reservations')}
              className="mt-4 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Ver Calendário de Reservas</span>
            </button>
          </article>

          {/* CARD 4: Mural Oficial de Notícias & Comunicados */}
          <article className="col-span-12 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-soft border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Mural Oficial de Notícias do Condomínio
                  </h3>
                  <p className="text-xs text-slate-400">Comunicados oficiais, avisos prediais e assembleias</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAnnouncementsOpen(true)}
                className="px-4 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-bold text-xs transition cursor-pointer self-start sm:self-auto"
              >
                Abrir Mural Completo →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                    Assembleia (AGO)
                  </span>
                  <span className="text-[10px] text-slate-400">28 Out • 19:30</span>
                </div>
                <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                  Previsão Orçamentária 2027 & Eleição do Conselho
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                  Convocamos todos os condôminos para a Assembleia Geral no Salão Principal ou transmissão online.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-full">
                    Manutenção
                  </span>
                  <span className="text-[10px] text-slate-400">Amanhã • 09h</span>
                </div>
                <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                  Inspeção Semestral Atlas dos Elevadores Torre A
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                  Elevador de serviço estará operando normalmente durante os testes técnicos preventivos.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/60 px-2 py-0.5 rounded-full">
                    Convivência
                  </span>
                  <span className="text-[10px] text-slate-400">Ativo</span>
                </div>
                <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                  Recolhimento Pet & Estações Biodegradáveis
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                  Lembramos aos tutores o uso de guia e o recolhimento nas praças internas e pista de caminhada.
                </p>
              </div>
            </div>
          </article>
        </div>

        {/* Modal de Comunicados Oficiais */}
        <AnnouncementsModal
          isOpen={isAnnouncementsOpen}
          onClose={() => setIsAnnouncementsOpen(false)}
          condominiumName={condoName}
        />
      </div>
    );
  }

  // DASHBOARD PARA SÍNDICO, SUPER ADMIN E PORTARIA
  return (
    <div className="flex flex-col gap-6 min-w-0" data-purpose="overview-view">
      {/* Top Action & Greeting Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/60 dark:bg-slate-900/80 p-4 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              Olá, {userName}
            </h1>
            <Badge variant="emerald" dot>
              Operação Normal • 98.4% Estável
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isPorteiro
              ? `Painel de Portaria & Acessos do ${condoName} em operação ao vivo.`
              : `Aqui está o resumo operacional e financeiro do ${condoName} hoje.`}
          </p>
        </div>

        {/* Action Buttons: Apenas Síndico/Super Admin podem registrar cobrança */}
        <div className="flex items-center gap-2 flex-wrap">
          {isSindicoOrAdmin && (
            <button
              type="button"
              onClick={() => onNavigateTab('finance')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-xs shadow-xs border border-slate-200 dark:border-slate-700 transition-all duration-200 cursor-pointer"
            >
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">+</span>
              <span>Registrar Cobrança</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigateTab('maintenance')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs shadow-pill transition-all duration-200 cursor-pointer"
          >
            <span className="font-bold">+</span>
            <span>Nova Ocorrência</span>
          </button>
        </div>
      </div>

      {/* Bento Grid Dashboard */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-5" data-purpose="bento-grid">
        {/* CARD 1: Total de Unidades e Ocupação */}
        <article className="md:col-span-12 lg:col-span-4 bg-white rounded-3xl p-6 shadow-soft border border-slate-100 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Ocupação Predial
              </span>
              <h2 className="text-3xl font-extrabold text-slate-900 mt-1">
                {realUnitsCount ?? 192} <span className="text-lg font-semibold text-slate-500">Unidades</span>
              </h2>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                  96.8% Ativas
                </span>
                <span className="text-[11px] text-slate-400">Torres Sol & Mar</span>
              </div>
            </div>
            {/* Thumbnail */}
            <div className="w-20 h-24 rounded-2xl overflow-hidden shadow-md shrink-0 border border-white">
              <img
                alt="Reserva Imperial Fachada"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuC1sNN2vNB3ai7UacFt4B8e-rOGW3woeMSYc3Zr71I9rDU55xmmHmWBH8fQP_7GbY3D6FiI_8caA7s70nm2UVPvB7TNuDIhiUl4O5dJ1uraEL106l688ElYUy4bjs6Z7_gL3NUkFHxEHR2-eZK1fVpnnLSg7lNDeSj-vme1apqI_jKoMi20SqqTcJ1R-IIwW13KgwosTEDjJR2bKxV_xc_vjNrMoai8GfH3UtLpqIDZCS0pmM3ZyCycLQ"
              />
            </div>
          </div>

          {/* Dots separator */}
          <div className="my-5 flex items-center justify-between border-t border-slate-100 pt-4">
            <div className="flex -space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
            </div>
            <button
              onClick={() => onNavigateTab('units')}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              <span>Ver Unidades</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M5 12h14m-7-7 7 7-7 7"></path>
              </svg>
            </button>
          </div>

          {/* Pill Quick Metrics */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-slate-50/70 rounded-2xl p-2.5 border border-slate-100">
              <span className="text-[11px] text-slate-400 font-medium block">Adimplência</span>
              <span className="text-sm font-bold text-slate-800">98.2%</span>
            </div>
            <div className="bg-slate-50/70 rounded-2xl p-2.5 border border-slate-100">
              <span className="text-[11px] text-slate-400 font-medium block">Vagas Garagem</span>
              <span className="text-sm font-bold text-slate-800">384 Livres</span>
            </div>
          </div>
        </article>

        {/* CARD 2: Fluxo Diário de Visitantes e Portaria */}
        <article className="md:col-span-12 lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-soft border border-slate-100 dark:border-slate-800 flex flex-col justify-between overflow-hidden">
          <DynamicTelemetryChart
            title="Fluxo de Acessos & Portaria"
            subtitle="Tráfego consolidado de moradores, prestadores e visitantes"
            primaryLabel="Moradores Residentes"
            secondaryLabel="Prestadores & Visitantes"
            primaryColor="#0D9488"
            secondaryColor="#F97316"
            defaultPeriod="dia"
            height={165}
            unitLabel="acessos"
          />
          <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button 
              onClick={() => onNavigateTab('concierge')}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
            >
              Ver log em tempo real →
            </button>
          </div>
        </article>

        {/* CARD 3: Próximos Vencimentos & Fundo de Reserva (Apenas Síndico / Admin) OU Operação Portaria (Porteiro) */}
        {isSindicoOrAdmin ? (
          <article className="md:col-span-12 lg:col-span-3 bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 dark:bg-none dark:bg-surface-dark text-white rounded-3xl p-6 shadow-lg shadow-emerald-900/10 dark:shadow-soft flex flex-col justify-between relative overflow-hidden border border-emerald-400/30 dark:border-transparent">
            <div className="absolute -right-10 -top-10 w-44 h-44 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none dark:hidden" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-100 dark:text-slate-400">
                Próxima Arrecadação
              </span>
              <span className="w-7 h-7 rounded-full bg-white/20 dark:bg-white/10 flex items-center justify-center text-white dark:text-slate-300 border border-white/20 dark:border-transparent">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" x2="21" y1="14" y2="3"></line>
                </svg>
              </span>
            </div>

            <div className="my-4 relative z-10">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold tracking-tight text-white">10</span>
                <span className="text-xl font-medium text-emerald-100 dark:text-slate-300">Dezembro</span>
              </div>
              <p className="text-xs text-emerald-100/90 dark:text-slate-400 mt-1">Taxa ordinária + Fundo de melhorias</p>
            </div>

            {/* Micro Progress Bar */}
            <div className="bg-white/15 dark:bg-white/10 p-3.5 rounded-2xl backdrop-blur-md dark:backdrop-blur-sm border border-white/20 dark:border-white/5 relative z-10">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-emerald-100 dark:text-slate-300 font-medium">Fundo Reserva</span>
                <span className="font-bold text-white dark:text-emerald-400">
                  {reserveFund.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="w-full bg-black/15 dark:bg-white/10 h-2 rounded-full overflow-hidden p-0.5">
                <div className="bg-emerald-300 dark:bg-emerald-400 h-full rounded-full shadow-[0_0_8px_rgba(110,231,183,0.7)] dark:shadow-none transition-all" style={{ width: `${reserveGoalPercent}%` }}></div>
              </div>
              <span className="text-[10px] text-emerald-100/90 dark:text-slate-400 block mt-1.5">
                {reserveFund.targetTitle}: {reserveGoalPercent}% atingida
              </span>
            </div>
          </article>
        ) : (
          <article className="md:col-span-12 lg:col-span-3 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-soft flex flex-col justify-between relative overflow-hidden border border-slate-700/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Portaria em Turno
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Ao Vivo
              </span>
            </div>
            <div className="my-4">
              <span className="text-xl font-bold block text-white">Clausuras & Catracas</span>
              <p className="text-xs text-slate-300 mt-1">Biometria BioSync AI e interfonia operando sem filas.</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('concierge')}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition text-center cursor-pointer shadow-sm"
            >
              Acessar Portaria ao Vivo →
            </button>
          </article>
        )}

        {/* CARD 4: Manutenção e Chamados Ativos */}
        <article className="md:col-span-12 lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-soft border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Gestão Operacional
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
                Atividades de Manutenção
              </h3>
            </div>
            <button 
              onClick={() => onNavigateTab('maintenance')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold shadow-sm transition-all self-start sm:self-auto cursor-pointer border border-transparent dark:border-slate-700"
            >
              <span>+ Novo Chamado</span>
            </button>
          </div>

          {/* Tasks List */}
          <div className="space-y-3 my-2" data-purpose="maintenance-task-list">
            {/* Task 1: 100% */}
            <div className="bg-slate-50/80 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Inspeção Preventiva ATLAS (Elevadores Torre A)</h4>
                  <span className="text-[11px] text-slate-400">Contrato #8491 • Concluído hoje</span>
                </div>
              </div>
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                  100%
                </span>
                <div className="flex -space-x-2 overflow-hidden">
                  <div className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-bold ring-2 ring-white dark:ring-slate-900">MS</div>
                  <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] font-bold ring-2 ring-white dark:ring-slate-900">LA</div>
                </div>
              </div>
            </div>

            {/* Task 2: 67% */}
            <div className="bg-slate-50/80 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 flex items-center justify-center font-bold text-xs shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Reparo Bomba de Recalque Subsolo 2</h4>
                  <span className="text-[11px] text-slate-400">Hidráulica Central • Previsão 16:30</span>
                </div>
              </div>
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300">
                  67%
                </span>
                <div className="flex -space-x-2 overflow-hidden">
                  <div className="w-6 h-6 rounded-full bg-sky-700 text-white flex items-center justify-center text-[10px] font-bold ring-2 ring-white dark:ring-slate-900">EN</div>
                </div>
              </div>
            </div>

            {/* Task 3: Scheduled */}
            <div className="bg-orange-50/50 dark:bg-amber-950/30 p-3.5 rounded-2xl border border-orange-100 dark:border-amber-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-amber-900/60 text-orange-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" x2="12" y1="9" y2="13"></line>
                    <line x1="12" x2="12.01" y1="17" y2="17"></line>
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Substituição Iluminação LED Garagem G1</h4>
                  <span className="text-[11px] text-orange-600 dark:text-amber-400 font-medium">Prioridade Média • Aguardando Material</span>
                </div>
              </div>
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-orange-100 dark:bg-amber-900/60 text-orange-700 dark:text-amber-300">
                  Agendado
                </span>
              </div>
            </div>
          </div>

          {/* Card Footer */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>9 manutenções planejadas este mês</span>
            <button 
              onClick={() => onNavigateTab('maintenance')}
              className="font-bold text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
            >
              Calendário de Serviços →
            </button>
          </div>
        </article>

        {/* CARD 5: Origem de Ocorrências (Barras Listradas do Behance) */}
        <article className="md:col-span-12 lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-soft border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Origem de Ocorrências
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
                  Canais de Abertura
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-full border border-slate-200/50 dark:border-slate-700 tabular-nums">
                  Total {totalChannelsCount.toLocaleString('pt-BR')}
                </span>
                <button
                  type="button"
                  onClick={() => setIsChannelModalOpen(true)}
                  className="p-1 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Configurar Canais de Abertura"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Striped Columns Chart */}
            <div className="flex items-end justify-between gap-3 h-36 pt-4 pb-2 px-3 bg-slate-50/60 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700/60">
              <div className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300">{appPercent}%</span>
                <div 
                  className="w-full bg-emerald-500 striped-pattern rounded-xl shadow-sm hover:scale-105 transition-all"
                  style={{ height: `${Math.max(16, (appPercent / 100) * 104)}px` }}
                  title={`App: ${channels.appCount} ocorrências`}
                />
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-200">App</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300">{totemPercent}%</span>
                <div 
                  className="w-full bg-teal-400 striped-pattern rounded-xl shadow-sm hover:scale-105 transition-all"
                  style={{ height: `${Math.max(16, (totemPercent / 100) * 104)}px` }}
                  title={`Totem: ${channels.totemCount} ocorrências`}
                />
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-200">Totem</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300">{whatsPercent}%</span>
                <div 
                  className="w-full bg-amber-400 striped-pattern rounded-xl shadow-sm hover:scale-105 transition-all"
                  style={{ height: `${Math.max(16, (whatsPercent / 100) * 104)}px` }}
                  title={`WhatsApp: ${channels.whatsappCount} ocorrências`}
                />
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-200">Whats</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300">{interfPercent}%</span>
                <div 
                  className="w-full bg-rose-400 striped-pattern rounded-xl shadow-sm hover:scale-105 transition-all"
                  style={{ height: `${Math.max(16, (interfPercent / 100) * 104)}px` }}
                  title={`Interfone: ${channels.interfoneCount} ocorrências`}
                />
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-200">Interf.</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Resolução <strong className="text-slate-800 dark:text-slate-200">{channels.resolutionRate24h}% 24h</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Satisfação <strong className="text-slate-800 dark:text-slate-200">{channels.satisfactionScore.toFixed(1)} / 5.0</strong>
              </span>
            </div>
          </div>
        </article>

        {/* CARD 6: Auto-generated Insights AI Condor */}
        <article className="md:col-span-12 lg:col-span-4 bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-3xl p-6 shadow-soft flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-white/20 backdrop-blur-md">
                  <Zap className="w-4 h-4 text-white" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">
                  Inteligência Artificial
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-extrabold bg-white text-emerald-800 px-2 py-0.5 rounded-full">
                  NOVO
                </span>
                <button
                  type="button"
                  onClick={() => setIsAiEnergyModalOpen(true)}
                  className="p-1 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition cursor-pointer"
                  title="Configurar IA de Energia"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="mt-5">
              <span className="text-4xl font-black">{aiEnergy.percentage}%</span>
              <p className="text-sm font-semibold text-emerald-50 mt-1 leading-snug">
                Economia de Energia Projetada
              </p>
              <p className="text-xs text-emerald-100/90 mt-2 font-normal leading-relaxed">
                Com base no sensor de presença em {aiEnergy.targetLocations}, a iluminação dimerizada reduziu o consumo em {aiEnergy.kwhPerDay} kWh/dia (economia de R$ {aiEnergy.monthlySavings.toLocaleString('pt-BR')}/mês).
              </p>
            </div>
          </div>

          <div className="relative z-10 pt-4 mt-4 border-t border-white/20 flex items-center justify-between">
            <span className="text-[11px] text-emerald-100 font-medium">Recomendação Automática</span>
            <button 
              onClick={() => {
                const updated = { ...aiEnergy, appliedToAllBlocks: !aiEnergy.appliedToAllBlocks };
                handleSaveAiEnergy(updated);
              }}
              className="px-3.5 py-1.5 rounded-full bg-white text-emerald-800 text-xs font-bold hover:bg-emerald-50 transition-colors shadow-sm cursor-pointer"
            >
              {aiEnergy.appliedToAllBlocks ? '✓ Aplicado em todos' : 'Aplicar em todos blocos'}
            </button>
          </div>
          <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
        </article>

        {/* CARD 7: Status Financeiro & Score de Qualidade */}
        <article className="md:col-span-12 lg:col-span-8 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-soft border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Auditoria e Compliance
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
                Saúde Financeira do Condomínio
              </h3>
            </div>
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800 px-4 py-2 rounded-full self-start sm:self-auto">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
                Score de Gestão: Excelente ({health.managementScore}%)
              </span>
            </div>
          </div>

          {/* Metrics in 3 Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-4">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60">
              <span className="text-xs text-slate-400 font-medium block">Arrecadação Mensal</span>
              <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100 block mt-1 tabular-nums">
                {health.monthlyRevenueTarget.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 inline-block">↑ +4.2% este mês</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60">
              <span className="text-xs text-slate-400 font-medium block">Despesas Operacionais</span>
              <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100 block mt-1 tabular-nums">
                {totalExpensesAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 inline-block">Dentro da projeção</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60">
              <span className="text-xs text-slate-400 font-medium block">Inadimplência Real</span>
              <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100 block mt-1 tabular-nums">1.8%</span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 inline-block">↓ Menor taxa anual</span>
            </div>
          </div>

          {/* Budget progress bar */}
          <div>
            <div className="flex justify-between items-center text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
              <span>Orçamento Anual Consumido (2026)</span>
              <span className="text-slate-900 dark:text-slate-100 font-bold">
                {health.annualBudgetConsumed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / {health.annualBudgetTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ({Math.round((health.annualBudgetConsumed / health.annualBudgetTotal) * 100)}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
              <div className="bg-emerald-500 h-full rounded-l-full transition-all" style={{ width: `${health.fixedExpensesPercent}%` }}></div>
              <div className="bg-teal-400 h-full transition-all" style={{ width: `${health.worksPercent}%` }}></div>
              <div className="bg-slate-200 dark:bg-slate-700 h-full flex-1"></div>
            </div>
            <div className="flex items-center gap-5 text-[11px] text-slate-400 mt-2 font-medium flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Despesas Fixas ({health.fixedExpensesPercent}%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-400"></span> Obras e Melhorias ({health.worksPercent}%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></span> Saldo Disponível ({health.availablePercent}%)
              </span>
            </div>
          </div>
        </article>
      </section>

      {/* Footer Status Bar */}
      <footer className="w-full py-2 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2 px-2" data-purpose="system-footer">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Sistemas de portaria e biometria conectados • Servidor Local Ativo</span>
        </div>
        <div>
          <span>Condor SaaS Real Estate Platform • Condomínio Residencial Reserva Imperial</span>
        </div>
      </footer>

      {/* Channel Metrics Modal */}
      <ChannelMetricsModal
        isOpen={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
        data={channels}
        onSave={handleSaveChannels}
      />

      {/* AI Energy Configuration Modal */}
      <AiEnergyModal
        isOpen={isAiEnergyModalOpen}
        onClose={() => setIsAiEnergyModalOpen(false)}
        data={aiEnergy}
        onSave={handleSaveAiEnergy}
      />
    </div>
  );
};
