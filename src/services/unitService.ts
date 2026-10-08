import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Unit as DatabaseUnit } from '../types/database.types';
import type { Unit as UIUnit } from '../types/condominium';
import { mockUnits } from './mockData';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(val?: string | null): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

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
}

function getStorageKey(condoId: string): string {
  return `condor_units_${condoId || 'default'}`;
}

function getLocalUnits(condoId: string): UIUnit[] {
  try {
    const raw = localStorage.getItem(getStorageKey(condoId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('[unitService] Erro ao ler unidades locais:', e);
  }
  return [...mockUnits];
}

function saveLocalUnits(condoId: string, units: UIUnit[]): void {
  try {
    localStorage.setItem(getStorageKey(condoId), JSON.stringify(units));
  } catch (e) {
    console.warn('[unitService] Erro ao salvar unidades locais:', e);
  }
}

/**
 * Maps database units to UI presentation units, merging with any mock templates
 * or generating consistent presentation attributes for new units.
 */
function mapDatabaseUnitToUI(dbUnit: DatabaseUnit): UIUnit {
  // Check if there's a matching mock template by unit number to preserve rich Stitch details
  const template = mockUnits.find((m) => m.number === dbUnit.identifier);

  if (template) {
    return {
      ...template,
      id: dbUnit.id,
      number: dbUnit.identifier,
      block: dbUnit.block,
    };
  }

  // Otherwise, construct a clean, realistic UIUnit representation
  return {
    id: dbUnit.id,
    number: dbUnit.identifier,
    block: dbUnit.block,
    tower: dbUnit.block.includes('B') ? 'Torre B' : 'Torre A',
    squareMeters: 90 + ((parseInt(dbUnit.identifier, 10) || 1) % 5) * 15,
    residentsCount: 2,
    residentType: 'Proprietário',
    ownerName: 'Morador Registrado',
    contactName: 'Morador Registrado',
    parkingSpot: `G-${dbUnit.identifier.slice(-2) || '01'}`,
    parkingFloor: dbUnit.floor && dbUnit.floor > 5 ? 'Subsolo 1' : 'Térreo',
    financialStatus: 'Condomínio em Dia',
    bioSyncCount: '2/2',
    bioSyncActive: true,
    hasPet: false,
    vehicleModel: 'Veículo Cadastrado',
    vehiclePlate: 'BRA-2026',
    members: [
      {
        id: `mem-${dbUnit.id}-1`,
        name: 'Morador Titular',
        role: 'Titular',
        initials: 'MT',
        bioSyncActive: true,
        isMainContact: true,
      },
    ],
  };
}

export const unitService = {
  /**
   * Fetches all units for the given condominium from Supabase or localStorage.
   */
  async getUnitsByCondominium(condominiumId: string): Promise<{ data: UIUnit[]; error: Error | null }> {
    const local = getLocalUnits(condominiumId);

    if (!isSupabaseConfigured || !isUuid(condominiumId)) {
      return { data: local, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('condominium_id', condominiumId)
        .order('block', { ascending: true })
        .order('identifier', { ascending: true });

      if (error) {
        console.warn('[unitService] Erro ao buscar unidades:', error.message);
        return { data: local, error: null };
      }

      if (!data || data.length === 0) {
        return { data: local, error: null };
      }

      const mapped = data.map(mapDatabaseUnitToUI);
      saveLocalUnits(condominiumId, mapped);
      return { data: mapped, error: null };
    } catch (err: any) {
      console.error('[unitService] Erro inesperado ao buscar unidades:', err);
      return { data: local, error: null };
    }
  },

  /**
   * Creates a new unit in the Supabase database and local storage.
   */
  async createUnit(input: CreateUnitInput): Promise<{ data: UIUnit | null; error: Error | null }> {
    const localId = `unit-${Date.now()}`;
    const newUIUnit: UIUnit = {
      id: localId,
      number: input.identifier.trim(),
      block: input.block.trim(),
      tower: input.block.includes('B') ? 'Torre B' : 'Torre A',
      squareMeters: 90,
      residentsCount: 2,
      residentType: input.residentType || 'Proprietário',
      ownerName: input.ownerName || 'Morador Registrado',
      contactName: input.contactName || 'Morador Registrado',
      parkingSpot: input.parkingSpot || `G-${input.identifier.slice(-2) || '01'}`,
      parkingFloor: input.floor && input.floor > 5 ? 'Subsolo 1' : 'Térreo',
      financialStatus: 'Condomínio em Dia',
      bioSyncCount: '1/1',
      bioSyncActive: true,
      hasPet: Boolean(input.hasPet),
      vehicleModel: 'Veículo Cadastrado',
      vehiclePlate: 'BRA-2026',
      members: [
        {
          id: `mem-${localId}`,
          name: input.contactName || input.ownerName || 'Morador',
          role: 'Titular',
          initials: (input.contactName || 'MT').slice(0, 2).toUpperCase(),
          bioSyncActive: true,
          isMainContact: true,
        },
      ],
    };

    if (!isSupabaseConfigured || !isUuid(input.condominium_id)) {
      const list = getLocalUnits(input.condominium_id);
      const updated = [newUIUnit, ...list];
      saveLocalUnits(input.condominium_id, updated);
      return { data: newUIUnit, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('units')
        .insert({
          condominium_id: input.condominium_id,
          identifier: input.identifier.trim(),
          block: input.block.trim(),
          floor: input.floor ?? null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return { data: null, error: new Error(`A unidade ${input.identifier} já existe neste bloco.`) };
        }
        console.warn('[unitService] Falha Supabase, gravando localmente:', error.message);
        const list = getLocalUnits(input.condominium_id);
        saveLocalUnits(input.condominium_id, [newUIUnit, ...list]);
        return { data: newUIUnit, error: null };
      }

      const uiUnit = mapDatabaseUnitToUI(data);
      if (input.ownerName) uiUnit.ownerName = input.ownerName;
      if (input.contactName) uiUnit.contactName = input.contactName;
      if (input.residentType) uiUnit.residentType = input.residentType;
      if (input.parkingSpot) uiUnit.parkingSpot = input.parkingSpot;
      if (typeof input.hasPet === 'boolean') uiUnit.hasPet = input.hasPet;

      const list = getLocalUnits(input.condominium_id);
      saveLocalUnits(input.condominium_id, [uiUnit, ...list]);
      return { data: uiUnit, error: null };
    } catch (err: any) {
      const list = getLocalUnits(input.condominium_id);
      saveLocalUnits(input.condominium_id, [newUIUnit, ...list]);
      return { data: newUIUnit, error: null };
    }
  },

  /**
   * Seeds initial sample units for a condominium.
   */
  async seedInitialUnits(condominiumId: string): Promise<{ count: number; error: Error | null }> {
    const list = [...mockUnits];
    saveLocalUnits(condominiumId, list);

    if (isSupabaseConfigured && isUuid(condominiumId)) {
      try {
        const initialRows = [
          { condominium_id: condominiumId, identifier: '402', block: 'Bloco A', floor: 4 },
          { condominium_id: condominiumId, identifier: '401', block: 'Bloco A', floor: 4 },
          { condominium_id: condominiumId, identifier: '303', block: 'Bloco A', floor: 3 },
          { condominium_id: condominiumId, identifier: '108', block: 'Bloco B', floor: 1 },
          { condominium_id: condominiumId, identifier: '204', block: 'Bloco B', floor: 2 },
          { condominium_id: condominiumId, identifier: '501', block: 'Bloco B', floor: 5 },
        ];

        await supabase
          .from('units')
          .upsert(initialRows, { onConflict: 'condominium_id,block,identifier' });
      } catch (err) {
        console.warn('[unitService] Falha seed Supabase:', err);
      }
    }

    return { count: list.length, error: null };
  },

  /**
   * Deletes a unit by its ID.
   */
  async deleteUnit(condominiumId: string, unitId: string): Promise<{ error: Error | null }> {
    const list = getLocalUnits(condominiumId);
    saveLocalUnits(condominiumId, list.filter((u) => u.id !== unitId));

    if (isSupabaseConfigured && isUuid(unitId)) {
      try {
        await supabase.from('units').delete().eq('id', unitId);
      } catch (err: any) {
        return { error: err instanceof Error ? err : new Error('Falha ao excluir unidade') };
      }
    }

    return { error: null };
  },
};
