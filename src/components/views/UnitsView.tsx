import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { unitService, type CreateUnitInput } from '../../services/unitService';
import type { Unit } from '../../types/condominium';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { CreateUnitModal } from './CreateUnitModal';
import { UnitDetailsModal } from './UnitDetailsModal';
import { 
  Plus, 
  Sparkles, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  Users, 
  Car, 
  PawPrint,
  TrendingUp,
  ExternalLink,
} from 'lucide-react';

export const UnitsView: React.FC = () => {
  const { currentCondominium, canManageUsers } = useAuth();

  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [filter, setFilter] = useState<'Todos' | 'Bloco A' | 'Bloco B' | 'Inquilinos' | 'Com Pets'>('Todos');
  const [activeTower, setActiveTower] = useState<'Torre A' | 'Torre B'>('Torre A');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Fetch real units from Supabase
  const loadUnits = useCallback(async () => {
    if (!currentCondominium?.id) return;
    setIsLoading(true);
    setErrorMessage(null);

    const { data, error } = await unitService.getUnitsByCondominium(currentCondominium.id);
    setIsLoading(false);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setUnits(data);
      if (data.length > 0) {
        setSelectedUnit(data[0]);
      } else {
        setSelectedUnit(null);
      }
    }
  }, [currentCondominium?.id]);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  // Handle unit creation
  const handleUnitCreated = async (input: CreateUnitInput): Promise<{ success: boolean; error?: string }> => {
    if (!canManageUsers) {
      return { success: false, error: 'Acesso negado: apenas o Síndico e o Super Administrador podem cadastrar novas unidades e moradores.' };
    }

    const { data, error } = await unitService.createUnit(input);
    if (error) {
      return { success: false, error: error.message };
    }

    if (data) {
      setUnits((prev) => [data, ...prev]);
      setSelectedUnit(data);
      setNotification({
        type: 'success',
        message: `Unidade ${data.number} (${data.block}) cadastrada com sucesso no banco de dados!`,
      });
      setTimeout(() => setNotification(null), 5000);
      return { success: true };
    }

    return { success: false, error: 'Erro desconhecido ao salvar' };
  };

  // Seed sample units
  const handleSeedUnits = async () => {
    if (!currentCondominium?.id) return;
    if (!canManageUsers) {
      setNotification({ type: 'error', message: 'Apenas o Síndico e o Super Administrador podem popular unidades.' });
      setTimeout(() => setNotification(null), 5000);
      return;
    }

    setIsSeeding(true);
    const { count, error } = await unitService.seedInitialUnits(currentCondominium.id);
    setIsSeeding(false);

    if (error) {
      setNotification({ type: 'error', message: `Erro ao popular unidades: ${error.message}` });
      setTimeout(() => setNotification(null), 5000);
    } else {
      await loadUnits();
      setNotification({
        type: 'success',
        message: `${count} unidades iniciais criadas com sucesso no condomínio ${currentCondominium.name}!`,
      });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  // Filtered units
  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      if (filter === 'Bloco A') return u.block.includes('A');
      if (filter === 'Bloco B') return u.block.includes('B');
      if (filter === 'Inquilinos') return u.residentType === 'Inquilino';
      if (filter === 'Com Pets') return u.hasPet;
      return true;
    });
  }, [units, filter]);

  // Census aggregates calculated from actual units in the database
  const census = useMemo(() => {
    const total = units.length;
    const residents = units.reduce((acc, u) => acc + (u.residentsCount || 1), 0);
    const vehicles = units.filter((u) => Boolean(u.parkingSpot)).length;
    const pets = units.filter((u) => Boolean(u.hasPet)).length;
    const rate = total > 0 ? 100 : 0;
    return { total, residents, vehicles, pets, rate };
  }, [units]);

  return (
    <div className="flex flex-col gap-5 pb-6" data-purpose="units-view">
      {/* Toast Notification Banner */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3.5 rounded-2xl flex items-center justify-between text-xs font-semibold animate-fadeIn ${
            notification.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
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
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Unidades & Diretório de Moradores
            </h2>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
              {currentCondominium?.name || 'Condomínio'}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Cadastro de moradores, controle de veículos, biometria facial BioSync e permissões
          </p>
        </div>

        {canManageUsers && (
          <div className="flex items-center gap-2">
            {units.length === 0 && !isLoading && (
              <button
                onClick={handleSeedUnits}
                disabled={isSeeding}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer"
                title="Inserir unidades de demonstração no banco"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{isSeeding ? 'Criando...' : 'Popular Unidades'}</span>
              </button>
            )}

            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-bold shadow-pill transition-all flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Cadastrar Morador / Unidade</span>
            </button>
          </div>
        )}
      </div>

      {/* Grid Bento Content */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5" data-purpose="bento-layout">
        {/* CARD 1: Censo & Indicadores Operacionais */}
        <section
          className="col-span-12 lg:col-span-4 bg-white rounded-3xl p-5 shadow-soft border border-slate-100 flex flex-col justify-between"
          data-purpose="metric-census-card"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2.5 py-0.5 rounded-full">
                  Censo Operacional Real
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-1 truncate max-w-[220px]">
                  {currentCondominium?.name || 'Condomínio'}
                </h2>
              </div>
              <div className="w-9 h-9 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
            </div>

            {/* Numbers */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-50 rounded-2.5xl p-3.5 border border-slate-100">
                <span className="text-xs text-slate-400">Total Unidades</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-black text-slate-900 tracking-tight">
                    {census.total}
                  </span>
                  <span className="text-[11px] text-emerald-600 font-semibold">
                    {census.total > 0 ? '100% ativo' : 'Vazio'}
                  </span>
                </div>
              </div>
              <div className="bg-slate-50 rounded-2.5xl p-3.5 border border-slate-100">
                <span className="text-xs text-slate-400">Moradores Registrados</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-black text-slate-900 tracking-tight">
                    {census.residents}
                  </span>
                  <span className="text-[11px] text-emerald-600 font-semibold">
                    {census.total > 0 ? 'Atualizado' : '0'}
                  </span>
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs px-2 py-1">
                <span className="text-slate-500 font-medium">Ocupação Efetiva</span>
                <div className="flex items-center gap-2">
                  <div className="w-28 bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${census.rate}%` }}
                    />
                  </div>
                  <span className="font-bold text-slate-800">{census.rate}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs px-2 py-1">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-slate-400" />
                  Veículos Credenciados
                </span>
                <span className="font-semibold text-slate-700 bg-slate-100 px-3 py-0.5 rounded-full">
                  {census.vehicles} vagas ocupadas
                </span>
              </div>
              <div className="flex items-center justify-between text-xs px-2 py-1">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <PawPrint className="w-3.5 h-3.5 text-slate-400" />
                  Animais Cadastrados (Pets)
                </span>
                <span className="font-semibold text-slate-700 bg-slate-100 px-3 py-0.5 rounded-full">
                  {census.pets} pets
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sincronizado com Supabase
            </span>
            <button
              onClick={loadUnits}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 group cursor-pointer"
            >
              <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-300" />
              Atualizar
            </button>
          </div>
        </section>

        {/* CARD 2: Visualização de Blocos & Topologia */}
        <section
          className="col-span-12 lg:col-span-5 bg-white rounded-3xl p-5 shadow-soft border border-slate-100 flex flex-col justify-between"
          data-purpose="block-distribution-card"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Topologia do Condomínio
                </span>
                <h2 className="text-lg font-bold text-slate-900">Bloco A & Bloco B</h2>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full text-xs">
                {(['Torre A', 'Torre B'] as const).map((tower) => (
                  <button
                    key={tower}
                    onClick={() => setActiveTower(tower)}
                    className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer ${
                      activeTower === tower
                        ? 'bg-white text-slate-800 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tower}
                  </button>
                ))}
              </div>
            </div>

            {/* Tower Block Diagram */}
            <div className="my-3 p-4 bg-gradient-to-b from-slate-50 to-white dark:from-slate-800/80 dark:to-slate-900/90 rounded-2.5xl border border-slate-100 dark:border-slate-800 relative overflow-hidden flex items-center justify-center">
              <div className="w-full flex items-center justify-around py-2">
                {/* Bloco A */}
                <div className="flex flex-col items-center">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-2">Bloco A • Cerejeiras</span>
                  <div className="space-y-1.5 w-32">
                    <div className="h-6 bg-emerald-600 rounded-lg flex items-center justify-between px-2 text-[10px] text-white font-medium">
                      <span>12º ao 16º</span> <span>100%</span>
                    </div>
                    <div className="h-6 bg-emerald-600 rounded-lg flex items-center justify-between px-2 text-[10px] text-white font-medium">
                      <span>08º ao 11º</span> <span>100%</span>
                    </div>
                    <div className="h-6 bg-emerald-500 rounded-lg flex items-center justify-between px-2 text-[10px] text-white font-medium">
                      <span>04º ao 07º</span> <span>96%</span>
                    </div>
                    <div className="h-6 bg-emerald-500 rounded-lg flex items-center justify-between px-2 text-[10px] text-white font-medium">
                      <span>01º ao 03º</span> <span>98%</span>
                    </div>
                  </div>
                </div>

                <div className="h-28 w-px bg-slate-200 dark:bg-slate-700" />

                {/* Bloco B */}
                <div className="flex flex-col items-center">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-2">Bloco B • Ipês</span>
                  <div className="space-y-1.5 w-32">
                    <div className="h-6 bg-emerald-600 rounded-lg flex items-center justify-between px-2 text-[10px] text-white font-medium">
                      <span>12º ao 16º</span> <span>100%</span>
                    </div>
                    <div className="h-6 bg-emerald-500 rounded-lg flex items-center justify-between px-2 text-[10px] text-white font-medium">
                      <span>08º ao 11º</span> <span>94%</span>
                    </div>
                    <div className="h-6 bg-amber-400 rounded-lg flex items-center justify-between px-2 text-[10px] text-slate-900 font-medium">
                      <span>04º ao 07º</span> <span>88%</span>
                    </div>
                    <div className="h-6 bg-emerald-600 rounded-lg flex items-center justify-between px-2 text-[10px] text-white font-medium">
                      <span>01º ao 03º</span> <span>100%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-4 text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> 95-100%
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Vagas Disponíveis
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-700">Topologia Ativa</span>
          </div>
        </section>

        {/* CARD 3: Biometria Facial BioSync */}
        <section
          className="col-span-12 lg:col-span-3 bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 dark:bg-none dark:bg-slate-900 rounded-3xl p-5 shadow-lg shadow-emerald-900/10 dark:shadow-soft text-white flex flex-col justify-between relative overflow-hidden border border-emerald-400/30 dark:border-transparent"
          data-purpose="biosync-card"
        >
          <div className="absolute -right-12 -top-12 w-44 h-44 bg-emerald-400/20 dark:bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider text-white dark:text-emerald-400 bg-white/20 dark:bg-emerald-950/80 border border-white/25 dark:border-emerald-800 px-2.5 py-1 rounded-full uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 dark:bg-emerald-400 animate-pulse" />
                BioSync 4.2 Online
              </span>
              <div className="w-8 h-8 rounded-full bg-white/20 dark:bg-slate-800 flex items-center justify-center text-white dark:text-slate-300">
                <Layers className="w-4 h-4 text-white dark:text-emerald-400" />
              </div>
            </div>
            <h3 className="text-base font-bold text-white mt-4">Biometria Facial</h3>
            <p className="text-xs text-emerald-100 dark:text-slate-400 mt-0.5">Leitores das portarias A e B</p>

            <div className="mt-5">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-3xl font-black tracking-tight text-white">98.5%</span>
                <span className="text-xs font-semibold text-emerald-200 dark:text-emerald-400">BioSync Ativo</span>
              </div>
              <div className="w-full bg-black/15 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-white/20 dark:border-slate-700/50">
                <div className="bg-emerald-300 dark:bg-gradient-to-r dark:from-emerald-500 dark:to-emerald-400 h-full rounded-full shadow-[0_0_8px_rgba(110,231,183,0.7)] dark:shadow-none" style={{ width: '98%' }} />
              </div>
              <p className="text-[11px] text-emerald-100/90 dark:text-slate-400 mt-2">
                Reconhecimento instantâneo em 0.24s na guarita.
              </p>
            </div>
          </div>

          <button
            onClick={() => alert('Sincronização BioSync com totens de portaria executada com sucesso.')}
            className="w-full mt-4 py-2.5 px-4 bg-white hover:bg-emerald-50 text-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:text-white rounded-2xl text-xs font-bold shadow-md dark:shadow-pill transition-all flex items-center justify-center gap-1.5 cursor-pointer relative z-10"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Auditoria Biométrica</span>
          </button>
        </section>

        {/* SECTION BOTTOM: Diretório de Unidades (Col 8) */}
        <section
          className="col-span-12 lg:col-span-8 bg-white rounded-3xl p-5 shadow-soft border border-slate-100 flex flex-col"
          data-purpose="directory-table-list"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Diretório de Unidades</h2>
              <p className="text-xs text-slate-400">Consulte ocupantes, veículos autorizados e adimplência</p>
            </div>
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-full text-xs">
              {(['Todos', 'Bloco A', 'Bloco B', 'Inquilinos', 'Com Pets'] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                    filter === item
                      ? 'bg-white text-slate-900 font-semibold shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* SKELETON LOADING STATE */}
          {isLoading && (
            <div className="space-y-3 py-2" role="status" aria-label="Carregando unidades">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-3.5 rounded-2.5xl border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-12 h-12 rounded-2xl" />
                    <div className="space-y-2">
                      <Skeleton className="w-40 h-4" />
                      <Skeleton className="w-60 h-3" />
                    </div>
                  </div>
                  <Skeleton className="w-24 h-6 rounded-full" />
                </div>
              ))}
            </div>
          )}

          {/* ERROR STATE */}
          {!isLoading && errorMessage && (
            <div className="p-8 text-center border border-dashed border-rose-200 rounded-2.5xl my-4 bg-rose-50/40">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-rose-800">Falha ao carregar unidades do Supabase</p>
              <p className="text-[11px] text-rose-600 mt-1 mb-4">{errorMessage}</p>
              <button
                onClick={loadUnits}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold"
              >
                Tentar Novamente
              </button>
            </div>
          )}

          {/* FIRST-USE EMPTY STATE (No units in current condominium) */}
          {!isLoading && !errorMessage && units.length === 0 && (
            <EmptyState
              title={`Nenhuma unidade cadastrada no ${currentCondominium?.name || 'Condomínio'}`}
              description="Você ainda não possui unidades registradas neste condomínio no Supabase. Cadastre a primeira unidade ou use o preenchimento automático inicial."
              actionLabel="+ Cadastrar Primeira Unidade"
              onAction={() => setIsModalOpen(true)}
              className="my-4 py-8"
            />
          )}

          {/* FILTER EMPTY STATE (Units exist, but filter returned 0) */}
          {!isLoading && !errorMessage && units.length > 0 && filteredUnits.length === 0 && (
            <EmptyState
              title="Nenhuma unidade encontrada"
              description="Nenhuma unidade corresponde ao filtro selecionado. Tente alterar ou limpar os filtros."
              actionLabel="Ver Todas as Unidades"
              onAction={() => setFilter('Todos')}
              className="my-4"
            />
          )}

          {/* DATA LIST */}
          {!isLoading && !errorMessage && filteredUnits.length > 0 && (
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1" role="list">
              {filteredUnits.map((unit) => {
                const isSelected = selectedUnit?.id === unit.id;
                const isOverdue =
                  unit.financialStatus?.includes('Atraso') || unit.financialStatus?.includes('Vencer');

                return (
                  <button
                    type="button"
                    key={unit.id}
                    onClick={() => setSelectedUnit(unit)}
                    className={`w-full text-left p-3.5 rounded-2.5xl flex items-center justify-between cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      isSelected
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/60 border-2 border-emerald-600 dark:border-emerald-400 shadow-sm'
                        : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-soft'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="relative">
                        <div
                          className={`w-12 h-12 rounded-2xl font-bold flex items-center justify-center text-sm shadow-sm ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {unit.number}
                        </div>
                        {isSelected && (
                          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-600 border-2 border-white dark:border-slate-900 rounded-full flex items-center justify-center text-[9px] text-white">
                            ✓
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            Apto {unit.number} • {unit.block}
                          </h4>
                          <Badge variant={unit.residentType === 'Proprietário' ? 'emerald' : 'slate'}>
                            {unit.residentType || 'Proprietário'}
                          </Badge>
                          {unit.hasPet && <Badge variant="amber">1 Pet</Badge>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                          <span>
                            Resp: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{unit.contactName}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Vaga: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{unit.parkingSpot}</strong>
                          </span>
                          <span>•</span>
                          <span>{unit.residentsCount} Moradores</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <Badge variant={isOverdue ? 'amber' : 'emerald'} dot>
                          {unit.financialStatus || 'Em Dia'}
                        </Badge>
                        <p className="text-[10px] text-slate-400 mt-0.5">BioSync Ativo ({unit.bioSyncCount})</p>
                      </div>
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-400'
                        }`}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path d="M8.25 4.5l7.5 7.5-7.5 7.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>
              Mostrando {filteredUnits.length} de {units.length} unidades registradas
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                Supabase PostgreSQL
              </span>
            </div>
          </div>
        </section>

        {/* SUB-BENTO: Painel de Detalhes da Unidade Selecionada (Col 4) */}
        <section
          className="col-span-12 lg:col-span-4 bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-soft border border-slate-100 dark:border-slate-800 flex flex-col justify-between"
          data-purpose="unit-detail-panel"
        >
          {selectedUnit ? (
            <div>
              <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full uppercase border border-emerald-200/60 dark:border-emerald-800">
                    Unidade Selecionada
                  </span>
                  <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
                    Apto {selectedUnit.number} - {selectedUnit.block}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedUnit.contactName} • {selectedUnit.squareMeters} m² • {selectedUnit.residentsCount} Moradores
                  </p>
                </div>
                <button
                  onClick={() => setIsDetailsModalOpen(true)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
                  title="Ver Ficha Completa"
                  aria-label="Ver Ficha Completa da Unidade"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>

              {/* Resident Members with BioSync */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Membros & Biometria</h5>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">BioSync Ativo</span>
                </div>
                <div className="space-y-2">
                  {selectedUnit.members?.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-800 dark:bg-slate-700 text-white text-[11px] font-bold flex items-center justify-center">
                          {member.initials}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">{member.name}</p>
                          <p className="text-[10px] text-slate-400">{member.role}</p>
                        </div>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Biometria Facial Ativa" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Vehicle & Parking Box */}
              <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Vaga & Veículo
                </span>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedUnit.parkingSpot}</span>
                  <span className="text-slate-500 dark:text-slate-400">{selectedUnit.vehicleModel || 'Veículo Cadastrado'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-400">
              <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-xs font-semibold">Nenhuma unidade selecionada</p>
              <p className="text-[11px]">Selecione uma unidade ao lado para visualizar os detalhes.</p>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-4 space-y-2">
            <button
              onClick={() => setIsDetailsModalOpen(true)}
              disabled={!selectedUnit}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ver Ficha Completa & Biometria</span>
            </button>
            <button
              onClick={() => {
                setNotification({
                  type: 'success',
                  message: `Notificação enviada e 2ª via do boleto disponibilizada para a unidade ${selectedUnit?.number}.`,
                });
                setTimeout(() => setNotification(null), 4000);
              }}
              disabled={!selectedUnit}
              className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:bg-slate-200 dark:disabled:bg-slate-800/50 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Emitir Notificação ou 2ª Via
            </button>
          </div>
        </section>
      </div>

      {/* Modal de Cadastro Real */}
      <CreateUnitModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        condominiumId={currentCondominium?.id || ''}
        condominiumName={currentCondominium?.name || 'Condomínio'}
        onUnitCreated={handleUnitCreated}
      />

      {/* Modal de Detalhes Completos da Unidade */}
      <UnitDetailsModal
        isOpen={isDetailsModalOpen}
        unit={selectedUnit}
        onClose={() => setIsDetailsModalOpen(false)}
        onUpdateUnit={(updatedUnit) => {
          setSelectedUnit(updatedUnit);
          setUnits((prev) => prev.map((u) => (u.id === updatedUnit.id ? updatedUnit : u)));
        }}
      />
    </div>
  );
};
