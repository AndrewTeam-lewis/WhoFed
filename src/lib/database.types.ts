export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      activity_log: {
        Row: {
          id: string
          pet_id: string
          schedule_id: string | null
          user_id: string
          action_type: string
          performed_at: string
          task_id: string | null
        }
        Insert: {
          id?: string
          pet_id: string
          schedule_id?: string | null
          user_id: string
          action_type: string
          performed_at?: string
          task_id?: string | null
        }
        Update: {
          id?: string
          pet_id?: string
          schedule_id?: string | null
          user_id?: string
          action_type?: string
          performed_at?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_pet_id_fkey"
            columns: ["pet_id"]
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_schedule_id_fkey"
            columns: ["schedule_id"]
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      daily_tasks: {
        Row: {
          id: string
          pet_id: string
          schedule_id: string | null
          household_id: string
          user_id: string | null
          label: string
          task_type: string
          status: string
          due_at: string
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          pet_id: string
          schedule_id?: string | null
          household_id: string
          user_id?: string | null
          label: string
          task_type: string
          status?: string
          due_at: string
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          pet_id?: string
          schedule_id?: string
          household_id?: string
          user_id?: string | null
          label?: string
          task_type?: string
          status?: string
          due_at?: string
          completed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_tasks_pet_id_fkey"
            columns: ["pet_id"]
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_tasks_schedule_id_fkey"
            columns: ["schedule_id"]
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_tasks_household_id_fkey"
            columns: ["household_id"]
            referencedRelation: "households"
            referencedColumns: ["id"]
          }
        ]
      }
      household_members: {
        Row: {
          household_id: string
          user_id: string
          is_active: boolean
          can_log: boolean
          can_edit: boolean
        }
        Insert: {
          household_id: string
          user_id: string
          is_active?: boolean
          can_log?: boolean
          can_edit?: boolean
        }
        Update: {
          household_id?: string
          user_id?: string
          is_active?: boolean
          can_log?: boolean
          can_edit?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      households: {
        Row: {
          id: string
          owner_id: string
          subscription_status: string | null
        }
        Insert: {
          id?: string
          owner_id: string
          subscription_status?: string | null
        }
        Update: {
          id?: string
          owner_id?: string
          subscription_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "households_owner_id_fkey"
            columns: ["owner_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      pets: {
        Row: {
          id: string
          household_id: string
          name: string
          species: string
          icon: string
          pet_timezone: string | null
        }
        Insert: {
          id?: string
          household_id: string
          name: string
          species: string
          icon?: string
          pet_timezone?: string | null
        }
        Update: {
          id?: string
          household_id?: string
          name?: string
          species?: string
          icon?: string
          pet_timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pets_household_id_fkey"
            columns: ["household_id"]
            referencedRelation: "households"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          id: string
          updated_at: string | null
          username: string | null
          first_name: string | null
          last_name: string | null
          phone: string | null
          email: string | null
        }
        Insert: {
          id: string
          updated_at?: string | null
          username?: string | null
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          email?: string | null
        }
        Update: {
          id?: string
          updated_at?: string | null
          username?: string | null
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      schedules: {
        Row: {
          id: string
          pet_id: string
          task_type: string
          label: string | null
          dosage: string | null
          schedule_mode: string
          interval_hours: number | null
          target_times: string[] | null
          is_enabled: boolean
        }
        Insert: {
          id?: string
          pet_id: string
          task_type: string
          label?: string | null
          dosage?: string | null
          schedule_mode: string
          interval_hours?: number | null
          target_times?: string[] | null
          is_enabled?: boolean
        }
        Update: {
          id?: string
          pet_id?: string
          task_type?: string
          label?: string | null
          dosage?: string | null
          schedule_mode?: string
          interval_hours?: number | null
          target_times?: string[] | null
          is_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "schedules_pet_id_fkey"
            columns: ["pet_id"]
            referencedRelation: "pets"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_household_join_info: {
        Args: {
          _household_id: string
        }
        Returns: {
          owner_name: string
          member_count: number
        }[]
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
