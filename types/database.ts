export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          admin_id: string | null
          admin_name: string | null
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          admin_id?: string | null
          admin_name?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          admin_id?: string | null
          admin_name?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
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
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          id: string
          rate: number
          type: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          rate?: number
          type: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          rate?: number
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      funds: {
        Row: {
          balance: number
          id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          balance?: number
          id?: string
          type: string
          updated_at?: string | null
        }
        Update: {
          balance?: number
          id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
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
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string | null
          email: string
          frozen: boolean | null
          id: string
          must_change_password: boolean | null
          name: string
          payment_date: string | null
          phone: string | null
          plan_id: string | null
          start_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email: string
          frozen?: boolean | null
          id?: string
          must_change_password?: boolean | null
          name: string
          payment_date?: string | null
          phone?: string | null
          plan_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          frozen?: boolean | null
          id?: string
          must_change_password?: boolean | null
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
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_closings: {
        Row: {
          active_members: number | null
          class_payments_count: number | null
          class_revenue_bs: number | null
          class_revenue_usd_cash: number | null
          class_revenue_usdt: number | null
          closed_at: string | null
          closed_by: string | null
          created_at: string | null
          expired_members: number | null
          frozen_members: number | null
          funds_bs: number | null
          funds_reset: boolean | null
          funds_usd_cash: number | null
          funds_usdt: number | null
          id: string
          membership_payments_count: number | null
          membership_revenue_bs: number | null
          membership_revenue_usd_cash: number | null
          membership_revenue_usdt: number | null
          new_members: number | null
          notes: string | null
          period: string
          rate_bcv: number | null
          rate_custom: number | null
          rate_usdt: number | null
          retention_rate: number | null
          total_members: number | null
          total_revenue_usd: number | null
        }
        Insert: {
          active_members?: number | null
          class_payments_count?: number | null
          class_revenue_bs?: number | null
          class_revenue_usd_cash?: number | null
          class_revenue_usdt?: number | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          expired_members?: number | null
          frozen_members?: number | null
          funds_bs?: number | null
          funds_reset?: boolean | null
          funds_usd_cash?: number | null
          funds_usdt?: number | null
          id?: string
          membership_payments_count?: number | null
          membership_revenue_bs?: number | null
          membership_revenue_usd_cash?: number | null
          membership_revenue_usdt?: number | null
          new_members?: number | null
          notes?: string | null
          period: string
          rate_bcv?: number | null
          rate_custom?: number | null
          rate_usdt?: number | null
          retention_rate?: number | null
          total_members?: number | null
          total_revenue_usd?: number | null
        }
        Update: {
          active_members?: number | null
          class_payments_count?: number | null
          class_revenue_bs?: number | null
          class_revenue_usd_cash?: number | null
          class_revenue_usdt?: number | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          expired_members?: number | null
          frozen_members?: number | null
          funds_bs?: number | null
          funds_reset?: boolean | null
          funds_usd_cash?: number | null
          funds_usdt?: number | null
          id?: string
          membership_payments_count?: number | null
          membership_revenue_bs?: number | null
          membership_revenue_usd_cash?: number | null
          membership_revenue_usdt?: number | null
          new_members?: number | null
          notes?: string | null
          period?: string
          rate_bcv?: number | null
          rate_custom?: number | null
          rate_usdt?: number | null
          retention_rate?: number | null
          total_members?: number | null
          total_revenue_usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_closings_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
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
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
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
      renewal_notifications_log: {
        Row: {
          created_at: string | null
          errors: string[] | null
          executed_at: string | null
          id: string
          sent_count: number | null
          status: string | null
          total_members: number | null
        }
        Insert: {
          created_at?: string | null
          errors?: string[] | null
          executed_at?: string | null
          id?: string
          sent_count?: number | null
          status?: string | null
          total_members?: number | null
        }
        Update: {
          created_at?: string | null
          errors?: string[] | null
          executed_at?: string | null
          id?: string
          sent_count?: number | null
          status?: string | null
          total_members?: number | null
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
      routine_assignments: {
        Row: {
          created_at: string | null
          day_of_week: string
          id: string
          plan_id: string
          routine_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week: string
          id?: string
          plan_id: string
          routine_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: string
          id?: string
          plan_id?: string
          routine_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routine_assignments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_assignments_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
        ]
      }
      routines: {
        Row: {
          content: string
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          content?: string
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          name?: string
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
            isOneToOne: false
            referencedRelation: "special_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_class_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

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

export interface PendingPeriod {
  period: string      // "2026-01"
  label: string       // "Enero 2026"
  isOldest: boolean   // To highlight the oldest one
}
