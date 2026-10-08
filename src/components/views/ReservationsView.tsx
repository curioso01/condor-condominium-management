import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { amenityService, type CreateReservationInput } from '../../services/amenityService';
import type { AmenityReservation } from '../../types/condominium';
import type { CommonArea } from '../../types/database.types';
import { ReservationCalendar } from './ReservationCalendar';
import { CreateReservationModal } from './CreateReservationModal';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import {
  CalendarDays,
  Plus,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Users,
  Clock,
  MapPin,
  Check,
  Layers,
  Award,
  Database,
} from 'lucide-react';

export interface ExtendedCommonArea extends CommonArea {
  requires_approval?: boolean;
  rules?: string;
  capacity?: number;
  fee?: number;
}

export const ReservationsView: React.FC = () => {
  const { currentCondominium } = useAuth();

  const [commonAreas, setCommonAreas] = useState<ExtendedCommonArea[]>([]);
  const [reservations, setReservations] = useState<AmenityReservation[]>([]);
  const [isLoadingAreas, setIsLoadingAreas] = useState(true);
  const [isSeedingAreas, setIsSeedingAreas] = useState(false);
  const [isSeedingReservations, setIsSeedingReservations] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [isMockMode, setIsMockMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDateForModal, setSelectedDateForModal] = useState<string | undefined>(undefined);
  const [viewTab, setViewTab] = useState<'calendar' | 'spaces' | 'list'>('calendar');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [filterSpace, setFilterSpace] = useState<string>('Todos');

  // Load common areas and reservations
  const loadAreasAndReservations = useCallback(async () => {
    if (!currentCondominium?.id) return;
    setIsLoadingAreas(true);

    const [areasRes, reservationsRes] = await Promise.all([
      amenityService.getCommonAreasByCondominium(currentCondominium.id),
      amenityService.getReservations(currentCondominium.id),
    ]);

    setIsLoadingAreas(false);

    if (reservationsRes.error?.tableMissing) {
      setTableMissing(true);
    } else {
      setTableMissing(false);
    }
    setIsMockMode(reservationsRes.isMock);

    if (areasRes.data) {
      setCommonAreas(areasRes.data);
    }
    if (reservationsRes.data) {
      setReservations(reservationsRes.data);
    }
  }, [currentCondominium?.id]);

  useEffect(() => {
    loadAreasAndReservations();
  }, [loadAreasAndReservations]);

  // Seed initial spaces if empty
  const handleSeedCommonAreas = async () => {
    if (!currentCondominium?.id) return;
    setIsSeedingAreas(true);
    const { count, error } = await amenityService.seedInitialCommonAreas(currentCondominium.id);
    setIsSeedingAreas(false);

    if (error) {
      setNotification({ type: 'error', message: `Erro ao popular áreas comuns: ${error.message}` });
      setTimeout(() => setNotification(null), 5000);
    } else {
      await loadAreasAndReservations();
      setNotification({
        type: 'success',
        message: `${count} espaços comuns de lazer cadastrados no banco Supabase para ${currentCondominium.name}!`,
      });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const handleSeedReservations = async () => {
    if (!currentCondominium?.id) return;
    setIsSeedingReservations(true);
    const { count, error } = await amenityService.seedInitialReservations(currentCondominium.id);
    setIsSeedingReservations(false);

    if (error) {
      setNotification({ type: 'error', message: `Erro ao popular reservas no banco: ${error.message}` });
      setTimeout(() => setNotification(null), 5000);
    } else {
      await loadAreasAndReservations();
      setNotification({
        type: 'success',
        message: `${count} reservas iniciais gravadas no banco Supabase com sucesso!`,
      });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const handleReservationCreated = async (input: CreateReservationInput): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await amenityService.createReservation(input);
    if (error) {
      return { success: false, error: error.message };
    }

    setReservations((prev) => [data, ...prev]);
    setNotification({
      type: 'success',
      message: `Reserva para "${data.spaceName}" confirmada com sucesso!`,
    });
    setTimeout(() => setNotification(null), 5000);
    return { success: true };
  };

  const filteredReservations = reservations.filter((r) => {
    if (filterSpace === 'Todos') return true;
    return r.spaceName.toLowerCase().includes(filterSpace.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-5 pb-6" data-purpose="reservations-view">
      {/* Toast Notification Banner */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3.5 rounded-2xl flex items-center justify-between text-xs font-semibold animate-fadeIn ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
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

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              Espaços Comuns & Reservas de Lazer
            </h2>
            <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
              {currentCondominium?.name || 'Condomínio'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Gestão integrada de salões, churrasqueiras, piscina e regras de agendamento para 60 dias
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {commonAreas.length === 0 && !isLoadingAreas && (
            <button
              onClick={handleSeedCommonAreas}
              disabled={isSeedingAreas}
              className="px-3 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition duration-150 flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700"
              title="Popular áreas comuns iniciais no Supabase"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{isSeedingAreas ? 'Cadastrando...' : 'Popular Áreas no Banco'}</span>
            </button>
          )}

          {!tableMissing && isMockMode && reservations.length > 0 && (
            <button
              onClick={handleSeedReservations}
              disabled={isSeedingReservations}
              className="px-3 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-xs transition duration-150 flex items-center gap-1.5 cursor-pointer border border-emerald-200 dark:border-emerald-800"
              title="Gravar reservas padrão no banco Supabase"
            >
              <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{isSeedingReservations ? 'Gravando...' : 'Salvar no Supabase'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setSelectedDateForModal(undefined);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-pill transition duration-150 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nova Reserva</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Espaços Ativos */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Espaços de Lazer</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">{commonAreas.length || 4}</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">100% liberados</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Salão de Festas, Gourmet, Piscina, Fitness</p>
        </div>

        {/* Card 2: Reservas 60 Dias (Lista dos Agendamentos Realizados) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Próximos 60 Dias</span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                {reservations.length} {reservations.length === 1 ? 'reserva' : 'reservas'}
              </span>
            </div>

            {/* Lista dos agendamentos realizados */}
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {reservations.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">Nenhum agendamento realizado</p>
              ) : (
                reservations.slice(0, 5).map((r) => (
                  <div
                    key={r.id}
                    className="p-1.5 px-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs hover:border-teal-300 dark:hover:border-teal-600 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm shrink-0">{r.emoji || '🎉'}</span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-900 dark:text-slate-100 truncate">
                          {r.spaceName}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {r.dateStr || r.date} • {r.responsibleName} ({r.unitNumber})
                        </p>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                      OK
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Sem duplicidade</span>
            <button
              type="button"
              onClick={() => setViewTab('list')}
              className="font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
            >
              Ver todos ({reservations.length}) →
            </button>
          </div>
        </div>

        {/* Card 3: Taxa de Ocupação Finais de Semana */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ocupação Fim de Semana</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">82%</span>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">+12% este mês</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Sábados e Domingos com alta procura</p>
        </div>

        {/* Card 4: Taxas dos Aluguéis */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Taxas dos Aluguéis</span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Check className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">R$ 3.850</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">arrecadados</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Receita de locação dos espaços comuns</p>
        </div>
      </div>

      {/* Main Container */}
      <section className="bg-white dark:bg-slate-900 rounded-4xl p-6 lg:p-7 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-6">
        {/* Navigation Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Controle de Agendamentos & Calendário</h3>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-800">
                Próximos 60 Dias
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Legenda de cores: 🟢 Verde = Livre • 🟡 Amarelo = Parcialmente Ocupado • 🔴 Vermelho = Totalmente Ocupado
            </p>
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewTab('calendar')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewTab === 'calendar'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Calendário 60 Dias</span>
            </button>
            <button
              type="button"
              onClick={() => setViewTab('spaces')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewTab === 'spaces'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Espaços Comuns ({commonAreas.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewTab('list')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewTab === 'list'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              <span>Lista de Reservas ({reservations.length})</span>
            </button>
          </div>
        </div>

        {/* TAB 1: Calendário de 60 Dias */}
        {viewTab === 'calendar' && (
          <div>
            <ReservationCalendar
              reservations={reservations}
              commonAreas={commonAreas}
              onSelectDateToReserve={(dateIso) => {
                setSelectedDateForModal(dateIso);
                setIsModalOpen(true);
              }}
            />
          </div>
        )}

        {/* TAB 2: Vitrine dos Espaços Comuns */}
        {viewTab === 'spaces' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {commonAreas.map((area) => (
                <div
                  key={area.id}
                  className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 flex flex-col justify-between hover:border-emerald-300 dark:hover:border-emerald-600/50 transition-all group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center text-xl font-bold">
                        {area.name.includes('Gourmet') || area.name.includes('Churrasco')
                          ? '🥩'
                          : area.name.includes('Piscina')
                          ? '🏊‍♂️'
                          : area.name.includes('Academia')
                          ? '🏋️'
                          : '🎉'}
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {area.requires_approval ? 'Requer Aprovação' : 'Aprovação Imediata'}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">{area.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                      {area.rules || 'Espaço de uso compartilhado com reserva prévia pelo sistema Condor.'}
                    </p>

                    <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <Users className="w-3.5 h-3.5" /> Capacidade
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          Até {area.capacity || 50} pessoas
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <Clock className="w-3.5 h-3.5" /> Horário
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          08:00 às 23:30
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <MapPin className="w-3.5 h-3.5" /> Taxa de Aluguel
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {area.fee ? `R$ ${Number(area.fee).toFixed(2)}` : 'Isento'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDateForModal(undefined);
                      setIsModalOpen(true);
                    }}
                    className="mt-5 w-full py-2.5 px-4 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Reservar este Espaço</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: Lista de Reservas Agendadas */}
        {viewTab === 'list' && (
          <div className="space-y-4">
            {/* Filter by space */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-semibold text-slate-400 shrink-0">Filtrar por:</span>
              <button
                onClick={() => setFilterSpace('Todos')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  filterSpace === 'Todos'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Todos ({reservations.length})
              </button>
              {commonAreas.map((area) => (
                <button
                  key={area.id}
                  onClick={() => setFilterSpace(area.name)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    filterSpace === area.name
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {area.name}
                </button>
              ))}
            </div>

            {isLoadingAreas && (
              <div className="space-y-2 py-4">
                <Skeleton className="w-full h-14 rounded-2xl" />
                <Skeleton className="w-full h-14 rounded-2xl" />
                <Skeleton className="w-full h-14 rounded-2xl" />
              </div>
            )}

            {!isLoadingAreas && filteredReservations.length === 0 ? (
              <EmptyState
                title="Nenhuma reserva encontrada"
                description="Não há reservas registradas correspondentes ao filtro selecionado."
                actionLabel="+ Agendar Reserva"
                onAction={() => {
                  setSelectedDateForModal(undefined);
                  setIsModalOpen(true);
                }}
                className="my-3 py-8"
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredReservations.map((res) => (
                  <div
                    key={res.id}
                    className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-base shrink-0">
                        {res.emoji}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{res.spaceName}</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {res.dateStr} • {res.responsibleName} ({res.unitNumber})
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                        res.statusType === 'success'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                      }`}
                    >
                      {res.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Sincronizado em tempo real com o banco de dados</span>
              <button
                type="button"
                onClick={loadAreasAndReservations}
                className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recarregar Reservas</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Modal de Nova Reserva */}
      <CreateReservationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedDateForModal(undefined);
        }}
        condominiumId={currentCondominium?.id || ''}
        commonAreas={commonAreas}
        initialDate={selectedDateForModal}
        existingReservations={reservations}
        onReservationCreated={handleReservationCreated}
      />
    </div>
  );
};
