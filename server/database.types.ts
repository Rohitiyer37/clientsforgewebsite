// Generated from the ClientsForge Supabase schema (supabase gen types), trimmed
// to the tables the dashboard uses. Manual patches, marked PATCH below:
// save_automation accepts a null p_automation_id to insert, and
// start_ig_sync_run accepts a null p_min_interval and returns null run_id and
// retry_after_seconds when it does not start a run. The generator cannot infer
// either. Regenerate after schema changes and re-apply them.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
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
          timezone: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          name: string
          pin?: string | null
          pin_hash?: string | null
          timezone?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          name?: string
          pin?: string | null
          pin_hash?: string | null
          timezone?: string
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
          dm_sent_at: string | null
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
          dm_sent_at?: string | null
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
          dm_sent_at?: string | null
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
          granted_scopes: string[] | null
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
          granted_scopes?: string[] | null
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
          granted_scopes?: string[] | null
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
      ig_account_daily_metrics: {
        Row: {
          bio_link_taps: number | null
          comments: number | null
          date: string
          fetched_at: string | null
          follower_count: number | null
          follows: number | null
          instagram_account_id: string
          likes: number | null
          profile_visits: number | null
          reach: number | null
          saves: number | null
          shares: number | null
          unfollows: number | null
          views: number | null
        }
        Insert: {
          bio_link_taps?: number | null
          comments?: number | null
          date: string
          fetched_at?: string | null
          follower_count?: number | null
          follows?: number | null
          instagram_account_id: string
          likes?: number | null
          profile_visits?: number | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          unfollows?: number | null
          views?: number | null
        }
        Update: {
          bio_link_taps?: number | null
          comments?: number | null
          date?: string
          fetched_at?: string | null
          follower_count?: number | null
          follows?: number | null
          instagram_account_id?: string
          likes?: number | null
          profile_visits?: number | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          unfollows?: number | null
          views?: number | null
        }
        Relationships: []
      }
      ig_analytics_state: {
        Row: {
          backfill_completed_at: string | null
          backfill_start_date: string | null
          insights_status: string
          instagram_account_id: string
          last_synced_at: string | null
          metric_availability: Json
          updated_at: string
        }
        Insert: {
          backfill_completed_at?: string | null
          backfill_start_date?: string | null
          insights_status?: string
          instagram_account_id: string
          last_synced_at?: string | null
          metric_availability?: Json
          updated_at?: string
        }
        Update: {
          backfill_completed_at?: string | null
          backfill_start_date?: string | null
          insights_status?: string
          instagram_account_id?: string
          last_synced_at?: string | null
          metric_availability?: Json
          updated_at?: string
        }
        Relationships: []
      }
      ig_media: {
        Row: {
          caption: string | null
          instagram_account_id: string
          media_id: string
          media_product_type: string | null
          media_type: string | null
          permalink: string | null
          thumbnail_url: string | null
          timestamp: string | null
          updated_at: string
        }
        Insert: {
          caption?: string | null
          instagram_account_id: string
          media_id: string
          media_product_type?: string | null
          media_type?: string | null
          permalink?: string | null
          thumbnail_url?: string | null
          timestamp?: string | null
          updated_at?: string
        }
        Update: {
          caption?: string | null
          instagram_account_id?: string
          media_id?: string
          media_product_type?: string | null
          media_type?: string | null
          permalink?: string | null
          thumbnail_url?: string | null
          timestamp?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ig_media_insights: {
        Row: {
          avg_watch_time_ms: number | null
          comments: number | null
          fetched_at: string
          follows: number | null
          likes: number | null
          media_id: string
          profile_visits: number | null
          reach: number | null
          saves: number | null
          shares: number | null
          total_interactions: number | null
          views: number | null
        }
        Insert: {
          avg_watch_time_ms?: number | null
          comments?: number | null
          fetched_at?: string
          follows?: number | null
          likes?: number | null
          media_id: string
          profile_visits?: number | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          total_interactions?: number | null
          views?: number | null
        }
        Update: {
          avg_watch_time_ms?: number | null
          comments?: number | null
          fetched_at?: string
          follows?: number | null
          likes?: number | null
          media_id?: string
          profile_visits?: number | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          total_interactions?: number | null
          views?: number | null
        }
        Relationships: []
      }
      ig_sync_runs: {
        Row: {
          api_calls: number
          error: string | null
          finished_at: string | null
          id: string
          instagram_account_id: string
          started_at: string
          status: string
          trigger: string
        }
        Insert: {
          api_calls?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          instagram_account_id: string
          started_at?: string
          status?: string
          trigger: string
        }
        Update: {
          api_calls?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          instagram_account_id?: string
          started_at?: string
          status?: string
          trigger?: string
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
      reset_ig_analytics: {
        Args: { p_account_id: string }
        Returns: undefined
      }
      start_ig_sync_run: {
        // PATCH: a null p_min_interval skips the throttle.
        Args: {
          p_account_id: string
          p_min_interval: string | null
          p_trigger: string
        }
        Returns: {
          outcome: string
          retry_after_seconds: number | null
          run_id: string | null
        }[]
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
