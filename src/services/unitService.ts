import { supabase, isSupabaseConfigured, isDemoSessionActive } from '../lib/supabase';
import type { Unit as DbUnit } from '../types/database.types';
import type { Unit as UIUnit } from '../types/condominium';
import { mockUnits } from './mockData';
import { auditService } from './auditService';

export interface CreateUnitInput {
  condominium_id: string;
  identifier: string;
  block: string;
  floor?: number | null;
  ownerName?: string;
  contactName?: string;
  residentType?: 'Proprietário' | 'Inquilino';
  parkingSpot?: string;
  hasPet?: boolean;
  vehicleModel?: string;
  vehiclePlate?: string;
  squareMeters?: number;
  residentsCount?: number;
}

const DEMO_UNITS_KEY_PREFIX = 'condor_demo_units_';

function loadDemoUnits(condominiumId: string): UIUnit[] {
  try {
    const raw = localStorage.getItem(`${DEMO_UNITS_KEY_PREFIX}${condominiumId}`);
    if (!raw) {
      return condominiumId === 'condo-imperial-001' ? [...mockUnits] : [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDemoUnits(condominiumId: string, units: UIUnit[]): void {
  try {
    localStorage.setItem(`${DEMO_UNITS_KEY_PREFIX}${condominiumId}`, JSON.stringify(units));
  } catch {
    // ignore storage errors in demo mode
  }
}

export function mapDbUnitToUI(dbUnit: DbUnit, extra?: Partial<CreateUnitInput>): UIUnit {
  const numHash = dbUnit.identifier
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const ownerName =
    extra?.ownerName ||
    dbUnit.owner_name ||
    `Unidade ${dbUnit.identifier} (${dbUnit.block})`;

  const residentType: 'Proprietário' | 'Inquilino' =
    extra?.residentType ||
    (dbUnit.resident_type as 'Proprietário' | 'Inquilino') ||
    'Proprietário';

  const hasPet =
    extra?.hasPet !== undefined
      ? extra.hasPet
      : dbUnit.has_pet !== undefined
      ? Boolean(dbUnit.has_pet)
      : false;

  const parkingSpot =
    extra?.parkingSpot !== undefined
      ? extra.parkingSpot
      : dbUnit.parking_spot || `G1 - ${dbUnit.identifier}`;

  return {
    id: dbUnit.id,
    number: dbUnit.identifier,
    block: dbUnit.block,
    tower: dbUnit.block,
    ownerName,
    contactName:
      extra?.contactName ||
      (dbUnit as any).contact_name ||
      `${ownerName.split(' ')[0]} • ${residentType}`,
    residentType,
    avatarUrl: `https://images.unsplash.com/photo-${1500648767791 + (numHash % 5) * 1000}?w=150&auto=format&fit=crop&q=80`,
    bioSyncActive: true,
    bioSyncCount: '1 Facial Ativa',
    financialStatus: 'Condomínio em Dia',
    parkingSpot,
    hasPet,
    status: 'Ativo',
    squareMeters: extra?.squareMeters ?? Number(dbUnit.square_meters ?? 92),
    residentsCount: extra?.residentsCount ?? Number(dbUnit.residents_count ?? 1),
    vehicleModel:
      extra?.vehicleModel !== undefined
        ? extra.vehicleModel
        : dbUnit.vehicle_model || 'Não informado',
    vehiclePlate:
      extra?.vehiclePlate !== undefined
        ? extra.vehiclePlate
        : dbUnit.vehicle_plate || '—',
    members: [
      {
        id: `mem-${dbUnit.id}`,
        name: ownerName,
        role: residentType,
        initials: ownerName
          .split(' ')
          .map((w) => w[0])
          .slice(0, 2)
          .join('')
          .toUpperCase(),
        bioSyncActive: true,
        isMainContact: true,
      },
    ],
  };
}

export const unitService = {
  /**
   * Busca todas as unidades de um condomínio no Supabase.
   * Quando conectado ao Supabase, retorna [] se o condomínio estiver vazio (sem mockUnits).
   */
  async getUnitsByCondominium(condominiumId: string): Promise<{
    data: UIUnit[];
    error: { message: string; code?: string } | null;
  }> {
    if (!condominiumId) {
      return { data: [], error: null };
    }

    if (isDemoSessionActive()) {
      return { data: loadDemoUnits(condominiumId), error: null };
    }

    if (!isSupabaseConfigured) {
      return { data: [], error: { message: 'Supabase não configurado.' } };
    }

    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('condominium_id', condominiumId)
        .order('block', { ascending: true })
        .order('identifier', { ascending: true });

      if (error) {
        return { data: [], error: { message: error.message, code: error.code } };
      }

      const mapped = ((data as DbUnit[]) || []).map((u) => mapDbUnitToUI(u));
      return { data: mapped, error: null };
    } catch (err: any) {
      return {
        data: [],
        error: { message: err?.message || 'Erro ao buscar unidades no Supabase.' },
      };
    }
  },

  /**
   * Cadastra uma nova unidade com os dados completos de morador, vaga, pet e veículo no Supabase.
   * Não retorna sucesso se o banco falhar.
   */
  async createUnit(input: CreateUnitInput): Promise<{
    data: UIUnit | null;
    error: { message: string; code?: string; isDuplicate?: boolean } | null;
  }> {
    if (isDemoSessionActive()) {
      const current = loadDemoUnits(input.condominium_id);
      const duplicate = current.some(
        (u) =>
          u.block.toLowerCase() === input.block.trim().toLowerCase() &&
          u.number.toLowerCase() === input.identifier.trim().toLowerCase()
      );
      if (duplicate) {
        return {
          data: null,
          error: {
            message: `A unidade ${input.identifier} no ${input.block} já está cadastrada neste condomínio.`,
            isDuplicate: true,
          },
        };
      }
      const demoUnit = mapDbUnitToUI(
        {
          id: `demo-unit-${Date.now()}`,
          condominium_id: input.condominium_id,
          identifier: input.identifier.trim(),
          block: input.block.trim(),
          floor: input.floor ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        input
      );
      saveDemoUnits(input.condominium_id, [demoUnit, ...current]);
      window.dispatchEvent(new CustomEvent('condor:units-updated'));
      return { data: demoUnit, error: null };
    }

    if (!isSupabaseConfigured) {
      return {
        data: null,
        error: { message: 'Cadastro bloqueado: banco de dados Supabase não configurado.' },
      };
    }

    try {
      const extendedPayload = {
        condominium_id: input.condominium_id,
        identifier: input.identifier.trim(),
        block: input.block.trim(),
        floor: input.floor,
        owner_name: input.ownerName?.trim() || null,
        contact_name: input.ownerName?.trim()
          ? `${input.ownerName.trim().split(' ')[0]} • ${input.residentType || 'Proprietário'}`
          : null,
        resident_type: input.residentType || 'Proprietário',
        parking_spot: input.parkingSpot?.trim() || null,
        has_pet: Boolean(input.hasPet),
        vehicle_model: input.vehicleModel?.trim() || null,
        vehicle_plate: input.vehiclePlate?.trim() || null,
        square_meters: input.squareMeters ?? 92,
        residents_count: input.residentsCount ?? 1,
      };

      let { data, error } = await (supabase.from('units') as any)
        .insert(extendedPayload)
        .select('*')
        .single();

      // Caso a migration 20261104000001 ainda não tenha sido rodada (erro 42703 column does not exist),
      // tenta inserir com as colunas básicas para não quebrar antes da migration, mas ainda exigindo persistência no Supabase
      if (error && (error.code === '42703' || error.message?.includes('column'))) {
        const fallbackRes = await (supabase.from('units') as any)
          .insert({
            condominium_id: input.condominium_id,
            identifier: input.identifier.trim(),
            block: input.block.trim(),
            floor: input.floor,
          })
          .select('*')
          .single();
        data = fallbackRes.data;
        error = fallbackRes.error;
      }

      if (error || !data) {
        const isDuplicate =
          error?.code === '23505' || error?.message?.includes('unique_condominium_unit');
        return {
          data: null,
          error: {
            message: isDuplicate
              ? `A unidade ${input.identifier} no ${input.block} já está cadastrada neste condomínio.`
              : error?.message || 'Erro ao salvar unidade no Supabase.',
            code: error?.code,
            isDuplicate,
          },
        };
      }

      const createdUI = mapDbUnitToUI(data as DbUnit, input);

      await auditService.log({
        condominiumId: input.condominium_id,
        action: 'UNIT_CREATED',
        entityTable: 'units',
        entityId: createdUI.id,
        metadata: { identifier: createdUI.number, block: createdUI.block },
      });

      window.dispatchEvent(new CustomEvent('condor:units-updated'));
      return { data: createdUI, error: null };
    } catch (err: any) {
      return {
        data: null,
        error: { message: err?.message || 'Erro inesperado ao salvar unidade no Supabase.' },
      };
    }
  },

  /**
   * Remove uma unidade do condomínio no Supabase.
   */
  async deleteUnit(
    unitId: string,
    condominiumId: string
  ): Promise<{
    error: { message: string } | null;
  }> {
    if (isDemoSessionActive()) {
      const current = loadDemoUnits(condominiumId);
      saveDemoUnits(
        condominiumId,
        current.filter((u) => u.id !== unitId)
      );
      window.dispatchEvent(new CustomEvent('condor:units-updated'));
      return { error: null };
    }

    if (!isSupabaseConfigured) {
      return { error: { message: 'Exclusão bloqueada: Supabase não configurado.' } };
    }

    try {
      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', unitId)
        .eq('condominium_id', condominiumId);

      if (error) {
        return { error: { message: error.message } };
      }

      await auditService.log({
        condominiumId,
        action: 'UNIT_DELETED',
        entityTable: 'units',
        entityId: unitId,
      });

      window.dispatchEvent(new CustomEvent('condor:units-updated'));
      return { error: null };
    } catch (err: any) {
      return { error: { message: err?.message || 'Erro ao excluir unidade no Supabase.' } };
    }
  },

  /**
   * Atualiza ou cadastra os dados de morador/censo de uma unidade diretamente no Supabase.
   */
  async registerOrUpdateResidentUnit(input: {
    condominium_id: string;
    identifier: string;
    block: string;
    residentName: string;
    residentType: 'Proprietário' | 'Inquilino';
    hasPet: boolean;
    phone?: string;
    cpf?: string;
    email?: string;
  }): Promise<{ data: UIUnit | null; error: { message: string } | null }> {
    const cleanIdentifier = input.identifier.replace(/\s*\(.*?\)\s*/g, '').trim() || '101';
    const cleanBlock = input.block.trim() || 'Bloco A';
    const digits = cleanIdentifier.replace(/\D/g, '');
    const inferredFloor = digits.length >= 3 ? parseInt(digits.slice(0, -2), 10) : 1;

    if (isDemoSessionActive()) {
      const current = loadDemoUnits(input.condominium_id);
      const existingIndex = current.findIndex(
        (u) =>
          u.number.toLowerCase() === cleanIdentifier.toLowerCase() &&
          u.block.toLowerCase() === cleanBlock.toLowerCase()
      );
      if (existingIndex >= 0) {
        const updatedUnit: UIUnit = {
          ...current[existingIndex],
          ownerName: input.residentName.trim(),
          contactName: `${input.residentName.trim().split(' ')[0]} • ${input.residentType}`,
          residentType: input.residentType,
          hasPet: input.hasPet,
          status: 'Ativo',
        };
        const updatedList = [...current];
        updatedList[existingIndex] = updatedUnit;
        saveDemoUnits(input.condominium_id, updatedList);
        window.dispatchEvent(new CustomEvent('condor:units-updated'));
        return { data: updatedUnit, error: null };
      }
      return this.createUnit({
        condominium_id: input.condominium_id,
        identifier: cleanIdentifier,
        block: cleanBlock,
        floor: inferredFloor,
        ownerName: input.residentName.trim(),
        residentType: input.residentType,
        hasPet: input.hasPet,
      });
    }

    if (!isSupabaseConfigured) {
      return { data: null, error: { message: 'Supabase não configurado.' } };
    }

    try {
      const payload = {
        condominium_id: input.condominium_id,
        identifier: cleanIdentifier,
        block: cleanBlock,
        floor: inferredFloor,
        owner_name: input.residentName.trim(),
        contact_name: `${input.residentName.trim().split(' ')[0]} • ${input.residentType}`,
        resident_type: input.residentType,
        has_pet: input.hasPet,
      };

      const { data, error } = await (supabase.from('units') as any)
        .upsert(payload, { onConflict: 'condominium_id,block,identifier' })
        .select('*')
        .single();

      if (error || !data) {
        return {
          data: null,
          error: { message: error?.message || 'Erro ao sincronizar unidade no Supabase.' },
        };
      }

      const mapped = mapDbUnitToUI(data as DbUnit, {
        ownerName: input.residentName.trim(),
        residentType: input.residentType,
        hasPet: input.hasPet,
      });
      window.dispatchEvent(new CustomEvent('condor:units-updated'));
      return { data: mapped, error: null };
    } catch (err: any) {
      return {
        data: null,
        error: { message: err?.message || 'Erro ao atualizar unidade no Supabase.' },
      };
    }
  },

  /**
   * Popula unidades de teste quando acionado explicitamente pelo administrador.
   */
  async seedInitialUnits(condominiumId: string): Promise<{
    count: number;
    error: { message: string } | null;
  }> {
    if (!isSupabaseConfigured || isDemoSessionActive()) {
      return { count: 0, error: { message: 'Disponível apenas com Supabase conectado.' } };
    }

    const sampleUnits = [
      { condominium_id: condominiumId, identifier: '101', block: 'Bloco A', floor: 1, owner_name: 'Morador Fictício 101', resident_type: 'Proprietário', has_pet: true },
      { condominium_id: condominiumId, identifier: '102', block: 'Bloco A', floor: 1, owner_name: 'Morador Fictício 102', resident_type: 'Inquilino', has_pet: false },
      { condominium_id: condominiumId, identifier: '201', block: 'Bloco B', floor: 2, owner_name: 'Morador Fictício 201', resident_type: 'Proprietário', has_pet: false },
    ];

    try {
      const { data, error } = await (supabase.from('units') as any)
        .upsert(sampleUnits, { onConflict: 'condominium_id,block,identifier', ignoreDuplicates: true })
        .select('*');

      if (error) {
        return { count: 0, error: { message: error.message } };
      }

      window.dispatchEvent(new CustomEvent('condor:units-updated'));
      return { count: data?.length || sampleUnits.length, error: null };
    } catch (err: any) {
      return { count: 0, error: { message: err?.message || 'Erro ao popular unidades.' } };
    }
  },
};
