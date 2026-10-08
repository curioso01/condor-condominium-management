import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';

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
  const [selectedReport, setSelectedReport] = useState<ReportType>('financeiro');
  const [period, setPeriod] = useState<'30dias' | 'mesAtual' | 'trimestre' | 'ano2026'>('mesAtual');
  const [isExporting, setIsExporting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const reportConfigs: Record<
    ReportType,
    {
      title: string;
      description: string;
      icon: React.ReactNode;
      headers: string[];
      previewRows: string[][];
      summary: { label: string; value: string }[];
    }
  > = {
    financeiro: {
      title: 'Relatório Financeiro & Balancete Sintético',
      description: 'Extrato de receitas condominiais, taxas extras, inadimplência e conciliação bancária.',
      icon: <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      headers: ['Competência', 'Receitas Previstas', 'Receitas Liquidadas', 'Inadimplência', 'Saldo Fundo de Reserva'],
      previewRows: [
        ['Outubro/2026', 'R$ 161.280,00', 'R$ 158.376,96', '1.8%', 'R$ 342.190,00'],
        ['Setembro/2026', 'R$ 161.280,00', 'R$ 157.900,00', '2.1%', 'R$ 334.800,00'],
        ['Agosto/2026', 'R$ 158.400,00', 'R$ 155.232,00', '2.0%', 'R$ 328.000,00'],
      ],
      summary: [
        { label: 'Taxa de Inadimplência', value: '1.8% (Excelente)' },
        { label: 'Fundo de Reserva Atual', value: 'R$ 342.190,00' },
        { label: 'Previsão de Superávit', value: '+ R$ 14.800/mês' },
      ],
    },
    portaria: {
      title: 'Auditoria de Portaria, Catracas & Acessos',
      description: 'Logs consolidados de biometria facial BioSync, passagens QR Code e entregas smart locker.',
      icon: <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      headers: ['Data/Hora', 'Pessoa Identificada', 'Método Autenticação', 'Ponto de Acesso', 'Destino / Unidade'],
      previewRows: [
        ['07/10/2026 14:32', 'Marina Alencar', 'BioSync Facial 99.8%', 'Catraca Principal 01', 'Apto 602 • Bloco B'],
        ['07/10/2026 14:15', 'Lucas Silveira', 'BioSync Facial 99.9%', 'Portão Garagem G1', 'Apto 104 • Bloco A'],
        ['07/10/2026 13:58', 'Carlos Prestador (Atlas)', 'QR Code Temporário', 'Portaria de Serviço', 'Casa de Máquinas'],
      ],
      summary: [
        { label: 'Total de Acessos Mês', value: '8.420 registros' },
        { label: 'Reconhecimento Facial', value: '98.5% sucesso' },
        { label: 'Entregas Smart Locker', value: '148 pacotes' },
      ],
    },
    reservas: {
      title: 'Relatório de Ocupação & Reservas de Espaços Comuns',
      description: 'Taxas de locação recolhidas, agenda para 60 dias e controle de limpeza/manutenção.',
      icon: <CalendarCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      headers: ['Espaço', 'Data da Reserva', 'Morador Responsável', 'Unidade', 'Taxa de Aluguel', 'Status'],
      previewRows: [
        ['Salão de Festas Principal', '15/10/2026', 'Carlos Mendes', 'Apto 104', 'R$ 150,00', 'Confirmada'],
        ['Espaço Gourmet Rooftop', '18/10/2026', 'Juliana Rios', 'Apto 203', 'R$ 100,00', 'Confirmada'],
        ['Churrasqueira 01', '24/10/2026', 'Roberto Silva', 'Apto 302', 'R$ 80,00', 'Confirmada'],
      ],
      summary: [
        { label: 'Taxas de Aluguel (60d)', value: 'R$ 2.430,00' },
        { label: 'Taxa de Ocupação Final de Semana', value: '84%' },
        { label: 'Conflitos Detectados', value: '0 (Prevenção Ativa)' },
      ],
    },
    manutencao: {
      title: 'Relatório de Manutenções & Ordens de Serviço',
      description: 'Acompanhamento de preventivas periódicas, SLAs e gastos com reparos prediais.',
      icon: <Wrench className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      headers: ['Código OS', 'Equipamento / Local', 'Categoria', 'Prestador Contratado', 'Custo Total', 'Status'],
      previewRows: [
        ['OS-2026-089', 'Elevador Social Torre 1', 'Preventiva', 'Atlas Schindler', 'R$ 1.450,00', 'Concluída'],
        ['OS-2026-092', 'Bomba de Recalque 02', 'Corretiva', 'HidroSul Engenharia', 'R$ 890,00', 'Em Andamento'],
        ['OS-2026-094', 'Portão Automático G1', 'Ajuste Fino', 'TecnoPort Automação', 'R$ 350,00', 'Concluída'],
      ],
      summary: [
        { label: 'OS Concluídas no Prazo', value: '94.2%' },
        { label: 'Investimento em Preventivas', value: 'R$ 18.600,00' },
        { label: 'Garantias Ativas', value: '12 equipamentos' },
      ],
    },
  };

  const currentConfig = reportConfigs[selectedReport];

  const handleExportCSV = () => {
    setIsExporting(true);

    setTimeout(() => {
      // Build CSV with UTF-8 BOM for Microsoft Excel Brazil compatibility
      const BOM = '\uFEFF';
      const rows = [
        [`Relatório: ${currentConfig.title}`],
        [`Condomínio: ${condominiumName}`],
        [`Período: ${period}`],
        [`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`],
        [],
        currentConfig.headers,
        ...currentConfig.previewRows,
      ];

      const csvContent = BOM + rows.map((row) => row.map((cell) => `"${cell}"`).join(';')).join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `condor_${selectedReport}_${period}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setIsExporting(false);
      setFeedback(`Arquivo CSV exportado com sucesso! Salvo para o período selecionado.`);
      setTimeout(() => setFeedback(null), 4000);
    }, 600);
  };

  const handlePrint = () => {
    window.print();
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
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-4xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-gradient-to-r from-slate-50/50 to-white dark:from-slate-900 dark:to-slate-800/60">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-extrabold flex items-center justify-center text-lg shadow-sm">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="reports-modal-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Central de Relatórios & Auditoria
                </h3>
                <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                  {condominiumName}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Exportação de dados auditados em CSV (Excel) e documentos oficiais para assembleia
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
            aria-label="Fechar relatórios"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Category & Period Selector */}
        <div className="px-6 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2 overflow-x-auto text-xs font-semibold pb-1">
            {(
              [
                { id: 'financeiro', label: 'Financeiro & Balancete' },
                { id: 'portaria', label: 'Portaria & Acessos' },
                { id: 'reservas', label: 'Reservas & Espaços' },
                { id: 'manutencao', label: 'Manutenção & OS' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedReport(t.id)}
                className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                  selectedReport === t.id
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold text-[11px]">Período:</span>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-full text-[11px]">
                {(
                  [
                    { id: '30dias', label: 'Últimos 30 Dias' },
                    { id: 'mesAtual', label: 'Mês Atual' },
                    { id: 'trimestre', label: 'Trimestre' },
                    { id: 'ano2026', label: 'Ano de 2026' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPeriod(p.id)}
                    className={`px-2.5 py-0.5 rounded-full font-semibold transition cursor-pointer ${
                      period === p.id
                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Formato: <strong>CSV / Excel Brasil (;)</strong>
            </span>
          </div>
        </div>

        {/* Report Preview Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{currentConfig.title}</h4>
              <p className="text-xs text-slate-400 mt-0.5">{currentConfig.description}</p>
            </div>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full shrink-0 border border-emerald-200 dark:border-emerald-800">
              Dados Consolidados
            </span>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {currentConfig.summary.map((s, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800"
              >
                <span className="text-[10px] text-slate-400 uppercase font-bold block">{s.label}</span>
                <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-1">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Table Preview */}
          <div className="border border-slate-100 dark:border-slate-800 rounded-2.5xl overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-800/80 px-4 py-2 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Amostra da Planilha a ser Baixada
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {currentConfig.headers.map((h, idx) => (
                      <th key={idx} className="py-2.5 px-4">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {currentConfig.previewRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="w-full sm:w-auto px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Versão para Impressão</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={isExporting}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Gerando Planilha...' : 'Baixar Planilha CSV'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 font-bold text-xs transition cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
