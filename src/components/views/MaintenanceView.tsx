import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { mockMaintenanceOrders } from '../../services/mockData';
import type { MaintenanceOrder } from '../../types/condominium';
import type { MaintenanceOrderDbStatus } from '../../types/database.types';
import { useAuth } from '../../contexts/AuthContext';
import { maintenanceService, type CreateMaintenanceOrderInput } from '../../services/maintenanceService';
import { CreateMaintenanceOrderModal } from './CreateMaintenanceOrderModal';
import { OrderDetailModal } from './OrderDetailModal';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { DynamicTelemetryChart } from '../common/DynamicTelemetryChart';
import { 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  RefreshCw, 
  Sparkles, 
  Plus,
  Wrench,
  ShieldCheck,
  Clock,
  MapPin,
  ArrowRight
} from 'lucide-react';

export const MaintenanceView: React.FC = () => {
  const { currentCondominium, isSuperAdmin } = useAuth();

  const [orders, setOrders] = useState<MaintenanceOrder[]>(mockMaintenanceOrders);
  const [isLoading, setIsLoading] = useState(true);
  const [isMockMode, setIsMockMode] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<MaintenanceOrder | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Urgentes' | 'Em Andamento' | 'Agendados' | 'Concluídos'>('Todos');

  const loadOrders = useCallback(async () => {
    if (!currentCondominium?.id) return;
    setIsLoading(true);

    const { data, error } = await maintenanceService.getMaintenanceOrders(currentCondominium.id);
    setIsLoading(false);

    if (error?.tableMissing) {
      setTableMissing(true);
      setIsMockMode(true);
    } else {
      setTableMissing(false);
      setIsMockMode(false);
    }

    setOrders(data);
  }, [currentCondominium?.id]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Operational metrics for Card 1
  const metrics = useMemo(() => {
    const total = orders.length;
    const urgentCount = orders.filter((o) => o.priority === 'Prioridade Máxima').length;
    const preventiveCount = orders.filter((o) => o.priority === 'Preventiva').length;
    const completedCount = orders.filter(
      (o) => o.statusType === 'completed' || o.statusType === 'certified'
    ).length;
    const resolutionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    return { total, urgentCount, preventiveCount, completedCount, resolutionRate };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter === 'Urgentes') return o.priority === 'Prioridade Máxima';
      if (statusFilter === 'Em Andamento') return o.statusType === 'in_progress';
      if (statusFilter === 'Agendados') return o.statusType === 'scheduled';
      if (statusFilter === 'Concluídos') return o.statusType === 'completed' || o.statusType === 'certified';
      return true;
    });
  }, [orders, statusFilter]);

  const handleCreateOrder = async (
    input: CreateMaintenanceOrderInput
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentCondominium?.id) return { success: false, error: 'Condomínio não selecionado.' };

    const { data, error } = await maintenanceService.createMaintenanceOrder(input);
    if (error) {
      return { success: false, error: error.message };
    }

    if (data) {
      setOrders((prev) => [data, ...prev.filter((o) => o.id !== data.id)]);
      setNotification({
        type: 'success',
        message: `${data.code} criada com sucesso para ${data.location}!`,
      });
      setTimeout(() => setNotification(null), 5000);
      return { success: true };
    }

    return { success: false, error: 'Erro desconhecido ao salvar ordem de serviço.' };
  };

  const handleAdvanceStatus = async (order: MaintenanceOrder) => {
    if (!currentCondominium?.id) return;

    let nextStatus: MaintenanceOrderDbStatus = 'in_progress';
    let nextProgress = 50;

    if (order.statusType === 'scheduled') {
      nextStatus = 'in_progress';
      nextProgress = 50;
    } else if (order.statusType === 'in_progress') {
      nextStatus = 'completed';
      nextProgress = 100;
    } else if (order.statusType === 'completed') {
      nextStatus = 'certified';
      nextProgress = 100;
    } else {
      return;
    }

    setUpdatingOrderId(order.id);
    const { error } = await maintenanceService.updateMaintenanceOrderStatus(
      currentCondominium.id,
      order.id,
      nextStatus,
      nextProgress
    );
    setUpdatingOrderId(null);

    if (error) {
      setNotification({ type: 'error', message: error.message });
      setTimeout(() => setNotification(null), 4000);
      return;
    }

    const updatedOrder: MaintenanceOrder = {
      ...order,
      statusType: nextStatus,
      progressPercentage: nextProgress,
      status:
        nextStatus === 'completed'
          ? '100% Concluído'
          : nextStatus === 'certified'
          ? 'Laudo Emitido'
          : `${nextProgress}% Em Andamento`,
      hasCertificate: nextStatus === 'certified',
    };

    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? updatedOrder : o))
    );

    if (selectedOrder && selectedOrder.id === order.id) {
      setSelectedOrder(updatedOrder);
    }

    setNotification({
      type: 'success',
      message: `Status da ${order.code} atualizado com sucesso!`,
    });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSeedOrders = async () => {
    if (!currentCondominium?.id) return;
    const { count, error } = await maintenanceService.seedInitialMaintenanceOrders(currentCondominium.id);

    if (error) {
      setNotification({ type: 'error', message: error.message });
      setTimeout(() => setNotification(null), 5000);
    } else {
      await loadOrders();
      setNotification({
        type: 'success',
        message: `${count} ordens de serviço iniciais criadas com sucesso!`,
      });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-6" data-purpose="maintenance-view">
      {/* Toast Notification Banner */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3.5 rounded-2xl flex items-center justify-between text-xs font-semibold animate-fadeIn ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : notification.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
              : 'bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100 ml-4 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Migration Missing Banner */}
      {tableMissing && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center shrink-0 text-amber-700 dark:text-amber-300">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold">
                {isSuperAdmin ? 'Tabela de ordens de serviço ainda não criada no Supabase' : 'Modo de Demonstração de Manutenção'}
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300/80">
                {isSuperAdmin ? (
                  <>
                    Execute a migration <code className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 font-mono font-bold">20261006000001_maintenance_orders.sql</code> no SQL Editor do Supabase para ativar dados reais e persistência. Exibindo dados de demonstração.
                  </>
                ) : (
                  'Exibindo ordens de serviço e planos preventivos do condomínio.'
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadOrders}
            className="px-3 py-1.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Recarregar</span>
          </button>
        </div>
      )}

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Gestão de Manutenção & Ordens de Serviço
            </h2>
            <span className="text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 px-3 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              {currentCondominium?.name || 'Condomínio'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            Controle unificado de vistorias técnicas, rotinas preventivas e corretivas com emissão de laudos e ART
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {orders.length < 4 && !isMockMode && (
            <button
              type="button"
              onClick={handleSeedOrders}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700 shadow-xs"
              title={isSuperAdmin ? "Inserir ordens padrão de elevadores, hidráulica e caixas d'água no Supabase" : "Inserir ordens padrão de manutenção"}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Popular Exemplos Reais</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold shadow-pill transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nova Ordem de Serviço</span>
          </button>
        </div>
      </div>

      {/* LINHA 1: 4 Cards de Indicadores (KPIs) com Design Uniforme */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total de Chamados */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-soft flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total de Chamados</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">{metrics.total}</span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">ativos</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Registrados no sistema Condor</p>
        </div>

        {/* Card 2: Urgentes & Prioridade Máxima */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-soft flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Prioridade Máxima</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">{metrics.urgentCount}</span>
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
              {metrics.urgentCount > 0 ? 'Atenção requerida' : 'Nenhuma emergência'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Triagem técnica imediata</p>
        </div>

        {/* Card 3: Preventivos em Dia */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-soft flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Preventivas em Dia</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">{metrics.preventiveCount}</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">em conformidade</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Rotinas de bombas, geradores e cabos</p>
        </div>

        {/* Card 4: Conformidade AVCB */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-soft flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">AVCB & Bombeiros</span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">100% Conforme</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Válido até 14/Nov/2026 • Regular</p>
        </div>
      </div>

      {/* LINHA 2: Telemetria & Inspeção Crítica (Colunas Perfeitamente Balanceadas) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Coluna 8: Gráfico de Telemetria Dinâmica */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-soft border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
          <DynamicTelemetryChart
            title="Performance de Resolução & Preventivas"
            subtitle="Monitoramento de Ordens de Serviço concluídas vs metas preventivas programadas"
            primaryLabel="OS Executadas & Concluídas"
            secondaryLabel="Meta Preventiva Programada"
            primaryColor="#0D9488"
            secondaryColor="#64748B"
            defaultPeriod="mes"
            height={195}
            unitLabel="OS"
          />
        </div>

        {/* Coluna 4: Destaque de Inspeção Crítica Programada */}
        <div className="lg:col-span-4 bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 dark:bg-none dark:bg-slate-900 text-white rounded-3xl p-6 shadow-lg shadow-emerald-900/10 dark:shadow-card flex flex-col justify-between relative overflow-hidden border border-emerald-400/30 dark:border-slate-800">
          <div className="absolute -right-16 -top-16 w-52 h-52 bg-emerald-400/20 dark:bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-full bg-white/20 dark:bg-rose-500/20 text-white dark:text-rose-400 border border-white/25 dark:border-rose-500/30 text-[10px] font-extrabold uppercase tracking-wider backdrop-blur-xs">
                Prioridade Máxima
              </span>
              <span className="text-xs text-emerald-100 dark:text-slate-400 font-medium">Torre A</span>
            </div>
            <h3 className="text-xl font-black tracking-tight mt-3 leading-snug text-white">
              Inspeção Crítica: Elevadores ATLAS
            </h3>
            <p className="text-emerald-100 dark:text-slate-400 text-xs mt-1.5 leading-relaxed line-clamp-2">
              Verificação semestral obrigatória de cabos de tração e freios eletromagnéticos com emissão de ART.
            </p>

            <div className="bg-white/15 dark:bg-slate-800/80 rounded-2xl p-3 border border-white/20 dark:border-slate-700/60 my-3.5 space-y-2 backdrop-blur-md dark:backdrop-blur-none">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-100 dark:text-slate-400 font-medium">Agendamento:</span>
                <span className="text-white dark:text-emerald-400 font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Amanhã, às 09:00
                </span>
              </div>
              <div className="flex items-center gap-2.5 pt-2 border-t border-white/20 dark:border-slate-700/40">
                <div className="w-7 h-7 rounded-full bg-white text-emerald-800 dark:bg-emerald-600 dark:text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                  EN
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white dark:text-slate-100 truncate">Eng. Marcos Fonseca</p>
                  <p className="text-[10px] text-emerald-100 dark:text-slate-400 truncate">CREA-SP 506.842-D • Atlas Schindler</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10">
            <button
              type="button"
              onClick={() => setChecklistOpen(!checklistOpen)}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:text-white font-bold text-xs transition-colors shadow-md dark:shadow-pill flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>{checklistOpen ? 'Ocultar Checklist' : 'Ver Checklist Técnico'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {checklistOpen && (
              <div className="mt-2.5 p-3 bg-white/15 dark:bg-slate-800/90 rounded-2xl text-xs space-y-1 animate-fadeIn border border-white/20 dark:border-slate-700/50 backdrop-blur-md dark:backdrop-blur-none">
                <p className="text-white dark:text-emerald-400 font-bold text-[11px]">Itens de Verificação Obrigatória:</p>
                <p className="text-emerald-50 dark:text-slate-300 text-[11px]">✓ Cabos de aço e polias de tração</p>
                <p className="text-emerald-50 dark:text-slate-300 text-[11px]">✓ Freios de emergência e contrapesos</p>
                <p className="text-emerald-50 dark:text-slate-300 text-[11px]">✓ Sensores infravermelhos das portas</p>
                <p className="text-emerald-50 dark:text-slate-300 text-[11px]">✓ Interfone da cabine e gerador de resgate</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LINHA 3: Central Geral de Ordens de Serviço (Full-Width Hub com Abas e Cards) */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 lg:p-7 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-5">
        {/* Toolbar com Título e Filtro por Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Ordens de Serviço do Condomínio
              </h3>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {filteredOrders.length} {filteredOrders.length === 1 ? 'chamado' : 'chamados'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Gestão operacional de equipes, chamados preventivos e certificações técnicas
            </p>
          </div>

          {/* Filtro em Pílulas */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-x-auto max-w-full">
            {(['Todos', 'Urgentes', 'Em Andamento', 'Agendados', 'Concluídos'] as const).map((tab) => {
              const count =
                tab === 'Todos'
                  ? orders.length
                  : tab === 'Urgentes'
                  ? metrics.urgentCount
                  : tab === 'Em Andamento'
                  ? orders.filter((o) => o.statusType === 'in_progress').length
                  : tab === 'Agendados'
                  ? orders.filter((o) => o.statusType === 'scheduled').length
                  : orders.filter((o) => o.statusType === 'completed' || o.statusType === 'certified').length;

              const isActive = statusFilter === tab;

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>{tab}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive
                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-extrabold'
                        : 'bg-slate-200/60 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cards Grid de Ordens de Serviço */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-48 rounded-3xl" />
            <Skeleton className="h-48 rounded-3xl" />
            <Skeleton className="h-48 rounded-3xl" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            title="Nenhuma ordem de serviço nesta categoria"
            description="Não há chamados com este status no momento. Você pode abrir uma nova OS ou selecionar outro filtro."
            actionLabel="+ Abrir Nova OS"
            onAction={() => setIsModalOpen(true)}
            className="py-10 bg-slate-50/50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
            {filteredOrders.map((order) => {
              const isCompleted = order.statusType === 'completed' || order.statusType === 'certified';
              const isInProgress = order.statusType === 'in_progress';
              const isScheduled = order.statusType === 'scheduled';
              const isUpdating = updatingOrderId === order.id;

              return (
                <article
                  key={order.id}
                  onClick={() => {
                    setSelectedOrder(order);
                    setIsDetailModalOpen(true);
                  }}
                  className="bg-slate-50/70 dark:bg-slate-800/70 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-600 transition-all flex flex-col justify-between min-h-[200px] group shadow-soft cursor-pointer hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-slate-400">{order.code}</span>
                        {order.category && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                            {order.category}
                          </span>
                        )}
                      </div>
                      <Badge
                        variant={isCompleted ? 'emerald' : isInProgress ? 'sky' : 'amber'}
                        dot
                      >
                        {order.status}
                      </Badge>
                    </div>

                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-snug group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      {order.title}
                    </h4>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{order.location}</span>
                    </div>

                    {order.description && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-2 line-clamp-2">
                        {order.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2.5">
                    {order.progressPercentage > 0 && (
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            isCompleted ? 'bg-emerald-500' : 'bg-sky-500'
                          }`}
                          style={{ width: `${order.progressPercentage}%` }}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{order.scheduledTime}</span>
                      </span>

                      <div className="flex items-center gap-2 shrink-0">
                        {order.materialsReserved && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50">
                            Materiais OK
                          </span>
                        )}

                        {order.technicians.length > 0 && (
                          <div className="flex -space-x-1" aria-label="Técnicos responsáveis">
                            {order.technicians.map((t, idx) => (
                              <div
                                key={idx}
                                className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[9px] font-bold ring-1.5 ring-white dark:ring-slate-800"
                                title={t.name || t.initials}
                              >
                                {t.initials}
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAdvanceStatus(order);
                          }}
                          disabled={isUpdating}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all bg-white dark:bg-slate-700 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                        >
                          {isUpdating ? (
                            <span className="animate-spin text-xs">⏳</span>
                          ) : isScheduled ? (
                            <span>Iniciar →</span>
                          ) : isInProgress ? (
                            <span>Concluir ✓</span>
                          ) : isCompleted && !order.hasCertificate ? (
                            <span>Laudo 📜</span>
                          ) : (
                            <span>OK ✓</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            {/* Card Convidativo Extra para preencher e equilibrar o grid quando houver menos de 3 ordens */}
            {filteredOrders.length > 0 && filteredOrders.length < 3 && statusFilter === 'Todos' && (
              <div
                onClick={() => setIsModalOpen(true)}
                className="p-5 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 bg-slate-50/40 dark:bg-slate-800/30 flex flex-col items-center justify-center text-center cursor-pointer transition-all group min-h-[200px]"
              >
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <Plus className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Registrar Nova Rotina Preventiva
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                  Clique para cadastrar uma nova OS de rotina predial
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* LINHA 4: Rodapé Técnico - Calendário de Vistorias & Inteligência Predial */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card Marco Obrigatório (lg:col-span-7) */}
        <article className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-soft border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex flex-col items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-800/60">
              <span className="text-[10px] font-extrabold uppercase leading-none">NOV</span>
              <span className="text-xl font-black mt-0.5">18</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Próximo Marco Obrigatório</p>
              </div>
              <h4 className="text-base font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
                Teste Mensal do Gerador Diesel Stemac
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Teste em carga automática de 30 min sem desabastecer áreas comuns do condomínio.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-emerald-600 dark:bg-slate-800 dark:hover:bg-emerald-600 text-white font-bold text-xs tracking-tight transition-all shadow-sm flex items-center justify-center gap-2 shrink-0 cursor-pointer border border-transparent dark:border-slate-700"
          >
            <span>+ Agendar Ordem</span>
          </button>
        </article>

        {/* Card Condor AI (lg:col-span-5) */}
        <article className="lg:col-span-5 bg-gradient-to-br from-emerald-50 via-teal-50/40 to-white dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 rounded-3xl p-6 border border-emerald-100/80 dark:border-emerald-800/50 shadow-soft flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-black shadow-sm">
                ⚡
              </span>
              <span className="text-xs font-black tracking-wider text-emerald-900 dark:text-emerald-300 uppercase">
                Condor AI Insights
              </span>
            </div>
            <span className="text-[10px] font-bold bg-white dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200/40 dark:border-emerald-700/50 px-2 py-0.5 rounded-full shadow-xs">
              Telemetria Ativa
            </span>
          </div>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-relaxed my-2.5">
            "Economia estimada de <strong className="text-emerald-900 dark:text-emerald-400 font-extrabold">18% em manutenção corretiva</strong> através das rotinas preventivas de sensores IoT nas bombas hidráulicas."
          </p>
          <div className="flex items-center justify-between pt-2 border-t border-emerald-100 dark:border-emerald-800/50 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
            <span>Sensores: 12/12 online</span>
            <button
              type="button"
              onClick={() => {
                setNotification({
                  type: 'info',
                  message: 'Telemetria IoT: 12 bombas e elevadores operando em conformidade de vibração e temperatura.',
                });
                setTimeout(() => setNotification(null), 4000);
              }}
              className="hover:underline flex items-center gap-1 cursor-pointer"
            >
              Relatório Completo →
            </button>
          </div>
        </article>
      </div>

      {/* Modal de Criação de OS */}
      <CreateMaintenanceOrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        condominiumId={currentCondominium?.id || ''}
        onSubmit={handleCreateOrder}
      />

      {/* Modal de Visualização & Detalhes da OS */}
      <OrderDetailModal
        order={selectedOrder}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onAdvanceStatus={handleAdvanceStatus}
        isUpdating={updatingOrderId === selectedOrder?.id}
      />
    </div>
  );
};
