import React, { useEffect, useState } from 'react';
import {
  Building2,
  ArrowRight,
  Wallet,
  Wrench,
  CalendarClock,
  Package,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  QrCode,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { unitService } from '../../services/unitService';
import { invoiceService } from '../../services/invoiceService';
import { maintenanceService } from '../../services/maintenanceService';
import { amenityService } from '../../services/amenityService';
import { packageService } from '../../services/packageService';
import { bankAccountService, isValidPixKeyConfigured } from '../../services/bankAccountService';
import type { NavigationTab } from '../../types/condominium';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';

interface CondoPortfolioMetrics {
  condoId: string;
  condoName: string;
  cnpj: string | null;
  cityState: string;
  role: string;
  unitsCount: number;
  totalBilled: number;
  totalPaid: number;
  overdueAmount: number;
  complianceRate: number;
  pendingReservations: number;
  openOrders: number;
  awaitingPackages: number;
  pixConfigured: boolean;
}

export interface PortfolioViewProps {
  onOpenCondominium: (condoId: string, tab?: NavigationTab) => void;
}

/**
 * Visão Carteira Executiva Multi-Condomínio (SaaS Premium)
 * Permite que a síndica acompanhe seus 3–4+ condomínios lado a lado com indicadores reais
 * e alterne para o painel de qualquer condomínio com 1 clique.
 */
export const PortfolioView: React.FC<PortfolioViewProps> = ({ onOpenCondominium }) => {
  const { memberships, currentCondominium, profile } = useAuth();
  const [items, setItems] = useState<CondoPortfolioMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPortfolio = async () => {
    if (memberships.length === 0) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const results = await Promise.all(
      memberships.map(async (m) => {
        const condo = m.condominium;
        const [unitsRes, invRes, ordersRes, resRes, pkgRes, bankRes] = await Promise.all([
          unitService.getUnitsByCondominium(condo.id),
          invoiceService.getInvoicesByCondominium(condo.id),
          maintenanceService.getOrdersByCondominium(condo.id),
          amenityService.getReservations(condo.id),
          packageService.getPackagesByCondominium(condo.id),
          bankAccountService.fetchSettings(condo.id, condo.name, condo.cnpj),
        ]);

        const invoices = invRes.data || [];
        const totalBilled = invoices.reduce((acc, i) => acc + i.amount, 0);
        const paidInvoices = invoices.filter(
          (i) => i.status === 'liquidated' || i.status === 'advance'
        );
        const totalPaid = paidInvoices.reduce((acc, i) => acc + i.amount, 0);
        const overdueAmount = invoices
          .filter((i) => i.status === 'overdue')
          .reduce((acc, i) => acc + i.amount, 0);
        const complianceRate =
          invoices.length > 0 ? Math.round((paidInvoices.length / invoices.length) * 100) : 0;

        const openOrders = (ordersRes.data || []).filter(
          (o) => o.statusType !== 'completed' && o.statusType !== 'certified'
        ).length;

        const pendingReservations = (resRes.data || []).filter(
          (r) => r.statusType === 'warning'
        ).length;

        const awaitingPackages = (pkgRes.data || []).filter((p) => p.status === 'awaiting').length;

        return {
          condoId: condo.id,
          condoName: condo.name,
          cnpj: condo.cnpj,
          cityState: [condo.city, condo.state].filter(Boolean).join(' - ') || 'Brasil',
          role: m.membership.role,
          unitsCount: (unitsRes.data || []).length,
          totalBilled,
          totalPaid,
          overdueAmount,
          complianceRate,
          pendingReservations,
          openOrders,
          awaitingPackages,
          pixConfigured: isValidPixKeyConfigured(bankRes.data),
        };
      })
    );

    setItems(results);
    setIsLoading(false);
  };

  useEffect(() => {
    loadPortfolio();
  }, [memberships]);

  const totals = items.reduce(
    (acc, cur) => ({
      units: acc.units + cur.unitsCount,
      billed: acc.billed + cur.totalBilled,
      paid: acc.paid + cur.totalPaid,
      overdue: acc.overdue + cur.overdueAmount,
      openOrders: acc.openOrders + cur.openOrders,
      pendingReservations: acc.pendingReservations + cur.pendingReservations,
    }),
    { units: 0, billed: 0, paid: 0, overdue: 0, openOrders: 0, pendingReservations: 0 }
  );

  return (
    <div className="flex flex-col gap-6 pb-6 min-w-0" data-purpose="portfolio-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/70 dark:border-slate-800 shadow-soft">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              Carteira de Condomínios
            </h1>
            <Badge variant="emerald" dot>
              {memberships.length} condomínios sob gestão
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Visão consolidada de {profile?.full_name || 'Gestão'} — cada condomínio permanece isolado em banco de dados e finanças.
          </p>
        </div>

        <button
          type="button"
          onClick={loadPortfolio}
          disabled={isLoading}
          className="self-start sm:self-auto px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Atualizar Carteira</span>
        </button>
      </div>

      {/* KPI Consolidado */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/70 dark:border-slate-800 shadow-soft">
          <span className="text-[11px] font-bold uppercase text-slate-400 block">Unidades na Carteira</span>
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 block tabular-nums">
            {totals.units}
          </span>
          <span className="text-[11px] text-slate-400">Em {memberships.length} condomínios</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/70 dark:border-slate-800 shadow-soft">
          <span className="text-[11px] font-bold uppercase text-slate-400 block">Receita Liquidada</span>
          <span className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block tabular-nums">
            {totals.paid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
          <span className="text-[11px] text-slate-400 tabular-nums">
            De {totals.billed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} emitidos
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/70 dark:border-slate-800 shadow-soft">
          <span className="text-[11px] font-bold uppercase text-slate-400 block">Em Atraso Total</span>
          <span className="text-xl sm:text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1 block tabular-nums">
            {totals.overdue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
          <span className="text-[11px] text-slate-400">Consolidado da carteira</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/70 dark:border-slate-800 shadow-soft">
          <span className="text-[11px] font-bold uppercase text-slate-400 block">Pendências Operacionais</span>
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 block tabular-nums">
            {totals.openOrders + totals.pendingReservations}
          </span>
          <span className="text-[11px] text-slate-400">
            {totals.openOrders} OS • {totals.pendingReservations} reserva(s)
          </span>
        </div>
      </div>

      {/* Cards individuais de cada Condomínio */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {Array.from({ length: Math.max(2, memberships.length) }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {items.map((item) => {
            const isActive = currentCondominium?.id === item.condoId;
            return (
              <article
                key={item.condoId}
                className={`bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border shadow-soft flex flex-col justify-between transition ${
                  isActive
                    ? 'border-emerald-500 ring-2 ring-emerald-500/15'
                    : 'border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 truncate">
                            {item.condoName}
                          </h2>
                          {isActive && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                              Ativo
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {item.cnpj || 'CNPJ não informado'} • {item.cityState}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 inline-flex items-center gap-1 ${
                        item.pixConfigured
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {item.pixConfigured ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> Pix OK
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3 h-3" /> Pix Pendente
                        </>
                      )}
                    </span>
                  </div>

                  {/* Métricas do Condomínio */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-5">
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                      <span className="text-[10px] text-slate-400 font-semibold block">Unidades</span>
                      <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                        {item.unitsCount}
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                      <span className="text-[10px] text-slate-400 font-semibold block">Adimplência</span>
                      <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {item.totalBilled > 0 ? `${item.complianceRate}%` : '—'}
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                      <span className="text-[10px] text-slate-400 font-semibold block">OS Abertas</span>
                      <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                        {item.openOrders}
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                      <span className="text-[10px] text-slate-400 font-semibold block">Aprovar Res.</span>
                      <span className="text-base font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                        {item.pendingReservations}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 pb-3">
                    <span className="inline-flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                      Liquidado:{' '}
                      <strong className="text-slate-800 dark:text-slate-200 tabular-nums">
                        {item.totalPaid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-slate-400" />
                      {item.awaitingPackages} encomenda(s)
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenCondominium(item.condoId, 'finance')}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <QrCode className="w-3 h-3 text-emerald-600" />
                      <span>Financeiro</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenCondominium(item.condoId, 'reservations')}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <CalendarClock className="w-3 h-3 text-amber-600" />
                      <span>Reservas</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenCondominium(item.condoId, 'maintenance')}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Wrench className="w-3 h-3 text-sky-600" />
                      <span>OS</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenCondominium(item.condoId, 'overview')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <span>Abrir Painel</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
