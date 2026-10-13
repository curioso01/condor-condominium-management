import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Plus, 
  Info,
  Clock,
  User,
  CheckCircle2
} from 'lucide-react';
import type { AmenityReservation } from '../../types/condominium';
import type { CommonArea } from '../../types/database.types';

export interface ReservationCalendarProps {
  reservations: AmenityReservation[];
  commonAreas: CommonArea[];
  onSelectDateToReserve: (dateIso: string) => void;
}

type DayStatus = 'free' | 'partial' | 'occupied';

interface CalendarDay {
  date: Date;
  dateIso: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  reservations: AmenityReservation[];
  status: DayStatus;
}

export const ReservationCalendar: React.FC<ReservationCalendarProps> = ({
  reservations,
  commonAreas,
  onSelectDateToReserve,
}) => {
  // Navigation base date: default to real current date/month
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedSpaceFilter, setSelectedSpaceFilter] = useState<string>('all');
  const [selectedDayIso, setSelectedDayIso] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });

  // Month navigation
  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const monthYearLabel = useMemo(() => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${months[currentDate.getMonth()]} de ${currentDate.getFullYear()}`;
  }, [currentDate]);

  // Combine spaces from commonAreas and reservations so the dropdown filter is always populated
  const filterSpacesList = useMemo(() => {
    const map = new Map<string, string>();
    commonAreas.forEach((a) => {
      if (a.name) map.set(a.name, a.id);
    });
    reservations.forEach((r) => {
      if (r.spaceName && !map.has(r.spaceName)) {
        map.set(r.spaceName, `space-${r.spaceName}`);
      }
    });
    if (map.size === 0) {
      ['Salão de Festas Principal', 'Espaço Gourmet & Churrasqueira', 'Quiosque Piscina', 'Academia & Espaço Fitness'].forEach((name, i) => {
        map.set(name, `fallback-${i}`);
      });
    }
    return Array.from(map.entries()).map(([name, id]) => ({ id, name }));
  }, [commonAreas, reservations]);

  // Filter reservations by selected space if applicable
  const activeReservations = useMemo(() => {
    if (selectedSpaceFilter === 'all') return reservations;
    return reservations.filter((r) => r.spaceName === selectedSpaceFilter);
  }, [reservations, selectedSpaceFilter]);

  // Map of dateIso -> AmenityReservation[]
  const reservationsByDate = useMemo(() => {
    const map = new Map<string, AmenityReservation[]>();
    activeReservations.forEach((r) => {
      // Find date: either r.date or try to parse from mock formats
      let iso = r.date;
      if (!iso && r.dateStr) {
        // Fallback for mock: check month
        if (r.dateStr.includes('Abr')) iso = '2026-04-25';
        else if (r.dateStr.includes('Out')) iso = '2026-10-10';
        else if (r.dateStr.includes('Set')) iso = '2026-09-26';
        else if (r.dateStr.includes('Nov')) iso = '2026-11-07';
      }

      if (iso) {
        const list = map.get(iso) || [];
        list.push(r);
        map.set(iso, list);
      }
    });
    return map;
  }, [activeReservations]);

  // Generate calendar grid
  const calendarDays = useMemo<CalendarDay[]>(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)
    const totalDaysInMonth = lastDayOfMonth.getDate();

    const days: CalendarDay[] = [];

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayRes = reservationsByDate.get(iso) || [];
      days.push({
        date: d,
        dateIso: iso,
        dayNumber: d.getDate(),
        isCurrentMonth: false,
        isToday: false,
        reservations: dayRes,
        status: dayRes.length === 0 ? 'free' : dayRes.length >= 2 ? 'occupied' : 'partial',
      });
    }

    // Current month days
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const d = new Date(year, month, day);
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayRes = reservationsByDate.get(iso) || [];

      let status: DayStatus = 'free';
      if (dayRes.length >= 2) {
        status = 'occupied';
      } else if (dayRes.length === 1) {
        status = 'partial';
      }

      days.push({
        date: d,
        dateIso: iso,
        dayNumber: day,
        isCurrentMonth: true,
        isToday:
          d.getDate() === new Date().getDate() &&
          d.getMonth() === new Date().getMonth() &&
          d.getFullYear() === new Date().getFullYear(),
        reservations: dayRes,
        status,
      });
    }

    // Next month padding to fill a 6-row or complete grid
    const remainingSlots = 42 - days.length;
    for (let i = 1; i <= remainingSlots && remainingSlots < 7; i++) {
      const d = new Date(year, month + 1, i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayRes = reservationsByDate.get(iso) || [];
      days.push({
        date: d,
        dateIso: iso,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: false,
        reservations: dayRes,
        status: dayRes.length === 0 ? 'free' : dayRes.length >= 2 ? 'occupied' : 'partial',
      });
    }

    return days;
  }, [currentDate, reservationsByDate]);

  // Selected day details
  const selectedDay = useMemo(() => {
    return calendarDays.find((d) => d.dateIso === selectedDayIso) || calendarDays[0];
  }, [calendarDays, selectedDayIso]);

  // Format readable title for selected day
  const formattedSelectedDay = useMemo(() => {
    if (!selectedDay) return '';
    try {
      const [y, m, d] = selectedDay.dateIso.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      });
    } catch {
      return selectedDay.dateIso;
    }
  }, [selectedDay]);

  return (
    <div className="bg-white rounded-3xl p-3 sm:p-6 border border-slate-100 shadow-soft flex flex-col gap-4 sm:gap-5 min-w-0">
      {/* Header and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-slate-100">
        <div className="min-w-0">
          <div className="flex items-start sm:items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0">
              <CalendarIcon className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                Calendário de Reservas <span className="hidden sm:inline">(Janela de 60 Dias)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Toque em um dia para ver a disponibilidade e reservar
              </p>
            </div>
          </div>
        </div>

        {/* Filter by Space */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label htmlFor="calendar-space-filter" className="text-xs font-semibold text-slate-500 whitespace-nowrap">
            Espaço:
          </label>
          <select
            id="calendar-space-filter"
            value={selectedSpaceFilter}
            onChange={(e) => setSelectedSpaceFilter(e.target.value)}
            className="flex-1 sm:flex-none min-w-0 px-3 py-2 sm:py-1.5 bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="all">Todos os Espaços</option>
            {filterSpacesList.map((space) => (
              <option key={space.id} value={space.name}>
                {space.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Calendar Controls & Color Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Month Switcher */}
        <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
          <button
            onClick={handlePrevMonth}
            className="p-2 sm:p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Mês Anterior"
            aria-label="Mês Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-slate-900 flex-1 sm:flex-none sm:min-w-[150px] text-center capitalize">
            {monthYearLabel}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-2 sm:p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Próximo Mês"
            aria-label="Próximo Mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Status Badges Legend */}
        <div className="flex items-center justify-center sm:justify-start gap-3 text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
            <span>Livre</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-xs" />
            <span>Parcial</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-xs" />
            <span>Ocupado</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid & Side Details Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full min-w-0">
        {/* Days Grid (Col 8) */}
        <div className="col-span-1 lg:col-span-8 w-full min-w-0 bg-slate-50/70 dark:bg-slate-800/40 p-2 sm:p-4 rounded-2xl sm:rounded-2.5xl border border-slate-200/80 dark:border-slate-800">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center mb-1.5 sm:mb-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, idx) => (
              <span key={day} className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider py-1">
                <span className="sm:hidden">{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][idx]}</span>
                <span className="hidden sm:inline">{day}</span>
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {calendarDays.map((day) => {
              const isSelected = selectedDayIso === day.dateIso;

              // Color styles according to requested status
              let dotColor = 'bg-emerald-500';

              if (day.status === 'occupied') {
                dotColor = 'bg-rose-500';
              } else if (day.status === 'partial') {
                dotColor = 'bg-amber-400';
              }

              return (
                <button
                  type="button"
                  key={day.dateIso}
                  onClick={() => setSelectedDayIso(day.dateIso)}
                  aria-label={`Dia ${day.dayNumber}: ${
                    day.status === 'free' ? 'livre' : day.status === 'partial' ? 'parcialmente ocupado' : 'ocupado'
                  }`}
                  aria-pressed={isSelected}
                  className={`aspect-square sm:aspect-auto sm:min-h-[72px] p-1 sm:p-2 rounded-xl sm:rounded-2xl border flex flex-col items-center justify-center sm:items-stretch sm:justify-between transition-all cursor-pointer relative ${
                    isSelected
                      ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-sm'
                      : day.isCurrentMonth
                      ? 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs'
                      : 'bg-slate-100/60 dark:bg-slate-800/30 border-slate-200/30 dark:border-slate-800/30 opacity-40 hover:opacity-75'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-center sm:justify-between w-full">
                    <span
                      className={`flex items-center justify-center text-xs font-bold leading-none ${
                        day.isToday
                          ? 'w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-emerald-600 text-white font-extrabold shadow-xs text-[11px]'
                          : isSelected
                          ? 'text-emerald-700 dark:text-emerald-300 font-extrabold'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {day.dayNumber}
                    </span>

                    {/* Status Dot */}
                    <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${dotColor} mt-0.5 sm:mt-0`} />
                  </div>

                  {/* Booking count or free label (somente telas maiores) */}
                  <div className="hidden sm:block mt-1">
                    {day.status === 'free' ? (
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block truncate">
                        Livre
                      </span>
                    ) : day.status === 'partial' ? (
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/60 px-1.5 py-0.5 rounded-md block truncate">
                        {day.reservations.length} {day.reservations.length === 1 ? 'reserva' : 'reservas'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-950/60 px-1.5 py-0.5 rounded-md block truncate">
                        Ocupado
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Details Panel (Col 4) */}
        <div className="col-span-1 lg:col-span-4 w-full min-w-0 bg-slate-50/70 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2.5xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Data Selecionada
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 capitalize mt-0.5">
                  {formattedSelectedDay}
                </h4>
              </div>

              {/* Status Indicator */}
              <span
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                  selectedDay?.status === 'free'
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : selectedDay?.status === 'partial'
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                }`}
              >
                {selectedDay?.status === 'free'
                  ? '🟢 Livre'
                  : selectedDay?.status === 'partial'
                  ? '🟡 Parcial'
                  : '🔴 Ocupado'}
              </span>
            </div>

            {/* List of reservations for the selected date */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Agendamentos no Dia ({selectedDay?.reservations.length || 0})
              </span>

              {selectedDay?.reservations.length === 0 ? (
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Nenhum evento agendado</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Todos os espaços comuns estão disponíveis para reserva nesta data.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {selectedDay?.reservations.map((res) => (
                    <div
                      key={res.id}
                      className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span>{res.emoji}</span>
                          <span>{res.spaceName}</span>
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/50">
                          {res.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{res.startTime && res.endTime ? `${res.startTime} às ${res.endTime}` : res.dateStr}</span>
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{res.responsibleName} ({res.unitNumber})</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action CTA */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 mt-4">
            <button
              type="button"
              onClick={() => onSelectDateToReserve(selectedDay?.dateIso || '')}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-pill transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Plus className="w-4 h-4" />
              <span>Reservar Espaço em {selectedDay?.dateIso.split('-')[2]}/{selectedDay?.dateIso.split('-')[1]}</span>
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-2 flex items-center justify-center gap-1">
              <Info className="w-3 h-3" />
              <span>Abre o formulário com a data pré-selecionada</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
