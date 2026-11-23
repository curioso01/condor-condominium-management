import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  DollarSign,
  ShieldCheck,
  CalendarCheck,
  Wrench,
  CheckCircle2,
  Printer,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { invoiceService } from '../../services/invoiceService';
import { conciergeService } from '../../services/conciergeService';
import { amenityService } from '../../services/amenityService';
import { maintenanceService } from '../../services/maintenanceService';
import { financialDataService } from '../../services/financialDataService';
import { printHtmlDocument, escapeHtml } from '../../utils/printDocument';
import type {
  Invoice,
  AccessEntry,
  AmenityReservation,
  MaintenanceOrder,
} from '../../types/condominium';

export interface ReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  condominiumName?: string;
}

type ReportType = 'financeiro' | 'portaria' | 'reservas' | 'manutencao';

export const ReportsModal: React.FC<ReportsModalProps> = ({
  isOpen,
  onClose,
  condominiumName = 'Condomínio Residencial',
}) => {
  const { currentCondominium } = useAuth();
  const [selectedReport, setSelectedReport] = useState<ReportType>('financeiro');
  const [period, setPeriod] = useState<'30dias' | 'mesAtual' | 'trimestre' | 'todos'>('mesAtual');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessEntry[]>([]);
  const [reservations, setReservations] = useState<AmenityReservation[]>([]);
  const [orders, setOrders] = useState<MaintenanceOrder[]>([]);
  const [reserveBalance, setReserveBalance] = useState<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !currentCondominium?.id) return;
    let cancelled = false;
    setIsLoading(true);

    Promise.all([
      invoiceService.getInvoicesByCondominium(currentCondominium.id),
      conciergeService.getAccessLogs(currentCondominium.id),
      amenityService.getReservations(currentCondominium.id),
      maintenanceService.getOrdersByCondominium(currentCondominium.id),
      financialDataService.loadCondominiumFinancials(currentCondominium.id),
    ]).then(([invRes, logRes, resRes, ordRes, finRes]) => {
      if (cancelled) return;
      setInvoices(invRes.data || []);
      setAccessLogs(logRes.data || []);
      setReservations(resRes.data || []);
      setOrders(ordRes.data || []);
      setReserveBalance(finRes.reserveFund.balance || 0);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, currentCondominium?.id]);

  const filterByDateIso = (isoDate?: string | null): boolean => {
    if (period === 'todos' || !isoDate) return true;
    const now = new Date();
    const target = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(target.getTime())) return true;

    if (period === 'mesAtual') {
      return target.getFullYear() === now.getFullYear() && target.getMonth() === now.getMonth();
    }
    const diffDays = (now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24);
    if (period === '30dias') return diffDays <= 30 && diffDays >= -30;
    if (period === 'trimestre') return diffDays <= 90 && diffDays >= -90;
    return true;
  };

  const reportData = useMemo(() => {
    const filteredInvoices = invoices.filter((i) => filterByDateIso(i.dueDateIso));
    const totalBilled = filteredInvoices.reduce((acc, i) => acc + i.amount, 0);
    const totalPaid = filteredInvoices
      .filter((i) => i.status === 'liquidated' || i.status === 'advance')
      .reduce((acc, i) => acc + i.amount, 0);
    const overdueCount = filteredInvoices.filter((i) => i.status === 'overdue').length;
    const defaultRate =
      filteredInvoices.length > 0
        ? ((overdueCount / filteredInvoices.length) * 100).toFixed(1)
        : '0.0';

    const filteredReservations = reservations.filter((r) => filterByDateIso(r.date));
    const totalRentalFees = filteredReservations.reduce((acc, r) => acc + (r.rentalFee || 0), 0);

    const filteredOrders = orders.filter((o) => filterByDateIso(o.scheduledDateIso));
    const completedOrders = filteredOrders.filter(
      (o) => o.statusType === 'completed' || o.statusType === 'certified'
    ).length;

    const configs: Record<
      ReportType,
      {
        title: string;
        description: string;
        icon: React.ReactNode;
        headers: string[];
        rows: string[][];
        summary: { label: string; value: string }[];
      }
    > = {
      financeiro: {
        title: 'Relatório Financeiro & Cobranças',
        description: 'Dados reais de boletos/Pix emitidos, liquidações e fundo de reserva do condomínio.',
        icon: <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
        headers: ['Unidade', 'Bloco', 'Morador', 'Descrição', 'Vencimento', 'Valor', 'Status'],
        rows: filteredInvoices.map((i) => [
          i.unitNumber,
          i.block,
          i.residentName,
          i.description,
          i.dueDate,
          i.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          i.statusLabel,
        ]),
        summary: [
          {
            label: 'Total Emitido',
            value: totalBilled.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          },
          {
            label: 'Total Liquidado',
            value: totalPaid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          },
          {
            label: 'Inadimplência / Reserva',
            value: `${defaultRate}% • ${reserveBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
          },
        ],
      },
      portaria: {
        title: 'Auditoria de Portaria & Acessos',
        description: 'Registros reais salvos em public.access_logs para o condomínio ativo.',
        icon: <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
        headers: ['Horário', 'Pessoa', 'Autenticação', 'Ponto de Acesso', 'Destino', 'Tipo'],
        rows: accessLogs.map((l) => [
          l.timestamp,
          l.personName,
          l.authDetail,
          l.accessPoint,
          l.destination,
          l.type,
        ]),
        summary: [
          { label: 'Total de Registros', value: `${accessLogs.length} eventos` },
          {
            label: 'Visitantes QR',
            value: `${accessLogs.filter((l) => l.authType === 'qr_code').length}`,
          },
          {
            label: 'Aberturas / Entregas',
            value: `${accessLogs.filter((l) => l.authType === 'manual' || l.authType === 'delivery').length}`,
          },
        ],
      },
      reservas: {
        title: 'Relatório de Reservas de Áreas Comuns',
        description: 'Reservas reais e taxas vinculadas para o condomínio selecionado.',
        icon: <CalendarCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
        headers: ['Espaço', 'Data', 'Responsável', 'Unidade', 'Taxa', 'Status'],
        rows: filteredReservations.map((r) => [
          r.spaceName || '—',
          r.dateStr || r.date || '—',
          r.responsibleName || '—',
          r.unitNumber || '—',
          (r.rentalFee || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          r.status || '—',
        ]),
        summary: [
          { label: 'Reservas no Período', value: `${filteredReservations.length}` },
          {
            label: 'Taxas Totais',
            value: totalRentalFees.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          },
          {
            label: 'Aguardando Aprovação',
            value: `${filteredReservations.filter((r) => r.statusType === 'warning').length}`,
          },
        ],
      },
      manutencao: {
        title: 'Relatório de Manutenções & Ordens de Serviço',
        description: 'Ordens de serviço reais registradas no condomínio ativo.',
        icon: <Wrench className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
        headers: ['Código', 'Título', 'Local', 'Prioridade', 'Agendamento', 'Status'],
        rows: filteredOrders.map((o) => [
          o.code,
          o.title,
          o.location,
          o.priority,
          o.scheduledTime,
          o.status,
        ]),
        summary: [
          { label: 'Total de OS', value: `${filteredOrders.length}` },
          { label: 'Concluídas / Laudo', value: `${completedOrders}` },
          {
            label: 'Taxa de Conclusão',
            value:
              filteredOrders.length > 0
                ? `${Math.round((completedOrders / filteredOrders.length) * 100)}%`
                : '0%',
          },
        ],
      },
    };

    return configs[selectedReport];
  }, [invoices, accessLogs, reservations, orders, reserveBalance, selectedReport, period]);

  if (!isOpen) return null;

  const handleExportCSV = () => {
    const BOM = '\uFEFF';
    const csvRows = [
      [`Relatório: ${reportData.title}`],
      [`Condomínio: ${currentCondominium?.name || condominiumName}`],
      [`Período: ${period}`],
      [`Emitido em: ${new Date().toLocaleString('pt-BR')}`],
      [],
      reportData.headers,
      ...reportData.rows,
    ];

    const csvContent =
      BOM +
      csvRows
        .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `condor_${selectedReport}_${period}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setFeedback(`Relatório CSV real exportado com ${reportData.rows.length} registro(s)!`);
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reports-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-slate-50/70 dark:bg-slate-900">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3
                  id="reports-modal-title"
                  className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100"
                >
                  Central de Relatórios &amp; Prestação de Contas
                </h3>
                <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                  {currentCondominium?.name || condominiumName}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Exportação direta dos registros reais do banco de dados para Excel/CSV e impressão
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 cursor-pointer"
            aria-label="Fechar relatórios"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {feedback && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Filters */}
        <div className="px-6 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
            {(
              [
                { id: 'financeiro', label: 'Financeiro' },
                { id: 'portaria', label: 'Portaria' },
                { id: 'reservas', label: 'Reservas' },
                { id: 'manutencao', label: 'Manutenção' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedReport(t.id)}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap ${
                  selectedReport === t.id
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-[11px] self-start sm:self-auto">
            {(
              [
                { id: 'mesAtual', label: 'Mês Atual' },
                { id: '30dias', label: '30 Dias' },
                { id: 'trimestre', label: '90 Dias' },
                { id: 'todos', label: 'Todos' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  period === p.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {reportData.summary.map((s) => (
              <div
                key={s.label}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60"
              >
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  {s.label}
                </span>
                <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-1 block tabular-nums">
                  {s.value}
                </span>
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-xs text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Consultando dados reais do condomínio...</span>
            </div>
          ) : reportData.rows.length === 0 ? (
            <div className="py-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
              Nenhum registro encontrado no banco de dados para esta categoria e período.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    {reportData.headers.map((h) => (
                      <th key={h} className="py-2.5 px-3 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {reportData.rows.slice(0, 25).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-[200px] truncate"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] text-slate-400">
            Exibindo até 25 linhas na prévia • CSV exporta todos os {reportData.rows.length} registros
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={reportData.rows.length === 0}
              onClick={() => {
                const headersHtml = reportData.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
                const rowsHtml = reportData.rows
                  .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
                  .join('');
                const body = `
                  <div class="wrap">
                    <div class="top">
                      <div>
                        <div class="kicker">CONDOR • RELATÓRIO OFICIAL</div>
                        <h1>${escapeHtml(reportData.title)}</h1>
                        <div class="sub">${escapeHtml(condominiumName)} • Emitido em ${escapeHtml(new Date().toLocaleString('pt-BR'))}</div>
                      </div>
                      <div class="count">${reportData.rows.length} registros</div>
                    </div>
                    <table>
                      <thead><tr>${headersHtml}</tr></thead>
                      <tbody>${rowsHtml}</tbody>
                    </table>
                  </div>
                `;
                const css = `
                  .wrap { padding: 4px; }
                  .top { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
                  .kicker { font-size: 9px; font-weight: 800; color: #059669; letter-spacing: 0.08em; }
                  h1 { margin: 2px 0; font-size: 18px; }
                  .sub { font-size: 11px; color: #475569; }
                  .count { font-size: 11px; font-weight: 800; background: #f1f5f9; padding: 5px 10px; border-radius: 999px; }
                  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
                  th { text-align: left; background: #f1f5f9; padding: 7px 8px; border-bottom: 1.5px solid #cbd5e1; font-weight: 800; text-transform: uppercase; font-size: 9.5px; }
                  td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
                  tr:nth-child(even) td { background: #f8fafc; }
                `;
                printHtmlDocument(`${reportData.title} — ${condominiumName}`, body, css);
              }}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / PDF</span>
            </button>
            <button
              type="button"
              disabled={reportData.rows.length === 0}
              onClick={handleExportCSV}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV (Excel)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
