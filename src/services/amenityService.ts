import { supabase, isSupabaseConfigured, isDemoSessionActive } from '../lib/supabase';
import type { CommonArea } from '../types/database.types';
import type { AmenityReservation } from '../types/condominium';
import { mockReservations } from './mockData';
import { auditService } from './auditService';

export interface CreateReservationInput {
  condominium_id: string;
  common_area_id?: string | null;
  spaceName: string;
  emoji: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  responsibleName: string;
  unitNumber: string;
  rentalFee?: number;
  requiresApproval?: boolean;
  status?: AmenityReservation['status'];
  statusType?: AmenityReservation['statusType'];
}

export function checkReservationConflict(
  spaceName: string,
  date: string,
  startTime: string,
  endTime: string,
  existingReservations: AmenityReservation[]
): AmenityReservation | null {
  const normalizedSpace = spaceName.trim().toLowerCase();
  for (const res of existingReservations) {
    if (res.spaceName.trim().toLowerCase() !== normalizedSpace) continue;
    if (res.date !== date) continue;
    if (res.status === 'rejected' || res.status === 'cancelled') continue;
    const existingStart = res.startTime || '00:00';
    const existingEnd = res.endTime || '23:59';
    if (startTime < existingEnd && endTime > existingStart) {
      return res;
    }
  }
  return null;
}

export interface UpsertCommonAreaInput {
  condominium_id: string;
  name: string;
  description?: string;
  capacity?: number;
  fee?: number;
  rules?: string;
  requires_approval?: boolean;
  requiresApproval?: boolean;
  emoji?: string;
  hours?: string;
  enforce_time_limit?: boolean;
  available_start_time?: string;
  available_end_time?: string;
  max_duration_hours?: number | null;
  active?: boolean;
}

export type ExtendedCommonArea = CommonArea & {
  emoji?: string;
  fee?: number;
  capacity?: number;
  hours?: string;
  rules?: string;
  requires_approval?: boolean;
  requiresApproval?: boolean;
  enforce_time_limit?: boolean;
  available_start_time?: string;
  available_end_time?: string;
  max_duration_hours?: number | null;
};

const DEMO_SPACES_KEY_PREFIX = 'condor_demo_spaces_';
const DEMO_RESERVATIONS_KEY_PREFIX = 'condor_demo_reservations_';

export const SPACE_METADATA: Record<
  string,
  { emoji: string; fee: number; capacity: number; hours: string }
> = {
  'Salão Gourmet Principal': { emoji: '🥂', fee: 250, capacity: 60, hours: '10:00 às 23:59' },
  'Churrasqueira Gourmet 01': { emoji: '🍖', fee: 120, capacity: 25, hours: '09:00 às 22:00' },
  'Churrasqueira Gourmet 02': { emoji: '🥩', fee: 120, capacity: 25, hours: '09:00 às 22:00' },
  'Quadra Poliesportiva Oficial': { emoji: '🎾', fee: 0, capacity: 20, hours: '07:00 às 22:00' },
  'Salão de Festas Infantil': { emoji: '🎈', fee: 180, capacity: 50, hours: '09:00 às 22:00' },
  'Espaço Pet & Agility': { emoji: '🐾', fee: 0, capacity: 15, hours: '06:00 às 22:00' },
  'Piscina Aquecida (Raia Olímpica)': { emoji: '🏊', fee: 0, capacity: 30, hours: '06:00 às 22:00' },
  'Academia BioSync Fitness': { emoji: '🏋️', fee: 0, capacity: 20, hours: '24 Horas' },
};

