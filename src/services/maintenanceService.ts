import { supabase, isSupabaseConfigured, isDemoSessionActive } from '../lib/supabase';
import type {
  MaintenanceOrderRow,
  MaintenanceOrderDbStatus,
  MaintenanceOrderDbPriority,
} from '../types/database.types';
import type { MaintenanceOrder } from '../types/condominium';
import { mockMaintenanceOrders } from './mockData';
import { auditService } from './auditService';

export interface CreateMaintenanceOrderInput {
  condominium_id: string;
  title: string;
  location: string;
  category: string;
  description: string;
  priority: MaintenanceOrderDbPriority;
  scheduledDateIso?: string; // YYYY-MM-DD
  scheduled_date?: string; // YYYY-MM-DD
  scheduledTime?: string;
  scheduled_time?: string;
  technicianName?: string;
  technician_name?: string;
  technicianCompany?: string;
  technician_company?: string;
  materialsReserved?: boolean;
  materials_reserved?: boolean;
}

const DEMO_MAINTENANCE_KEY_PREFIX = 'condor_demo_maintenance_';

function loadDemoOrders(condominiumId: string): MaintenanceOrder[] {
  try {
    const raw = localStorage.getItem(`${DEMO_MAINTENANCE_KEY_PREFIX}${condominiumId}`);
    if (!raw) {
      return condominiumId === 'condo-imperial-001' ? [...mockMaintenanceOrders] : [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDemoOrders(condominiumId: string, orders: MaintenanceOrder[]): void {
  try {
    localStorage.setItem(`${DEMO_MAINTENANCE_KEY_PREFIX}${condominiumId}`, JSON.stringify(orders));
  } catch {
    // ignore
  }
}

function formatScheduledLabel(isoDate: string, timeRange: string): string {
  if (!isoDate) return timeRange || 'A definir';
  const todayIso = new Date().toISOString().slice(0, 10);
  const datePart = isoDate.slice(0, 10);

  if (datePart === todayIso) {
    return `Hoje • ${timeRange}`;
  }

  const parts = datePart.split('-');
  if (parts.length === 3) {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const monthLabel = months[monthIndex] || parts[1];
    return `${parts[2]} ${monthLabel} • ${timeRange}`;
  }

  return `${datePart} • ${timeRange}`;
}

function getInitials(name: string | null): string {
  if (!name) return 'EQ';
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'EQ'
  );
}

export function mapDbOrderToUI(row: MaintenanceOrderRow): MaintenanceOrder {
  const techDisplay = row.technician_name
    ? row.technician_company
      ? `${row.technician_name} (${row.technician_company})`
      : row.technician_name
    : row.technician_company || 'Equipe Interna Condor';
  const initials = row.technician_initials || getInitials(row.technician_name);

  return {
    id: row.id,
    code: row.code,
    title: row.title,
    location: row.location,
    category: row.category,
    description: row.description,
    priority: row.priority,
    status:
      row.status === 'completed'
        ? '100% Concluído'
        : row.status === 'certified'
        ? 'Laudo Emitido'
        : `${row.progress_percentage}% Em Andamento`,
    statusType: row.status,
    progressPercentage: row.progress_percentage,
    scheduledTime: formatScheduledLabel(row.scheduled_date, row.scheduled_time),
    scheduledDate: row.scheduled_date,
    scheduledDateIso: row.scheduled_date,
    technicians: [{ initials, name: techDisplay }],
    technicianCompany: row.technician_company || undefined,
    materialsReserved: row.materials_reserved,
    hasCertificate: row.has_certificate,
  };
}

export const maintenanceService = {
  /**
   * Lista todas as ordens de serviço do condomínio selecionado.
   * Quando conectado ao Supabase, retorna [] se o condomínio estiver vazio (sem mockMaintenanceOrders).
   */
  async getOrdersByCondominium(condominiumId: string): Promise<{
    data: MaintenanceOrder[];
    error: { message: string; code?: string; tableMissing?: boolean } | null;
  }> {
    if (!condominiumId) {
      return { data: [], error: null };
    }

    if (isDemoSessionActive()) {
      return { data: loadDemoOrders(condominiumId), error: null };
    }

    if (!isSupabaseConfigured) {
      return { data: [], error: { message: 'Supabase não configurado.' } };
    }

    try {
      const { data, error } = await supabase
        .from('maintenance_orders')
        .select('*')
        .eq('condominium_id', condominiumId)
        .order('created_at', { ascending: false });

      if (error) {
        const isTableMissing =
          error.code === '42P01' ||
          error.code === 'PGRST205' ||
          error.message?.includes('relation "public.maintenance_orders" does not exist') ||
          error.message?.includes('Could not find the table');

        return {
          data: [],
          error: {
            message: error.message,
            code: error.code,
            tableMissing: isTableMissing,
          },
        };
      }

      const mapped = ((data as MaintenanceOrderRow[]) || []).map(mapDbOrderToUI);
      return { data: mapped, error: null };
    } catch (err: any) {
      return {
        data: [],
        error: { message: err?.message || 'Erro ao buscar ordens de manutenção no Supabase.' },
      };
    }
  },

  /**
   * Cria uma nova Ordem de Serviço / Chamado de Manutenção no Supabase.
   * Só retorna sucesso se o banco confirmar a gravação.
   */
  async createOrder(input: CreateMaintenanceOrderInput): Promise<{
    data: MaintenanceOrder | null;
    error: { message: string } | null;
  }> {
    const randomNum = Math.floor(2900 + Math.random() * 7000);
    const code = `#OS-${randomNum}`;
    const techName = input.technicianName || input.technician_name;
    const techCompany = input.technicianCompany || input.technician_company;
    const schedDate = input.scheduledDateIso || input.scheduled_date || new Date().toISOString().slice(0, 10);
    const schedTime = input.scheduledTime || input.scheduled_time || 'Horário Comercial';
    const matReserved = Boolean(input.materialsReserved ?? input.materials_reserved);
    const initials = getInitials(techName || techCompany || 'Equipe');

    const isUrgent = input.priority === 'Prioridade Máxima';
    const initialStatus: MaintenanceOrderDbStatus = isUrgent ? 'in_progress' : 'scheduled';
    const initialProgress = isUrgent ? 25 : 0;

    if (isDemoSessionActive()) {
      const demoOrder = mapDbOrderToUI({
        id: `demo-os-${Date.now()}`,
        condominium_id: input.condominium_id,
        code,
        title: input.title.trim(),
        location: input.location.trim(),
        category: input.category,
        description: input.description.trim(),
        priority: input.priority,
        status: initialStatus,
        progress_percentage: initialProgress,
        scheduled_date: schedDate,
        scheduled_time: schedTime.trim() || 'Horário Comercial',
        technician_name: techName?.trim() || 'Equipe Técnica',
        technician_company: techCompany?.trim() || null,
        technician_initials: initials,
        materials_reserved: matReserved,
        has_certificate: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      const current = loadDemoOrders(input.condominium_id);
      saveDemoOrders(input.condominium_id, [demoOrder, ...current]);
      return { data: demoOrder, error: null };
    }

    if (!isSupabaseConfigured) {
      return {
        data: null,
        error: { message: 'Abertura de OS bloqueada: Supabase não configurado.' },
      };
    }

    try {
      const { data, error } = await (supabase.from('maintenance_orders') as any)
        .insert({
          condominium_id: input.condominium_id,
          code,
          title: input.title.trim(),
          location: input.location.trim(),
          category: input.category,
          description: input.description.trim(),
          priority: input.priority,
          status: initialStatus,
          progress_percentage: initialProgress,
          scheduled_date: schedDate,
          scheduled_time: schedTime.trim() || 'Horário Comercial',
          technician_name: techName?.trim() || 'Equipe Técnica',
          technician_company: techCompany?.trim() || null,
          technician_initials: initials,
          materials_reserved: matReserved,
          has_certificate: false,
        })
        .select('*')
        .single();

      if (error || !data) {
        return {
          data: null,
          error: {
            message:
              error?.message || 'Não foi possível registrar a Ordem de Serviço no Supabase.',
          },
        };
      }

      const created = mapDbOrderToUI(data as MaintenanceOrderRow);

      await auditService.log({
        condominiumId: input.condominium_id,
        action: 'MAINTENANCE_ORDER_CREATED',
        entityTable: 'maintenance_orders',
        entityId: created.id,
        metadata: { code: created.code, title: created.title, priority: created.priority },
      });

      return { data: created, error: null };
    } catch (err: any) {
      return {
        data: null,
        error: { message: err?.message || 'Erro ao criar ordem de serviço no Supabase.' },
      };
    }
  },

  /**
   * Avança ou atualiza o status de uma Ordem de Serviço no Supabase.
   */
  async updateOrderStatus(
    orderId: string,
    nextStatus: MaintenanceOrderDbStatus,
    condominiumId: string = ''
  ): Promise<{
    progressPercentage: number;
    hasCertificate: boolean;
    error: { message: string } | null;
  }> {
    let progressPercentage = 0;
    let hasCertificate = false;

    if (nextStatus === 'scheduled') {
      progressPercentage = 15;
    } else if (nextStatus === 'in_progress') {
      progressPercentage = 65;
    } else if (nextStatus === 'completed' || nextStatus === 'certified') {
      progressPercentage = 100;
      hasCertificate = true;
    }

    if (isDemoSessionActive()) {
      const current = loadDemoOrders(condominiumId || 'condo-imperial-001');
      const updated = current.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: nextStatus,
              progressPercentage,
              hasCertificate,
            }
          : o
      );
      saveDemoOrders(condominiumId || 'condo-imperial-001', updated);
      return { progressPercentage, hasCertificate, error: null };
    }

    if (!isSupabaseConfigured) {
      return {
        progressPercentage,
        hasCertificate,
        error: { message: 'Atualização de OS bloqueada: Supabase não configurado.' },
      };
    }

    try {
      let query = (supabase.from('maintenance_orders') as any)
        .update({
          status: nextStatus,
          progress_percentage: progressPercentage,
          has_certificate: hasCertificate,
        })
        .eq('id', orderId);

      if (condominiumId) {
        query = query.eq('condominium_id', condominiumId);
      }

      const { data, error } = await query.select('id').single();

      if (error || !data) {
        return {
          progressPercentage,
          hasCertificate,
          error: {
            message:
              error?.message ||
              'Não foi possível atualizar o status da Ordem de Serviço no Supabase.',
          },
        };
      }

      return { progressPercentage, hasCertificate, error: null };
    } catch (err: any) {
      return {
        progressPercentage,
        hasCertificate,
        error: { message: err?.message || 'Erro ao atualizar status da OS no Supabase.' },
      };
    }
  },

  async getMaintenanceOrders(condominiumId: string) {
    return this.getOrdersByCondominium(condominiumId);
  },

  async createMaintenanceOrder(input: CreateMaintenanceOrderInput) {
    return this.createOrder(input);
  },

  async updateMaintenanceOrderStatus(
    condominiumId: string,
    orderId: string,
    nextStatus: MaintenanceOrderDbStatus,
    _nextProgress?: number
  ) {
    return this.updateOrderStatus(orderId, nextStatus, condominiumId);
  },

  async seedInitialMaintenanceOrders(condominiumId: string): Promise<{
    count: number;
    error: { message: string } | null;
  }> {
    const res = await this.createOrder({
      condominium_id: condominiumId,
      title: 'Inspeção Preventiva de Elevadores e Bombas',
      location: 'Torre A & Casa de Máquinas',
      category: 'Elevadores',
      description: 'Manutenção preventiva programada do condomínio.',
      priority: 'Preventiva',
      scheduledDateIso: new Date().toISOString().slice(0, 10),
      scheduledTime: '09:00 às 12:00',
      technicianName: 'Equipe Técnica',
      technicianCompany: 'Atlas Manutenção',
      materialsReserved: true,
    });
    return { count: res.error ? 0 : 1, error: res.error };
  },
};
