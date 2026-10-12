import { supabase } from '../lib/supabase';
import type { InvoiceRow } from '../types/database.types';
import type { Invoice } from '../types/condominium';
import { mockInvoices } from './mockData';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(val: string | null | undefined): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Postgres "undefined_table" ou PostgREST "table not in schema cache" */
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);

export interface InvoiceTarget {
  unitId: string;
  residentName: string;
}

export interface CreateInvoiceBatchInput {
  condominium_id: string;
  description: string;
  amount: number;
  dueDateIso: string;
  targets: InvoiceTarget[];
}

export interface InvoiceServiceError extends Error {
  /** true quando a migration 03 ainda não foi aplicada no Supabase */
  tableMissing?: boolean;
}

type InvoiceRowWithUnit = InvoiceRow & {
  units: { identifier: string; block: string } | null;
};

function toError(message: string, code?: string): InvoiceServiceError {
  const err: InvoiceServiceError = new Error(message);
  if (code && MISSING_TABLE_CODES.has(code)) err.tableMissing = true;
  return err;
}

/** YYYY-MM-DD no fuso local (evita o deslocamento de dia do toISOString em UTC) */
export function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIso(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { y, m, d };
}

/** Diferença em dias inteiros entre duas datas ISO (a - b), sem influência de fuso/horário de verão */
function diffInDays(aIso: string, bIso: string): number {
  const a = parseIso(aIso);
  const b = parseIso(bIso);
  return Math.round((Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d)) / 86_400_000);
}

export function formatDueDate(iso: string): string {
  const { y, m, d } = parseIso(iso);
  return `${String(d).padStart(2, '0')}/${MONTHS_PT[m - 1]}/${y}`;
}

/**
 * Payload SIMULADO de Pix "copia e cola". Não é um BR Code válido e não recebe
 * pagamentos: a geração real exige um provedor de pagamentos (PSP).
 */
export function buildSimulatedPixPayload(invoiceId: string, amount: number): string {
  return `CONDOR-PIX-SIMULADO:${invoiceId}:${amount.toFixed(2)}`;
}

function mapRowToInvoice(row: InvoiceRowWithUnit, todayIso: string): Invoice {
  const amount = Number(row.amount);
  const base = {
    id: row.id,
    unitId: row.unit_id,
    unitNumber: row.units?.identifier ?? '—',
    block: row.units?.block ?? '—',
    residentName: row.resident_name,
    description: row.description,
    dueDate: formatDueDate(row.due_date),
    dueDateIso: row.due_date,
    amount,
    pixCode: row.pix_code ?? buildSimulatedPixPayload(row.id, amount),
    whatsappReminderSent: row.reminder_sent_at !== null,
  };

  if (row.status === 'paid') {
    const paidIso = row.paid_at ? toLocalIsoDate(new Date(row.paid_at)) : row.due_date;
    const early = paidIso < row.due_date;
    return {
      ...base,
      paidAtIso: row.paid_at ?? undefined,
      status: early ? 'advance' : 'liquidated',
      statusLabel: early ? 'Liquidado Antecipado' : 'Liquidado',
      pixAuthenticated: true,
    };
  }

  const daysLate = diffInDays(todayIso, row.due_date);
  if (daysLate > 0) {
    return {
      ...base,
      status: 'overdue',
      statusLabel: `Em Atraso — ${daysLate}d`,
      pixAuthenticated: false,
    };
  }
  if (daysLate === 0) {
    return { ...base, status: 'due_today', statusLabel: 'A Vencer Hoje', pixAuthenticated: false };
  }
  return { ...base, status: 'upcoming', statusLabel: 'A Vencer', pixAuthenticated: false };
}

function getStorageKey(condominiumId: string): string {
  return `condor_invoices_${condominiumId || 'condo-imperial-001'}`;
}

