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
  // Navigation base date: default to current month (October 2026 based on app timeline)
  const [currentDate, setCurrentDate] = useState(() => {
    // Current date in the app context is October 2026
    return new Date(2026, 9, 1); // Month 9 is October (0-indexed)
  });

  const [selectedSpaceFilter, setSelectedSpaceFilter] = useState<string>('all');
  const [selectedDayIso, setSelectedDayIso] = useState<string>('2026-10-10');

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
        isToday: day === 5 && month === 9 && year === 2026, // Oct 05, 2026
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
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-soft flex flex-col gap-5">
      {/* Header and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <CalendarIcon className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Calendário de Reservas (Janela de 60 Dias)
              </h3>
              <p className="text-xs text-slate-400">
                Disponibilidade por dia: Verde (Livre), Amarelo (Parcial) e Vermelho (Ocupado)
              </p>
            </div>
          </div>
        </div>

        {/* Filter by Space */}
        <div className="flex items-center gap-2">
          <label htmlFor="calendar-space-filter" className="text-xs font-semibold text-slate-500 whitespace-nowrap">
            Espaço:
          </label>
          <select
            id="calendar-space-filter"
            value={selectedSpaceFilter}
            onChange={(e) => setSelectedSpaceFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="all">Todos os Espaços</option>
            {commonAreas.map((area) => (
              <option key={area.id} value={area.name}>
                {area.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Calendar Controls & Color Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Month Switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Mês Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-slate-900 min-w-[150px] text-center capitalize">
            {monthYearLabel}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Próximo Mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Status Badges Legend */}
        <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-xs" />
            <span>Livre</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 shadow-xs" />
            <span>Parcialmente Ocupado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 shadow-xs" />
            <span>100% Ocupado</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid & Side Details Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Days Grid (Col 8) */}
        <div className="lg:col-span-8 bg-slate-50/70 p-4 rounded-2.5xl border border-slate-200/80">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1.5 text-center mb-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
              <span key={day} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider py-1">
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1.5">
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
                  className={`min-h-[64px] sm:min-h-[72px] p-1.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer relative ${
                    isSelected
                      ? 'ring-2 ring-emerald-500 border-emerald-500 bg-white dark:bg-slate-800 shadow-md'
                      : day.isCurrentMonth
                      ? 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                      : 'bg-slate-100/60 border-slate-200/40 opacity-40 hover:opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs font-bold ${
                        day.isToday
                          ? 'w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]'
                          : isSelected
                          ? 'text-emerald-600 dark:text-emerald-400 font-black'
                          : 'text-slate-700'
                      }`}
                    >
                      {day.dayNumber}
                    </span>

                    {/* Status Dot */}
                    <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                  </div>

                  {/* Booking count or free label */}
                  <div className="mt-1">
                    {day.status === 'free' ? (
                      <span className="text-[10px] font-semibold text-emerald-600 block truncate">
                        Livre
                      </span>
                    ) : day.status === 'partial' ? (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded-md block truncate">
                        {day.reservations.length} reserva
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-100/70 px-1.5 py-0.5 rounded-md block truncate">
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
        <div className="lg:col-span-4 bg-slate-50/70 p-4 sm:p-5 rounded-2.5xl border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Data Selecionada
                </span>
                <h4 className="text-sm font-bold text-slate-900 capitalize mt-0.5">
                  {formattedSelectedDay}
                </h4>
              </div>

              {/* Status Indicator */}
              <span
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                  selectedDay?.status === 'free'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : selectedDay?.status === 'partial'
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-rose-100 text-rose-800 border-rose-200'
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
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Agendamentos no Dia ({selectedDay?.reservations.length || 0})
              </span>

              {selectedDay?.reservations.length === 0 ? (
                <div className="p-4 bg-white rounded-2xl border border-dashed border-slate-200 text-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-slate-800">Nenhum evento agendado</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Todos os espaços comuns estão disponíveis para reserva nesta data.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {selectedDay?.reservations.map((res) => (
                    <div
                      key={res.id}
                      className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{res.emoji}</span>
                          <span>{res.spaceName}</span>
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          {res.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{res.startTime && res.endTime ? `${res.startTime} às ${res.endTime}` : res.dateStr}</span>
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
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
          <div className="pt-4 border-t border-slate-200 mt-4">
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
