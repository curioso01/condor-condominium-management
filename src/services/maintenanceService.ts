import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { MaintenanceOrderRow, MaintenanceOrderDbStatus, MaintenanceOrderDbPriority } from '../types/database.types';
import type { MaintenanceOrder } from '../types/condominium';
import { mockMaintenanceOrders } from './mockData';

const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);

export function isValidUuid(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export interface MaintenanceServiceError extends Error {
  tableMissing?: boolean;
}

function toError(message: string, code?: string): MaintenanceServiceError {
  const err: MaintenanceServiceError = new Error(message);
  if (code && MISSING_TABLE_CODES.has(code)) err.tableMissing = true;
  return err;
}

export interface CreateMaintenanceOrderInput {
  condominium_id: string;
  title: string;
  location: string;
  category?: string;
  description: string;
  priority: MaintenanceOrderDbPriority;
  scheduled_date: string; // YYYY-MM-DD
  scheduled_time: string;
  technician_name?: string;
  technician_company?: string;
  materials_reserved?: boolean;
}

function getInitials(name?: string | null): string {
  if (!name) return 'OS';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getStorageKey(condoId: string): string {
  return `condor_maintenance_orders_${condoId || 'default'}`;
}

function getLocalOrders(condoId: string): MaintenanceOrder[] {
  try {
    const raw = localStorage.getItem(getStorageKey(condoId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('[maintenanceService] Erro ao ler ordens do localStorage:', e);
  }
  return [...mockMaintenanceOrders];
}

function saveLocalOrders(condoId: string, orders: MaintenanceOrder[]): void {
  try {
    localStorage.setItem(getStorageKey(condoId), JSON.stringify(orders));
  } catch (e) {
    console.warn('[maintenanceService] Erro ao salvar ordens no localStorage:', e);
  }
}

function mapRowToOrder(row: MaintenanceOrderRow): MaintenanceOrder {
  let statusLabel: string;
  if (row.status === 'completed') {
    statusLabel = '100% Concluído';
  } else if (row.status === 'certified') {
    statusLabel = 'Laudo Emitido';
  } else if (row.status === 'in_progress') {
    statusLabel = `${row.progress_percentage || 50}% Em Andamento`;
  } else {
    statusLabel = 'Agendado';
  }

  const technicians = [];
  if (row.technician_name || row.technician_initials) {
    technicians.push({
      initials: row.technician_initials || getInitials(row.technician_name),
      name: row.technician_name || undefined,
    });
  }

  return {
    id: row.id,
    code: row.code,
    title: row.title,
    location: row.location,
    category: row.category,
    description: row.description,
    status: statusLabel,
    statusType: row.status,
    progressPercentage: row.progress_percentage,
    scheduledTime: row.scheduled_time,
    scheduledDate: row.scheduled_date,
    priority: row.priority,
    technicians,
    technicianCompany: row.technician_company || undefined,
    materialsReserved: row.materials_reserved,
    hasCertificate: row.has_certificate,
    createdAt: row.created_at,
  };
}

export const maintenanceService = {
  /**
   * Busca todas as ordens de serviço do condomínio, ordenadas pela data de criação.
   * Evita erros de sintaxe UUID quando executado com personas demo e garante fallback local.
   */
  async getMaintenanceOrders(
    condominiumId: string
  ): Promise<{ data: MaintenanceOrder[]; error: MaintenanceServiceError | null }> {
    const localList = getLocalOrders(condominiumId);

    // Se Supabase não estiver configurado ou o ID não for um UUID válido,
    // retorna imediatamente os dados locais persistidos sem lançar erro de sintaxe SQL
    if (!isSupabaseConfigured || !isValidUuid(condominiumId)) {
      return { data: localList, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('maintenance_orders')
        .select('*')
        .eq('condominium_id', condominiumId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[maintenanceService] Falha na consulta Supabase, utilizando dados locais:', error.message);
        const appErr = toError(error.message, error.code);
        // Retorna aviso informativo de tabela apenas se for erro específico de tabela inexistente
        return { data: localList, error: appErr.tableMissing ? appErr : null };
      }

      if (data && data.length > 0) {
        const rows = data as MaintenanceOrderRow[];
        const mapped = rows.map(mapRowToOrder);
        saveLocalOrders(condominiumId, mapped);
        return { data: mapped, error: null };
      }

      // Se a tabela estiver vazia no banco, usa os dados persistidos locais
      return { data: localList, error: null };
    } catch (err: any) {
      console.warn('[maintenanceService] Exceção ao consultar ordens:', err);
      return { data: localList, error: null };
    }
  },

  /**
   * Cria uma nova ordem de serviço no banco de dados e/ou no armazenamento local.
   * Garante funcionamento imediato mesmo em modo de demonstração.
   */
  async createMaintenanceOrder(
    input: CreateMaintenanceOrderInput
  ): Promise<{ data: MaintenanceOrder | null; error: MaintenanceServiceError | null }> {
    const randomCodeNumber = Math.floor(8500 + Math.random() * 900);
    const code = `OS #${randomCodeNumber}`;
    const initials = getInitials(input.technician_name || input.technician_company);

    const localNewOrder: MaintenanceOrder = {
      id: `os-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code,
      title: input.title.trim(),
      location: input.location.trim(),
      category: input.category?.trim() || 'Geral',
      description: input.description.trim(),
      status: 'Agendado',
      statusType: 'scheduled',
      progressPercentage: 0,
      scheduledDate: input.scheduled_date,
      scheduledTime: input.scheduled_time.trim(),
      priority: input.priority,
      technicians: (input.technician_name || input.technician_company)
        ? [
            {
              initials,
              name: input.technician_name?.trim() || undefined,
            },
          ]
        : [],
      technicianCompany: input.technician_company?.trim() || undefined,
      materialsReserved: Boolean(input.materials_reserved),
      hasCertificate: false,
      createdAt: new Date().toISOString(),
    };

    // Se Supabase não estiver configurado ou o ID do condomínio não for UUID válido, salva localmente
    if (!isSupabaseConfigured || !isValidUuid(input.condominium_id)) {
      const localList = getLocalOrders(input.condominium_id);
      const updated = [localNewOrder, ...localList.filter((o) => o.id !== localNewOrder.id)];
      saveLocalOrders(input.condominium_id, updated);
      return { data: localNewOrder, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('maintenance_orders')
        .insert({
          condominium_id: input.condominium_id,
          code,
          title: input.title.trim(),
          location: input.location.trim(),
          category: input.category?.trim() || 'Geral',
          description: input.description.trim(),
          priority: input.priority,
          status: 'scheduled',
          progress_percentage: 0,
          scheduled_date: input.scheduled_date,
          scheduled_time: input.scheduled_time.trim(),
          technician_name: input.technician_name?.trim() || null,
          technician_company: input.technician_company?.trim() || null,
          technician_initials: initials,
          materials_reserved: Boolean(input.materials_reserved),
          has_certificate: false,
        })
        .select('*')
        .single();

      if (error) {
        console.warn('[maintenanceService] Falha ao persistir no Supabase, salvando localmente:', error.message);
        // Grava localmente para não frustrar o usuário
        const localList = getLocalOrders(input.condominium_id);
        const updated = [localNewOrder, ...localList.filter((o) => o.id !== localNewOrder.id)];
        saveLocalOrders(input.condominium_id, updated);
        return { data: localNewOrder, error: null };
      }

      const created = mapRowToOrder(data as MaintenanceOrderRow);
      const localList = getLocalOrders(input.condominium_id);
      saveLocalOrders(input.condominium_id, [created, ...localList.filter((o) => o.id !== created.id)]);
      return { data: created, error: null };
    } catch (err: any) {
      console.warn('[maintenanceService] Erro ao gravar ordem de serviço:', err);
      const localList = getLocalOrders(input.condominium_id);
      saveLocalOrders(input.condominium_id, [localNewOrder, ...localList]);
      return { data: localNewOrder, error: null };
    }
  },

  /**
   * Atualiza o status e progresso de uma ordem de serviço.
   */
  async updateMaintenanceOrderStatus(
    condominiumIdOrOrderId: string,
    orderIdOrStatus: string | MaintenanceOrderDbStatus,
    statusOrProgress?: MaintenanceOrderDbStatus | number,
    progressPercentage?: number
  ): Promise<{ error: MaintenanceServiceError | null }> {
    let condoId = 'condo-imperial-001';
    let id = condominiumIdOrOrderId;
    let status: MaintenanceOrderDbStatus = 'in_progress';
    let progress = progressPercentage;

    // Trata sobrecarga de parâmetros para compatibilidade com chamadas existentes
    if (typeof orderIdOrStatus === 'string' && (orderIdOrStatus === 'scheduled' || orderIdOrStatus === 'in_progress' || orderIdOrStatus === 'completed' || orderIdOrStatus === 'certified')) {
      id = condominiumIdOrOrderId;
      status = orderIdOrStatus;
      if (typeof statusOrProgress === 'number') {
        progress = statusOrProgress;
      }
    } else if (typeof orderIdOrStatus === 'string' && typeof statusOrProgress === 'string') {
      condoId = condominiumIdOrOrderId;
      id = orderIdOrStatus;
      status = statusOrProgress as MaintenanceOrderDbStatus;
    }

    if (progress === undefined) {
      if (status === 'completed' || status === 'certified') progress = 100;
      else if (status === 'in_progress') progress = 50;
      else progress = 0;
    }

    // Atualiza localmente
    const localList = getLocalOrders(condoId);
    const updated = localList.map((o) =>
      o.id === id
        ? {
            ...o,
            statusType: status,
            progressPercentage: progress!,
            status:
              status === 'completed'
                ? '100% Concluído'
                : status === 'certified'
                ? 'Laudo Emitido'
                : `${progress}% Em Andamento`,
            hasCertificate: status === 'certified',
          }
        : o
    );
    saveLocalOrders(condoId, updated);

    // Se estiver conectado ao Supabase com UUID válido, atualiza também no banco
    if (isSupabaseConfigured && isValidUuid(id)) {
      try {
        const { error } = await supabase
          .from('maintenance_orders')
          .update({
            status,
            progress_percentage: progress,
            has_certificate: status === 'certified',
          })
          .eq('id', id);

        if (error) console.warn('[maintenanceService] Falha ao atualizar no Supabase:', error.message);
      } catch (err: any) {
        console.warn('[maintenanceService] Exceção ao atualizar no Supabase:', err);
      }
    }

    return { error: null };
  },

  /**
   * Remove uma ordem de serviço.
   */
  async deleteMaintenanceOrder(
    condominiumId: string,
    id: string
  ): Promise<{ error: MaintenanceServiceError | null }> {
    const localList = getLocalOrders(condominiumId);
    saveLocalOrders(condominiumId, localList.filter((o) => o.id !== id));

    if (isSupabaseConfigured && isValidUuid(id)) {
      try {
        const { error } = await supabase.from('maintenance_orders').delete().eq('id', id);
        if (error) return { error: toError(error.message, error.code) };
      } catch (err: any) {
        return { error: err instanceof Error ? err : toError('Falha ao excluir no banco') };
      }
    }

    return { error: null };
  },

  /**
   * Popula ordens de serviço padrão caso o condomínio não tenha nenhuma.
   */
  async seedInitialMaintenanceOrders(
    condominiumId: string
  ): Promise<{ count: number; error: MaintenanceServiceError | null }> {
    const seeds = [...mockMaintenanceOrders];
    saveLocalOrders(condominiumId, seeds);

    if (isSupabaseConfigured && isValidUuid(condominiumId)) {
      try {
        const dbSeeds = seeds.map((s) => ({
          condominium_id: condominiumId,
          code: s.code,
          title: s.title,
          location: s.location,
          category: s.category || 'Geral',
          description: s.description || '',
          priority: s.priority as MaintenanceOrderDbPriority,
          status: s.statusType,
          progress_percentage: s.progressPercentage || 0,
          scheduled_date: s.scheduledDate || new Date().toISOString().slice(0, 10),
          scheduled_time: s.scheduledTime || 'Horário Comercial',
          technician_name: s.technicians[0]?.name || null,
          technician_company: s.technicianCompany || null,
          technician_initials: s.technicians[0]?.initials || null,
          materials_reserved: Boolean(s.materialsReserved),
          has_certificate: Boolean(s.hasCertificate),
        }));

        await supabase.from('maintenance_orders').insert(dbSeeds);
      } catch (e) {
        console.warn('[maintenanceService] Falha ao enviar seed ao Supabase:', e);
      }
    }

    return { count: seeds.length, error: null };
  },
};
