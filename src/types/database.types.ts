export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type CondominiumRole = 'superadmin' | 'sindico' | 'morador' | 'porteiro';
export type MembershipStatus = 'active' | 'inactive' | 'pending';
export type InvoiceDbStatus = 'pending' | 'paid' | 'cancelled';
export type MaintenanceOrderDbStatus = 'scheduled' | 'in_progress' | 'completed' | 'certified';
export type MaintenanceOrderDbPriority = 'Prioridade Máxima' | 'Média' | 'Normal' | 'Preventiva';

export interface Database {
  public: {
    Tables: {
      condominiums: {
        Row: {
          id: string
          name: string
          cnpj: string | null
          address: string | null
          city: string | null
          state: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          cnpj?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          cnpj?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          id: string
          full_name: string
          email?: string | null
          phone: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          email?: string | null
          phone?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string | null
          phone?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      condominium_members: {
        Row: {
          id: string
          condominium_id: string
          user_id: string
          role: CondominiumRole
          status: MembershipStatus
          unit_id?: string | null
          unit_number?: string | null
          block?: string | null
          resident_type?: string | null
          has_pet?: boolean
          cpf?: string | null
          log_access_granted?: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          condominium_id: string
          user_id: string
          role: CondominiumRole
          status?: MembershipStatus
          unit_id?: string | null
          unit_number?: string | null
          block?: string | null
          resident_type?: string | null
          has_pet?: boolean
          cpf?: string | null
          log_access_granted?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          condominium_id?: string
          user_id?: string
          role?: CondominiumRole
          status?: MembershipStatus
          unit_id?: string | null
          unit_number?: string | null
          block?: string | null
          resident_type?: string | null
          has_pet?: boolean
          cpf?: string | null
          log_access_granted?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "condominium_members_condominium_id_fkey"
            columns: ["condominium_id"]
            isOneToOne: false
            referencedRelation: "condominiums"
            referencedColumns: ["id"]
          }
        ]
      }
      units: {
        Row: {
          id: string
          condominium_id: string
          identifier: string
          block: string
          floor: number | null
          owner_name?: string | null
          contact_name?: string | null
          resident_type?: 'Proprietário' | 'Inquilino' | null
          parking_spot?: string | null
          has_pet?: boolean
          vehicle_model?: string | null
          vehicle_plate?: string | null
          square_meters?: number | null
          residents_count?: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          condominium_id: string
          identifier: string
          block: string
          floor?: number | null
          owner_name?: string | null
          contact_name?: string | null
          resident_type?: 'Proprietário' | 'Inquilino' | null
          parking_spot?: string | null
          has_pet?: boolean
          vehicle_model?: string | null
          vehicle_plate?: string | null
          square_meters?: number | null
          residents_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          condominium_id?: string
          identifier?: string
          block?: string
          floor?: number | null
          owner_name?: string | null
          contact_name?: string | null
          resident_type?: 'Proprietário' | 'Inquilino' | null
          parking_spot?: string | null
          has_pet?: boolean
          vehicle_model?: string | null
          vehicle_plate?: string | null
          square_meters?: number | null
          residents_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_condominium_id_fkey"
            columns: ["condominium_id"]
            isOneToOne: false
            referencedRelation: "condominiums"
            referencedColumns: ["id"]
          }
        ]
      }
      common_areas: {
        Row: {
          id: string
          condominium_id: string
          name: string
          description: string | null
          capacity?: number
          fee?: number
          rules?: string | null
          requires_approval?: boolean
          emoji?: string | null
          hours?: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          condominium_id: string
          name: string
          description?: string | null
          capacity?: number
          fee?: number
          rules?: string | null
          requires_approval?: boolean
          emoji?: string | null
          hours?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          condominium_id?: string
          name?: string
          description?: string | null
          capacity?: number
          fee?: number
          rules?: string | null
          requires_approval?: boolean
          emoji?: string | null
          hours?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "common_areas_condominium_id_fkey"
            columns: ["condominium_id"]
            isOneToOne: false
            referencedRelation: "condominiums"
            referencedColumns: ["id"]
          }
        ]
      }
      invoices: {
        Row: {
          id: string
          condominium_id: string
          unit_id: string
          resident_name: string
          description: string
          amount: number
          due_date: string
          status: InvoiceDbStatus
          paid_at: string | null
          pix_code: string | null
          reminder_sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          condominium_id: string
          unit_id: string
          resident_name: string
          description: string
          amount: number
          due_date: string
          status?: InvoiceDbStatus
          paid_at?: string | null
          pix_code?: string | null
          reminder_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          condominium_id?: string
          unit_id?: string
          resident_name?: string
          description?: string
          amount?: number
          due_date?: string
          status?: InvoiceDbStatus
          paid_at?: string | null
          pix_code?: string | null
          reminder_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_condominium_id_fkey"
            columns: ["condominium_id"]
            isOneToOne: false
            referencedRelation: "condominiums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          }
        ]
      }
      maintenance_orders: {
        Row: {
          id: string
          condominium_id: string
          code: string
          title: string
          location: string
          category: string
          description: string
          priority: MaintenanceOrderDbPriority
          status: MaintenanceOrderDbStatus
          progress_percentage: number
          scheduled_date: string
          scheduled_time: string
          technician_name: string | null
          technician_company: string | null
          technician_initials: string | null
          materials_reserved: boolean
          has_certificate: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          condominium_id: string
          code: string
          title: string
          location: string
          category?: string
          description: string
          priority?: MaintenanceOrderDbPriority
          status?: MaintenanceOrderDbStatus
          progress_percentage?: number
          scheduled_date?: string
          scheduled_time?: string
          technician_name?: string | null
          technician_company?: string | null
          technician_initials?: string | null
          materials_reserved?: boolean
          has_certificate?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          condominium_id?: string
          code?: string
          title?: string
          location?: string
          category?: string
          description?: string
          priority?: MaintenanceOrderDbPriority
          status?: MaintenanceOrderDbStatus
          progress_percentage?: number
          scheduled_date?: string
          scheduled_time?: string
          technician_name?: string | null
          technician_company?: string | null
          technician_initials?: string | null
          materials_reserved?: boolean
          has_certificate?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_orders_condominium_id_fkey"
            columns: ["condominium_id"]
            isOneToOne: false
            referencedRelation: "condominiums"
            referencedColumns: ["id"]
          }
        ]
      }
      amenity_reservations: {
        Row: {
          id: string
          condominium_id: string
          common_area_id: string | null
          space_name: string
          emoji: string | null
          date: string
          start_time: string
          end_time: string
          date_str: string | null
          responsible_name: string
          unit_number: string
          rental_fee: number
          status: string
          status_type: 'success' | 'warning' | 'info'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          condominium_id: string
          common_area_id?: string | null
          space_name: string
          emoji?: string | null
          date: string
          start_time?: string
          end_time?: string
          date_str?: string | null
          responsible_name: string
          unit_number: string
          rental_fee?: number
          status?: string
          status_type?: 'success' | 'warning' | 'info'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          condominium_id?: string
          common_area_id?: string | null
          space_name?: string
          emoji?: string | null
          date?: string
          start_time?: string
          end_time?: string
          date_str?: string | null
          responsible_name?: string
          unit_number?: string
          rental_fee?: number
          status?: string
          status_type?: 'success' | 'warning' | 'info'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amenity_reservations_condominium_id_fkey"
            columns: ["condominium_id"]
            isOneToOne: false
            referencedRelation: "condominiums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amenity_reservations_common_area_id_fkey"
            columns: ["common_area_id"]
            isOneToOne: false
            referencedRelation: "common_areas"
            referencedColumns: ["id"]
          }
        ]
      }
      access_logs: {
        Row: {
          id: string
          condominium_id: string
          person_name: string
          photo_url: string | null
          auth_type: string
          auth_detail: string
          access_point: string
          destination: string
          entry_type: string
          created_at: string
        }
        Insert: {
          id?: string
          condominium_id: string
          person_name: string
          photo_url?: string | null
          auth_type?: string
          auth_detail?: string
          access_point?: string
          destination: string
          entry_type?: string
          created_at?: string
        }
        Update: {
          id?: string
          condominium_id?: string
          person_name?: string
          photo_url?: string | null
          auth_type?: string
          auth_detail?: string
          access_point?: string
          destination?: string
          entry_type?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_logs_condominium_id_fkey"
            columns: ["condominium_id"]
            isOneToOne: false
            referencedRelation: "condominiums"
            referencedColumns: ["id"]
          }
        ]
      }
      announcements: {
        Row: {
          id: string
          condominium_id: string
          title: string
          category: 'Urgente' | 'Manutenção' | 'Assembleia' | 'Convivência' | 'Comunicado'
          content: string
          author_name: string
          author_user_id: string | null
          is_pinned: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          condominium_id: string
          title: string
          category?: 'Urgente' | 'Manutenção' | 'Assembleia' | 'Convivência' | 'Comunicado'
          content: string
          author_name: string
          author_user_id?: string | null
          is_pinned?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          condominium_id?: string
          title?: string
          category?: 'Urgente' | 'Manutenção' | 'Assembleia' | 'Convivência' | 'Comunicado'
          content?: string
          author_name?: string
          author_user_id?: string | null
          is_pinned?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      condominium_bank_settings: {
        Row: {
          id: string
          condominium_id: string
          bank_code: string
          bank_name: string
          agency: string
          account_number: string
          account_digit: string
          wallet_code: string
          beneficiary_name: string
          beneficiary_cnpj: string
          pix_key_type: 'CNPJ' | 'E-mail' | 'Telefone' | 'Chave Aleatória'
          pix_key: string
          interest_rate_monthly: number
          fine_percent: number
          instructions_line1: string | null
          instructions_line2: string | null
          active_integration: boolean
          updated_by_name: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          condominium_id: string
          bank_code?: string
          bank_name?: string
          agency: string
          account_number: string
          account_digit: string
          wallet_code?: string
          beneficiary_name: string
          beneficiary_cnpj: string
          pix_key_type?: 'CNPJ' | 'E-mail' | 'Telefone' | 'Chave Aleatória'
          pix_key: string
          interest_rate_monthly?: number
          fine_percent?: number
          instructions_line1?: string | null
          instructions_line2?: string | null
          active_integration?: boolean
          updated_by_name?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          condominium_id?: string
          bank_code?: string
          bank_name?: string
          agency?: string
          account_number?: string
          account_digit?: string
          wallet_code?: string
          beneficiary_name?: string
          beneficiary_cnpj?: string
          pix_key_type?: 'CNPJ' | 'E-mail' | 'Telefone' | 'Chave Aleatória'
          pix_key?: string
          interest_rate_monthly?: number
          fine_percent?: number
          instructions_line1?: string | null
          instructions_line2?: string | null
          active_integration?: boolean
          updated_by_name?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      condominium_financial_config: {
        Row: {
          id: string
          condominium_id: string
          reserve_fund_balance: number
          reserve_fund_yield_rate: number
          reserve_fund_institution: string
          reserve_fund_target_title: string
          reserve_fund_target_amount: number
          reserve_fund_history: Json
          monthly_budget: number
          ai_diagnosis: Json | null
          channel_metrics: Json | null
          ai_energy: Json | null
          health_metrics: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          condominium_id: string
          reserve_fund_balance?: number
          reserve_fund_yield_rate?: number
          reserve_fund_institution?: string
          reserve_fund_target_title?: string
          reserve_fund_target_amount?: number
          reserve_fund_history?: Json
          monthly_budget?: number
          ai_diagnosis?: Json | null
          channel_metrics?: Json | null
          ai_energy?: Json | null
          health_metrics?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          condominium_id?: string
          reserve_fund_balance?: number
          reserve_fund_yield_rate?: number
          reserve_fund_institution?: string
          reserve_fund_target_title?: string
          reserve_fund_target_amount?: number
          reserve_fund_history?: Json
          monthly_budget?: number
          ai_diagnosis?: Json | null
          channel_metrics?: Json | null
          ai_energy?: Json | null
          health_metrics?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      operational_expenses: {
        Row: {
          id: string
          condominium_id: string
          category: string
          supplier: string
          description: string
          amount: number
          due_date: string
          status: 'Pago' | 'Pendente' | 'Agendado'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          condominium_id: string
          category: string
          supplier: string
          description: string
          amount: number
          due_date: string
          status?: 'Pago' | 'Pendente' | 'Agendado'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          condominium_id?: string
          category?: string
          supplier?: string
          description?: string
          amount?: number
          due_date?: string
          status?: 'Pago' | 'Pendente' | 'Agendado'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          condominium_id: string | null
          actor_user_id: string | null
          action: string
          entity_table: string
          entity_id: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          condominium_id?: string | null
          actor_user_id?: string | null
          action: string
          entity_table: string
          entity_id?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          condominium_id?: string | null
          actor_user_id?: string | null
          action?: string
          entity_table?: string
          entity_id?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      resolve_user_by_email: {
        Args: { target_email: string }
        Returns: {
          user_id: string
          full_name: string
          email: string
          phone: string | null
          avatar_url: string | null
        }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Condominium = Database['public']['Tables']['condominiums']['Row'];
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type CondominiumMember = Database['public']['Tables']['condominium_members']['Row'];
export type Unit = Database['public']['Tables']['units']['Row'];
export type CommonArea = Database['public']['Tables']['common_areas']['Row'];
export type InvoiceRow = Database['public']['Tables']['invoices']['Row'];
export type MaintenanceOrderRow = Database['public']['Tables']['maintenance_orders']['Row'];
export type AmenityReservationRow = Database['public']['Tables']['amenity_reservations']['Row'];
export type AccessLogRow = Database['public']['Tables']['access_logs']['Row'];
export type AnnouncementRow = Database['public']['Tables']['announcements']['Row'];
export type CondominiumBankSettingsRow = Database['public']['Tables']['condominium_bank_settings']['Row'];
export type CondominiumFinancialConfigRow = Database['public']['Tables']['condominium_financial_config']['Row'];
export type OperationalExpenseRow = Database['public']['Tables']['operational_expenses']['Row'];
export type AuditLogRow = Database['public']['Tables']['audit_logs']['Row'];

export interface ActiveMembershipContext {
  membership: CondominiumMember;
  condominium: Condominium;
}
