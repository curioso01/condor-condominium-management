export type NavigationTab = 
  | 'overview' 
  | 'finance' 
  | 'units' 
  | 'concierge' 
  | 'reservations' 
  | 'maintenance';

export interface Condominium {
  id: string;
  name: string;
  towers: string[];
  totalUnits: number;
  occupancyRate: number;
  reserveFund: number;
}

export interface ResidentMember {
  id: string;
  name: string;
  role: string;
  initials: string;
  bioSyncActive: boolean;
  isMainContact?: boolean;
}

export interface Unit {
  id: string;
  number: string;
  block: string;
  tower: string;
  squareMeters: number;
  residentsCount: number;
  residentType: 'Proprietário' | 'Inquilino';
  ownerName: string;
  contactName: string;
  parkingSpot: string;
  parkingFloor?: string;
  financialStatus: 'Condomínio em Dia' | 'Boleto a Vencer (Hoje)' | 'Em Atraso';
  bioSyncCount: string;
  bioSyncActive: boolean;
  hasPet?: boolean;
  petDescription?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  smartLockerPackage?: {
    drawerNumber: string;
    description: string;
    status: 'Pronto' | 'Retirado';
  };
  members: ResidentMember[];
}

export interface Invoice {
  id: string;
  unitNumber: string;
  block: string;
  residentName: string;
  description: string;
  dueDate: string;
  amount: number;
  status: 'liquidated' | 'due_today' | 'overdue' | 'advance' | 'upcoming';
  statusLabel: string;
  pixAuthenticated: boolean;
  whatsappReminderSent?: boolean;
  /** Campos presentes apenas em boletos persistidos no Supabase */
  unitId?: string;
  dueDateIso?: string; // YYYY-MM-DD
  paidAtIso?: string;
  pixCode?: string;
}

export interface AccessEntry {
  id: string;
  personName: string;
  photoUrl: string;
  timestamp: string;
  accessPoint: string;
  destination: string;
  type: 'Morador Residente' | 'Convidado QR Válido' | 'Liberação Temp. (15 min)' | 'Prestador de Serviço' | 'Abertura Remota Emergencial';
  authType: 'facial' | 'qr' | 'qr_code' | 'delivery' | 'manual' | 'tag';
  authDetail: string;
}

export interface AmenityReservation {
  id: string;
  spaceName: string;
  emoji: string;
  dateStr: string;
  date?: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  responsibleName: string;
  unitNumber: string;
  status: 'Aprovado / Taxa Paga' | 'Aprovado' | 'Aguardando Caução';
  statusType: 'success' | 'warning' | 'info';
}

export interface MaintenanceOrder {
  id: string;
  code: string;
  title: string;
  location: string;
  category?: string;
  description: string;
  status: string;
  statusType: 'completed' | 'in_progress' | 'scheduled' | 'certified';
  progressPercentage: number;
  scheduledTime: string;
  scheduledDate?: string;
  priority: 'Prioridade Máxima' | 'Média' | 'Normal' | 'Preventiva';
  technicians: {
    initials: string;
    name?: string;
    avatarUrl?: string;
  }[];
  technicianCompany?: string;
  materialsReserved?: boolean;
  hasCertificate?: boolean;
  createdAt?: string;
}
