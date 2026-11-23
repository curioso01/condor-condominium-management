import { supabase, isSupabaseConfigured, isDemoSessionActive } from '../lib/supabase';
import type { Invoice, InvoiceStatus } from '../types/condominium';
import { mockInvoices } from './mockData';
import { auditService } from './auditService';
import {
  bankAccountService,
  generateOfficialPixPayload,
  type CondominiumBankSettings,
} from './bankAccountService';

export function toLocalIsoDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface CreateInvoiceBatchInput {
  condominium_id: string;
  description: string;
  amount: number;
  dueDateIso: string; // YYYY-MM-DD
  targets: Array<{
    unit_id?: string;
    unitId?: string;
    unitNumber?: string;
    block?: string;
    residentName: string;
  }>;
}

const DEMO_INVOICES_KEY_PREFIX = 'condor_demo_invoices_';

function loadDemoInvoices(condominiumId: string): Invoice[] {
  try {
    const raw = localStorage.getItem(`${DEMO_INVOICES_KEY_PREFIX}${condominiumId}`);
    if (!raw) {
      // No modo demonstração, apenas o 1º condomínio demo recebe dados iniciais;
      // o 4º condomínio (condo-palmeiras-004) permanece vazio para testar estado zero.
      return condominiumId === 'condo-imperial-001' ? [...mockInvoices] : [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDemoInvoices(condominiumId: string, invoices: Invoice[]): void {
  try {
    localStorage.setItem(`${DEMO_INVOICES_KEY_PREFIX}${condominiumId}`, JSON.stringify(invoices));
  } catch {
    // ignore storage errors in demo mode
  }
}

function generatePixEmvCode(
  unitNumber: string,
  block: string,
  amount: number,
  dueDateIso: string,
  bankSettings?: CondominiumBankSettings
): string {
  const cleanUnit = (unitNumber || '101').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const cleanBlock = (block || 'A').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
  const dateCompact = (dueDateIso || '').replace(/-/g, '');
  const txId = `CONDOR${cleanBlock}${cleanUnit}${dateCompact}`.slice(0, 25);

  if (!bankSettings?.pixKey) {
    return '';
  }

  return generateOfficialPixPayload({
    pixKey: bankSettings.pixKey,
    pixKeyType: bankSettings.pixKeyType,
    merchantName: bankSettings.pixMerchantName || bankSettings.beneficiaryName || 'CONDOMINIO',
    merchantCity: bankSettings.pixMerchantCity || 'SAO PAULO',
    amount,
    txid: txId,
    description: `Cota ${cleanUnit} ${cleanBlock}`.slice(0, 30),
  });
}

function formatDateBr(isoDate: string): string {
  if (!isoDate) return '—';
  const parts = isoDate.slice(0, 10).split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function deriveUiStatus(
  dbStatus: 'pending' | 'paid' | 'cancelled',
  dueDateIso: string,
  paidAtIso: string | null
): { status: InvoiceStatus; statusLabel: string } {
  const todayIso = new Date().toISOString().slice(0, 10);
  const dueIso = dueDateIso.slice(0, 10);

  if (dbStatus === 'paid') {
    if (paidAtIso && paidAtIso.slice(0, 10) < dueIso) {
      return { status: 'advance', statusLabel: 'Pago Antecipado' };
    }
    return { status: 'liquidated', statusLabel: 'Liquidado' };
  }

  if (dueIso < todayIso) {
    const dueTime = new Date(`${dueIso}T12:00:00`).getTime();
    const todayTime = new Date(`${todayIso}T12:00:00`).getTime();
    const diffDays = Math.max(1, Math.round((todayTime - dueTime) / (1000 * 60 * 60 * 24)));
    return { status: 'overdue', statusLabel: `Atrasado (${diffDays}d)` };
  }

  if (dueIso === todayIso) {
    return { status: 'due_today', statusLabel: 'Vence Hoje' };
  }

  return { status: 'upcoming', statusLabel: 'A Vencer' };
}

export function mapDbInvoiceToUI(row: any): Invoice {
  const unitIdentifier = row.units?.identifier || row.unit_identifier || '101';
  const unitBlock = row.units?.block || row.unit_block || 'Bloco A';
  const { status, statusLabel } = deriveUiStatus(row.status, row.due_date, row.paid_at);

  const initials = (row.resident_name || 'M R')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n: string) => n[0]?.toUpperCase() || '')
    .join('');

  return {
    id: row.id,
    unitId: row.unit_id,
    unitNumber: unitIdentifier,
    block: unitBlock,
    residentName: row.resident_name,
    residentInitials: initials || 'MR',
    description: row.description,
    dueDate: formatDateBr(row.due_date),
    dueDateIso: row.due_date,
    amount: Number(row.amount),
    status,
    statusLabel,
    pixCode:
      row.pix_code ||
      generatePixEmvCode(unitIdentifier, unitBlock, Number(row.amount), row.due_date),
    pixAuthenticated: row.status === 'paid',
    whatsappReminderSent: Boolean(row.reminder_sent_at),
    paidAtIso: row.paid_at,
  };
}

export const invoiceService = {
  /**
   * Busca boletos do condomínio selecionado.
   * Quando conectado ao Supabase, retorna [] se o condomínio não tiver boletos (sem poluição de mockData).
   */
  async getInvoicesByCondominium(condominiumId: string): Promise<{
    data: Invoice[];
    error: { message: string; code?: string; tableMissing?: boolean } | null;
  }> {
    if (!condominiumId) {
      return { data: [], error: null };
    }

    if (isDemoSessionActive()) {
      return { data: loadDemoInvoices(condominiumId), error: null };
    }

    if (!isSupabaseConfigured) {
      return {
        data: [],
        error: { message: 'Banco de dados Supabase não configurado.' },
      };
    }

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(
          `
          *,
          units:unit_id (
            identifier,
            block
          )
        `
        )
        .eq('condominium_id', condominiumId)
        .order('due_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        const isTableMissing =
          error.code === '42P01' ||
          error.code === 'PGRST205' ||
          error.message?.includes('relation "public.invoices" does not exist') ||
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

      const mapped = (data || []).map((row) => mapDbInvoiceToUI(row));
      return { data: mapped, error: null };
    } catch (err: any) {
      return {
        data: [],
        error: { message: err?.message || 'Erro ao buscar boletos no Supabase.' },
      };
    }
  },

  /**
   * Realiza a baixa manual de um boleto.
   * REGRA CRÍTICA (Item 3.2): A baixa somente é confirmada após resposta positiva do Supabase.
   * Nenhum erro de banco é silenciado por localStorage.
   */
  async markAsPaid(
    invoiceId: string,
    condominiumId: string = ''
  ): Promise<{
    error: { message: string } | null;
  }> {
    const paidAtIso = new Date().toISOString();

    if (isDemoSessionActive()) {
      const current = loadDemoInvoices(condominiumId || 'condo-imperial-001');
      const updated = current.map((inv) =>
        inv.id === invoiceId
          ? {
              ...inv,
              status: 'liquidated' as InvoiceStatus,
              statusLabel: 'Liquidado',
              pixAuthenticated: true,
              paidAtIso,
            }
          : inv
      );
      saveDemoInvoices(condominiumId || 'condo-imperial-001', updated);
      return { error: null };
    }

    if (!isSupabaseConfigured) {
      return {
        error: {
          message:
            'Operação bloqueada: banco de dados Supabase não configurado para confirmar a baixa financeira.',
        },
      };
    }

    if (!condominiumId) {
      return {
        error: { message: 'Condomínio ativo não identificado para confirmar a baixa.' },
      };
    }

    try {
      const { data, error } = await (supabase.from('invoices') as any)
        .update({
          status: 'paid',
          paid_at: paidAtIso,
        })
        .eq('id', invoiceId)
        .eq('condominium_id', condominiumId)
        .select('id, status, paid_at')
        .single();

      if (error || !data) {
        return {
          error: {
            message:
              error?.message ||
              'Não foi possível confirmar a baixa do boleto no banco de dados (verifique permissões ou conexão).',
          },
        };
      }

      await auditService.log({
        condominiumId,
        action: 'INVOICE_MARKED_PAID',
        entityTable: 'invoices',
        entityId: invoiceId,
        metadata: { paid_at: paidAtIso },
      });

      return { error: null };
    } catch (err: any) {
      return {
        error: {
          message:
            err?.message || 'Falha de comunicação ao registrar baixa do boleto no Supabase.',
        },
      };
    }
  },

  /**
   * Registra envio de lembrete de cobrança via WhatsApp.
   */
  async markReminderSent(invoiceId: string): Promise<{ error: { message: string } | null }> {
    if (isDemoSessionActive()) return { error: null };
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase não configurado.' } };
    }

    try {
      const { error } = await (supabase.from('invoices') as any)
        .update({
          reminder_sent_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (error) {
        return { error: { message: error.message } };
      }

      return { error: null };
    } catch (err: any) {
      return { error: { message: err?.message || 'Erro ao registrar lembrete.' } };
    }
  },

  /**
   * Emite cobranças para uma ou múltiplas unidades do condomínio.
   * Evita duplicidade verificando (unit_id, description, due_date).
   */
  async createInvoiceBatch(input: CreateInvoiceBatchInput): Promise<{
    created: number;
    skipped: number;
    error: { message: string } | null;
  }> {
    if (!input.targets || input.targets.length === 0) {
      return {
        created: 0,
        skipped: 0,
        error: { message: 'Selecione ao menos uma unidade para emitir.' },
      };
    }

    if (isDemoSessionActive()) {
      const existing = loadDemoInvoices(input.condominium_id);
      const newInvoices: Invoice[] = input.targets.map((t, idx) =>
        mapDbInvoiceToUI({
          id: `demo-inv-${Date.now()}-${idx}`,
          condominium_id: input.condominium_id,
          unit_id: t.unit_id || t.unitId || `unit-${idx}`,
          unit_identifier: t.unitNumber || '101',
          unit_block: t.block || 'Bloco A',
          resident_name: t.residentName,
          description: input.description.trim(),
          amount: input.amount,
          due_date: input.dueDateIso,
          status: 'pending',
          paid_at: null,
          pix_code: generatePixEmvCode(
            t.unitNumber || '101',
            t.block || 'Bloco A',
            input.amount,
            input.dueDateIso
          ),
        })
      );
      saveDemoInvoices(input.condominium_id, [...newInvoices, ...existing]);
      return { created: newInvoices.length, skipped: 0, error: null };
    }

    if (!isSupabaseConfigured) {
      return {
        created: 0,
        skipped: 0,
        error: {
          message: 'Emissão bloqueada: banco de dados Supabase não configurado.',
        },
      };
    }

    try {
      const validTargets: typeof input.targets = [];

      for (const t of input.targets) {
        const targetUnitId = t.unit_id || t.unitId || '';
        const targetUnitNumber = t.unitNumber || '101';
        const targetBlock = t.block || 'Bloco A';
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUnitId);
        if (isUuid) {
          validTargets.push({ ...t, unit_id: targetUnitId, unitNumber: targetUnitNumber, block: targetBlock });
        } else {
          const { data: createdUnit, error: unitErr } = await (supabase.from('units') as any)
            .upsert(
              {
                condominium_id: input.condominium_id,
                identifier: targetUnitNumber,
                block: targetBlock,
                floor: parseInt(targetUnitNumber.replace(/\D/g, '').slice(0, -2) || '1', 10) || 1,
              },
              { onConflict: 'condominium_id,block,identifier' }
            )
            .select('id')
            .single();

          if (!unitErr && createdUnit?.id) {
            validTargets.push({ ...t, unit_id: createdUnit.id, unitNumber: targetUnitNumber, block: targetBlock });
          }
        }
      }

      if (validTargets.length === 0) {
        return {
          created: 0,
          skipped: 0,
          error: {
            message:
              'Não foi possível validar as unidades no banco de dados. Cadastre as unidades primeiro na aba "Unidades".',
          },
        };
      }

      // Verifica cobranças existentes para evitar duplicidade em novas tentativas após falha de rede
      const { data: existingRows } = await (supabase.from('invoices') as any)
        .select('unit_id')
        .eq('condominium_id', input.condominium_id)
        .eq('description', input.description.trim())
        .eq('due_date', input.dueDateIso);

      const existingUnitIds = new Set((existingRows || []).map((r: any) => r.unit_id));
      const nonDuplicateTargets = validTargets.filter((t) => !existingUnitIds.has(t.unit_id));
      const preSkipped = validTargets.length - nonDuplicateTargets.length;

      if (nonDuplicateTargets.length === 0) {
        return {
          created: 0,
          skipped: preSkipped,
          error: null,
        };
      }

      // Busca a chave Pix cadastrada pela síndica para este condomínio
      const { data: condoBankSettings } = await bankAccountService.fetchSettings(
        input.condominium_id
      );

      const rowsToInsert = nonDuplicateTargets.map((t) => ({
        condominium_id: input.condominium_id,
        unit_id: t.unit_id || t.unitId || '',
        resident_name: t.residentName,
        description: input.description.trim(),
        amount: input.amount,
        due_date: input.dueDateIso,
        status: 'pending',
        pix_code:
          generatePixEmvCode(
            t.unitNumber || '101',
            t.block || 'Bloco A',
            input.amount,
            input.dueDateIso,
            condoBankSettings
          ) || null,
      }));

      const { data, error } = await (supabase.from('invoices') as any)
        .upsert(rowsToInsert, {
          onConflict: 'unit_id,description,due_date',
          ignoreDuplicates: true,
        })
        .select('id');

      if (error) {
        return { created: 0, skipped: 0, error: { message: error.message } };
      }

      const createdCount = data?.length || 0;
      const skippedCount = preSkipped + Math.max(0, nonDuplicateTargets.length - createdCount);

      await auditService.log({
        condominiumId: input.condominium_id,
        action: 'INVOICE_BATCH_CREATED',
        entityTable: 'invoices',
        metadata: {
          description: input.description.trim(),
          amount: input.amount,
          due_date: input.dueDateIso,
          created_count: createdCount,
        },
      });

      return { created: createdCount, skipped: skippedCount, error: null };
    } catch (err: any) {
      return {
        created: 0,
        skipped: 0,
        error: { message: err?.message || 'Erro ao emitir boletos no Supabase.' },
      };
    }
  },
};
