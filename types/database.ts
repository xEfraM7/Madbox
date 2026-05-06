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
          athlete_level: string | null
          athlete_since: string | null
          auth_user_id: string | null
          avatar_url: string | null
          birth_date: string | null
          created_at: string | null
          discoverable: boolean
          email: string
          frozen: boolean | null
          gender: string | null
          height_cm: number | null
          id: string
          must_change_password: boolean | null
          name: string
          payment_date: string | null
          phone: string | null
          plan_id: string | null
          quote: string | null
          show_avatar: boolean
          show_body_metrics: boolean
          show_plan: boolean
          show_rms: boolean
          show_wods: boolean
          start_date: string | null
          status: string | null
          updated_at: string | null
          weight_kg: number | null
        }
        Insert: {
          athlete_level?: string | null
          athlete_since?: string | null
          auth_user_id?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string | null
          discoverable?: boolean
          email: string
          frozen?: boolean | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          must_change_password?: boolean | null
          name: string
          payment_date?: string | null
          phone?: string | null
          plan_id?: string | null
          quote?: string | null
          show_avatar?: boolean
          show_body_metrics?: boolean
          show_plan?: boolean
          show_rms?: boolean
          show_wods?: boolean
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          weight_kg?: number | null
        }
        Update: {
          athlete_level?: string | null
          athlete_since?: string | null
          auth_user_id?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string | null
          discoverable?: boolean
          email?: string
          frozen?: boolean | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          must_change_password?: boolean | null
          name?: string
          payment_date?: string | null
          phone?: string | null
          plan_id?: string | null
          quote?: string | null
          show_avatar?: boolean
          show_body_metrics?: boolean
          show_plan?: boolean
          show_rms?: boolean
          show_wods?: boolean
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          weight_kg?: number | null
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
      personal_records: {
        Row: {
          achieved_at: string | null
          created_at: string | null
          id: string
          member_id: string
          movement: string
          updated_at: string | null
          weight_kg: number
        }
        Insert: {
          achieved_at?: string | null
          created_at?: string | null
          id?: string
          member_id: string
          movement: string
          updated_at?: string | null
          weight_kg: number
        }
        Update: {
          achieved_at?: string | null
          created_at?: string | null
          id?: string
          member_id?: string
          movement?: string
          updated_at?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "personal_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
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
      routine_schedule_plans: {
        Row: {
          plan_id: string
          schedule_id: string
        }
        Insert: {
          plan_id: string
          schedule_id: string
        }
        Update: {
          plan_id?: string
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_schedule_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_schedule_plans_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "routine_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_schedules: {
        Row: {
          blocks: Json
          content: string
          created_at: string | null
          date: string
          id: string
          name: string | null
          updated_at: string | null
        }
        Insert: {
          blocks?: Json
          content?: string
          created_at?: string | null
          date: string
          id?: string
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          blocks?: Json
          content?: string
          created_at?: string | null
          date?: string
          id?: string
          name?: string | null
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
      wod_logs: {
        Row: {
          block_id: string
          created_at: string | null
          date: string
          id: string
          member_id: string
          notes: string | null
          routine_id: string
          rx: boolean
          score_kg: number | null
          score_reps: number | null
          score_rounds: number | null
          score_seconds: number | null
          score_type: string
          updated_at: string | null
        }
        Insert: {
          block_id?: string
          created_at?: string | null
          date: string
          id?: string
          member_id: string
          notes?: string | null
          routine_id: string
          rx?: boolean
          score_kg?: number | null
          score_reps?: number | null
          score_rounds?: number | null
          score_seconds?: number | null
          score_type: string
          updated_at?: string | null
        }
        Update: {
          block_id?: string
          created_at?: string | null
          date?: string
          id?: string
          member_id?: string
          notes?: string | null
          routine_id?: string
          rx?: boolean
          score_kg?: number | null
          score_reps?: number | null
          score_rounds?: number | null
          score_seconds?: number | null
          score_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wod_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wod_logs_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routine_schedules"
            referencedColumns: ["id"]
          },
        ]
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
