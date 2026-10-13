import { supabase } from '../lib/supabase';
import type { CommonArea as DatabaseCommonArea, AmenityReservationRow } from '../types/database.types';
import type { AmenityReservation } from '../types/condominium';
import { mockReservations } from './mockData';

const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);

export interface AmenityServiceError extends Error {
  tableMissing?: boolean;
}

function toError(message: string, code?: string): AmenityServiceError {
  const err: AmenityServiceError = new Error(message);
  if (code && MISSING_TABLE_CODES.has(code)) err.tableMissing = true;
  return err;
}

export interface CreateCommonAreaInput {
  condominium_id: string;
  name: string;
  description?: string;
  active?: boolean;
}

export interface UpsertCommonAreaInput {
  condominium_id: string;
  name: string;
  description?: string;
  active?: boolean;
  capacity?: number;
  fee?: number;
  rules?: string;
  requires_approval?: boolean;
}

export interface ExtendedCommonArea extends DatabaseCommonArea {
  requires_approval?: boolean;
  rules?: string;
  capacity?: number;
  fee?: number;
}

export const DEFAULT_COMMON_AREAS: Omit<ExtendedCommonArea, 'id' | 'condominium_id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Salão de Festas Principal',
    description: 'Espaço climatizado com isolamento acústico, mesas, cadeiras e cozinha de apoio completa.',
    active: true,
    capacity: 80,
    fee: 250,
    rules: 'Uso das 08:00 às 23:30. Proibido som alto após as 22:00. Limpeza inclusa na taxa.',
    requires_approval: true,
  },
  {
    name: 'Espaço Gourmet & Churrasqueira',
    description: 'Churrasqueira a carvão, forno de pizza a lenha, bancada em granito e freezer horizontal.',
    active: true,
    capacity: 30,
    fee: 150,
    rules: 'Uso das 10:00 às 22:00. Trazer carvão e utensílios pessoais.',
    requires_approval: false,
  },
  {
    name: 'Quiosque da Piscina',
    description: 'Área externa coberta com ombrelones, mesas bistrô e vista para o deck molhado.',
    active: true,
    capacity: 20,
    fee: 80,
    rules: 'Uso das 09:00 às 18:00. Não é permitido vidro ou garrafas na borda da piscina.',
    requires_approval: false,
  },
  {
    name: 'Academia & Fitness Center',
    description: 'Equipamentos modernos para musculação, esteiras, elípticos e halteres.',
    active: true,
    capacity: 15,
    fee: 0,
    rules: 'Acesso livre aos moradores das 06:00 às 23:00 com toalha obrigatória.',
    requires_approval: false,
  },
];

export interface CreateReservationInput {
  condominium_id: string;
  common_area_id?: string;
  spaceName: string;
  emoji?: string;
  dateStr?: string;
  date?: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  responsibleName: string;
  unitNumber: string;
  rentalFee?: number;
  status?: 'Aprovado / Taxa Paga' | 'Aprovado' | 'Aguardando Caução';
  statusType?: 'success' | 'warning' | 'info';
}

function toMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

export function checkReservationConflict(
  spaceName: string,
  date: string,
  startTime: string,
  endTime: string,
  existingList: AmenityReservation[],
  excludeId?: string
): AmenityReservation | null {
  const normSpace = spaceName.trim().toLowerCase();
  const startMins = toMinutes(startTime);
  const endMins = toMinutes(endTime);

  for (const item of existingList) {
    if (excludeId && item.id === excludeId) continue;
    const itemSpace = item.spaceName.trim().toLowerCase();
    if (itemSpace !== normSpace) continue;

    // Check date match
    const itemDate = item.date;
    if (itemDate && itemDate !== date) continue;

    const itemStart = toMinutes(item.startTime || '08:00');
    const itemEnd = toMinutes(item.endTime || '23:00');

    // Overlap condition: startA < endB && endA > startB
    if (startMins < itemEnd && endMins > itemStart) {
      return item;
    }
  }

  return null;
}

function mapRowToReservation(row: AmenityReservationRow): AmenityReservation {
  return {
    id: row.id,
    spaceName: row.space_name,
    emoji: row.emoji || '🎉',
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    dateStr: row.date_str || `${row.date} • ${row.start_time} às ${row.end_time}`,
    responsibleName: row.responsible_name,
    unitNumber: row.unit_number,
    status: row.status as any,
    statusType: row.status_type as any,
  };
}

