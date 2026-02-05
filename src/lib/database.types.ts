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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action_type: string
          id: string
          performed_at: string | null
          pet_id: string | null
          schedule_id: string | null
          task_id: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          id?: string
          performed_at?: string | null
          pet_id?: string | null
          schedule_id?: string | null
          task_id?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          id?: string
          performed_at?: string | null
          pet_id?: string | null
          schedule_id?: string | null
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "daily_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          due_at: string
          household_id: string
          id: string
          label: string
          pet_id: string
          schedule_id: string | null
          status: string | null
          task_type: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_at: string
          household_id: string
          id?: string
          label: string
          pet_id: string
          schedule_id?: string | null
          status?: string | null
          task_type: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_at?: string
          household_id?: string
          id?: string
          label?: string
          pet_id?: string
          schedule_id?: string | null
          status?: string | null
          task_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_tasks_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "debug_households_view"
            referencedColumns: ["household_id"]
          },
          {
            foreignKeyName: "daily_tasks_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_tasks_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_tasks_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invitations: {
        Row: {
          id: string
          household_id: string
          invited_user_id: string
          invited_by: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          invited_user_id: string
          invited_by: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          invited_user_id?: string
          invited_by?: string
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_invitations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_invitations_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          can_edit: boolean | null
          can_log: boolean | null
          household_id: string
          is_active: boolean | null
          user_id: string
        }
        Insert: {
          can_edit?: boolean | null
          can_log?: boolean | null
          household_id: string
          is_active?: boolean | null
          user_id: string
        }
        Update: {
          can_edit?: boolean | null
          can_log?: boolean | null
          household_id?: string
          is_active?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hm_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "debug_households_view"
            referencedColumns: ["household_id"]
          },
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          id: string
          owner_id: string
          name: string | null
          subscription_status: string | null
        }
        Insert: {
          id?: string
          owner_id: string
          name?: string | null
          subscription_status?: string | null
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string | null
          subscription_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "households_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          created_by: string | null
          household_id: string | null
          icon: string | null
          id: string
          name: string
          pet_timezone: string
          species: string | null
        }
        Insert: {
          created_by?: string | null
          household_id?: string | null
          icon?: string | null
          id?: string
          name: string
          pet_timezone?: string
          species?: string | null
        }
        Update: {
          created_by?: string | null
          household_id?: string | null
          icon?: string | null
          id?: string
          name?: string
          pet_timezone?: string
          species?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "debug_households_view"
            referencedColumns: ["household_id"]
          },
          {
            foreignKeyName: "pets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          push_subscription: Json | null
          tier: string
          updated_at: string
          username: string | null
        }
        Insert: {
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          push_subscription?: Json | null
          tier?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          push_subscription?: Json | null
          tier?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      schedules: {
        Row: {
          dosage: string | null
          id: string
          interval_hours: number | null
          is_enabled: boolean | null
          label: string
          pet_id: string | null
          schedule_mode: string | null
          target_times: string[] | null
          task_type: string | null
        }
        Insert: {
          dosage?: string | null
          id?: string
          interval_hours?: number | null
          is_enabled?: boolean | null
          label: string
          pet_id?: string | null
          schedule_mode?: string | null
          target_times?: string[] | null
          task_type?: string | null
        }
        Update: {
          dosage?: string | null
          id?: string
          interval_hours?: number | null
          is_enabled?: boolean | null
          label?: string
          pet_id?: string | null
          schedule_mode?: string | null
          target_times?: string[] | null
          task_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedules_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      debug_households_view: {
        Row: {
          household_id: string | null
          owner_email: string | null
          owner_id: string | null
          owner_name: string | null
          subscription_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "households_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      debug_members_view: {
        Row: {
          can_edit: boolean | null
          can_log: boolean | null
          household_id: string | null
          household_owner_id: string | null
          is_active: boolean | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hm_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "debug_households_view"
            referencedColumns: ["household_id"]
          },
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "households_owner_id_fkey"
            columns: ["household_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_household_invite: {
        Args: { p_invite_id: string }
        Returns: Json
      }
      get_household_join_info: {
        Args: { _household_id: string }
        Returns: {
          member_count: number
          owner_name: string
        }[]
      }
      get_household_from_key: {
        Args: { lookup_key: string }
        Returns: {
          household_id: string
          owner_name: string
          member_count: number
        }[]
      }
      get_my_households: { Args: never; Returns: string[] }
      invite_user_by_identifier: {
        Args: { p_identifier: string; p_household_id: string }
        Returns: Json
      }
      invite_user_by_username: {
        Args: { p_username: string; p_household_id: string }
        Returns: Json
      }
      is_household_member: { Args: { _household_id: string }; Returns: boolean }
      join_household_by_key: {
        Args: { p_household_id: string }
        Returns: Json
      }
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
