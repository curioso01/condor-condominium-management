import { supabase } from '../lib/supabase';
import type { AccessLogRow } from '../types/database.types';
import type { AccessEntry } from '../types/condominium';
import { mockAccessEntries } from './mockData';

const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);

export interface ConciergeServiceError extends Error {
  tableMissing?: boolean;
}

function toError(message: string, code?: string): ConciergeServiceError {
  const err: ConciergeServiceError = new Error(message);
  if (code && MISSING_TABLE_CODES.has(code)) err.tableMissing = true;
  return err;
}

export interface CreateAccessLogInput {
  condominium_id: string;
  personName: string;
  photoUrl?: string;
  authType: 'facial' | 'qr_code' | 'delivery' | 'manual' | 'tag';
  authDetail: string;
  accessPoint: string;
  destination: string;
  entryType: 'Morador Residente' | 'Convidado QR Válido' | 'Liberação Temp. (15 min)' | 'Abertura Remota Emergencial';
}

function mapRowToAccessEntry(row: AccessLogRow): AccessEntry {
  const createdAtDate = new Date(row.created_at);
  const timeStr = createdAtDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return {
    id: row.id,
    personName: row.person_name,
    photoUrl: row.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    authType: row.auth_type as any,
    authDetail: row.auth_detail,
    timestamp: timeStr,
    accessPoint: row.access_point,
    destination: row.destination,
    type: row.entry_type as any,
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(val?: string | null): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

export const conciergeService = {
  /**
   * Fetches access logs from Supabase with fallback to mock data.
   */
  async getAccessLogs(condominiumId: string): Promise<{ data: AccessEntry[]; isMock: boolean; error: ConciergeServiceError | null }> {
    if (!isUuid(condominiumId)) {
      return {
        data: [...mockAccessEntries],
        isMock: true,
        error: null,
      };
    }

    try {
      const { data, error } = await supabase
        .from('access_logs')
        .select('*')
        .eq('condominium_id', condominiumId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        return {
          data: [...mockAccessEntries],
          isMock: true,
          error: toError(error.message, error.code),
        };
      }

      if (data && data.length > 0) {
        return {
          data: data.map(mapRowToAccessEntry),
          isMock: false,
          error: null,
        };
      }

      return {
        data: [...mockAccessEntries],
        isMock: true,
        error: null,
      };
    } catch (err: any) {
      return {
        data: [...mockAccessEntries],
        isMock: true,
        error: err instanceof Error ? err : toError('Falha ao buscar logs de acesso'),
      };
    }
  },

  /**
   * Inserts a new access entry into Supabase.
   */
  async createAccessEntry(input: CreateAccessLogInput): Promise<{ data: AccessEntry; error: ConciergeServiceError | null }> {
    try {
      const { data, error } = await supabase
        .from('access_logs')
        .insert({
          condominium_id: input.condominium_id,
          person_name: input.personName,
          photo_url: input.photoUrl || null,
          auth_type: input.authType,
          auth_detail: input.authDetail,
          access_point: input.accessPoint,
          destination: input.destination,
          entry_type: input.entryType,
        })
        .select()
        .single();

      if (!error && data) {
        return { data: mapRowToAccessEntry(data), error: null };
      }

      // Fallback
      const now = new Date();
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const localEntry: AccessEntry = {
        id: `access-${Date.now()}`,
        personName: input.personName,
        photoUrl: input.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        authType: input.authType as any,
        authDetail: input.authDetail,
        timestamp: `${timeStr} (Agora)`,
        accessPoint: input.accessPoint,
        destination: input.destination,
        type: input.entryType as any,
      };

      return { data: localEntry, error: error ? toError(error.message, error.code) : null };
    } catch (err: any) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return {
        data: {
          id: `access-${Date.now()}`,
          personName: input.personName,
          photoUrl: input.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
          authType: input.authType as any,
          authDetail: input.authDetail,
          timestamp: `${timeStr} (Agora)`,
          accessPoint: input.accessPoint,
          destination: input.destination,
          type: input.entryType as any,
        },
        error: err instanceof Error ? err : toError('Falha ao registrar acesso'),
      };
    }
  },

  /**
   * Seeds demo access entries into Supabase if table is created.
   */
  async seedInitialAccessLogs(condominiumId: string): Promise<{ count: number; error: ConciergeServiceError | null }> {
    try {
      const rows = mockAccessEntries.map((e) => ({
        condominium_id: condominiumId,
        person_name: e.personName,
        photo_url: e.photoUrl,
        auth_type: e.authType,
        auth_detail: e.authDetail,
        access_point: e.accessPoint,
        destination: e.destination,
        entry_type: e.type,
      }));

      const { data, error } = await supabase
        .from('access_logs')
        .insert(rows)
        .select();

      if (error) {
        return { count: 0, error: toError(error.message, error.code) };
      }

      return { count: data?.length || 0, error: null };
    } catch (err: any) {
      return { count: 0, error: err instanceof Error ? err : toError('Falha ao popular logs de acesso') };
    }
  },
};
