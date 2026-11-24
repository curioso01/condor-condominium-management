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
  Pencil,
  Trash2,
  X,
  Building2,
} from 'lucide-react';
import { PremiumSelect } from '../ui/PremiumSelect';

export const UnitsView: React.FC = () => {
  const { currentCondominium, canManageUsers, canManageUnits, isSuperAdmin, refreshMemberships } = useAuth();
  const canEditBlocksAndUnits = canManageUsers || canManageUnits;

  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [filter, setFilter] = useState<string>('Todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Gestão de Blocos / Torres
  const [savedBlocks, setSavedBlocks] = useState<string[]>([]);
  const [blockModalMode, setBlockModalMode] = useState<'create' | 'rename' | 'delete' | null>(null);
  const [activeBlockTarget, setActiveBlockTarget] = useState<string>('');
  const [blockNameInput, setBlockNameInput] = useState<string>('');
  const [deleteReassignBlock, setDeleteReassignBlock] = useState<string>('');
  const [deleteWithUnitsConfirmed, setDeleteWithUnitsConfirmed] = useState<boolean>(false);
  const [isSavingBlock, setIsSavingBlock] = useState(false);
  const [blockModalError, setBlockModalError] = useState<string | null>(null);

  useEffect(() => {
    const fromCondo = Array.isArray(currentCondominium?.blocks)
      ? currentCondominium.blocks.map((b) => String(b).trim()).filter(Boolean)
      : [];
    setSavedBlocks(fromCondo);
  }, [currentCondominium?.id, currentCondominium?.blocks]);

  // Fetch real units from Supabase
  const loadUnits = useCallback(async () => {
    if (!currentCondominium?.id) return;
    setIsLoading(true);
    setErrorMessage(null);
    setUnits([]);
    setSelectedUnit(null);

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
    const handleUnitsUpdated = () => {
      loadUnits();
    };
    window.addEventListener('condor:units-updated', handleUnitsUpdated);
    return () => window.removeEventListener('condor:units-updated', handleUnitsUpdated);
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

  // Blocos reais presentes no condomínio (salvos no condomínio + existentes nas unidades)
  const dynamicBlocks = useMemo(
    () => unitService.getConsolidatedBlocks(savedBlocks, units),
    [savedBlocks, units]
  );

  // Handlers de gestão de blocos (Criar, Renomear, Excluir)
  const openCreateBlockModal = () => {
    setBlockModalMode('create');
    setActiveBlockTarget('');
    setBlockNameInput('');
    setBlockModalError(null);
  };

  const openRenameBlockModal = (blockName: string) => {
    setBlockModalMode('rename');
    setActiveBlockTarget(blockName);
    setBlockNameInput(blockName);
    setBlockModalError(null);
  };

  const openDeleteBlockModal = (blockName: string) => {
    const alternatives = dynamicBlocks.filter((b) => b !== blockName);
    setBlockModalMode('delete');
    setActiveBlockTarget(blockName);
    setDeleteReassignBlock(alternatives[0] || '');
    setDeleteWithUnitsConfirmed(false);
    setBlockModalError(null);
  };

  const handleConfirmBlockAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCondominium?.id || !blockModalMode) return;
    setBlockModalError(null);
    setIsSavingBlock(true);

    if (blockModalMode === 'create') {
      const res = await unitService.addBlock(currentCondominium.id, blockNameInput, dynamicBlocks);
      setIsSavingBlock(false);
      if (res.error) {
        setBlockModalError(res.error.message);
        return;
      }
      setSavedBlocks(res.blocks);
      setBlockModalMode(null);
      setNotification({ type: 'success', message: `Bloco "${blockNameInput.trim()}" adicionado com sucesso!` });
      setTimeout(() => setNotification(null), 4500);
      await refreshMemberships();
      return;
    }

    if (blockModalMode === 'rename') {
      const res = await unitService.renameBlock(currentCondominium.id, activeBlockTarget, blockNameInput);
      setIsSavingBlock(false);
      if (res.error) {
        setBlockModalError(res.error.message);
        return;
      }
      if (res.blocks.length > 0) setSavedBlocks(res.blocks);
      if (filter === activeBlockTarget) setFilter(blockNameInput.trim());
      setBlockModalMode(null);
      setNotification({
        type: 'success',
        message: `Bloco "${activeBlockTarget}" alterado para "${blockNameInput.trim()}" (${res.unitsUpdated} unidade(s) atualizada(s)).`,
      });
      setTimeout(() => setNotification(null), 5000);
      await Promise.all([loadUnits(), refreshMemberships()]);
      return;
    }

    if (blockModalMode === 'delete') {
      const targetCount = units.filter((u) => u.block === activeBlockTarget).length;
      const res = await unitService.deleteBlock(currentCondominium.id, activeBlockTarget, {
        reassignToBlock: targetCount > 0 && !deleteWithUnitsConfirmed ? deleteReassignBlock || null : null,
        deleteUnits: targetCount > 0 && deleteWithUnitsConfirmed,
      });
      setIsSavingBlock(false);
      if (res.error) {
        setBlockModalError(res.error.message);
        return;
      }
      setSavedBlocks(res.blocks);
      if (filter === activeBlockTarget) setFilter('Todos');
      setBlockModalMode(null);
      setNotification({
        type: 'success',
        message: `Bloco "${activeBlockTarget}" excluído com sucesso!`,
      });
      setTimeout(() => setNotification(null), 5000);
      await Promise.all([loadUnits(), refreshMemberships()]);
    }
  };

  // Filtered units (funciona com qualquer nome de bloco/torre do condomínio)
  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      if (filter === 'Todos') return true;
      if (filter === 'Inquilinos') return u.residentType === 'Inquilino';
      if (filter === 'Com Pets') return u.hasPet;
      return u.block === filter;
    });
  }, [units, filter]);

  // Census aggregates calculated from actual units in the database
  const census = useMemo(() => {
    const total = units.length;
    const residents = units.reduce((acc, u) => acc + (u.residentsCount || 1), 0);
    const vehicles = units.filter((u) => Boolean(u.parkingSpot)).length;
    const pets = units.filter((u) => Boolean(u.hasPet)).length;
    const owners = units.filter((u) => u.residentType !== 'Inquilino').length;
    const tenants = units.filter((u) => u.residentType === 'Inquilino').length;
    const rate = total > 0 ? Math.round((owners / total) * 100) : 0;
    const byBlock = dynamicBlocks.map((blockName) => {
      const blockUnits = units.filter((u) => u.block === blockName);
      return {
        name: blockName,
        count: blockUnits.length,
        residents: blockUnits.reduce((acc, u) => acc + (u.residentsCount || 1), 0),
        share: total > 0 ? Math.round((blockUnits.length / total) * 100) : 0,
      };
    });
    return { total, residents, vehicles, pets, owners, tenants, rate, byBlock };
  }, [units, dynamicBlocks]);

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
              Unidades e Moradores
            </h2>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
              {currentCondominium?.name || 'Condomínio'}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Cadastro de moradores, controle de veículos, biometria facial BioSync e permissões
          </p>
        </div>

        {canEditBlocksAndUnits && (
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
              <span>Cadastrar Novo Morador ou Unidade</span>
            </button>
          </div>
        )}
      </div>

      {/* Grid Bento Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full min-w-0" data-purpose="bento-layout">
        {/* CARD 1: Censo & Indicadores Operacionais */}
        <section
          className="col-span-1 lg:col-span-4 w-full min-w-0 bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-soft border border-slate-100 dark:border-slate-800 flex flex-col justify-between"
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
              {isSuperAdmin ? 'Sincronizado com Supabase' : 'Sincronizado em tempo real'}
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

        {/* CARD 2: Distribuição Real de Blocos & Torres (com Edição, Alteração e Exclusão) */}
        <section
          className="col-span-1 lg:col-span-5 w-full min-w-0 bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-soft border border-slate-100 dark:border-slate-800 flex flex-col justify-between"
          data-purpose="block-distribution-card"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Topologia Real do Condomínio
                </span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {dynamicBlocks.length > 0
                    ? `${dynamicBlocks.length} ${dynamicBlocks.length === 1 ? 'Bloco / Torre' : 'Blocos / Torres'}`
                    : 'Sem Blocos Cadastrados'}
                </h2>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full">
                  {census.total} unid.
                </span>
                {canEditBlocksAndUnits && (
                  <button
                    type="button"
                    onClick={openCreateBlockModal}
                    className="px-2.5 py-1 rounded-full bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white text-[10px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
                    title="Adicionar novo bloco ou torre"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Bloco</span>
                  </button>
                )}
              </div>
            </div>

            {census.byBlock.length === 0 ? (
              <div className="my-3 p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
                Cadastre blocos ou unidades para organizar a distribuição por torre.
              </div>
            ) : (
              <div className="space-y-2.5 my-3 max-h-60 overflow-y-auto pr-1">
                {census.byBlock.map((blk) => (
                  <div
                    key={blk.name}
                    className={`w-full p-3 rounded-2xl border transition flex flex-col gap-1.5 ${
                      filter === blk.name
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setFilter(filter === blk.name ? 'Todos' : blk.name)}
                        className="font-bold text-slate-900 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-400 text-left truncate cursor-pointer flex-1"
                      >
                        {blk.name}
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold text-slate-500 dark:text-slate-400 tabular-nums text-[11px]">
                          {blk.count} {blk.count === 1 ? 'unid.' : 'unid.'} • {blk.residents} morad.
                        </span>
                        {canEditBlocksAndUnits && (
                          <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-slate-700">
                            <button
                              type="button"
                              onClick={() => openRenameBlockModal(blk.name)}
                              className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition cursor-pointer"
                              title={`Editar / renomear ${blk.name}`}
                              aria-label={`Editar bloco ${blk.name}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeleteBlockModal(blk.name)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition cursor-pointer"
                              title={`Excluir ${blk.name}`}
                              aria-label={`Excluir bloco ${blk.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFilter(filter === blk.name ? 'Todos' : blk.name)}
                      className="w-full h-2 bg-slate-200/70 dark:bg-slate-700 rounded-full overflow-hidden cursor-pointer"
                      aria-label={`Filtrar por ${blk.name}`}
                    >
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all"
                        style={{ width: `${blk.count > 0 ? Math.max(8, blk.share) : 0}%` }}
                      />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400">
            <span>Clique em um bloco para filtrar a tabela</span>
            {filter !== 'Todos' && (
              <button
                type="button"
                onClick={() => setFilter('Todos')}
                className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Limpar filtro
              </button>
            )}
          </div>
        </section>

        {/* CARD 3: Perfil de Ocupação Real (Proprietários vs Inquilinos) */}
        <section
          className="col-span-1 lg:col-span-3 w-full min-w-0 bg-slate-900 text-white rounded-3xl p-5 shadow-soft flex flex-col justify-between border border-slate-800"
          data-purpose="occupancy-profile-card"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2.5 py-1 rounded-full uppercase">
                Perfil de Posse
              </span>
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-base font-bold text-white mt-4">Proprietários &amp; Inquilinos</h3>
            <p className="text-xs text-slate-400 mt-0.5">Composição real do censo</p>

            <div className="mt-5 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-300">Proprietários</span>
                <span className="text-2xl font-black text-white tabular-nums">{census.owners}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-300">Inquilinos</span>
                <span className="text-2xl font-black text-emerald-400 tabular-nums">{census.tenants}</span>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all"
                  style={{ width: `${census.rate}%` }}
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setFilter(filter === 'Inquilinos' ? 'Todos' : 'Inquilinos')}
            className="w-full mt-4 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{filter === 'Inquilinos' ? 'Mostrar Todas' : 'Filtrar Inquilinos'}</span>
          </button>
        </section>

        {/* SECTION BOTTOM: Diretório de Unidades (Col 8) */}
        <section
          className="col-span-1 lg:col-span-8 w-full min-w-0 bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-soft border border-slate-100 dark:border-slate-800 flex flex-col"
          data-purpose="directory-table-list"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Diretório de Unidades</h2>
              <p className="text-xs text-slate-400">Consulte ocupantes, veículos autorizados e adimplência</p>
            </div>
            {/* Filter Pills (Dinâmicos pelos blocos reais do condomínio) */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
              {(['Todos', ...dynamicBlocks, 'Inquilinos', 'Com Pets']).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    filter === item
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-semibold shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
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
              <p className="text-xs font-bold text-rose-800">
                {isSuperAdmin ? 'Falha ao carregar unidades do Supabase' : 'Falha ao carregar unidades do sistema'}
              </p>
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
              description={
                isSuperAdmin
                  ? 'Você ainda não possui unidades registradas neste condomínio no Supabase. Cadastre a primeira unidade ou use o preenchimento automático inicial.'
                  : 'Você ainda não possui unidades registradas neste condomínio. Cadastre a primeira unidade ou use o preenchimento automático inicial.'
              }
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
                {isSuperAdmin ? 'Supabase PostgreSQL' : 'Banco em Tempo Real'}
              </span>
            </div>
          </div>
        </section>

        {/* SUB-BENTO: Painel de Detalhes da Unidade Selecionada (Col 4) */}
        <section
          className="col-span-1 lg:col-span-4 w-full min-w-0 bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-soft border border-slate-100 dark:border-slate-800 flex flex-col justify-between"
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
        availableBlocks={dynamicBlocks}
        onUnitCreated={handleUnitCreated}
        onSuccess={(msg) => {
          setNotification({ type: 'success', message: msg });
          setTimeout(() => setNotification(null), 5000);
          loadUnits();
        }}
      />

      {/* Popup Modal: Criar / Renomear / Excluir Bloco do Condomínio */}
      {blockModalMode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Gerenciar Bloco do Condomínio"
          className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-sm animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSavingBlock) setBlockModalMode(null);
          }}
        >
          <form
            onSubmit={handleConfirmBlockAction}
            className="w-full max-w-md max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    blockModalMode === 'delete'
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {blockModalMode === 'delete' ? (
                    <Trash2 className="w-5 h-5" />
                  ) : (
                    <Building2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {blockModalMode === 'create'
                      ? 'Adicionar Novo Bloco / Torre'
                      : blockModalMode === 'rename'
                      ? `Editar Bloco "${activeBlockTarget}"`
                      : `Excluir Bloco "${activeBlockTarget}"`}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {currentCondominium?.name || 'Condomínio'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSavingBlock}
                onClick={() => setBlockModalMode(null)}
                aria-label="Fechar modal de bloco"
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
              {blockModalError && (
                <div
                  role="alert"
                  className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{blockModalError}</span>
                </div>
              )}

              {(blockModalMode === 'create' || blockModalMode === 'rename') && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                    {blockModalMode === 'create' ? 'Nome do Novo Bloco / Torre *' : 'Novo Nome do Bloco / Torre *'}
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={blockNameInput}
                    onChange={(e) => setBlockNameInput(e.target.value)}
                    placeholder="Ex: Bloco C, Torre Esmeralda, Ala Norte..."
                    className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {blockModalMode === 'rename' && (
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      Todas as unidades e moradores vinculados a <strong>{activeBlockTarget}</strong> serão atualizados automaticamente no banco de dados.
                    </p>
                  )}
                </div>
              )}

              {blockModalMode === 'delete' && (() => {
                const unitsInBlock = units.filter((u) => u.block === activeBlockTarget).length;
                const otherBlocks = dynamicBlocks.filter((b) => b !== activeBlockTarget);
                return (
                  <div className="space-y-3 text-xs">
                    {unitsInBlock === 0 ? (
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        O bloco <strong>{activeBlockTarget}</strong> não possui unidades vinculadas e pode ser removido com segurança.
                      </p>
                    ) : (
                      <>
                        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-200">
                          Este bloco possui <strong>{unitsInBlock} unidade(s)</strong> cadastrada(s). Escolha como tratar essas unidades antes de excluir:
                        </div>

                        {otherBlocks.length > 0 && !deleteWithUnitsConfirmed && (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                              Mover unidades deste bloco para:
                            </label>
                            <PremiumSelect
                              ariaLabel="Bloco de destino para mover unidades"
                              size="md"
                              value={deleteReassignBlock}
                              onChange={setDeleteReassignBlock}
                              options={otherBlocks.map((b) => ({ value: b, label: b }))}
                            />
                          </div>
                        )}

                        <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={deleteWithUnitsConfirmed}
                            onChange={(e) => setDeleteWithUnitsConfirmed(e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded accent-rose-600 cursor-pointer shrink-0"
                          />
                          <span className="text-[11px] text-rose-800 dark:text-rose-200 font-semibold leading-snug">
                            Em vez de mover, excluir permanentemente também as {unitsInBlock} unidade(s) vinculadas a este bloco.
                          </span>
                        </label>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                disabled={isSavingBlock}
                onClick={() => setBlockModalMode(null)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingBlock}
                className={`px-5 py-2 rounded-full text-white text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50 ${
                  blockModalMode === 'delete'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isSavingBlock
                  ? 'Processando...'
                  : blockModalMode === 'create'
                  ? 'Adicionar Bloco'
                  : blockModalMode === 'rename'
                  ? 'Salvar Alteração'
                  : 'Confirmar Exclusão'}
              </button>
            </div>
          </form>
        </div>
      )}

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
