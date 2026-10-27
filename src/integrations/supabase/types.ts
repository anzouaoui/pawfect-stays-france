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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      booking_requests: {
        Row: {
          check_in: string
          check_out: string
          created_at: string
          dogs: Json
          fee: number
          host_id: string
          id: string
          listing_id: string
          listing_name: string
          message: string
          nights: number
          payment_intent_id: string | null
          payment_status: string
          status: string
          subtotal: number
          traveler_id: string
          updated_at: string
        }
        Insert: {
          check_in: string
          check_out: string
          created_at?: string
          dogs?: Json
          fee?: number
          host_id: string
          id?: string
          listing_id: string
          listing_name?: string
          message?: string
          nights?: number
          payment_intent_id?: string | null
          payment_status?: string
          status?: string
          subtotal?: number
          traveler_id?: string
          updated_at?: string
        }
        Update: {
          check_in?: string
          check_out?: string
          created_at?: string
          dogs?: Json
          fee?: number
          host_id?: string
          id?: string
          listing_id?: string
          listing_name?: string
          message?: string
          nights?: number
          payment_intent_id?: string | null
          payment_status?: string
          status?: string
          subtotal?: number
          traveler_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "host_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      dog_profiles: {
        Row: {
          behavior: string
          breed: string
          created_at: string
          id: string
          name: string
          owner_id: string
          size: string
          weight: number
        }
        Insert: {
          behavior?: string
          breed: string
          created_at?: string
          id?: string
          name: string
          owner_id?: string
          size: string
          weight: number
        }
        Update: {
          behavior?: string
          breed?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          size?: string
          weight?: number
        }
        Relationships: []
      }
      host_listings: {
        Row: {
          available_from: string
          available_to: string
          blocked_dates: string[]
          city: string
          cleaning_fee: number
          created_at: string
          description: string
          dog_fee_per_night: number
          dog_rules: Json
          equipment: string[]
          fenced_garden: boolean
          id: string
          max_dogs: number
          min_nights: number
          name: string
          owner_id: string
          photos: string[]
          price_per_night: number
          region: string
          sizes: string[]
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          available_from: string
          available_to: string
          blocked_dates?: string[]
          city: string
          cleaning_fee?: number
          created_at?: string
          description?: string
          dog_fee_per_night?: number
          dog_rules?: Json
          equipment?: string[]
          fenced_garden?: boolean
          id?: string
          max_dogs?: number
          min_nights?: number
          name: string
          owner_id?: string
          photos?: string[]
          price_per_night: number
          region?: string
          sizes?: string[]
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          available_from?: string
          available_to?: string
          blocked_dates?: string[]
          city?: string
          cleaning_fee?: number
          created_at?: string
          description?: string
          dog_fee_per_night?: number
          dog_rules?: Json
          equipment?: string[]
          fenced_garden?: boolean
          id?: string
          max_dogs?: number
          min_nights?: number
          name?: string
          owner_id?: string
          photos?: string[]
          price_per_night?: number
          region?: string
          sizes?: string[]
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