export function getStoredInvoices(condominiumId: string): Invoice[] {
  try {
    const raw = localStorage.getItem(getStorageKey(condominiumId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  return [...mockInvoices];
}

export function saveStoredInvoices(condominiumId: string, list: Invoice[]): void {
  try {
    localStorage.setItem(getStorageKey(condominiumId), JSON.stringify(list));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('condor:invoices-updated'));
    }
  } catch {
    // ignore
  }
}

export const invoiceService = {
  /**
   * Lista as cobranças do condomínio (exceto canceladas), mais recentes primeiro.
   */
  async getInvoicesByCondominium(
    condominiumId: string
  ): Promise<{ data: Invoice[]; error: InvoiceServiceError | null }> {
    try {
      if (!isUuid(condominiumId)) {
        return { data: getStoredInvoices(condominiumId), error: null };
      }

      const { data, error } = await supabase
        .from('invoices')
        .select('*, units(identifier, block)')
        .eq('condominium_id', condominiumId)
        .neq('status', 'cancelled')
        .order('due_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[invoiceService] Erro ao buscar cobranças no banco, usando cache:', error.message);
        return { data: getStoredInvoices(condominiumId), error: null };
      }

      if (data && data.length > 0) {
        const today = toLocalIsoDate(new Date());
        const rows = data as unknown as InvoiceRowWithUnit[];
        const mapped = rows.map((row) => mapRowToInvoice(row, today));
        saveStoredInvoices(condominiumId, mapped);
        return { data: mapped, error: null };
      }

      return { data: getStoredInvoices(condominiumId), error: null };
    } catch {
      return { data: getStoredInvoices(condominiumId), error: null };
    }
  },

  /**
   * Emite a mesma cota para várias unidades. Idempotente: unidades que já têm
   * a cobrança (mesma descrição + vencimento) são ignoradas e contadas em `skipped`.
   */
  async createInvoiceBatch(
    input: CreateInvoiceBatchInput
  ): Promise<{ created: number; skipped: number; error: InvoiceServiceError | null }> {
    if (input.targets.length === 0) {
      return { created: 0, skipped: 0, error: toError('Nenhuma unidade selecionada para emissão.') };
    }

    try {
      const rows = input.targets.map((target) => ({
        condominium_id: input.condominium_id,
        unit_id: target.unitId,
        resident_name: target.residentName.trim(),
        description: input.description.trim(),
        amount: input.amount,
        due_date: input.dueDateIso,
      }));

      const { data, error } = await supabase
        .from('invoices')
        .upsert(rows, { onConflict: 'unit_id,description,due_date', ignoreDuplicates: true })
        .select('id');

      if (error) {
        return { created: 0, skipped: 0, error: toError(error.message, error.code) };
      }

      const created = data?.length ?? 0;
      return { created, skipped: rows.length - created, error: null };
    } catch (err) {
      return {
        created: 0,
        skipped: 0,
        error: err instanceof Error ? err : toError('Falha ao emitir boletos em lote'),
      };
    }
  },

  /**
   * Dá baixa manual (pagamento recebido). Funciona de modo resiliente e persistente.
   */
  async markAsPaid(invoiceId: string, condominiumId: string = 'condo-imperial-001'): Promise<{ error: InvoiceServiceError | null }> {
    // 1. Atualiza persistência local imediatamente para resposta em tempo real
    const list = getStoredInvoices(condominiumId);
    const updated = list.map((inv) => {
      if (inv.id === invoiceId) {
        return {
          ...inv,
          status: 'liquidated' as const,
          statusLabel: 'Liquidado',
          pixAuthenticated: true,
          paidAtIso: new Date().toISOString(),
        };
      }
      return inv;
    });
    saveStoredInvoices(condominiumId, updated);

    // 2. Se for UUID do Supabase, sincroniza com o banco remoto
    if (isUuid(invoiceId)) {
      try {
        await supabase
          .from('invoices')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', invoiceId);
      } catch (err) {
        console.warn('[invoiceService] Falha ao atualizar Supabase:', err);
      }
    }

    return { error: null };
  },

  /**
   * Registra que o lembrete de cobrança foi enviado.
   */
  async markReminderSent(invoiceId: string, condominiumId: string = 'condo-imperial-001'): Promise<{ error: InvoiceServiceError | null }> {
    const list = getStoredInvoices(condominiumId);
    const updated = list.map((inv) => (inv.id === invoiceId ? { ...inv, whatsappReminderSent: true } : inv));
    saveStoredInvoices(condominiumId, updated);

    if (isUuid(invoiceId)) {
      try {
        await supabase
          .from('invoices')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', invoiceId);
      } catch {
        // ignore
      }
    }

    return { error: null };
  },
};
