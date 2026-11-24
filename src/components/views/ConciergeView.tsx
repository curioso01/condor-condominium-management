import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { conciergeService } from '../../services/conciergeService';
import { packageService, type PackageRecord } from '../../services/packageService';
import { unitService } from '../../services/unitService';
import type { AccessEntry, Unit } from '../../types/condominium';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { DynamicTelemetryChart, type ChartDataPoint } from '../common/DynamicTelemetryChart';
import {
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Radio,
  Eye,
  Package,
  QrCode,
  Plus,
  Check,
  X,
} from 'lucide-react';
import { PackageDeliveryModal } from './PackageDeliveryModal';
import { CreateVisitorPassModal, type VisitorPassData } from './CreateVisitorPassModal';
import { userService } from '../../services/userService';

export const ConciergeView: React.FC = () => {
  const { currentCondominium, currentRole, user, isDemoSession } = useAuth();
  const canViewAccessLogs = userService.canAccessRealtimeLogs(
    user?.id,
    currentRole,
    currentCondominium?.id || ''
  );

  const [accessLog, setAccessLog] = useState<AccessEntry[]>([]);
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [accessFilter, setAccessFilter] = useState<
    'Todos' | 'Moradores' | 'Visitantes QR' | 'Entregadores'
  >('Todos');
  const [gateUnlocked, setGateUnlocked] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [selectedLogDetail, setSelectedLogDetail] = useState<AccessEntry | null>(null);

  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [isVisitorModalOpen, setIsVisitorModalOpen] = useState(false);

  const canRunDemoSimulator = !isSupabaseConfigured || isDemoSession;
  const [isLiveLogActive, setIsLiveLogActive] = useState(() => canRunDemoSimulator);

  const loadConciergeData = useCallback(async () => {
    if (!currentCondominium?.id) return;
    setAccessLog([]);
    setPackages([]);
    const [logsRes, pkgRes, unitsRes] = await Promise.all([
      conciergeService.getAccessLogs(currentCondominium.id),
      packageService.getPackagesByCondominium(currentCondominium.id),
      unitService.getUnitsByCondominium(currentCondominium.id),
    ]);

    if (logsRes.error && !logsRes.error.tableMissing) {
      setNotification({ type: 'error', message: logsRes.error.message });
    }
    setAccessLog(logsRes.data || []);
    setPackages(pkgRes.data || []);
    setUnits(unitsRes.data || []);
  }, [currentCondominium?.id]);

  useEffect(() => {
    loadConciergeData();
  }, [loadConciergeData]);

  // Simulador automático restrito exclusivamente ao modo demonstração explícito
  useEffect(() => {
    if (!isLiveLogActive || !canRunDemoSimulator) return;
    const interval = setInterval(() => {
      const sampleNames = ['Marina Alencar', 'Lucas Silveira', 'Henrique Viana', 'Beatriz Castilho'];
      const sampleDest = ['Apto 602 • Bloco B', 'Apto 104 • Bloco A', 'Apto 1201 • Torre 1', 'Apto 304 • Bloco B'];
      const randomIdx = Math.floor(Math.random() * sampleNames.length);
      const timeStr = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const newEntry: AccessEntry = {
        id: `live-${Date.now()}`,
        personName: sampleNames[randomIdx],
        photoUrl: '',
        authType: 'facial',
        authDetail: 'Simulação Demo • Portaria',
        timestamp: `${timeStr} (Demo)`,
        accessPoint: 'Catraca Principal 01',
        destination: sampleDest[randomIdx],
        type: 'Morador Residente',
      };

      setAccessLog((prev) => [newEntry, ...prev.slice(0, 24)]);
    }, 12000);

    return () => clearInterval(interval);
  }, [isLiveLogActive, canRunDemoSimulator]);

  const awaitingPackages = useMemo(
    () => packages.filter((p) => p.status === 'awaiting'),
    [packages]
  );

  const overduePackagesCount = useMemo(() => {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    return awaitingPackages.filter((p) => new Date(p.received_at).getTime() < cutoff).length;
  }, [awaitingPackages]);

  const accessStats = useMemo(() => {
    const total = accessLog.length;
    const qrCount = accessLog.filter((l) => l.authType === 'qr_code').length;
    const deliveryCount = accessLog.filter(
      (l) => l.authType === 'delivery' || l.type.includes('Liberação Temp')
    ).length;
    const manualCount = accessLog.filter((l) => l.authType === 'manual').length;
    return { total, qrCount, deliveryCount, manualCount };
  }, [accessLog]);

  // Série real de acessos agrupados por categoria para o gráfico Recharts
  const chartDataPoints: ChartDataPoint[] = useMemo(() => {
    const residents = accessLog.filter((l) => l.type === 'Morador Residente').length;
    const visitors = accessLog.filter((l) => l.authType === 'qr_code').length;
    const deliveries = accessLog.filter(
      (l) => l.authType === 'delivery' || l.type.includes('Liberação Temp')
    ).length;
    const manual = accessLog.filter((l) => l.authType === 'manual' && !l.type.includes('Liberação Temp')).length;

    if (accessLog.length === 0) return [];
    return [
      { label: 'Moradores', primaryValue: residents, secondaryValue: 0 },
      { label: 'Visitantes QR', primaryValue: visitors, secondaryValue: visitors },
      { label: 'Entregadores', primaryValue: deliveries, secondaryValue: awaitingPackages.length },
      { label: 'Aberturas Remotas', primaryValue: manual, secondaryValue: 0 },
    ];
  }, [accessLog, awaitingPackages.length]);

  const handleRemoteOpen = async () => {
    if (!currentCondominium?.id) return;

    const { data, error } = await conciergeService.createAccessEntry({
      condominium_id: currentCondominium.id,
      personName: 'Operador da Portaria (Remoto)',
      authType: 'manual',
      authDetail: 'Abertura Remota Autorizada pelo Painel',
      accessPoint: 'Portão Principal 01',
      destination: 'Acesso Geral',
      entryType: 'Abertura Remota',
    });

    if (error || !data) {
      setNotification({
        type: 'error',
        message: error?.message || 'Falha ao registrar abertura remota no banco de dados.',
      });
      setTimeout(() => setNotification(null), 5000);
      return;
    }

    setAccessLog((prev) => [data, ...prev]);
    setGateUnlocked(true);
    setNotification({
      type: 'success',
      message: 'Liberação registrada e auditada com sucesso no banco de dados!',
    });

    setTimeout(() => {
      setGateUnlocked(false);
      setNotification(null);
    }, 4000);
  };

  const handlePackageRegistered = async (pkg: {
    unitId?: string | null;
    unitNumber: string;
    recipientName: string;
    courier: string;
    trackingCode: string;
    lockerCompartment: string;
    size: 'Pequeno' | 'Médio' | 'Grande';
  }): Promise<{ success: boolean; error?: string }> => {
    if (!currentCondominium?.id) {
      return { success: false, error: 'Condomínio ativo não identificado.' };
    }

    const [pkgRes, logRes] = await Promise.all([
      packageService.registerPackage({
        condominium_id: currentCondominium.id,
        unit_id: pkg.unitId || null,
        unit_number: pkg.unitNumber,
        recipient_name: pkg.recipientName,
        courier: pkg.courier,
        tracking_code: pkg.trackingCode,
        locker_compartment: pkg.lockerCompartment,
        size: pkg.size,
      }),
      conciergeService.createAccessEntry({
        condominium_id: currentCondominium.id,
        personName: `Entregador (${pkg.courier})`,
        authType: 'delivery',
        authDetail: `Depósito em ${pkg.lockerCompartment} • Rastreio ${pkg.trackingCode}`,
        accessPoint: 'Recepção / Encomendas',
        destination: `${pkg.unitNumber} (${pkg.recipientName})`,
        entryType: 'Liberação Temp. (Entrega)',
      }),
    ]);

    if (pkgRes.error && logRes.error) {
      return {
        success: false,
        error: pkgRes.error.message || logRes.error.message,
      };
    }

    if (pkgRes.data) {
      setPackages((prev) => [pkgRes.data!, ...prev]);
    }
    if (logRes.data) {
      setAccessLog((prev) => [logRes.data!, ...prev]);
    }

    setNotification({
      type: 'success',
      message: pkgRes.data
        ? `Encomenda de ${pkg.courier} registrada para ${pkg.unitNumber} • PIN de retirada: ${pkgRes.data.pickup_pin}`
        : `Entrega de ${pkg.courier} registrada no log da portaria para ${pkg.unitNumber}.`,
    });
    setTimeout(() => setNotification(null), 6000);
    return { success: true };
  };

  const handleConfirmPackagePickup = async (pkg: PackageRecord) => {
    if (!currentCondominium?.id) return;
    const { error } = await packageService.markAsPickedUp(pkg.id, currentCondominium.id);
    if (error) {
      setNotification({ type: 'error', message: error.message });
      return;
    }
    setPackages((prev) =>
      prev.map((p) =>
        p.id === pkg.id ? { ...p, status: 'picked_up', picked_up_at: new Date().toISOString() } : p
      )
    );
    window.dispatchEvent(new CustomEvent('condor:packages-updated'));
    setNotification({
      type: 'success',
      message: `Retirada confirmada para ${pkg.unit_number} (${pkg.courier}).`,
    });
    setTimeout(() => setNotification(null), 4000);
  };

  const handlePassCreated = async (
    pass: VisitorPassData
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentCondominium?.id) {
      return { success: false, error: 'Condomínio ativo não identificado.' };
    }

    const { data, error } = await conciergeService.createAccessEntry({
      condominium_id: currentCondominium.id,
      personName: pass.visitorName,
      authType: 'qr_code',
      authDetail: `Token #${pass.tokenCode} • Pré-autorizado para ${pass.visitDate}`,
      accessPoint: 'Portaria Principal',
      destination: pass.unitNumber,
      entryType: 'Convidado QR Válido',
    });

    if (error || !data) {
      return {
        success: false,
        error: error?.message || 'Falha ao persistir passe QR de visitante no banco de dados.',
      };
    }

    setAccessLog((prev) => [data, ...prev]);
    setNotification({
      type: 'success',
      message: `Passe QR confirmado no banco para ${pass.visitorName} (Token #${pass.tokenCode}).`,
    });
    setTimeout(() => setNotification(null), 5000);
    return { success: true };
  };

  const filteredLogs = accessLog.filter((log) => {
    if (accessFilter === 'Moradores') return log.type === 'Morador Residente';
    if (accessFilter === 'Visitantes QR') return log.type === 'Convidado QR Válido';
    if (accessFilter === 'Entregadores') return log.type.includes('Liberação Temp');
    return true;
  });

  return (
    <div className="flex flex-col gap-5 pb-6" data-purpose="concierge-view">
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
            type="button"
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
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              Portaria &amp; Controle de Acessos
            </h2>
            <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
              {currentCondominium?.name || 'Condomínio'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Controle auditado de visitantes QR, entregas, encomendas e liberações da portaria
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsVisitorModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>+ Pré-Autorizar Visitante</span>
          </button>
          <button
            type="button"
            onClick={() => setIsPackageModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Package className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>+ Registrar Encomenda</span>
          </button>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full min-w-0">
        {/* CARD 1: Resumo Operacional Real da Portaria */}
        <section className="col-span-1 lg:col-span-7 w-full min-w-0 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/70 dark:border-slate-800 shadow-soft flex flex-col justify-between">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  Auditoria de Portaria em Tempo Real
                </h3>
                <p className="text-xs text-slate-400">
                  Métricas calculadas a partir dos registros reais do condomínio
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 my-5">
            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/60">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Acessos Auditados
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 block tabular-nums">
                {accessStats.total}
              </span>
              <span className="text-[11px] text-slate-400">No histórico recente</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/60">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Passes QR Ativos
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block tabular-nums">
                {accessStats.qrCount}
              </span>
              <span className="text-[11px] text-slate-400">Pré-autorizados</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/60">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Entregas Registradas
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 block tabular-nums">
                {accessStats.deliveryCount}
              </span>
              <span className="text-[11px] text-slate-400">Logs de recebimento</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between flex-wrap sm:flex-nowrap gap-3">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Registro de Liberação Manual / Remota
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Registra imediatamente um evento auditado em public.access_logs e public.audit_logs
              </p>
            </div>
            <button
              type="button"
              onClick={handleRemoteOpen}
              className={`px-4 py-2 font-bold text-xs rounded-xl border transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                gateUnlocked
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-700 border-emerald-200 dark:border-emerald-700'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>{gateUnlocked ? 'Liberação Registrada!' : 'Registrar Liberação'}</span>
            </button>
          </div>
        </section>

        {/* CARD 2: Central Real de Encomendas & Retirada com PIN */}
        <section className="col-span-1 lg:col-span-5 w-full min-w-0 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/70 dark:border-slate-800 shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Encomendas &amp; Armários
                  </h3>
                  <p className="text-xs text-slate-400">
                    {awaitingPackages.length} aguardando retirada
                    {overduePackagesCount > 0 ? ` • ${overduePackagesCount} > 48h` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPackageModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova</span>
              </button>
            </div>

            {awaitingPackages.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
                Nenhuma encomenda pendente de retirada neste condomínio.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {awaitingPackages.slice(0, 6).map((pkg) => (
                  <div
                    key={pkg.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                        {pkg.unit_number} • {pkg.courier}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {pkg.recipient_name} • {pkg.locker_compartment} • PIN{' '}
                        <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                          {pkg.pickup_pin}
                        </strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleConfirmPackagePickup(pkg)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                      title="Confirmar entrega ao morador"
                    >
                      <Check className="w-3 h-3" />
                      <span>Entregue</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CARD 3: Gráfico Real (Recharts) */}
        <section className="col-span-1 lg:col-span-12 w-full min-w-0 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/70 dark:border-slate-800 shadow-soft">
          <DynamicTelemetryChart
            title="Distribuição Real de Acessos & Entregas"
            subtitle="Consolidado dos registros auditados deste condomínio"
            primaryLabel="Eventos Registrados"
            secondaryLabel="Pendentes / QR"
            primaryColor="#059669"
            secondaryColor="#F59E0B"
            height={200}
            unitLabel="registros"
            dataPoints={chartDataPoints}
            emptyMessage="Nenhum registro de portaria encontrado ainda para este condomínio."
          />
        </section>

        {/* CARD 4: Log de Acessos */}
        {canViewAccessLogs ? (
          <section
            className="col-span-1 lg:col-span-12 w-full min-w-0 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/70 dark:border-slate-800 shadow-soft"
            data-purpose="access-log-feed"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Log Auditado de Acessos
                    </h3>
                    {canRunDemoSimulator && (
                      <button
                        type="button"
                        onClick={() => setIsLiveLogActive((prev) => !prev)}
                        className="text-[10px] font-bold text-slate-500 underline cursor-pointer"
                      >
                        {isLiveLogActive ? 'Pausar Demo' : 'Retomar Demo'}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Histórico isolado por condomínio via Row Level Security
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {(['Todos', 'Moradores', 'Visitantes QR', 'Entregadores'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setAccessFilter(filter)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      accessFilter === filter
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <EmptyState
                title="Nenhum acesso registrado"
                description="Os registros de visitantes QR, encomendas e liberações da portaria aparecerão aqui."
                actionLabel="Ver Todos os Acessos"
                onAction={() => setAccessFilter('Todos')}
                className="my-4"
              />
            ) : (
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <th className="py-3 px-4">Pessoa / Origem</th>
                      <th className="py-3 px-4">Horário / Ponto</th>
                      <th className="py-3 px-4">Destino</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4 text-right">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {filteredLogs.map((log) => {
                      const isResident = log.type === 'Morador Residente';
                      const isGuest = log.type === 'Convidado QR Válido';
                      return (
                        <tr
                          key={log.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0">
                                {log.personName.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 dark:text-slate-100 block">
                                  {log.personName}
                                </span>
                                <span className="text-[11px] text-slate-400">{log.authDetail}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                            {log.timestamp}
                            <span className="block text-[11px] font-normal text-slate-400">
                              {log.accessPoint}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                            {log.destination}
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge variant={isResident ? 'emerald' : isGuest ? 'sky' : 'amber'} dot>
                              {log.type}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedLogDetail(log)}
                              className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
                              aria-label={`Ver detalhes do acesso de ${log.personName}`}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <section className="col-span-1 lg:col-span-12 w-full min-w-0 bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-dashed border-slate-200 dark:border-slate-800 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Log de Acessos Restrito
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
              Os registros de auditoria de portaria estão restritos à administração e operadores autorizados.
            </p>
          </section>
        )}
      </div>

      {/* Modal de Detalhe do Log (substitui window.alert) */}
      {selectedLogDetail && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedLogDetail(null);
          }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Detalhes da Auditoria de Acesso
              </h4>
              <button
                type="button"
                onClick={() => setSelectedLogDetail(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100 dark:border-slate-800">
                <dt className="text-slate-400">Identificação</dt>
                <dd className="font-bold text-slate-900 dark:text-slate-100">{selectedLogDetail.personName}</dd>
              </div>
              <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100 dark:border-slate-800">
                <dt className="text-slate-400">Horário</dt>
                <dd className="font-semibold text-slate-700 dark:text-slate-200">{selectedLogDetail.timestamp}</dd>
              </div>
              <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100 dark:border-slate-800">
                <dt className="text-slate-400">Ponto de Acesso</dt>
                <dd className="font-semibold text-slate-700 dark:text-slate-200">{selectedLogDetail.accessPoint}</dd>
              </div>
              <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100 dark:border-slate-800">
                <dt className="text-slate-400">Destino</dt>
                <dd className="font-semibold text-slate-700 dark:text-slate-200">{selectedLogDetail.destination}</dd>
              </div>
              <div className="flex justify-between gap-2 py-1.5">
                <dt className="text-slate-400">Observação</dt>
                <dd className="font-medium text-slate-600 dark:text-slate-300 text-right">{selectedLogDetail.authDetail}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      <PackageDeliveryModal
        isOpen={isPackageModalOpen}
        onClose={() => setIsPackageModalOpen(false)}
        units={units}
        onPackageRegistered={handlePackageRegistered}
      />

      <CreateVisitorPassModal
        isOpen={isVisitorModalOpen}
        onClose={() => setIsVisitorModalOpen(false)}
        units={units}
        onPassCreated={handlePassCreated}
      />
    </div>
  );
};
