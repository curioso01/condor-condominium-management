import React, { useState, useEffect, useMemo } from 'react';
import { Radio, Calendar } from 'lucide-react';

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
  generator?: (
    period: ChartPeriod,
    customRange: { start: string; end: string },
    liveTick: number
  ) => ChartPeriodResult;
}

function generateSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
  let path = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;

    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return path;
}

export const DynamicTelemetryChart: React.FC<DynamicTelemetryChartProps> = ({
  title,
  subtitle,
  primaryLabel,
  secondaryLabel,
  primaryColor = '#0D9488', // Emerald
  secondaryColor = '#F59E0B', // Amber
  valueFormatter = (v) => v.toLocaleString('pt-BR'),
  defaultPeriod = 'mes',
  height = 200,
  unitLabel,
  generator,
}) => {
  const [period, setPeriod] = useState<ChartPeriod>(defaultPeriod);
  const [isRealTime, setIsRealTime] = useState(false);
  const [liveTick, setLiveTick] = useState(0);

  // Custom date picker range
  const todayIso = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgoIso = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [customStart, setCustomStart] = useState(thirtyDaysAgoIso);
  const [customEnd, setCustomEnd] = useState(todayIso);

  // Interval for real-time telemetry updates
  useEffect(() => {
    if (!isRealTime) return;
    const interval = setInterval(() => {
      setLiveTick((t) => t + 1);
    }, 2800);
    return () => clearInterval(interval);
  }, [isRealTime]);

  // Default dataset generator if not provided
  const chartData = useMemo(() => {
    if (generator) {
      return generator(period, { start: customStart, end: customEnd }, liveTick);
    }

    // Built-in dynamic generator
    let count = 7;
    let xLabels: string[] = [];
    let peakLabel = '';
    let peakValue = 0;
    let peakDetail = '';

    const jitter = isRealTime ? Math.sin(liveTick * 0.8) * 8 : 0;

    switch (period) {
      case 'dia':
        xLabels = ['00:00', '04:00', '08:00', '12:00', '16:00', '19:00', '23:59'];
        count = 7;
        peakLabel = 'Pico às 18:30';
        peakValue = 78 + Math.round(jitter);
        peakDetail = 'Horário de pico de retorno';
        break;
      case 'quinzena':
        xLabels = ['Dia 1', 'Dia 3', 'Dia 6', 'Dia 9', 'Dia 12', 'Dia 15'];
        count = 6;
        peakLabel = 'Pico no 10º Dia';
        peakValue = 240 + Math.round(jitter * 2);
        peakDetail = 'Concentração de vencimentos';
        break;
      case 'mes':
        xLabels = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'];
        count = 4;
        peakLabel = 'Pico na Semana 2';
        peakValue = 480 + Math.round(jitter * 3);
        peakDetail = 'Fechamento da taxa condominial';
        break;
      case 'semestral':
        xLabels = ['Mês 1', 'Mês 2', 'Mês 3', 'Mês 4', 'Mês 5', 'Mês 6'];
        count = 6;
        peakLabel = 'Pico no Mês 4';
        peakValue = 920 + Math.round(jitter * 4);
        peakDetail = 'Maior taxa de arrecadação semestral';
        break;
      case 'anual':
        xLabels = ['Jan', 'Mar', 'Mai', 'Jul', 'Set', 'Nov', 'Dez'];
        count = 7;
        peakLabel = 'Pico em Dezembro';
        peakValue = 1840 + Math.round(jitter * 5);
        peakDetail = 'Arrecadação 13º e manutenções prediais';
        break;
      case 'personalizado':
        xLabels = [customStart.slice(5), 'Período Central', customEnd.slice(5)];
        count = 5;
        peakLabel = 'Pico no intervalo selecionado';
        peakValue = 650 + Math.round(jitter * 2);
        peakDetail = `${customStart} até ${customEnd}`;
        break;
    }

    // Generate dynamic curve points
    const points: ChartDataPoint[] = [];
    for (let i = 0; i < count; i++) {
      const progress = i / (count - 1 || 1);
      // Curve formula that changes dynamically based on period
      const seed =
        period === 'dia'
          ? Math.sin(progress * Math.PI) * 0.9 + 0.1
          : period === 'quinzena'
          ? Math.sin(progress * Math.PI * 1.5) * 0.4 + 0.5
          : period === 'semestral'
          ? Math.sin(progress * Math.PI * 0.8) * 0.8 + 0.2
          : period === 'anual'
          ? 0.3 + progress * 0.6 + Math.sin(progress * 4) * 0.1
          : Math.sin(progress * Math.PI) * 0.85 + 0.15;

      const noise = isRealTime ? (Math.sin(liveTick + i) * 0.08) : 0;
      const primaryVal = Math.max(10, Math.round(peakValue * Math.max(0.15, seed + noise)));
      const secondaryVal = secondaryLabel ? Math.max(5, Math.round(primaryVal * 0.65)) : undefined;

      points.push({
        label: xLabels[i] || `P${i + 1}`,
        primaryValue: primaryVal,
        secondaryValue: secondaryVal,
        tooltipDetail: `Registro: ${primaryVal}`,
      });
    }

    return {
      points,
      peakLabel,
      peakValue,
      peakDetail,
      xLabels,
    };
  }, [generator, period, customStart, customEnd, liveTick, isRealTime, secondaryLabel]);

  // SVG coordinate transformation
  const svgWidth = 700;
  const svgHeight = height;
  const paddingX = 20;
  const paddingTop = 25;
  const paddingBottom = 35;
  const graphW = svgWidth - paddingX * 2;
  const graphH = svgHeight - paddingTop - paddingBottom;

  const maxVal = useMemo(() => {
    let m = chartData.peakValue;
    chartData.points.forEach((p) => {
      if (p.primaryValue > m) m = p.primaryValue;
      if (p.secondaryValue && p.secondaryValue > m) m = p.secondaryValue;
    });
    return Math.max(m * 1.15, 10);
  }, [chartData]);

  // Calculate coordinates
  const primaryCoords = useMemo(() => {
    return chartData.points.map((p, i) => {
      const x = paddingX + (i / (chartData.points.length - 1 || 1)) * graphW;
      const y = paddingTop + graphH - (p.primaryValue / maxVal) * graphH;
      return { x, y, val: p.primaryValue, label: p.label };
    });
  }, [chartData, maxVal, graphW, graphH, paddingX, paddingTop]);

  const secondaryCoords = useMemo(() => {
    if (!secondaryLabel) return [];
    return chartData.points.map((p, i) => {
      const val = p.secondaryValue || 0;
      const x = paddingX + (i / (chartData.points.length - 1 || 1)) * graphW;
      const y = paddingTop + graphH - (val / maxVal) * graphH;
      return { x, y, val, label: p.label };
    });
  }, [chartData, maxVal, secondaryLabel, graphW, graphH, paddingX, paddingTop]);

  // Find peak coordinate
  const peakCoord = useMemo(() => {
    if (primaryCoords.length === 0) return { x: 350, y: 50 };
    let highest = primaryCoords[0];
    primaryCoords.forEach((c) => {
      if (c.y < highest.y) highest = c;
    });
    return highest;
  }, [primaryCoords]);

  // Generate SVG curve strings
  const primaryCurve = useMemo(() => generateSmoothPath(primaryCoords), [primaryCoords]);
  const primaryArea = useMemo(() => {
    if (primaryCoords.length === 0) return '';
    const lastX = primaryCoords[primaryCoords.length - 1].x;
    const firstX = primaryCoords[0].x;
    const bottomY = paddingTop + graphH;
    return `${primaryCurve} L ${lastX.toFixed(1)},${bottomY.toFixed(1)} L ${firstX.toFixed(1)},${bottomY.toFixed(1)} Z`;
  }, [primaryCurve, primaryCoords, paddingTop, graphH]);

  const secondaryCurve = useMemo(() => generateSmoothPath(secondaryCoords), [secondaryCoords]);
  const secondaryArea = useMemo(() => {
    if (secondaryCoords.length === 0) return '';
    const lastX = secondaryCoords[secondaryCoords.length - 1].x;
    const firstX = secondaryCoords[0].x;
    const bottomY = paddingTop + graphH;
    return `${secondaryCurve} L ${lastX.toFixed(1)},${bottomY.toFixed(1)} L ${firstX.toFixed(1)},${bottomY.toFixed(1)} Z`;
  }, [secondaryCurve, secondaryCoords, paddingTop, graphH]);

  // Peak percent for CSS tooltip positioning
  const peakPercentX = useMemo(() => {
    return Math.min(Math.max((peakCoord.x / svgWidth) * 100, 15), 85);
  }, [peakCoord, svgWidth]);

  const periodsList: { key: ChartPeriod; label: string }[] = [
    { key: 'dia', label: 'Dia' },
    { key: 'quinzena', label: 'Quinzena' },
    { key: 'mes', label: 'Mês' },
    { key: 'semestral', label: 'Semestral' },
    { key: 'anual', label: 'Anual' },
    { key: 'personalizado', label: 'Personalizado' },
  ];

  return (
    <div className="flex flex-col justify-between w-full" data-purpose="dynamic-telemetry-chart">
      {/* Chart Header & Controls */}
      <div className="flex flex-col gap-2.5 mb-3.5 w-full">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">{title}</h3>
              {isRealTime && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700/60 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  AO VIVO
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Real-time Toggle Button */}
          <button
            type="button"
            onClick={() => setIsRealTime((prev) => !prev)}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border shrink-0 ${
              isRealTime
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-pill'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
            title="Ativar atualização streaming em tempo real"
          >
            <Radio className={`w-3 h-3 ${isRealTime ? 'animate-pulse text-white' : 'text-slate-400'}`} />
            <span>{isRealTime ? 'Ao Vivo' : 'Tempo Real'}</span>
          </button>

          {/* Period Selector Pills */}
          <div
            className="bg-slate-100 dark:bg-slate-800/90 p-0.5 rounded-xl flex items-center gap-0.5 border border-slate-200/80 dark:border-slate-700 overflow-x-auto max-w-full"
            role="group"
            aria-label="Filtro de período do gráfico"
          >
            {periodsList.map((p) => {
              const active = period === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setPeriod(p.key);
                  }}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Custom Date Range Popover / Bar when 'personalizado' is active */}
      {period === 'personalizado' && (
        <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Intervalo Personalizado:</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-1">
              <span className="text-slate-500 text-[11px]">De:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-500 text-[11px]">Até:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                // Trigger a re-render tick
                setLiveTick((t) => t + 1);
              }}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors cursor-pointer text-xs"
            >
              Filtrar
            </button>
          </div>
        </div>
      )}

      {/* SVG Canvas with Dynamic Interactive Curves */}
      <div className="relative w-full my-2" style={{ height: `${height}px` }}>
        {/* Dynamic Peak Tooltip */}
        <div
          className="absolute -top-2 -translate-x-1/2 z-20 pointer-events-none transition-all duration-500 drop-shadow-md"
          style={{ left: `${peakPercentX}%` }}
        >
          <div className="bg-slate-900 dark:bg-slate-950 text-white px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>
              {chartData.peakLabel}: {valueFormatter(chartData.peakValue)} {unitLabel || ''}
            </span>
          </div>
          <div className="w-2 h-2 bg-slate-900 dark:bg-slate-950 rotate-45 mx-auto -mt-1 border-r border-b border-slate-700" />
        </div>

        <svg
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        >
          <defs>
            <linearGradient id={`gradPrimary-${title.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primaryColor} stopOpacity="0.30" />
              <stop offset="70%" stopColor={primaryColor} stopOpacity="0.05" />
              <stop offset="100%" stopColor={primaryColor} stopOpacity="0.0" />
            </linearGradient>
            {secondaryLabel && (
              <linearGradient id={`gradSec-${title.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={secondaryColor} stopOpacity="0.18" />
                <stop offset="100%" stopColor={secondaryColor} stopOpacity="0.0" />
              </linearGradient>
            )}
          </defs>

          {/* Grid lines */}
          <line
            stroke="currentColor"
            className="text-slate-100 dark:text-slate-800/80"
            strokeDasharray="4 4"
            strokeWidth="1.2"
            x1="0"
            x2={svgWidth}
            y1={paddingTop + graphH * 0.25}
            y2={paddingTop + graphH * 0.25}
          />
          <line
            stroke="currentColor"
            className="text-slate-100 dark:text-slate-800/80"
            strokeDasharray="4 4"
            strokeWidth="1.2"
            x1="0"
            x2={svgWidth}
            y1={paddingTop + graphH * 0.6}
            y2={paddingTop + graphH * 0.6}
          />
          <line
            stroke="currentColor"
            className="text-slate-100 dark:text-slate-800/80"
            strokeDasharray="4 4"
            strokeWidth="1.2"
            x1="0"
            x2={svgWidth}
            y1={paddingTop + graphH}
            y2={paddingTop + graphH}
          />

          {/* Secondary Series (if any) */}
          {secondaryLabel && secondaryCoords.length > 0 && (
            <>
              <path
                d={secondaryArea}
                fill={`url(#gradSec-${title.replace(/\s+/g, '')})`}
                className="transition-all duration-700 ease-out"
              />
              <path
                d={secondaryCurve}
                fill="none"
                stroke={secondaryColor}
                strokeDasharray="4 4"
                strokeLinecap="round"
                strokeWidth="2.2"
                className="transition-all duration-700 ease-out"
              />
            </>
          )}

          {/* Primary Series Area & Stroke */}
          <path
            d={primaryArea}
            fill={`url(#gradPrimary-${title.replace(/\s+/g, '')})`}
            className="transition-all duration-700 ease-out"
          />
          <path
            d={primaryCurve}
            fill="none"
            stroke={primaryColor}
            strokeLinecap="round"
            strokeWidth="3.2"
            className="transition-all duration-700 ease-out"
          />

          {/* Data Points / Circles */}
          {primaryCoords.map((c, i) => (
            <circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={i === primaryCoords.length - 1 && isRealTime ? 5 : 4}
              fill="#FFFFFF"
              stroke={primaryColor}
              strokeWidth="2.5"
              className="transition-all duration-700 ease-out"
            />
          ))}

          {/* Real-time Beacon on Last Point */}
          {isRealTime && primaryCoords.length > 0 && (
            <circle
              cx={primaryCoords[primaryCoords.length - 1].x}
              cy={primaryCoords[primaryCoords.length - 1].y}
              r="8"
              fill={primaryColor}
              opacity="0.3"
              className="animate-ping"
            />
          )}
        </svg>
      </div>

      {/* X-Axis Dynamic Labels */}
      <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800 px-1">
        {chartData.xLabels.map((lbl, idx) => (
          <span
            key={idx}
            className={idx === chartData.xLabels.length - 1 && isRealTime ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}
          >
            {lbl}
          </span>
        ))}
      </div>

      {/* Series Legend */}
      <div className="flex items-center justify-between pt-3 text-xs">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />
            {primaryLabel}
          </span>
          {secondaryLabel && (
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: secondaryColor }} />
              {secondaryLabel}
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          {chartData.peakDetail}
        </span>
      </div>
    </div>
  );
};
