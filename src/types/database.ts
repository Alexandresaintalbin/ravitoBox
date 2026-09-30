export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          pseudo: string
          weight_kg: number | null
          primary_sport: Database['public']['Enums']['sport'] | null
          tolerance_g_per_h: number
          preferred_flavors: string[]
          role: Database['public']['Enums']['app_role']
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          pseudo: string
          weight_kg?: number | null
          primary_sport?: Database['public']['Enums']['sport'] | null
          tolerance_g_per_h?: number
          preferred_flavors?: string[]
          role?: Database['public']['Enums']['app_role']
        }
        Update: {
          pseudo?: string
          weight_kg?: number | null
          primary_sport?: Database['public']['Enums']['sport'] | null
          tolerance_g_per_h?: number
          preferred_flavors?: string[]
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          name: string
          brand: string | null
          product_type: Database['public']['Enums']['product_type']
          flavor: string | null
          carbs_g: number
          sodium_mg: number
          caffeine_mg: number
          volume_ml: number | null
          scope: Database['public']['Enums']['product_scope']
          owner_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          brand?: string | null
          product_type: Database['public']['Enums']['product_type']
          flavor?: string | null
          carbs_g?: number
          sodium_mg?: number
          caffeine_mg?: number
          volume_ml?: number | null
          scope: Database['public']['Enums']['product_scope']
          owner_id?: string | null
        }
        Update: {
          name?: string
          brand?: string | null
          product_type?: Database['public']['Enums']['product_type']
          flavor?: string | null
          carbs_g?: number
          sodium_mg?: number
          caffeine_mg?: number
          volume_ml?: number | null
        }
        Relationships: []
      }
      box_items: {
        Row: {
          user_id: string
          product_id: string
          quantity: number
          excluded: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          product_id: string
          quantity?: number
          excluded?: boolean
        }
        Update: {
          quantity?: number
          excluded?: boolean
        }
        Relationships: []
      }
      favorites: {
        Row: { user_id: string; product_id: string; created_at: string }
        Insert: { user_id: string; product_id: string }
        Update: Record<string, never>
        Relationships: []
      }
      plans: {
        Row: {
          id: string
          user_id: string
          title: string
          sport: Database['public']['Enums']['sport']
          session_type: Database['public']['Enums']['session_type']
          parameters: Json
          targets: Json
          generated_plan: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          sport: Database['public']['Enums']['sport']
          session_type: Database['public']['Enums']['session_type']
          parameters: Json
          targets: Json
          generated_plan: Json
        }
        Update: {
          title?: string
          parameters?: Json
          targets?: Json
          generated_plan?: Json
        }
        Relationships: []
      }
      debriefs: {
        Row: {
          id: string
          plan_id: string
          user_id: string
          energy: number
          stomach: number
          thirst: number
          notes: string | null
          consumed: Json
          created_at: string
        }
        Insert: {
          id?: string
          plan_id: string
          user_id: string
          energy: number
          stomach: number
          thirst: number
          notes?: string | null
          consumed?: Json
        }
        Update: {
          energy?: number
          stomach?: number
          thirst?: number
          notes?: string | null
          consumed?: Json
        }
        Relationships: []
      }
      badges: {
        Row: { id: string; name: string; description: string; icon: string }
        Insert: { id: string; name: string; description: string; icon: string }
        Update: { name?: string; description?: string; icon?: string }
        Relationships: []
      }
      user_badges: {
        Row: { user_id: string; badge_id: string; earned_at: string }
        Insert: { user_id: string; badge_id: string }
        Update: Record<string, never>
        Relationships: []
      }
      app_settings: {
        Row: { key: string; value: string; updated_at: string }
        Insert: { key: string; value: string }
        Update: { value?: string }
        Relationships: []
      }
      invitations: {
        Row: {
          id: string
          code: string
          note: string | null
          active: boolean
          max_uses: number
          use_count: number
          expires_at: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          code: string
          note?: string | null
          active?: boolean
          max_uses?: number
          expires_at?: string | null
          created_by?: string | null
        }
        Update: { active?: boolean; note?: string | null }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      signup_policy: { Args: Record<string, never>; Returns: Json }
      admin_list_accounts: {
        Args: Record<string, never>
        Returns: {
          id: string
          email: string
          pseudo: string
          role: Database['public']['Enums']['app_role']
          active: boolean
          created_at: string
        }[]
      }
      admin_create_account: { Args: { p_email: string; p_password: string; p_pseudo: string }; Returns: string }
      admin_set_account_active: { Args: { p_user_id: string; p_active: boolean }; Returns: undefined }
      tables_without_rls: { Args: Record<string, never>; Returns: string[] }
      delete_own_account: { Args: Record<string, never>; Returns: undefined }
      sync_my_badges: { Args: Record<string, never>; Returns: Database['public']['Tables']['user_badges']['Row'][] }
    }
    Enums: {
      sport: 'course' | 'trail' | 'cyclisme' | 'triathlon'
      session_type: 'entrainement' | 'course_intermediaire' | 'objectif_principal'
      product_type: 'gel' | 'boisson' | 'barre' | 'compote' | 'pate_de_fruit' | 'capsule_sel' | 'eau' | 'autre'
      product_scope: 'catalog' | 'custom'
      app_role: 'user' | 'admin'
    }
    CompositeTypes: Record<string, never>
  }
}
