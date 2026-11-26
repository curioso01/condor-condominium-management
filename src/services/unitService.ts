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
      : dbUnit.parking_spot || 'Não informada';

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
    avatarUrl: '',
    bioSyncActive: true,
    bioSyncCount: '1/1',
    financialStatus: 'Condomínio em Dia',
    parkingSpot,
    hasPet,
    status: 'Ativo',
    squareMeters: extra?.squareMeters ?? Number(dbUnit.square_meters ?? 0),
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
   * Retorna lista consolidada de blocos/torres do condomínio (salvos no condomínio + presentes nas unidades).
   */
  getConsolidatedBlocks(condoBlocks?: string[] | null, units: UIUnit[] = []): string[] {
    const set = new Set<string>();
    (condoBlocks || []).forEach((b) => {
      const clean = String(b || '').trim();
      if (clean) set.add(clean);
    });
    units.forEach((u) => {
      const clean = String(u.block || '').trim();
      if (clean) set.add(clean);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  },

  /**
   * Adiciona um novo bloco/torre à lista oficial de blocos do condomínio no Supabase.
   */
  async addBlock(
    condominiumId: string,
    blockName: string,
    existingBlocks: string[]
  ): Promise<{ blocks: string[]; error: { message: string } | null }> {
    const clean = blockName.trim();
    if (!clean) {
      return { blocks: existingBlocks, error: { message: 'Informe o nome do bloco ou torre.' } };
    }
    if (existingBlocks.some((b) => b.toLowerCase() === clean.toLowerCase())) {
      return { blocks: existingBlocks, error: { message: `O bloco "${clean}" já está cadastrado.` } };
    }
    const nextBlocks = [...existingBlocks, clean].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    if (isDemoSessionActive()) {
      window.dispatchEvent(new CustomEvent('condor:units-updated'));
      return { blocks: nextBlocks, error: null };
    }

    if (!isSupabaseConfigured) {
      return { blocks: existingBlocks, error: { message: 'Supabase não configurado.' } };
    }

    try {
      const { error } = await (supabase.from('condominiums') as any)
        .update({ blocks: nextBlocks, updated_at: new Date().toISOString() })
        .eq('id', condominiumId);

      if (error) {
        return { blocks: existingBlocks, error: { message: error.message } };
      }

      await auditService.log({
        condominiumId,
        action: 'BLOCK_CREATED',
        entityTable: 'condominiums',
        entityId: condominiumId,
        metadata: { block_name: clean },
      });

      window.dispatchEvent(new CustomEvent('condor:units-updated'));
      return { blocks: nextBlocks, error: null };
    } catch (err: any) {
      return {
        blocks: existingBlocks,
        error: { message: err?.message || 'Erro ao adicionar bloco no Supabase.' },
      };
    }
  },

  /**
   * Renomeia um bloco do condomínio de forma atômica (atualiza condominiums.blocks, units e condominium_members).
   */
  async renameBlock(
    condominiumId: string,
    oldName: string,
    newName: string
  ): Promise<{ blocks: string[]; unitsUpdated: number; error: { message: string } | null }> {
    const cleanOld = oldName.trim();
    const cleanNew = newName.trim();
    if (!cleanOld || !cleanNew) {
      return { blocks: [], unitsUpdated: 0, error: { message: 'Informe o novo nome do bloco.' } };
    }

    if (isDemoSessionActive()) {
      const current = loadDemoUnits(condominiumId);
      let count = 0;
      const updated = current.map((u) => {
        if (u.block.toLowerCase() === cleanOld.toLowerCase()) {
          count += 1;
          return { ...u, block: cleanNew, tower: cleanNew };
        }
        return u;
      });
      saveDemoUnits(condominiumId, updated);
      window.dispatchEvent(new CustomEvent('condor:units-updated'));
      return {
        blocks: this.getConsolidatedBlocks([cleanNew], updated),
        unitsUpdated: count,
        error: null,
      };
    }

    if (!isSupabaseConfigured) {
      return { blocks: [], unitsUpdated: 0, error: { message: 'Supabase não configurado.' } };
    }

    try {
      const { data, error } = await (supabase.rpc as any)('rename_condominium_block', {
        target_condo_id: condominiumId,
        old_block: cleanOld,
        new_block: cleanNew,
      });

      if (error) {
        return { blocks: [], unitsUpdated: 0, error: { message: error.message } };
      }

      window.dispatchEvent(new CustomEvent('condor:units-updated'));
      return {
        blocks: Array.isArray(data?.blocks) ? data.blocks : [],
        unitsUpdated: Number(data?.units_updated || 0),
        error: null,
      };
    } catch (err: any) {
      return {
        blocks: [],
        unitsUpdated: 0,
        error: { message: err?.message || 'Erro ao renomear bloco.' },
      };
    }
  },

  /**
   * Remove um bloco do condomínio (opcionalmente movendo unidades para outro bloco ou removendo-as).
   */
  async deleteBlock(
    condominiumId: string,
    blockName: string,
    options?: { reassignToBlock?: string | null; deleteUnits?: boolean }
  ): Promise<{ blocks: string[]; affectedUnits: number; error: { message: string } | null }> {
    const cleanTarget = blockName.trim();
    if (!cleanTarget) {
      return { blocks: [], affectedUnits: 0, error: { message: 'Bloco não informado.' } };
    }

    if (isDemoSessionActive()) {
      const current = loadDemoUnits(condominiumId);
      let nextUnits = current;
      const affected = current.filter((u) => u.block.toLowerCase() === cleanTarget.toLowerCase()).length;
      if (options?.reassignToBlock) {
        nextUnits = current.map((u) =>
          u.block.toLowerCase() === cleanTarget.toLowerCase()
            ? { ...u, block: options.reassignToBlock!, tower: options.reassignToBlock! }
            : u
        );
      } else if (options?.deleteUnits) {
        nextUnits = current.filter((u) => u.block.toLowerCase() !== cleanTarget.toLowerCase());
      } else if (affected > 0) {
        return {
          blocks: [],
          affectedUnits: affected,
          error: { message: `Este bloco possui ${affected} unidade(s). Escolha outro bloco para mover as unidades.` },
        };
      }
      saveDemoUnits(condominiumId, nextUnits);
      window.dispatchEvent(new CustomEvent('condor:units-updated'));
      return { blocks: this.getConsolidatedBlocks([], nextUnits), affectedUnits: affected, error: null };
    }

    if (!isSupabaseConfigured) {
      return { blocks: [], affectedUnits: 0, error: { message: 'Supabase não configurado.' } };
    }

    try {
      const { data, error } = await (supabase.rpc as any)('delete_condominium_block', {
        target_condo_id: condominiumId,
        target_block: cleanTarget,
        reassign_to_block: options?.reassignToBlock || null,
        delete_units: Boolean(options?.deleteUnits),
      });

      if (error) {
        return { blocks: [], affectedUnits: 0, error: { message: error.message } };
      }

      window.dispatchEvent(new CustomEvent('condor:units-updated'));
      return {
        blocks: Array.isArray(data?.blocks) ? data.blocks : [],
        affectedUnits: Number(data?.affected_units || 0),
        error: null,
      };
    } catch (err: any) {
      return {
        blocks: [],
        affectedUnits: 0,
        error: { message: err?.message || 'Erro ao excluir bloco.' },
      };
    }
  },
};