function enrichCommonArea(row: any): ExtendedCommonArea {
  const preset = SPACE_METADATA[row.name];
  const reqApproval = Boolean(row.requires_approval ?? row.requiresApproval);
  const enforceTimeLimit = Boolean(row.enforce_time_limit);
  const availStart = row.available_start_time || '08:00';
  const availEnd = row.available_end_time || '22:00';
  const maxDur =
    row.max_duration_hours !== undefined && row.max_duration_hours !== null
      ? Number(row.max_duration_hours)
      : null;
  const computedHours = enforceTimeLimit
    ? `${availStart} às ${availEnd}${maxDur ? ` (máx. ${maxDur}h)` : ''}`
    : row.hours || 'Horário livre (sem limite)';

  return {
    ...row,
    capacity: row.capacity !== undefined && row.capacity !== null ? Number(row.capacity) : preset?.capacity ?? 30,
    fee: row.fee !== undefined && row.fee !== null ? Number(row.fee) : preset?.fee ?? 0,
    rules: row.rules || row.description || 'Sujeito ao regimento interno do condomínio.',
    requires_approval: reqApproval,
    requiresApproval: reqApproval,
    enforce_time_limit: enforceTimeLimit,
    available_start_time: availStart,
    available_end_time: availEnd,
    max_duration_hours: maxDur,
    emoji: row.emoji || preset?.emoji || '🏢',
    hours: computedHours,
  };
}

function formatPtBrDateLabel(
  isoDate: string,
  startTime: string = '18:00',
  endTime: string = '23:00'
): string {
  try {
    const [year, month, day] = isoDate.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const mName = months[d.getMonth()] || 'Out';
    const wName = weekdays[d.getDay()] || 'Sáb';
    return `${String(day).padStart(2, '0')} ${mName} (${wName}) • ${startTime} - ${endTime}`;
  } catch {
    return `${isoDate} • ${startTime} - ${endTime}`;
  }
}

export function mapDbReservationToUI(row: any): AmenityReservation {
  return {
    id: row.id,
    spaceName: row.space_name,
    emoji: row.emoji || SPACE_METADATA[row.space_name]?.emoji || '🎉',
    date: row.date,
    dateStr: row.date_str || formatPtBrDateLabel(row.date, row.start_time, row.end_time),
    responsibleName: row.responsible_name,
    unitNumber: row.unit_number,
    rentalFee: Number(row.rental_fee) || 0,
    status: row.status || 'Aprovado / Taxa Paga',
    statusType: (row.status_type as 'success' | 'warning' | 'info') || 'success',
  };
}

