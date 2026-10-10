import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { conciergeService } from '../../services/conciergeService';
import { mockAccessEntries } from '../../services/mockData';
import type { AccessEntry } from '../../types/condominium';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { DynamicTelemetryChart } from '../common/DynamicTelemetryChart';
import { 
  Key, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Radio, 
  Eye, 
  Package, 
  QrCode, 
  Plus 
} from 'lucide-react';
import { PackageDeliveryModal } from './PackageDeliveryModal';
import { CreateVisitorPassModal, type VisitorPassData } from './CreateVisitorPassModal';
import { userService } from '../../services/userService';

export const ConciergeView: React.FC = () => {
  const { currentCondominium, currentRole, user } = useAuth();
  const canViewAccessLogs = userService.canAccessRealtimeLogs(
    user?.id,
    currentRole,
    currentCondominium?.id || 'condo-imperial-001'
  );

  const [accessLog, setAccessLog] = useState<AccessEntry[]>(mockAccessEntries);
  const [accessFilter, setAccessFilter] = useState<'Todos' | 'Moradores' | 'Visitantes QR' | 'Entregadores'>('Todos');
  const [gateUnlocked, setGateUnlocked] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [tableMissing, setTableMissing] = useState(false);

  // Modals state
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [isVisitorModalOpen, setIsVisitorModalOpen] = useState(false);
  const [awaitingPackages, setAwaitingPackages] = useState(28);
  const [freeLockers, setFreeLockers] = useState(4);

  // Simulated live event for Portaria log
  const [isLiveLogActive, setIsLiveLogActive] = useState(true);

  // Load access logs from Supabase
  const loadAccessLogs = useCallback(async () => {
    if (!currentCondominium?.id) return;
    const { data, error } = await conciergeService.getAccessLogs(currentCondominium.id);

    if (error?.tableMissing) {
      setTableMissing(true);
    } else {
      setTableMissing(false);
    }
    setAccessLog(data);
  }, [currentCondominium?.id]);

  useEffect(() => {
    loadAccessLogs();
  }, [loadAccessLogs]);

  useEffect(() => {
    if (!isLiveLogActive) return;
    const interval = setInterval(() => {
      // Simulate live arrival every 12s
      const sampleNames = ['Marina Alencar', 'Lucas Silveira', 'Dr. Henrique Viana', 'Beatriz Castilho'];
      const sampleDest = ['Apto 602 • Bloco B', 'Apto 104 • Bloco A', 'Apto 1201 • Torre 1', 'Apto 304 • Bloco B'];
      const randomIdx = Math.floor(Math.random() * sampleNames.length);

      const now = new Date();
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const newEntry: AccessEntry = {
        id: `live-${Date.now()}`,
        personName: sampleNames[randomIdx],
        photoUrl: `https://images.unsplash.com/photo-${1534528741775 + randomIdx * 100}?w=120&auto=format&fit=crop&q=80`,
        authType: 'facial',
        authDetail: 'BioSync Facial 99.8% • Aprovado',
        timestamp: `${timeStr} (Agora)`,
        accessPoint: 'Catraca Principal 01',
        destination: sampleDest[randomIdx],
        type: 'Morador Residente',
      };

      setAccessLog((prev) => [newEntry, ...prev.slice(0, 24)]);

      // If condo is present, attempt background sync to Supabase
      if (currentCondominium?.id && !tableMissing) {
        conciergeService.createAccessEntry({
          condominium_id: currentCondominium.id,
          personName: sampleNames[randomIdx],
          authType: 'facial',
          authDetail: 'BioSync Facial 99.8% • Aprovado',
          accessPoint: 'Catraca Principal 01',
          destination: sampleDest[randomIdx],
          entryType: 'Morador Residente',
        });
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [isLiveLogActive, currentCondominium?.id, tableMissing]);

  const handleRemoteOpen = async () => {
    setGateUnlocked(true);
    setNotification({
      type: 'success',
      message: 'Comando de liberação remoto enviado: Portão da Clausura 01 Destravado com Sucesso!',
    });

    if (currentCondominium?.id) {
      await conciergeService.createAccessEntry({
        condominium_id: currentCondominium.id,
        personName: 'Operador da Portaria (Remoto)',
        authType: 'manual',
        authDetail: 'Abertura Remota Autorizada pelo Painel',
        accessPoint: 'Clausura de Veículos / Pedestres 01',
        destination: 'Acesso Geral',
        entryType: 'Abertura Remota Emergencial',
      });
    }

    setTimeout(() => {
      setGateUnlocked(false);
      setNotification(null);
    }, 4000);
  };


  const handleWhatsAppReminder = () => {
    setNotification({
      type: 'success',
      message: 'Notificação push via WhatsApp enviada para todos os moradores com pacotes no Smart Locker há mais de 48h.',
    });
    setTimeout(() => setNotification(null), 5000);
  };

  const handlePackageRegistered = (pkg: {
    unitNumber: string;
    recipientName: string;
    courier: string;
    trackingCode: string;
    lockerCompartment: string;
    size: 'Pequeno' | 'Médio' | 'Grande';
  }) => {
    setAwaitingPackages((prev) => prev + 1);
    setFreeLockers((prev) => Math.max(0, prev - 1));

    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const newEntry: AccessEntry = {
      id: `delivery-${Date.now()}`,
      personName: `Entregador (${pkg.courier})`,
      photoUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80',
      authType: 'manual' as any,
      authDetail: `Depósito no ${pkg.lockerCompartment} • Rastreio ${pkg.trackingCode}`,
      timestamp: `${timeStr} (Agora)`,
      accessPoint: 'Central de Smart Lockers',
      destination: `${pkg.unitNumber} (${pkg.recipientName})`,
      type: 'Liberação Temp. (15 min)',
    };

    setAccessLog((prev) => [newEntry, ...prev]);

    if (currentCondominium?.id && !tableMissing) {
      conciergeService.createAccessEntry({
        condominium_id: currentCondominium.id,
        personName: `Entregador (${pkg.courier})`,
        authType: 'manual',
        authDetail: `Depósito no ${pkg.lockerCompartment}`,
        accessPoint: 'Central de Smart Lockers',
        destination: pkg.unitNumber,
        entryType: 'Liberação Temp. (15 min)',
      });
    }

    setNotification({
      type: 'success',
      message: `Pacote da transportadora ${pkg.courier} armazenado com sucesso no ${pkg.lockerCompartment} para ${pkg.unitNumber}! Morador notificado com QR Code.`,
    });
    setTimeout(() => setNotification(null), 6000);
  };

  const handlePassCreated = (pass: VisitorPassData) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const newEntry: AccessEntry = {
      id: `visitor-${Date.now()}`,
      personName: pass.visitorName,
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
      authType: 'qr_code' as any,
      authDetail: `Código Token ${pass.tokenCode} • Pré-autorizado para ${pass.visitDate}`,
      timestamp: `${timeStr} (Pré-autorizado)`,
      accessPoint: 'Portaria Principal / Cancelas',
      destination: pass.unitNumber,
      type: 'Convidado QR Válido',
    };

    setAccessLog((prev) => [newEntry, ...prev]);

    setNotification({
      type: 'success',
      message: `Passe digital gerado com sucesso para ${pass.visitorName}! Token #${pass.tokenCode} emitido para ${pass.unitNumber}.`,
    });
    setTimeout(() => setNotification(null), 6000);
  };

  const filteredLogs = accessLog.filter((log) => {
    if (accessFilter === 'Moradores') return log.type === 'Morador Residente';
    if (accessFilter === 'Visitantes QR') return log.type === 'Convidado QR Válido';
    if (accessFilter === 'Entregadores') return log.type.includes('Liberação Temp');
    return true;
  });

  return (
    <div className="flex flex-col gap-5 pb-6" data-purpose="concierge-view">
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
              Portaria Virtual & Controle de Acessos
            </h2>
            <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
              {currentCondominium?.name || 'Condomínio'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Monitoramento facial BioSync AI, clausuras inteligentes, smart lockers e auditoria em tempo real
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsVisitorModalOpen(true)}
            className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition duration-150 flex items-center gap-1.5 cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>+ Pré-Autorizar Visitante</span>
          </button>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200/50 dark:border-emerald-800/60">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Catracas & Câmeras Conectadas (Online)
          </span>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* CARD 1: Portaria BioSync AI */}
        <section className="col-span-12 lg:col-span-7 bg-white dark:bg-slate-900 rounded-4xl p-6 lg:p-7 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">Portaria BioSync AI</h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px] tracking-wide border border-emerald-200 dark:border-emerald-800">
                    ONLINE
                  </span>
                </div>
                <p className="text-xs text-slate-400">Reconhecimento Facial & Catracas Automatizadas</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-3 py-1.5 rounded-full hidden sm:inline-block">
              Portão Principal 01
            </span>
          </div>

          {/* Numbers with crisp dark contrast */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 my-6">
            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-3xl p-4 border border-slate-100 dark:border-slate-700/60">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Acessos Auditados
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">432</span>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">+14% hoje</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Zero filas registradas</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-3xl p-4 border border-slate-100 dark:border-slate-700/60">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Reconhecimento Facial
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">99.4%</span>
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">Instantâneo (&lt;0.3s)</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-3xl p-4 border border-slate-100 dark:border-slate-700/60 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Câmera LPR Veículos
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">128</span>
                <span className="text-[11px] text-slate-400 font-medium">veículos</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Portão Veicular 1 & 2</p>
            </div>
          </div>

          {/* Hardware Banner with Remote Open Action & Crisp Dark Mode Contrast */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white dark:from-emerald-950/70 dark:via-slate-800 dark:to-slate-900 rounded-3xl p-4 border border-emerald-100/60 dark:border-emerald-800/60 flex items-center justify-between flex-wrap sm:flex-nowrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Portões de clausura & biometria calibrados</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Última sincronização há 12 segundos com servidores locais</p>
              </div>
            </div>
            <button
              onClick={handleRemoteOpen}
              className={`px-4 py-2 font-bold text-xs rounded-full border shadow-sm transition-all cursor-pointer flex items-center gap-1.5 ${
                gateUnlocked
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-700 border-emerald-200 dark:border-emerald-700'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>{gateUnlocked ? 'Portão Aberto!' : 'Abrir Remoto'}</span>
            </button>
          </div>
        </section>

        {/* CARD 2: Smart Lockers de Encomendas */}
        <section className="col-span-12 lg:col-span-5 bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 dark:bg-none dark:bg-slate-900 text-white rounded-4xl p-6 lg:p-7 shadow-lg shadow-emerald-900/10 dark:shadow-xl dark:shadow-slate-900/10 flex flex-col justify-between relative overflow-hidden border border-emerald-400/30 dark:border-slate-800">
          <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-emerald-400/20 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 dark:bg-white/10 flex items-center justify-center text-white dark:text-emerald-400">
                  <Package className="w-5 h-5 text-white dark:text-emerald-400" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-200 dark:text-emerald-400">
                    Armários Inteligentes
                  </span>
                  <h3 className="text-lg font-bold text-white leading-tight">Smart Lockers</h3>
                </div>
              </div>
              <span className="text-xs px-3 py-1 bg-white/20 dark:bg-white/10 rounded-full font-medium text-white dark:text-slate-300">Torre 1 & 2</span>
            </div>
            <p className="text-xs text-emerald-100 dark:text-slate-400 mb-6 leading-relaxed">
              Gavetas automatizadas conectadas à portaria. Notificação instantânea com QR Code de retirada para os moradores.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white/15 dark:bg-white/5 rounded-3xl p-4 border border-white/20 dark:border-white/10 backdrop-blur-md dark:backdrop-blur-none">
                <span className="text-[10px] text-emerald-100 dark:text-slate-400 uppercase font-semibold">Aguardando Retirada</span>
                <p className="text-3xl font-extrabold text-white mt-1">{awaitingPackages}</p>
                <span className="text-[11px] text-amber-200 dark:text-amber-400 font-semibold">3 pacotes &gt;48h</span>
              </div>
              <div className="bg-white/15 dark:bg-white/5 rounded-3xl p-4 border border-white/20 dark:border-white/10 backdrop-blur-md dark:backdrop-blur-none">
                <span className="text-[10px] text-emerald-100 dark:text-slate-400 uppercase font-semibold">Lockers Livres</span>
                <p className="text-3xl font-extrabold text-emerald-200 dark:text-emerald-400 mt-1">
                  {String(freeLockers).padStart(2, '0')}
                </p>
                <span className="text-[11px] text-emerald-100/90 dark:text-slate-400 font-medium">De 32 compartimentos</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 relative z-10">
            <button
              onClick={() => setIsPackageModalOpen(true)}
              className="flex-1 py-3 px-4 bg-white hover:bg-emerald-50 text-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:text-white rounded-full font-bold text-xs flex items-center justify-center gap-2 shadow-md dark:shadow-lg dark:shadow-emerald-600/30 transition duration-150 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Pacote</span>
            </button>
            <button
              onClick={handleWhatsAppReminder}
              className="py-3 px-4 bg-white/20 hover:bg-white/30 text-white dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full font-bold text-xs flex items-center justify-center gap-2 transition duration-150 cursor-pointer border border-white/30 dark:border-slate-700"
            >
              Push WhatsApp
            </button>
          </div>
        </section>

        {/* CARD 3: Gráfico Dinâmico de Fluxo de Acesso por Horário */}
        <section className="col-span-12 bg-white dark:bg-slate-900 rounded-4xl p-6 lg:p-7 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <DynamicTelemetryChart
            title="Fluxo Dinâmico de Acessos & Portaria"
            subtitle="Monitoramento em tempo real do tráfego de moradores, visitantes QR e prestadores"
            primaryLabel="Moradores Residentes"
            secondaryLabel="Prestadores & Visitantes QR"
            primaryColor="#0D9488"
            secondaryColor="#FB923C"
            defaultPeriod="dia"
            height={210}
            unitLabel="acessos"
          />
        </section>

        {/* CARD 4: Log em Tempo Real de Acessos Recentes (Permissão Restrita: Super Admin / Síndico ou Porteiro autorizado) */}
        {canViewAccessLogs ? (
          <section className="col-span-12 bg-white dark:bg-slate-900 rounded-4xl p-6 lg:p-7 border border-slate-100 dark:border-slate-800 shadow-sm" data-purpose="access-log-feed">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Log em Tempo Real de Acessos Recentes</h3>
                    {isLiveLogActive ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Pausado</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsLiveLogActive((prev) => !prev)}
                      className="ml-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 underline cursor-pointer"
                    >
                      {isLiveLogActive ? 'Pausar' : 'Retomar'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">Captura de foto biométrica instantânea nas cancelas e catracas</p>
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                {(['Todos', 'Moradores', 'Visitantes QR', 'Entregadores'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setAccessFilter(filter)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
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
                description="Nenhum registro de acesso corresponde ao filtro selecionado."
                actionLabel="Ver Todos os Acessos"
                onAction={() => setAccessFilter('Todos')}
                className="my-6"
              />
            ) : (
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <th className="py-3 px-4">Pessoa Identificada</th>
                      <th className="py-3 px-4">Horário / Ponto</th>
                      <th className="py-3 px-4">Destino</th>
                      <th className="py-3 px-4">Tipo & Liberação</th>
                      <th className="py-3 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {filteredLogs.map((log) => {
                      const isResident = log.type === 'Morador Residente';
                      const isGuest = log.type === 'Convidado QR Válido';

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                alt={log.personName}
                                className={`w-9 h-9 rounded-full object-cover ring-2 ${
                                  isResident ? 'ring-emerald-500/30' : isGuest ? 'ring-slate-400' : 'ring-orange-400'
                                }`}
                                src={log.photoUrl}
                              />
                              <div>
                                <span className="font-bold text-slate-900 dark:text-slate-100 block">{log.personName}</span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-400">{log.authDetail}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300">
                            {log.timestamp}
                            <span className="block text-[11px] font-normal text-slate-400">{log.accessPoint}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{log.destination}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge variant={isResident ? 'emerald' : isGuest ? 'sky' : 'amber'} dot>
                              {log.type}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => alert(`Detalhes da auditoria biométrica: ${log.personName} às ${log.timestamp} em ${log.accessPoint}`)}
                              className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
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
          <section className="col-span-12 bg-white dark:bg-slate-900 rounded-4xl p-8 border border-dashed border-slate-200 dark:border-slate-800 text-center shadow-xs">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Log em Tempo Real Restrito
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
              Os registros de auditoria em tempo real estão configurados para visualização exclusiva do Síndico e Super Administrador. Para ter acesso, solicite a concessão em "Configurações &gt; Usuários &amp; Privilégios".
            </p>
          </section>
        )}
      </div>

      {/* Modal de Registro de Pacotes e Encomendas */}
      <PackageDeliveryModal
        isOpen={isPackageModalOpen}
        onClose={() => setIsPackageModalOpen(false)}
        onPackageRegistered={handlePackageRegistered}
      />

      {/* Modal de Pré-Autorização e Passe QR do Visitante */}
      <CreateVisitorPassModal
        isOpen={isVisitorModalOpen}
        onClose={() => setIsVisitorModalOpen(false)}
        onPassCreated={handlePassCreated}
      />
    </div>
  );
};
