import type {
  Unit,
  Invoice,
  AccessEntry,
  AmenityReservation,
  MaintenanceOrder,
} from '../types/condominium';

/**
 * Produção limpa: nenhum dado fictício pré-carregado.
 * Todos os registros vêm exclusivamente do banco de dados Supabase (CondoGest SaaS).
 */
export const mockUnits: Unit[] = [];
export const mockInvoices: Invoice[] = [];
export const mockAccessEntries: AccessEntry[] = [];
export const mockReservations: AmenityReservation[] = [];
export const mockMaintenanceOrders: MaintenanceOrder[] = [];
