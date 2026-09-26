// Generated from the ClientsForge Supabase schema (supabase gen types), trimmed
// to the tables this feature uses. One manual patch, marked PATCH below:
// save_automation accepts a null p_automation_id to insert, which the
// generator cannot infer. Regenerate after schema changes and re-apply it.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      automations: {
        Row: {
          client_id: string
          created_at: string
          dm_link_label: string | null
          dm_link_url: string | null
          dm_message: string
          id: string
          instagram_account_id: string
          is_active: boolean
          keywords: string[]
          media_caption: string | null
          media_id: string
          media_permalink: string | null
          media_thumbnail_url: string | null
          media_type: string | null
          name: string
          public_replies: string[]
          public_reply_enabled: boolean
          trigger_type: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          dm_link_label?: string | null
          dm_link_url?: string | null
          dm_message: string
          id?: string
          instagram_account_id: string
          is_active?: boolean
          keywords?: string[]
          media_caption?: string | null
          media_id: string
          media_permalink?: string | null
          media_thumbnail_url?: string | null
          media_type?: string | null
          name: string
          public_replies?: string[]
          public_reply_enabled?: boolean
          trigger_type: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          dm_link_label?: string | null
          dm_link_url?: string | null
          dm_message?: string
          id?: string
          instagram_account_id?: string
          is_active?: boolean
          keywords?: string[]
          media_caption?: string | null
          media_id?: string
          media_permalink?: string | null
          media_thumbnail_url?: string | null
          media_type?: string | null
          name?: string
          public_replies?: string[]
          public_reply_enabled?: boolean
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_sessions: {
        Row: {
          client_id: string
          created_at: string
          expires_at: string
          id: string
          ip: string | null
          last_seen_at: string
          token_hash: string
          user_agent: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          expires_at: string
          id?: string
          ip?: string | null
          last_seen_at?: string
          token_hash: string
          user_agent?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          ip?: string | null
          last_seen_at?: string
          token_hash?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_login_at: string | null
          name: string
          pin: string | null
          pin_hash: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          name: string
          pin?: string | null
          pin_hash?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          name?: string
          pin?: string | null
          pin_hash?: string | null
        }
        Relationships: []
      }
      comment_events: {
        Row: {
          attempts: number
          automation_id: string | null
          client_id: string | null
          comment_id: string
          comment_text: string | null
          commenter_id: string | null
          commenter_username: string | null
          dm_status: string | null
          error: string | null
          id: string
          ig_user_id: string
          last_attempt_at: string | null
          media_id: string | null
          processed_at: string | null
          public_reply_status: string | null
          received_at: string
          retryable: boolean
          status: string
        }
        Insert: {
          attempts?: number
          automation_id?: string | null
          client_id?: string | null
          comment_id: string
          comment_text?: string | null
          commenter_id?: string | null
          commenter_username?: string | null
          dm_status?: string | null
          error?: string | null
          id?: string
          ig_user_id: string
          last_attempt_at?: string | null
          media_id?: string | null
          processed_at?: string | null
          public_reply_status?: string | null
          received_at?: string
          retryable?: boolean
          status?: string
        }
        Update: {
          attempts?: number
          automation_id?: string | null
          client_id?: string | null
          comment_id?: string
          comment_text?: string | null
          commenter_id?: string | null
          commenter_username?: string | null
          dm_status?: string | null
          error?: string | null
          id?: string
          ig_user_id?: string
          last_attempt_at?: string | null
          media_id?: string | null
          processed_at?: string | null
          public_reply_status?: string | null
          received_at?: string
          retryable?: boolean
          status?: string
        }
        Relationships: []
      }
      data_deletion_requests: {
        Row: {
          completed_at: string | null
          confirmation_code: string
          id: string
          meta_user_id: string
          requested_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          confirmation_code: string
          id?: string
          meta_user_id: string
          requested_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          confirmation_code?: string
          id?: string
          meta_user_id?: string
          requested_at?: string
          status?: string
        }
        Relationships: []
      }
      instagram_accounts: {
        Row: {
          access_token_encrypted: string | null
          client_id: string
          connected_at: string
          id: string
          ig_scoped_id: string | null
          ig_user_id: string
          profile_picture_url: string | null
          status: string
          token_expires_at: string | null
          token_refreshed_at: string | null
          updated_at: string
          username: string
        }
        Insert: {
          access_token_encrypted?: string | null
          client_id: string
          connected_at?: string
          id?: string
          ig_scoped_id?: string | null
          ig_user_id: string
          profile_picture_url?: string | null
          status?: string
          token_expires_at?: string | null
          token_refreshed_at?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          access_token_encrypted?: string | null
          client_id?: string
          connected_at?: string
          id?: string
          ig_scoped_id?: string | null
          ig_user_id?: string
          profile_picture_url?: string | null
          status?: string
          token_expires_at?: string | null
          token_refreshed_at?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempted_at: string
          id: number
          ip: string
          success: boolean
        }
        Insert: {
          attempted_at?: string
          id?: never
          ip: string
          success: boolean
        }
        Update: {
          attempted_at?: string
          id?: never
          ip?: string
          success?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      automation_stats: {
        Args: { p_client_id: string }
        Returns: {
          automation_id: string
          dms_sent: number
          failures: number
          matched: number
        }[]
      }
      claim_comment_event: {
        Args: { p_event_id: string }
        Returns: Database["public"]["Tables"]["comment_events"]["Row"][]
      }
      save_automation: {
        // PATCH: a null p_automation_id inserts a new automation.
        Args: {
          p_automation_id: string | null
          p_client_id: string
          p_payload: Json
        }
        Returns: Database["public"]["Tables"]["automations"]["Row"][]
      }
      verify_client_pin: {
        Args: { p_pin: string }
        Returns: {
          id: string
          name: string
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

type PublicTables = Database["public"]["Tables"]
export type Row<T extends keyof PublicTables> = PublicTables[T]["Row"]
export type Insert<T extends keyof PublicTables> = PublicTables[T]["Insert"]
export type Update<T extends keyof PublicTables> = PublicTables[T]["Update"]
