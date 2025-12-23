export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admins: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          email: string
          id: string
          name: string
          role_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          name: string
          role_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          role_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admins_role_id_fkey"
            columns: ["role_id"]
            referencedRelation: "roles"
            referencedColumns: ["id"]
          }
        ]
      }
      gym_schedule: {
        Row: {
          close_time: string
          created_at: string | null
          day_of_week: string
          id: string
          open_time: string
        }
        Insert: {
          close_time: string
          created_at?: string | null
          day_of_week: string
          id?: string
          open_time: string
        }
        Update: {
          close_time?: string
          created_at?: string | null
          day_of_week?: string
          id?: string
          open_time?: string
        }
        Relationships: []
      }
      gym_settings: {
        Row: {
          address: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          email: string | null
          id: string
          name: string
          payment_methods: string[] | null
          phone: string | null
          tax_rate: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          email?: string | null
          id?: string
          name: string
          payment_methods?: string[] | null
          phone?: string | null
          tax_rate?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          email?: string | null
          id?: string
          name?: string
          payment_methods?: string[] | null
          phone?: string | null
          tax_rate?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      members: {
        Row: {
          created_at: string | null
          email: string
          frozen: boolean | null
          id: string
          name: string
          payment_date: string | null
          phone: string | null
          plan_id: string | null
          start_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          frozen?: boolean | null
          id?: string
          name: string
          payment_date?: string | null
          phone?: string | null
          plan_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          frozen?: boolean | null
          id?: string
          name?: string
          payment_date?: string | null
          phone?: string | null
          plan_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_plan_id_fkey"
            columns: ["plan_id"]
            referencedRelation: "plans"
            referencedColumns: ["id"]
          }
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          due_date: string
          id: string
          member_id: string | null
          method: string | null
          payment_date: string | null
          payment_rate: number | null
          plan_id: string | null
          reference: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          due_date: string
          id?: string
          member_id?: string | null
          method?: string | null
          payment_date?: string | null
          payment_rate?: number | null
          plan_id?: string | null
          reference?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          due_date?: string
          id?: string
          member_id?: string | null
          method?: string | null
          payment_date?: string | null
          payment_rate?: number | null
          plan_id?: string | null
          reference?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            referencedRelation: "plans"
            referencedColumns: ["id"]
          }
        ]
      }
      plans: {
        Row: {
          active: boolean | null
          created_at: string | null
          duration: string
          features: string[] | null
          id: string
          name: string
          price: number
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          duration: string
          features?: string[] | null
          id?: string
          name: string
          price: number
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          duration?: string
          features?: string[] | null
          id?: string
          name?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          permissions: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          permissions?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          permissions?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      special_class_payments: {
        Row: {
          amount: number
          class_id: string | null
          created_at: string | null
          id: string
          member_id: string | null
          method: string | null
          payment_date: string | null
          payment_rate: number | null
          reference: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          class_id?: string | null
          created_at?: string | null
          id?: string
          member_id?: string | null
          method?: string | null
          payment_date?: string | null
          payment_rate?: number | null
          reference?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          class_id?: string | null
          created_at?: string | null
          id?: string
          member_id?: string | null
          method?: string | null
          payment_date?: string | null
          payment_rate?: number | null
          reference?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "special_class_payments_class_id_fkey"
            columns: ["class_id"]
            referencedRelation: "special_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_class_payments_member_id_fkey"
            columns: ["member_id"]
            referencedRelation: "members"
            referencedColumns: ["id"]
          }
        ]
      }
      special_classes: {
        Row: {
          capacity: number
          created_at: string | null
          enrolled: number | null
          id: string
          instructor: string
          name: string
          price: number
          schedule: string
          updated_at: string | null
        }
        Insert: {
          capacity: number
          created_at?: string | null
          enrolled?: number | null
          id?: string
          instructor: string
          name: string
          price: number
          schedule: string
          updated_at?: string | null
        }
        Update: {
          capacity?: number
          created_at?: string | null
          enrolled?: number | null
          id?: string
          instructor?: string
          name?: string
          price?: number
          schedule?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      monthly_closings: {
        Row: {
          id: string
          period: string
          membership_revenue_bs: number | null
          membership_revenue_usd_cash: number | null
          membership_revenue_usdt: number | null
          membership_payments_count: number | null
          class_revenue_bs: number | null
          class_revenue_usd_cash: number | null
          class_revenue_usdt: number | null
          class_payments_count: number | null
          total_revenue_usd: number | null
          active_members: number | null
          new_members: number | null
          expired_members: number | null
          frozen_members: number | null
          total_members: number | null
          retention_rate: number | null
          funds_bs: number | null
          funds_usd_cash: number | null
          funds_usdt: number | null
          funds_reset: boolean | null
          rate_bcv: number | null
          rate_usdt: number | null
          rate_custom: number | null
          closed_by: string | null
          closed_at: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          period: string
          membership_revenue_bs?: number | null
          membership_revenue_usd_cash?: number | null
          membership_revenue_usdt?: number | null
          membership_payments_count?: number | null
          class_revenue_bs?: number | null
          class_revenue_usd_cash?: number | null
          class_revenue_usdt?: number | null
          class_payments_count?: number | null
          total_revenue_usd?: number | null
          active_members?: number | null
          new_members?: number | null
          expired_members?: number | null
          frozen_members?: number | null
          total_members?: number | null
          retention_rate?: number | null
          funds_bs?: number | null
          funds_usd_cash?: number | null
          funds_usdt?: number | null
          funds_reset?: boolean | null
          rate_bcv?: number | null
          rate_usdt?: number | null
          rate_custom?: number | null
          closed_by?: string | null
          closed_at?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          period?: string
          membership_revenue_bs?: number | null
          membership_revenue_usd_cash?: number | null
          membership_revenue_usdt?: number | null
          membership_payments_count?: number | null
          class_revenue_bs?: number | null
          class_revenue_usd_cash?: number | null
          class_revenue_usdt?: number | null
          class_payments_count?: number | null
          total_revenue_usd?: number | null
          active_members?: number | null
          new_members?: number | null
          expired_members?: number | null
          frozen_members?: number | null
          total_members?: number | null
          retention_rate?: number | null
          funds_bs?: number | null
          funds_usd_cash?: number | null
          funds_usdt?: number | null
          funds_reset?: boolean | null
          rate_bcv?: number | null
          rate_usdt?: number | null
          rate_custom?: number | null
          closed_by?: string | null
          closed_at?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_closings_closed_by_fkey"
            columns: ["closed_by"]
            referencedRelation: "admins"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"]

// Monthly Closing types
export interface MonthlyClosing {
  id: string
  period: string
  
  // Ingresos membresías
  membership_revenue_bs: number
  membership_revenue_usd_cash: number
  membership_revenue_usdt: number
  membership_payments_count: number
  
  // Ingresos clases
  class_revenue_bs: number
  class_revenue_usd_cash: number
  class_revenue_usdt: number
  class_payments_count: number
  
  // Total USD
  total_revenue_usd: number
  
  // Métricas miembros
  active_members: number
  new_members: number
  expired_members: number
  frozen_members: number
  total_members: number
  retention_rate: number
  
  // Fondos
  funds_bs: number
  funds_usd_cash: number
  funds_usdt: number
  funds_reset: boolean
  
  // Tasas
  rate_bcv: number
  rate_usdt: number
  rate_custom: number
  
  // Metadata
  closed_by: string | null
  closed_at: string
  notes: string | null
  created_at: string
  
  // Relaciones
  admin?: { name: string }
}

export interface MonthlyClosingPreview {
  period: string
  membership_revenue: { bs: number; usd_cash: number; usdt: number; count: number }
  class_revenue: { bs: number; usd_cash: number; usdt: number; count: number }
  total_revenue_usd: number
  members: { active: number; new: number; expired: number; frozen: number; total: number; retention: number }
  funds: { bs: number; usd_cash: number; usdt: number }
  rates: { bcv: number; usdt: number; custom: number }
}