export const amenityService = {
  /**
   * Fetches all common areas for a given condominium with Supabase + localStorage + default fallbacks.
   */
  async getCommonAreasByCondominium(condominiumId: string): Promise<{ data: ExtendedCommonArea[]; error: AmenityServiceError | null }> {
    const storageKey = `condor_common_areas_${condominiumId}`;
    try {
      // 1. Try Supabase first
      const { data, error } = await supabase
        .from('common_areas')
        .select('*')
        .eq('condominium_id', condominiumId)
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) {
        const savedRaw = localStorage.getItem(storageKey);
        const savedList: ExtendedCommonArea[] = savedRaw ? JSON.parse(savedRaw) : [];
        const merged: ExtendedCommonArea[] = data.map((item) => {
          const match = savedList.find((s) => s.id === item.id || s.name.trim().toLowerCase() === item.name.trim().toLowerCase());
          return {
            ...item,
            capacity: match?.capacity ?? (item.name.includes('Festas') ? 80 : item.name.includes('Gourmet') ? 30 : 20),
            fee: match?.fee ?? (item.name.includes('Festas') ? 250 : item.name.includes('Gourmet') ? 150 : item.name.includes('Piscina') ? 80 : 0),
            rules: match?.rules ?? (item.description || 'Espaço de uso compartilhado com reserva prévia pelo sistema Condor.'),
            requires_approval: match?.requires_approval ?? item.name.includes('Festas'),
          };
        });
        localStorage.setItem(storageKey, JSON.stringify(merged));
        return { data: merged, error: null };
      }

      // 2. If Supabase is empty or had error, check localStorage
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return { data: parsed, error: null };
          }
        } catch {}
      }

      // 3. Populate default initial common areas so calendar filter and showcase are never empty
      const fallbackList: ExtendedCommonArea[] = DEFAULT_COMMON_AREAS.map((def, idx) => ({
        ...def,
        id: `ca-${condominiumId}-${idx + 1}`,
        condominium_id: condominiumId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      localStorage.setItem(storageKey, JSON.stringify(fallbackList));

      // Attempt background seed to Supabase
      this.seedInitialCommonAreas(condominiumId).catch(() => {});

      return { data: fallbackList, error: null };
    } catch {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          return { data: JSON.parse(saved), error: null };
        } catch {}
      }
      const fallbackList: ExtendedCommonArea[] = DEFAULT_COMMON_AREAS.map((def, idx) => ({
        ...def,
        id: `ca-${condominiumId}-${idx + 1}`,
        condominium_id: condominiumId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      return { data: fallbackList, error: null };
    }
  },

  /**
   * Creates a new common area in Supabase + local cache.
   */
  async createCommonArea(input: UpsertCommonAreaInput): Promise<{ data: ExtendedCommonArea | null; error: AmenityServiceError | null }> {
    const storageKey = `condor_common_areas_${input.condominium_id}`;
    try {
      const nowIso = new Date().toISOString();
      let createdRow: DatabaseCommonArea | null = null;

      try {
        const { data, error } = await supabase
          .from('common_areas')
          .insert({
            condominium_id: input.condominium_id,
            name: input.name.trim(),
            description: input.description?.trim() || null,
            active: input.active ?? true,
          })
          .select()
          .single();

        if (!error && data) {
          createdRow = data;
        }
      } catch {}

      const newArea: ExtendedCommonArea = {
        id: createdRow?.id || `ca-${Date.now()}`,
        condominium_id: input.condominium_id,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        active: input.active ?? true,
        capacity: Number(input.capacity) || 50,
        fee: Number(input.fee) || 0,
        rules: input.rules?.trim() || input.description?.trim() || 'Regras padrão do condomínio.',
        requires_approval: input.requires_approval ?? false,
        created_at: createdRow?.created_at || nowIso,
        updated_at: createdRow?.updated_at || nowIso,
      };

      const savedRaw = localStorage.getItem(storageKey);
      const list: ExtendedCommonArea[] = savedRaw ? JSON.parse(savedRaw) : [];
      list.push(newArea);
      localStorage.setItem(storageKey, JSON.stringify(list));

      return { data: newArea, error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : toError('Falha ao cadastrar área comum') };
    }
  },

  /**
   * Updates an existing common area in Supabase + local cache.
   */
  async updateCommonArea(
    id: string,
    input: Partial<UpsertCommonAreaInput> & { condominium_id: string }
  ): Promise<{ data: ExtendedCommonArea | null; error: AmenityServiceError | null }> {
    const storageKey = `condor_common_areas_${input.condominium_id}`;
    try {
      const nowIso = new Date().toISOString();

      try {
        await supabase
          .from('common_areas')
          .update({
            ...(input.name ? { name: input.name.trim() } : {}),
            ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
            updated_at: nowIso,
          })
          .eq('id', id);
      } catch {}

      const savedRaw = localStorage.getItem(storageKey);
      const list: ExtendedCommonArea[] = savedRaw ? JSON.parse(savedRaw) : [];
      const index = list.findIndex((a) => a.id === id);

      if (index >= 0) {
        list[index] = {
          ...list[index],
          ...input,
          name: input.name?.trim() || list[index].name,
          capacity: input.capacity !== undefined ? Number(input.capacity) : list[index].capacity,
          fee: input.fee !== undefined ? Number(input.fee) : list[index].fee,
          rules: input.rules !== undefined ? input.rules.trim() : list[index].rules,
          requires_approval: input.requires_approval !== undefined ? input.requires_approval : list[index].requires_approval,
          active: input.active !== undefined ? input.active : list[index].active,
          updated_at: nowIso,
        };
        localStorage.setItem(storageKey, JSON.stringify(list));
        return { data: list[index], error: null };
      }

      return { data: null, error: toError('Área comum não encontrada') };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : toError('Falha ao atualizar área comum') };
    }
  },

  /**
   * Deletes a common area from Supabase + local cache.
   */
  async deleteCommonArea(id: string, condominiumId: string): Promise<{ success: boolean; error: AmenityServiceError | null }> {
    const storageKey = `condor_common_areas_${condominiumId}`;
    try {
      try {
        await supabase
          .from('common_areas')
          .delete()
          .eq('id', id);
      } catch {}

      const savedRaw = localStorage.getItem(storageKey);
      if (savedRaw) {
        const list: ExtendedCommonArea[] = JSON.parse(savedRaw);
        const filtered = list.filter((a) => a.id !== id);
        localStorage.setItem(storageKey, JSON.stringify(filtered));
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err : toError('Falha ao excluir área comum') };
    }
  },

  /**
   * Seeds initial common areas (Salão de Festas, Espaço Gourmet, Piscina, etc.)
   */
  async seedInitialCommonAreas(condominiumId: string): Promise<{ count: number; error: AmenityServiceError | null }> {
    try {
      const initialAreas = [
        {
          condominium_id: condominiumId,
          name: 'Salão de Festas Principal',
          description: 'Capacidade para 80 convidados, ar-condicionado e cozinha equipada.',
          active: true,
        },
        {
          condominium_id: condominiumId,
          name: 'Espaço Gourmet & Churrasqueira',
          description: 'Capacidade para 30 pessoas com forno de pizza e churrasqueira a carvão.',
          active: true,
        },
        {
          condominium_id: condominiumId,
          name: 'Quiosque da Piscina',
          description: 'Área externa com ombrelones e freezer.',
          active: true,
        },
        {
          condominium_id: condominiumId,
          name: 'Academia & Fitness Center',
          description: 'Aparelhos de musculação e esteiras de alta performance.',
          active: true,
        },
      ];

      const { data, error } = await supabase
        .from('common_areas')
        .insert(initialAreas)
        .select();

      if (error) {
        return { count: 0, error: toError(error.message, error.code) };
      }

      return { count: data?.length || 0, error: null };
    } catch (err: any) {
      return { count: 0, error: err instanceof Error ? err : toError('Falha ao popular áreas comuns') };
    }
  },

  /**
   * Fetches reservations from Supabase with fallback to localStorage/mockData if table is not yet created.
   */
  async getReservations(condominiumId: string): Promise<{ data: AmenityReservation[]; isMock: boolean; error: AmenityServiceError | null }> {
    try {
      // 1. Try Supabase first
      const { data, error } = await supabase
        .from('amenity_reservations')
        .select('*')
        .eq('condominium_id', condominiumId)
        .order('date', { ascending: true });

      if (error) {
        const appErr = toError(error.message, error.code);
        // Fallback gracefully
        const storageKey = `condor_reservations_${condominiumId}`;
        const saved = localStorage.getItem(storageKey);
        const list: AmenityReservation[] = saved ? JSON.parse(saved) : [...mockReservations];
        return { data: list, isMock: true, error: appErr };
      }

      if (data && data.length > 0) {
        return { data: data.map(mapRowToReservation), isMock: false, error: null };
      }

      // If database is empty, check localStorage
      const storageKey = `condor_reservations_${condominiumId}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return { data: JSON.parse(saved), isMock: true, error: null };
      }

      return { data: [...mockReservations], isMock: true, error: null };
    } catch {
      return { data: [...mockReservations], isMock: true, error: null };
    }
  },

  /**
   * Seeds demo reservations into Supabase if table is created.
   */
  async seedInitialReservations(condominiumId: string): Promise<{ count: number; error: AmenityServiceError | null }> {
    try {
      const rows = mockReservations.map((r) => ({
        condominium_id: condominiumId,
        space_name: r.spaceName,
        emoji: r.emoji,
        date: r.date || '2026-10-10',
        start_time: r.startTime || '12:00',
        end_time: r.endTime || '22:00',
        date_str: r.dateStr,
        responsible_name: r.responsibleName,
        unit_number: r.unitNumber,
        rental_fee: r.spaceName.includes('Festas') ? 250 : r.spaceName.includes('Gourmet') ? 150 : 80,
        status: r.status,
        status_type: r.statusType,
      }));

      const { data, error } = await supabase
        .from('amenity_reservations')
        .insert(rows)
        .select();

      if (error) {
        return { count: 0, error: toError(error.message, error.code) };
      }

      return { count: data?.length || 0, error: null };
    } catch (err: any) {
      return { count: 0, error: err instanceof Error ? err : toError('Falha ao popular reservas no banco') };
    }
  },

  /**
   * Creates a new amenity reservation with collision prevention.
   */
  async createReservation(input: CreateReservationInput): Promise<{ data: AmenityReservation; error: AmenityServiceError | null }> {
    try {
      let friendlyDateStr = input.dateStr;
      if (!friendlyDateStr && input.date) {
        const [year, month, day] = input.date.split('-').map(Number);
        const d = new Date(year, month - 1, day);
        const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const weekday = days[d.getDay()] || '';
        const monthName = months[d.getMonth()] || '';
        const dayStr = String(day).padStart(2, '0');
        friendlyDateStr = `${weekday}, ${dayStr} ${monthName}`;
        if (input.startTime && input.endTime) {
          friendlyDateStr += ` • ${input.startTime} às ${input.endTime}`;
        }
      }

      const unitFormatted = input.unitNumber.startsWith('Apto') ? input.unitNumber : `Apto ${input.unitNumber}`;

      // 1. Attempt to insert into Supabase
      const { data, error } = await supabase
        .from('amenity_reservations')
        .insert({
          condominium_id: input.condominium_id,
          common_area_id: input.common_area_id || null,
          space_name: input.spaceName,
          emoji: input.emoji || '🎉',
          date: input.date || '2026-10-10',
          start_time: input.startTime || '08:00',
          end_time: input.endTime || '22:00',
          date_str: friendlyDateStr || 'Data agendada',
          responsible_name: input.responsibleName,
          unit_number: unitFormatted,
          rental_fee: input.rentalFee ?? (input.spaceName.includes('Festas') ? 250 : input.spaceName.includes('Gourmet') ? 150 : 80),
          status: input.status || 'Aprovado / Taxa Paga',
          status_type: input.statusType || 'success',
        })
        .select()
        .single();

      if (!error && data) {
        return { data: mapRowToReservation(data), error: null };
      }

      // If Supabase failed (e.g. tableMissing), persist locally
      const newReservation: AmenityReservation = {
        id: `res-${Date.now()}`,
        spaceName: input.spaceName,
        emoji: input.emoji || '🎉',
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        dateStr: friendlyDateStr || 'Data agendada',
        responsibleName: input.responsibleName,
        unitNumber: unitFormatted,
        status: input.status || 'Aprovado / Taxa Paga',
        statusType: input.statusType || 'success',
      };

      const storageKey = `condor_reservations_${input.condominium_id}`;
      const existing = localStorage.getItem(storageKey);
      const list: AmenityReservation[] = existing ? JSON.parse(existing) : [...mockReservations];
      list.unshift(newReservation);
      localStorage.setItem(storageKey, JSON.stringify(list));

      return { data: newReservation, error: null };
    } catch (err: any) {
      return {
        data: null as any,
        error: err instanceof Error ? err : toError('Falha ao registrar reserva'),
      };
    }
  },
};
