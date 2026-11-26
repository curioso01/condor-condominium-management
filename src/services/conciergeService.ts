import { supabase, isSupabaseConfigured, isDemoSessionActive } from '../lib/supabase';
import type { AccessEntry, AccessAuthType } from '../types/condominium';
import { mockAccessEntries } from './mockData';
import { auditService } from './auditService';

export interface CreateAccessLogInput {
  condominium_id: string;
  personName: string;
  photoUrl?: string;
  authType: AccessAuthType;
  authDetail: string;
  accessPoint: string;
  destination: string;
  entryType: string;
}

const DEMO_ACCESS_KEY_PREFIX = 'condor_demo_access_logs_';

function formatLogTimestamp(isoString: string): string {
  try {
    const d = new Date(isoString);
    const today = new Date();
    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();

    const timeStr = d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    if (isToday) {
      return `${timeStr} (Hoje)`;
    }

    const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `${dateStr} • ${timeStr}`;
  } catch {
    return 'Agora';
  }
}

export function mapDbAccessLogToUI(row: any): AccessEntry {
  return {
    id: row.id,
    personName: row.person_name,
    photoUrl: row.photo_url || '',
    authType: (row.auth_type as AccessAuthType) || 'facial',
    authDetail: row.auth_detail || 'Acesso Registrado',
    timestamp: formatLogTimestamp(row.created_at),
    accessPoint: row.access_point || 'Portaria Principal',
    destination: row.destination || 'Acesso Geral',
    type: row.entry_type || 'Morador Residente',
  };
}

export const conciergeService = {
  /**
   * Busca os últimos 50 registros de acesso da portaria do condomínio.
   * Quando conectado ao Supabase, retorna [] se o condomínio não tiver logs (sem mockAccessEntries).
   */
  async getAccessLogs(condominiumId: string): Promise<{
    data: AccessEntry[];
    error: { message: string; tableMissing?: boolean } | null;
  }> {
    if (!condominiumId) {
      return { data: [], error: null };
    }

    if (isDemoSessionActive()) {
      try {
        const raw = localStorage.getItem(`${DEMO_ACCESS_KEY_PREFIX}${condominiumId}`);
        if (raw) {
          return { data: JSON.parse(raw), error: null };
        }
      } catch {
        // ignore
      }
      return {
        data: condominiumId === 'condo-imperial-001' ? [...mockAccessEntries] : [],
        error: null,
      };
    }

    if (!isSupabaseConfigured) {
      return { data: [], error: { message: 'Supabase não configurado.' } };
    }

    try {
      const { data, error } = await supabase
        .from('access_logs')
        .select('*')
        .eq('condominium_id', condominiumId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        const isMissing =
          error.code === '42P01' ||
          error.code === 'PGRST205' ||
          error.message?.includes('access_logs');
        return {
          data: [],
          error: { message: error.message, tableMissing: isMissing },
        };
      }

      const mapped = ((data as any[]) || []).map(mapDbAccessLogToUI);
      return { data: mapped, error: null };
    } catch (err: any) {
      return {
        data: [],
        error: { message: err?.message || 'Erro ao consultar logs da portaria no Supabase.' },
      };
    }
  },

  /**
   * Registra um novo evento de portaria/acesso ou convite QR no Supabase.
   * Só retorna sucesso se o banco confirmar a inserção.
   */
  async createAccessEntry(input: CreateAccessLogInput): Promise<{
    data: AccessEntry | null;
    error: { message: string } | null;
  }> {
    if (isDemoSessionActive()) {
      const demoEntry = mapDbAccessLogToUI({
        id: `demo-log-${Date.now()}`,
        person_name: input.personName,
        photo_url: input.photoUrl || null,
        auth_type: input.authType,
        auth_detail: input.authDetail,
        access_point: input.accessPoint,
        destination: input.destination,
        entry_type: input.entryType,
        created_at: new Date().toISOString(),
      });
      const existing = (await this.getAccessLogs(input.condominium_id)).data;
      localStorage.setItem(
        `${DEMO_ACCESS_KEY_PREFIX}${input.condominium_id}`,
        JSON.stringify([demoEntry, ...existing.slice(0, 49)])
      );
      return { data: demoEntry, error: null };
    }

    if (!isSupabaseConfigured) {
      return {
        data: null,
        error: {
          message: 'Registro de portaria bloqueado: banco de dados Supabase não configurado.',
        },
      };
    }

    try {
      const { data, error } = await (supabase.from('access_logs') as any)
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
        .select('*')
        .single();

      if (error || !data) {
        return {
          data: null,
          error: {
            message:
              error?.message ||
              'Não foi possível confirmar o registro de acesso da portaria no Supabase.',
          },
        };
      }

      const created = mapDbAccessLogToUI(data);

      await auditService.log({
        condominiumId: input.condominium_id,
        action: 'CONCIERGE_ACCESS_RECORDED',
        entityTable: 'access_logs',
        entityId: created.id,
        metadata: {
          auth_type: input.authType,
          entry_type: input.entryType,
          access_point: input.accessPoint,
          destination: input.destination,
        },
      });

      return { data: created, error: null };
    } catch (err: any) {
      return {
        data: null,
        error: { message: err?.message || 'Falha ao gravar registro de portaria no Supabase.' },
      };
    }
  },
};
