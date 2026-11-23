import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { BarChart3 } from 'lucide-react';

export type ChartPeriod = 'dia' | 'quinzena' | 'mes' | 'semestral' | 'anual' | 'personalizado';

export interface ChartDataPoint {
  label: string;
  primaryValue: number;
  secondaryValue?: number;
  tooltipDetail?: string;
}

export interface ChartPeriodResult {
  points: ChartDataPoint[];
  peakLabel: string;
  peakValue: number;
  peakDetail: string;
  xLabels: string[];
}

export interface DynamicTelemetryChartProps {
  title: string;
  subtitle: string;
  primaryLabel: string;
  secondaryLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  valueFormatter?: (val: number) => string;
  defaultPeriod?: ChartPeriod;
  height?: number;
  unitLabel?: string;
  dataPoints?: ChartDataPoint[];
  emptyMessage?: string;
  generator?: (
    period: ChartPeriod,
    customRange: { start: string; end: string },
    liveTick: number
  ) => ChartPeriodResult;
}

/**
 * Gráfico Analítico Profissional (Recharts) alimentado exclusivamente por dados reais
 * do condomínio selecionado — sem curvas sintéticas (Math.sin) nem números inventados.
 */
export const DynamicTelemetryChart: React.FC<DynamicTelemetryChartProps> = ({
  title,
  subtitle,
  primaryLabel,
  secondaryLabel,
  primaryColor = '#059669',
  secondaryColor = '#F59E0B',
  valueFormatter = (v) => v.toLocaleString('pt-BR'),
  defaultPeriod = 'mes',
  height = 210,
  unitLabel = '',
  dataPoints,
  emptyMessage = 'Sem registros suficientes neste condomínio para exibir a série histórica.',
  generator,
}) => {
  const [period, setPeriod] = useState<ChartPeriod>(defaultPeriod);

  const todayIso = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgoIso = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const points: ChartDataPoint[] = useMemo(() => {
    if (Array.isArray(dataPoints)) {
      return dataPoints;
    }
    if (generator) {
      return generator(period, { start: thirtyDaysAgoIso, end: todayIso }, 0).points;
    }
    return [];
  }, [dataPoints, generator, period, thirtyDaysAgoIso, todayIso]);

  const hasNonZeroData = useMemo(
    () =>
      points.some(
        (p) => (p.primaryValue || 0) > 0 || (p.secondaryValue !== undefined && p.secondaryValue > 0)
      ),
    [points]
  );

  const peakPoint = useMemo(() => {
    if (!points.length) return null;
    return points.reduce((best, cur) =>
      cur.primaryValue > best.primaryValue ? cur : best
    );
  }, [points]);

  const primaryGradId = useMemo(
    () => `condor-grad-p-${title.replace(/\W+/g, '').slice(0, 12)}`,
    [title]
  );
  const secondaryGradId = useMemo(
    () => `condor-grad-s-${title.replace(/\W+/g, '').slice(0, 12)}`,
    [title]
  );

  return (
    <div className="flex flex-col gap-4 w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
            {title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap shrink-0">
          {peakPoint && hasNonZeroData && (
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Maior Registro ({peakPoint.label})
              </span>
              <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                {valueFormatter(peakPoint.primaryValue)}
                {unitLabel ? ` ${unitLabel}` : ''}
              </span>
            </div>
          )}

          {generator && !dataPoints && (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-[11px]">
              {(['dia', 'mes', 'anual'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-2 py-0.5 rounded-lg font-semibold capitalize transition cursor-pointer ${
                    period === p
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {p === 'mes' ? 'Mês' : p === 'dia' ? 'Dia' : 'Ano'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: primaryColor }}
            aria-hidden="true"
          />
          <span>{primaryLabel}</span>
        </span>
        {secondaryLabel && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: secondaryColor }}
              aria-hidden="true"
            />
            <span>{secondaryLabel}</span>
          </span>
        )}
      </div>

      {/* Chart or Empty State */}
      {!hasNonZeroData ? (
        <div
          style={{ minHeight: height }}
          className="w-full rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 flex flex-col items-center justify-center p-6 text-center gap-2"
        >
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
            <BarChart3 className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 max-w-xs">
            {emptyMessage}
          </p>
        </div>
      ) : (
        <div style={{ width: '100%', height }} className="min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id={primaryGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={primaryColor} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={primaryColor} stopOpacity={0.02} />
                </linearGradient>
                {secondaryLabel && (
                  <linearGradient id={secondaryGradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={secondaryColor} stopOpacity={0.22} />
                    <stop offset="95%" stopColor={secondaryColor} stopOpacity={0.02} />
                  </linearGradient>
                )}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                width={52}
                tickFormatter={(val) =>
                  typeof val === 'number' && val >= 1000
                    ? `${(val / 1000).toFixed(val >= 10000 ? 0 : 1)}k`
                    : String(val)
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#1E293B',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#F8FAFC',
                }}
                formatter={(value: any, name: any) => {
                  const formatted = valueFormatter(Number(value || 0));
                  const label = name === 'primaryValue' ? primaryLabel : secondaryLabel || name;
                  return [`${formatted}${unitLabel ? ` ${unitLabel}` : ''}`, label];
                }}
              />
              <Area
                type="monotone"
                dataKey="primaryValue"
                stroke={primaryColor}
                strokeWidth={2.5}
                fill={`url(#${primaryGradId})`}
                activeDot={{ r: 5 }}
              />
              {secondaryLabel && (
                <Area
                  type="monotone"
                  dataKey="secondaryValue"
                  stroke={secondaryColor}
                  strokeWidth={2}
                  fill={`url(#${secondaryGradId})`}
                  activeDot={{ r: 4 }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
