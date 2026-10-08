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
          phone: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          phone?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
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
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          condominium_id: string
          user_id: string
          role: CondominiumRole
          status?: MembershipStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          condominium_id?: string
          user_id?: string
          role?: CondominiumRole
          status?: MembershipStatus
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
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          condominium_id: string
          identifier: string
          block: string
          floor?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          condominium_id?: string
          identifier?: string
          block?: string
          floor?: number | null
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
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          condominium_id: string
          name: string
          description?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          condominium_id?: string
          name?: string
          description?: string | null
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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type MaintenanceOrderDbStatus = 'scheduled' | 'in_progress' | 'completed' | 'certified';
export type MaintenanceOrderDbPriority = 'Prioridade Máxima' | 'Média' | 'Normal' | 'Preventiva';

export type Condominium = Database['public']['Tables']['condominiums']['Row'];
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type CondominiumMember = Database['public']['Tables']['condominium_members']['Row'];
export type Unit = Database['public']['Tables']['units']['Row'];
export type CommonArea = Database['public']['Tables']['common_areas']['Row'];
export type InvoiceRow = Database['public']['Tables']['invoices']['Row'];
export type MaintenanceOrderRow = Database['public']['Tables']['maintenance_orders']['Row'];
export type AmenityReservationRow = Database['public']['Tables']['amenity_reservations']['Row'];
export type AccessLogRow = Database['public']['Tables']['access_logs']['Row'];

export interface ActiveMembershipContext {
  membership: CondominiumMember;
  condominium: Condominium;
}
