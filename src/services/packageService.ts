import { supabase, isSupabaseConfigured, isDemoSessionActive } from '../lib/supabase';
import { auditService } from './auditService';

export interface PackageRecord {
  id: string;
  condominium_id: string;
  unit_id: string | null;
  unit_number: string;
  recipient_name: string;
  courier: string;
  tracking_code: string | null;
  locker_compartment: string;
  size: 'Pequeno' | 'Médio' | 'Grande';
  pickup_pin: string;
  status: 'awaiting' | 'picked_up';
  received_at: string;
  picked_up_at: string | null;
}

export interface RegisterPackageInput {
  condominium_id: string;
  unit_id?: string | null;
  unit_number: string;
  recipient_name: string;
  courier: string;
  tracking_code?: string;
  locker_compartment: string;
  size: 'Pequeno' | 'Médio' | 'Grande';
}

const DEMO_PACKAGES_PREFIX = 'condor_demo_packages_';

/**
 * Gera PIN numérico de 4 ou 6 dígitos utilizando CSPRNG do navegador (crypto.getRandomValues).
 */
export function generateSecurePin(digits: number = 4): string {
  const arr = new Uint32Array(1);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    arr[0] = Date.now() ^ Math.floor(Math.random() * 0xffffffff);
  }
  const mod = 10 ** digits;
  return String(arr[0] % mod).padStart(digits, '0');
}

function loadDemoPackages(condominiumId: string): PackageRecord[] {
  try {
    const raw = localStorage.getItem(`${DEMO_PACKAGES_PREFIX}${condominiumId}`);
    if (raw) return JSON.parse(raw) as PackageRecord[];
  } catch {
    // ignore
  }
  return [];
}

function saveDemoPackages(condominiumId: string, list: PackageRecord[]): void {
  try {
    localStorage.setItem(`${DEMO_PACKAGES_PREFIX}${condominiumId}`, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export const packageService = {
  async getPackagesByCondominium(condominiumId: string): Promise<{
    data: PackageRecord[];
    error: { message: string; tableMissing?: boolean } | null;
  }> {
    if (!condominiumId) return { data: [], error: null };

    if (isDemoSessionActive()) {
      return { data: loadDemoPackages(condominiumId), error: null };
    }

    if (!isSupabaseConfigured) {
      return { data: [], error: { message: 'Supabase não configurado.' } };
    }

    try {
      const { data, error } = await (supabase.from('packages') as any)
        .select('*')
        .eq('condominium_id', condominiumId)
        .order('received_at', { ascending: false })
        .limit(100);

      if (error) {
        const tableMissing =
          error.code === '42P01' ||
          error.code === 'PGRST205' ||
          error.message?.includes('packages');
        return { data: [], error: { message: error.message, tableMissing } };
      }

      return { data: (data || []) as PackageRecord[], error: null };
    } catch (err: any) {
      return { data: [], error: { message: err?.message || 'Erro ao buscar encomendas.' } };
    }
  },

  async registerPackage(input: RegisterPackageInput): Promise<{
    data: PackageRecord | null;
    error: { message: string } | null;
  }> {
    if (!input.condominium_id) {
      return { data: null, error: { message: 'Condomínio ativo não identificado.' } };
    }

    const pickupPin = generateSecurePin(4);

    if (isDemoSessionActive()) {
      const created: PackageRecord = {
        id: `demo-pkg-${Date.now()}`,
        condominium_id: input.condominium_id,
        unit_id: input.unit_id || null,
        unit_number: input.unit_number.trim(),
        recipient_name: input.recipient_name.trim(),
        courier: input.courier.trim(),
        tracking_code: input.tracking_code?.trim() || null,
        locker_compartment: input.locker_compartment.trim() || 'Portaria Principal',
        size: input.size,
        pickup_pin: pickupPin,
        status: 'awaiting',
        received_at: new Date().toISOString(),
        picked_up_at: null,
      };
      const existing = loadDemoPackages(input.condominium_id);
      saveDemoPackages(input.condominium_id, [created, ...existing]);
      return { data: created, error: null };
    }

    if (!isSupabaseConfigured) {
      return { data: null, error: { message: 'Cadastro bloqueado: Supabase não configurado.' } };
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      const { data, error } = await (supabase.from('packages') as any)
        .insert({
          condominium_id: input.condominium_id,
          unit_id: input.unit_id || null,
          unit_number: input.unit_number.trim(),
          recipient_name: input.recipient_name.trim(),
          courier: input.courier.trim(),
          tracking_code: input.tracking_code?.trim() || null,
          locker_compartment: input.locker_compartment.trim() || 'Portaria Principal',
          size: input.size,
          pickup_pin: pickupPin,
          status: 'awaiting',
          created_by: authData?.user?.id || null,
        })
        .select('*')
        .single();

      if (error || !data) {
        return {
          data: null,
          error: { message: error?.message || 'Não foi possível registrar a encomenda no Supabase.' },
        };
      }

      await auditService.log({
        condominiumId: input.condominium_id,
        action: 'PACKAGE_REGISTERED',
        entityTable: 'packages',
        entityId: data.id,
        metadata: { unit_number: input.unit_number, courier: input.courier },
      });

      return { data: data as PackageRecord, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err?.message || 'Erro ao salvar encomenda.' } };
    }
  },

  async markAsPickedUp(
    packageId: string,
    condominiumId: string
  ): Promise<{ error: { message: string } | null }> {
    const pickedUpAt = new Date().toISOString();

    if (isDemoSessionActive()) {
      const list = loadDemoPackages(condominiumId).map((p) =>
        p.id === packageId ? { ...p, status: 'picked_up' as const, picked_up_at: pickedUpAt } : p
      );
      saveDemoPackages(condominiumId, list);
      return { error: null };
    }

    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase não configurado.' } };
    }

    try {
      const { data, error } = await (supabase.from('packages') as any)
        .update({ status: 'picked_up', picked_up_at: pickedUpAt })
        .eq('id', packageId)
        .eq('condominium_id', condominiumId)
        .select('id')
        .single();

      if (error || !data) {
        return { error: { message: error?.message || 'Falha ao confirmar retirada da encomenda.' } };
      }

      await auditService.log({
        condominiumId,
        action: 'PACKAGE_PICKED_UP',
        entityTable: 'packages',
        entityId: packageId,
      });

      return { error: null };
    } catch (err: any) {
      return { error: { message: err?.message || 'Erro ao atualizar encomenda.' } };
    }
  },
};