export const amenityService = {
  /**
   * Lista as áreas comuns do condomínio no Supabase.
   * Quando conectado ao Supabase, retorna [] se o condomínio não tiver áreas cadastradas.
   */
  async getCommonAreasByCondominium(condominiumId: string): Promise<{
    data: ExtendedCommonArea[];
    error: { message: string } | null;
  }> {
    if (!condominiumId) {
      return { data: [], error: null };
    }

    if (isDemoSessionActive()) {
      try {
        const raw = localStorage.getItem(`${DEMO_SPACES_KEY_PREFIX}${condominiumId}`);
        if (raw) {
          return { data: JSON.parse(raw), error: null };
        }
      } catch {
        // ignore
      }
      if (condominiumId === 'condo-palmeiras-004') {
        return { data: [], error: null };
      }
      const demoAreas: ExtendedCommonArea[] = Object.entries(SPACE_METADATA)
        .slice(0, 4)
        .map(([name, meta], idx) => ({
          id: `demo-area-${condominiumId}-${idx}`,
          condominium_id: condominiumId,
          name,
          description: `Capacidade até ${meta.capacity} pessoas • Horário: ${meta.hours}`,
          active: true,
          emoji: meta.emoji,
          fee: meta.fee,
          capacity: meta.capacity,
          hours: meta.hours,
          rules: `Capacidade até ${meta.capacity} pessoas • Horário: ${meta.hours}`,
          requires_approval: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
      return { data: demoAreas, error: null };
    }

    if (!isSupabaseConfigured) {
      return { data: [], error: { message: 'Supabase não configurado.' } };
    }

    try {
      const { data, error } = await supabase
        .from('common_areas')
        .select('*')
        .eq('condominium_id', condominiumId)
        .order('name', { ascending: true });

      if (error) {
        return { data: [], error: { message: error.message } };
      }

      const enriched = ((data as any[]) || []).map((row) => enrichCommonArea(row));
      return { data: enriched, error: null };
    } catch (err: any) {
      return { data: [], error: { message: err?.message || 'Erro ao buscar áreas comuns.' } };
    }
  },

  /**
   * Cria uma nova área comum no Supabase persistindo capacity, fee, rules, requires_approval, emoji e hours.
   */
  async createCommonArea(input: UpsertCommonAreaInput): Promise<{
    data: ExtendedCommonArea | null;
    error: { message: string } | null;
  }> {
    if (!input.name.trim()) {
      return { data: null, error: { message: 'Informe o nome da área comum.' } };
    }

    if (isDemoSessionActive()) {
      const newArea: ExtendedCommonArea = {
        id: `demo-area-${Date.now()}`,
        condominium_id: input.condominium_id,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        active: input.active ?? true,
        capacity: input.capacity ?? 30,
        fee: input.fee ?? 0,
        rules: input.rules?.trim() || 'Sujeito ao regimento interno.',
        requires_approval: Boolean(input.requires_approval),
        emoji: input.emoji || '🏢',
        hours: input.hours || '08:00 às 22:00',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const existing = (await this.getCommonAreasByCondominium(input.condominium_id)).data;
      localStorage.setItem(
        `${DEMO_SPACES_KEY_PREFIX}${input.condominium_id}`,
        JSON.stringify([...existing, newArea])
      );
      return { data: newArea, error: null };
    }

    if (!isSupabaseConfigured) {
      return { data: null, error: { message: 'Cadastro bloqueado: Supabase não configurado.' } };
    }

    try {
      const fullPayload = {
        condominium_id: input.condominium_id,
        name: input.name.trim(),
        description:
          input.description?.trim() ||
          input.rules?.trim() ||
          `Capacidade: ${input.capacity ?? 30} pessoas`,
        capacity: Number(input.capacity ?? 30),
        fee: Number(input.fee ?? 0),
        rules: input.rules?.trim() || input.description?.trim() || 'Sujeito ao regimento interno.',
        requires_approval: Boolean(input.requires_approval),
        emoji: input.emoji || SPACE_METADATA[input.name.trim()]?.emoji || '🏢',
        hours:
          input.hours ||
          (input.enforce_time_limit
            ? `${input.available_start_time || '08:00'} às ${input.available_end_time || '22:00'}`
            : 'Horário livre (sem limite)'),
        enforce_time_limit: Boolean(input.enforce_time_limit),
        available_start_time: input.available_start_time || '08:00',
        available_end_time: input.available_end_time || '22:00',
        max_duration_hours:
          input.enforce_time_limit && input.max_duration_hours ? Number(input.max_duration_hours) : null,
        active: input.active ?? true,
      };

      let { data, error } = await (supabase.from('common_areas') as any)
        .insert(fullPayload)
        .select('*')
        .single();

      // Fallback apenas de colunas caso a migration 20261104000001 ainda não tenha sido executada no banco
      if (error && (error.code === '42703' || error.message?.includes('column'))) {
        const basicRes = await (supabase.from('common_areas') as any)
          .insert({
            condominium_id: input.condominium_id,
            name: input.name.trim(),
            description: fullPayload.description,
            active: input.active ?? true,
          })
          .select('*')
          .single();
        data = basicRes.data;
        error = basicRes.error;
      }

      if (error || !data) {
        return {
          data: null,
          error: {
            message: error?.message || 'Não foi possível cadastrar a área comum no Supabase.',
          },
        };
      }

      const created = enrichCommonArea({ ...fullPayload, ...data });

      await auditService.log({
        condominiumId: input.condominium_id,
        action: 'COMMON_AREA_CREATED',
        entityTable: 'common_areas',
        entityId: created.id,
        metadata: {
          name: created.name,
          capacity: created.capacity,
          fee: created.fee,
          requires_approval: created.requires_approval,
        },
      });

      return { data: created, error: null };
    } catch (err: any) {
      return {
        data: null,
        error: { message: err?.message || 'Erro ao criar área comum no Supabase.' },
      };
    }
  },

  /**
   * Atualiza uma área comum existente no Supabase.
   */
  async updateCommonArea(
    areaId: string,
    input: UpsertCommonAreaInput
  ): Promise<{
    data: ExtendedCommonArea | null;
    error: { message: string } | null;
  }> {
    if (!input.name.trim()) {
      return { data: null, error: { message: 'Informe o nome da área comum.' } };
    }

    if (isDemoSessionActive()) {
      const existing = (await this.getCommonAreasByCondominium(input.condominium_id)).data;
      let updatedItem: ExtendedCommonArea | null = null;
      const updatedList = existing.map((a) => {
        if (a.id === areaId) {
          updatedItem = {
            ...a,
            name: input.name.trim(),
            description: input.description?.trim() || a.description,
            capacity: input.capacity ?? a.capacity,
            fee: input.fee ?? a.fee,
            rules: input.rules ?? a.rules,
            requires_approval: input.requires_approval ?? a.requires_approval,
            active: input.active ?? a.active,
            updated_at: new Date().toISOString(),
          };
          return updatedItem;
        }
        return a;
      });
      localStorage.setItem(
        `${DEMO_SPACES_KEY_PREFIX}${input.condominium_id}`,
        JSON.stringify(updatedList)
      );
      return { data: updatedItem, error: null };
    }

    if (!isSupabaseConfigured) {
      return { data: null, error: { message: 'Atualização bloqueada: Supabase não configurado.' } };
    }

    try {
      const fullPayload = {
        name: input.name.trim(),
        description:
          input.description?.trim() ||
          input.rules?.trim() ||
          `Capacidade: ${input.capacity ?? 30} pessoas`,
        capacity: Number(input.capacity ?? 30),
        fee: Number(input.fee ?? 0),
        rules: input.rules?.trim() || input.description?.trim() || 'Sujeito ao regimento interno.',
        requires_approval: Boolean(input.requires_approval),
        emoji: input.emoji || SPACE_METADATA[input.name.trim()]?.emoji || '🏢',
        hours:
          input.hours ||
          (input.enforce_time_limit
            ? `${input.available_start_time || '08:00'} às ${input.available_end_time || '22:00'}`
            : 'Horário livre (sem limite)'),
        enforce_time_limit: Boolean(input.enforce_time_limit),
        available_start_time: input.available_start_time || '08:00',
        available_end_time: input.available_end_time || '22:00',
        max_duration_hours:
          input.enforce_time_limit && input.max_duration_hours ? Number(input.max_duration_hours) : null,
        active: input.active ?? true,
      };

      let { data, error } = await (supabase.from('common_areas') as any)
        .update(fullPayload)
        .eq('id', areaId)
        .eq('condominium_id', input.condominium_id)
        .select('*')
        .single();

      if (error && (error.code === '42703' || error.message?.includes('column'))) {
        const basicRes = await (supabase.from('common_areas') as any)
          .update({
            name: input.name.trim(),
            description: fullPayload.description,
            active: input.active ?? true,
          })
          .eq('id', areaId)
          .eq('condominium_id', input.condominium_id)
          .select('*')
          .single();
        data = basicRes.data;
        error = basicRes.error;
      }

      if (error || !data) {
        return {
          data: null,
          error: {
            message: error?.message || 'Não foi possível atualizar a área comum no Supabase.',
          },
        };
      }

      const updated = enrichCommonArea({ ...fullPayload, ...data });

      await auditService.log({
        condominiumId: input.condominium_id,
        action: 'COMMON_AREA_UPDATED',
        entityTable: 'common_areas',
        entityId: areaId,
        metadata: {
          name: updated.name,
          capacity: updated.capacity,
          fee: updated.fee,
          requires_approval: updated.requires_approval,
        },
      });

      return { data: updated, error: null };
    } catch (err: any) {
      return {
        data: null,
        error: { message: err?.message || 'Erro ao atualizar área comum no Supabase.' },
      };
    }
  },

  /**
   * Exclui uma área comum do condomínio no Supabase.
   */
  async deleteCommonArea(
    areaId: string,
    condominiumId: string
  ): Promise<{
    error: { message: string } | null;
  }> {
    if (isDemoSessionActive()) {
      const existing = (await this.getCommonAreasByCondominium(condominiumId)).data;
      localStorage.setItem(
        `${DEMO_SPACES_KEY_PREFIX}${condominiumId}`,
        JSON.stringify(existing.filter((a) => a.id !== areaId))
      );
      return { error: null };
    }

    if (!isSupabaseConfigured) {
      return { error: { message: 'Exclusão bloqueada: Supabase não configurado.' } };
    }

    try {
      const { error } = await supabase
        .from('common_areas')
        .delete()
        .eq('id', areaId)
        .eq('condominium_id', condominiumId);

      if (error) {
        return { error: { message: error.message } };
      }

      await auditService.log({
        condominiumId,
        action: 'COMMON_AREA_DELETED',
        entityTable: 'common_areas',
        entityId: areaId,
      });

      return { error: null };
    } catch (err: any) {
      return { error: { message: err?.message || 'Erro ao excluir área comum no Supabase.' } };
    }
  },

  /**
   * Busca as reservas do condomínio no Supabase.
   * Quando conectado ao Supabase, retorna [] se o condomínio não tiver reservas (sem mockReservations).
   */
  async getReservations(condominiumId: string): Promise<{
    data: AmenityReservation[];
    error: { message: string; tableMissing?: boolean } | null;
  }> {
    if (!condominiumId) {
      return { data: [], error: null };
    }

    if (isDemoSessionActive()) {
      try {
        const raw = localStorage.getItem(`${DEMO_RESERVATIONS_KEY_PREFIX}${condominiumId}`);
        if (raw) {
          return { data: JSON.parse(raw), error: null };
        }
      } catch {
        // ignore
      }
      return {
        data: condominiumId === 'condo-imperial-001' ? [...mockReservations] : [],
        error: null,
      };
    }

    if (!isSupabaseConfigured) {
      return { data: [], error: { message: 'Supabase não configurado.' } };
    }

    try {
      const { data, error } = await supabase
        .from('amenity_reservations')
        .select('*')
        .eq('condominium_id', condominiumId)
        .order('date', { ascending: true });

      if (error) {
        const isMissing =
          error.code === '42P01' ||
          error.code === 'PGRST205' ||
          error.message?.includes('amenity_reservations');
        return {
          data: [],
          error: { message: error.message, tableMissing: isMissing },
        };
      }

      const mapped = ((data as any[]) || []).map(mapDbReservationToUI);
      return { data: mapped, error: null };
    } catch (err: any) {
      return {
        data: [],
        error: { message: err?.message || 'Erro ao buscar reservas no Supabase.' },
      };
    }
  },

  /**
   * Cria uma reserva de área comum no Supabase.
   * Respeita o parâmetro requires_approval da área comum e só confirma sucesso após persistência no banco.
   */
  async createReservation(input: CreateReservationInput): Promise<{
    data: AmenityReservation | null;
    error: { message: string } | null;
  }> {
    const dateStr = formatPtBrDateLabel(input.date, input.startTime, input.endTime);
    const needsApproval = Boolean(input.requiresApproval);
    const rentalFeeValue = Number(input.rentalFee ?? 0);
    const statusText = needsApproval
      ? 'Aguardando Aprovação do Síndico'
      : rentalFeeValue > 0
      ? 'Aprovado / Taxa em Boleto'
      : 'Confirmada / Uso Gratuito';
    const statusType: 'success' | 'warning' | 'info' = needsApproval ? 'warning' : 'success';

    if (isDemoSessionActive()) {
      const demoRes: AmenityReservation = {
        id: `demo-res-${Date.now()}`,
        spaceName: input.spaceName,
        emoji: input.emoji,
        date: input.date,
        dateStr,
        responsibleName: input.responsibleName,
        unitNumber: input.unitNumber,
        rentalFee: rentalFeeValue,
        status: statusText,
        statusType,
      };
      const current = (await this.getReservations(input.condominium_id)).data;
      localStorage.setItem(
        `${DEMO_RESERVATIONS_KEY_PREFIX}${input.condominium_id}`,
        JSON.stringify([demoRes, ...current])
      );
      return { data: demoRes, error: null };
    }

    if (!isSupabaseConfigured) {
      return {
        data: null,
        error: { message: 'Reserva bloqueada: banco de dados Supabase não configurado.' },
      };
    }

    try {
      const isUuidArea =
        input.common_area_id &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          input.common_area_id
        );

      const { data, error } = await (supabase.from('amenity_reservations') as any)
        .insert({
          condominium_id: input.condominium_id,
          common_area_id: isUuidArea ? input.common_area_id : null,
          space_name: input.spaceName,
          emoji: input.emoji,
          date: input.date,
          start_time: input.startTime,
          end_time: input.endTime,
          date_str: dateStr,
          responsible_name: input.responsibleName,
          unit_number: input.unitNumber,
          rental_fee: input.rentalFee,
          status: statusText,
          status_type: statusType,
        })
        .select('*')
        .single();

      if (error || !data) {
        return {
          data: null,
          error: {
            message:
              error?.message || 'Não foi possível confirmar a reserva no banco de dados Supabase.',
          },
        };
      }

      const created = mapDbReservationToUI(data);

      await auditService.log({
        condominiumId: input.condominium_id,
        action: 'RESERVATION_CREATED',
        entityTable: 'amenity_reservations',
        entityId: created.id,
        metadata: {
          space_name: created.spaceName,
          date: created.date,
          unit_number: created.unitNumber,
          status: created.status,
        },
      });

      return { data: created, error: null };
    } catch (err: any) {
      return {
        data: null,
        error: { message: err?.message || 'Falha ao gravar reserva no Supabase.' },
      };
    }
  },

  /**
   * Aprova ou recusa uma reserva pendente (apenas Síndico / SuperAdmin via RLS).
   */
  async updateReservationStatus(
    reservationId: string,
    condominiumId: string,
    decision: 'approved' | 'rejected'
  ): Promise<{ error: { message: string } | null }> {
    const nextStatus =
      decision === 'approved' ? 'Aprovada pela Administração' : 'Recusada pela Administração';
    const nextStatusType: 'success' | 'warning' | 'info' =
      decision === 'approved' ? 'success' : 'info';

    if (isDemoSessionActive()) {
      const existing = (await this.getReservations(condominiumId)).data;
      const updated = existing.map((r) =>
        r.id === reservationId ? { ...r, status: nextStatus, statusType: nextStatusType } : r
      );
      localStorage.setItem(
        `${DEMO_RESERVATIONS_KEY_PREFIX}${condominiumId}`,
        JSON.stringify(updated)
      );
      return { error: null };
    }

    if (!isSupabaseConfigured) {
      return { error: { message: 'Operação bloqueada: Supabase não configurado.' } };
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      const { data, error } = await (supabase.from('amenity_reservations') as any)
        .update({
          status: nextStatus,
          status_type: nextStatusType,
          approved_by: authData?.user?.id || null,
          approved_at: new Date().toISOString(),
        })
        .eq('id', reservationId)
        .eq('condominium_id', condominiumId)
        .select('id')
        .single();

      if (error || !data) {
        return {
          error: {
            message: error?.message || 'Não foi possível atualizar a reserva no banco de dados.',
          },
        };
      }

      await auditService.log({
        condominiumId,
        action: decision === 'approved' ? 'RESERVATION_APPROVED' : 'RESERVATION_REJECTED',
        entityTable: 'amenity_reservations',
        entityId: reservationId,
      });

      return { error: null };
    } catch (err: any) {
      return { error: { message: err?.message || 'Erro ao atualizar reserva.' } };
    }
  },

  /**
   * Cancela / remove uma reserva (Síndico/SuperAdmin ou o próprio Morador criador via RLS).
   */
  async deleteReservation(
    reservationId: string,
    condominiumId: string
  ): Promise<{ error: { message: string } | null }> {
    if (isDemoSessionActive()) {
      const existing = (await this.getReservations(condominiumId)).data;
      localStorage.setItem(
        `${DEMO_RESERVATIONS_KEY_PREFIX}${condominiumId}`,
        JSON.stringify(existing.filter((r) => r.id !== reservationId))
      );
      return { error: null };
    }

    if (!isSupabaseConfigured) {
      return { error: { message: 'Exclusão bloqueada: Supabase não configurado.' } };
    }

    try {
      const { error } = await supabase
        .from('amenity_reservations')
        .delete()
        .eq('id', reservationId)
        .eq('condominium_id', condominiumId);

      if (error) {
        return { error: { message: error.message } };
      }

      await auditService.log({
        condominiumId,
        action: 'RESERVATION_CANCELLED',
        entityTable: 'amenity_reservations',
        entityId: reservationId,
      });

      return { error: null };
    } catch (err: any) {
      return { error: { message: err?.message || 'Erro ao cancelar reserva.' } };
    }
  },
};
