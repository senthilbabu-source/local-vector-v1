export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      activity_log: {
        Row: {
          actor_email: string | null
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          org_id: string
          target_email: string
          target_role: Database["public"]["Enums"]["membership_role"] | null
          target_user_id: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          org_id: string
          target_email: string
          target_role?: Database["public"]["Enums"]["membership_role"] | null
          target_user_id?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          org_id?: string
          target_email?: string
          target_role?: Database["public"]["Enums"]["membership_role"] | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_audits: {
        Row: {
          audit_date: string | null
          created_at: string | null
          id: string
          is_hallucination_detected: boolean | null
          location_id: string | null
          model_provider: Database["public"]["Enums"]["model_provider"]
          org_id: string
          prompt_text: string | null
          prompt_type: Database["public"]["Enums"]["audit_prompt_type"]
          raw_response: string | null
          response_metadata: Json | null
        }
        Insert: {
          audit_date?: string | null
          created_at?: string | null
          id?: string
          is_hallucination_detected?: boolean | null
          location_id?: string | null
          model_provider: Database["public"]["Enums"]["model_provider"]
          org_id: string
          prompt_text?: string | null
          prompt_type: Database["public"]["Enums"]["audit_prompt_type"]
          raw_response?: string | null
          response_metadata?: Json | null
        }
        Update: {
          audit_date?: string | null
          created_at?: string | null
          id?: string
          is_hallucination_detected?: boolean | null
          location_id?: string | null
          model_provider?: Database["public"]["Enums"]["model_provider"]
          org_id?: string
          prompt_text?: string | null
          prompt_type?: Database["public"]["Enums"]["audit_prompt_type"]
          raw_response?: string | null
          response_metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_audits_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_audits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_evaluations: {
        Row: {
          accuracy_score: number | null
          created_at: string
          engine: string
          hallucinations_detected: Json
          id: string
          location_id: string
          org_id: string
          prompt_used: string | null
          response_text: string | null
        }
        Insert: {
          accuracy_score?: number | null
          created_at?: string
          engine: string
          hallucinations_detected?: Json
          id?: string
          location_id: string
          org_id: string
          prompt_used?: string | null
          response_text?: string | null
        }
        Update: {
          accuracy_score?: number | null
          created_at?: string
          engine?: string
          hallucinations_detected?: Json
          id?: string
          location_id?: string
          org_id?: string
          prompt_used?: string | null
          response_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_evaluations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_evaluations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_hallucinations: {
        Row: {
          audit_id: string | null
          category: string | null
          claim_text: string
          corrected_at: string | null
          correction_query: string | null
          correction_status:
            | Database["public"]["Enums"]["correction_status"]
            | null
          created_at: string | null
          detected_at: string | null
          embedding: string | null
          expected_truth: string | null
          first_detected_at: string | null
          follow_up_checked_at: string | null
          follow_up_result: string | null
          id: string
          last_seen_at: string | null
          location_id: string | null
          model_provider: Database["public"]["Enums"]["model_provider"]
          occurrence_count: number | null
          org_id: string
          propagation_events: Json | null
          resolution_notes: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["hallucination_severity"] | null
          verifying_since: string | null
        }
        Insert: {
          audit_id?: string | null
          category?: string | null
          claim_text: string
          corrected_at?: string | null
          correction_query?: string | null
          correction_status?:
            | Database["public"]["Enums"]["correction_status"]
            | null
          created_at?: string | null
          detected_at?: string | null
          embedding?: string | null
          expected_truth?: string | null
          first_detected_at?: string | null
          follow_up_checked_at?: string | null
          follow_up_result?: string | null
          id?: string
          last_seen_at?: string | null
          location_id?: string | null
          model_provider: Database["public"]["Enums"]["model_provider"]
          occurrence_count?: number | null
          org_id: string
          propagation_events?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?:
            | Database["public"]["Enums"]["hallucination_severity"]
            | null
          verifying_since?: string | null
        }
        Update: {
          audit_id?: string | null
          category?: string | null
          claim_text?: string
          corrected_at?: string | null
          correction_query?: string | null
          correction_status?:
            | Database["public"]["Enums"]["correction_status"]
            | null
          created_at?: string | null
          detected_at?: string | null
          embedding?: string | null
          expected_truth?: string | null
          first_detected_at?: string | null
          follow_up_checked_at?: string | null
          follow_up_result?: string | null
          id?: string
          last_seen_at?: string | null
          location_id?: string | null
          model_provider?: Database["public"]["Enums"]["model_provider"]
          occurrence_count?: number | null
          org_id?: string
          propagation_events?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?:
            | Database["public"]["Enums"]["hallucination_severity"]
            | null
          verifying_since?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_hallucinations_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "ai_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_hallucinations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_hallucinations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_credits: {
        Row: {
          created_at: string
          credits_limit: number
          credits_used: number
          id: string
          org_id: string
          plan: string
          reset_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits_limit: number
          credits_used?: number
          id?: string
          org_id: string
          plan: string
          reset_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits_limit?: number
          credits_used?: number
          id?: string
          org_id?: string
          plan?: string
          reset_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_credits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      apple_bc_connections: {
        Row: {
          apple_location_id: string | null
          claim_status: string
          created_at: string
          id: string
          last_synced_at: string | null
          location_id: string
          org_id: string
          sync_error: string | null
          sync_status: string | null
          updated_at: string
        }
        Insert: {
          apple_location_id?: string | null
          claim_status?: string
          created_at?: string
          id?: string
          last_synced_at?: string | null
          location_id: string
          org_id: string
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string
        }
        Update: {
          apple_location_id?: string | null
          claim_status?: string
          created_at?: string
          id?: string
          last_synced_at?: string | null
          location_id?: string
          org_id?: string
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apple_bc_connections_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apple_bc_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      apple_bc_sync_log: {
        Row: {
          apple_response: Json | null
          error_message: string | null
          fields_updated: string[] | null
          id: string
          location_id: string | null
          org_id: string
          status: string
          synced_at: string
        }
        Insert: {
          apple_response?: Json | null
          error_message?: string | null
          fields_updated?: string[] | null
          id?: string
          location_id?: string | null
          org_id: string
          status: string
          synced_at?: string
        }
        Update: {
          apple_response?: Json | null
          error_message?: string | null
          fields_updated?: string[] | null
          id?: string
          location_id?: string | null
          org_id?: string
          status?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apple_bc_sync_log_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apple_bc_sync_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      benchmark_snapshots: {
        Row: {
          category_key: string
          category_label: string
          computed_at: string
          id: string
          location_key: string
          location_label: string
          sample_count: number
          score_median: number
          score_p25: number
          score_p75: number
          score_p90: number
          week_of: string
        }
        Insert: {
          category_key: string
          category_label: string
          computed_at?: string
          id?: string
          location_key: string
          location_label: string
          sample_count: number
          score_median: number
          score_p25: number
          score_p75: number
          score_p90: number
          week_of: string
        }
        Update: {
          category_key?: string
          category_label?: string
          computed_at?: string
          id?: string
          location_key?: string
          location_label?: string
          sample_count?: number
          score_median?: number
          score_p25?: number
          score_p75?: number
          score_p90?: number
          week_of?: string
        }
        Relationships: []
      }
      benchmarks: {
        Row: {
          avg_score: number
          city: string
          computed_at: string
          id: string
          industry: string
          max_score: number
          min_score: number
          org_count: number
        }
        Insert: {
          avg_score: number
          city: string
          computed_at?: string
          id?: string
          industry?: string
          max_score: number
          min_score: number
          org_count: number
        }
        Update: {
          avg_score?: number
          city?: string
          computed_at?: string
          id?: string
          industry?: string
          max_score?: number
          min_score?: number
          org_count?: number
        }
        Relationships: []
      }
      bing_places_connections: {
        Row: {
          bing_listing_id: string | null
          claim_status: string
          conflict_note: string | null
          created_at: string
          id: string
          last_synced_at: string | null
          location_id: string
          org_id: string
          sync_error: string | null
          sync_status: string | null
          updated_at: string
        }
        Insert: {
          bing_listing_id?: string | null
          claim_status?: string
          conflict_note?: string | null
          created_at?: string
          id?: string
          last_synced_at?: string | null
          location_id: string
          org_id: string
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string
        }
        Update: {
          bing_listing_id?: string | null
          claim_status?: string
          conflict_note?: string | null
          created_at?: string
          id?: string
          last_synced_at?: string | null
          location_id?: string
          org_id?: string
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bing_places_connections_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bing_places_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bing_places_sync_log: {
        Row: {
          error_message: string | null
          fields_updated: string[] | null
          id: string
          location_id: string | null
          org_id: string
          status: string
          synced_at: string
        }
        Insert: {
          error_message?: string | null
          fields_updated?: string[] | null
          id?: string
          location_id?: string | null
          org_id: string
          status: string
          synced_at?: string
        }
        Update: {
          error_message?: string | null
          fields_updated?: string[] | null
          id?: string
          location_id?: string | null
          org_id?: string
          status?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bing_places_sync_log_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bing_places_sync_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_voice_profiles: {
        Row: {
          avoid_phrases: string[]
          custom_instructions: string | null
          derived_from: string
          formality: string
          highlight_keywords: string[]
          id: string
          last_updated_at: string
          location_id: string
          org_id: string
          owner_name: string | null
          sign_off: string
          tone: string
          use_emojis: boolean
        }
        Insert: {
          avoid_phrases?: string[]
          custom_instructions?: string | null
          derived_from?: string
          formality?: string
          highlight_keywords?: string[]
          id?: string
          last_updated_at?: string
          location_id: string
          org_id: string
          owner_name?: string | null
          sign_off?: string
          tone?: string
          use_emojis?: boolean
        }
        Update: {
          avoid_phrases?: string[]
          custom_instructions?: string | null
          derived_from?: string
          formality?: string
          highlight_keywords?: string[]
          id?: string
          last_updated_at?: string
          location_id?: string
          org_id?: string
          owner_name?: string | null
          sign_off?: string
          tone?: string
          use_emojis?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "brand_voice_profiles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_voice_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_info: {
        Row: {
          address: string | null
          amenities: Json | null
          business_name: string
          created_at: string | null
          hours_data: Json | null
          id: string
          location_id: string | null
          org_id: string
          phone: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          address?: string | null
          amenities?: Json | null
          business_name: string
          created_at?: string | null
          hours_data?: Json | null
          id?: string
          location_id?: string | null
          org_id: string
          phone?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          address?: string | null
          amenities?: Json | null
          business_name?: string
          created_at?: string | null
          hours_data?: Json | null
          id?: string
          location_id?: string | null
          org_id?: string
          phone?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_info_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_info_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      citation_source_intelligence: {
        Row: {
          business_category: string
          citation_frequency: number
          city: string
          id: string
          measured_at: string
          model_provider: Database["public"]["Enums"]["model_provider"]
          platform: string
          sample_query: string | null
          sample_size: number
          state: string
        }
        Insert: {
          business_category: string
          citation_frequency: number
          city: string
          id?: string
          measured_at?: string
          model_provider: Database["public"]["Enums"]["model_provider"]
          platform: string
          sample_query?: string | null
          sample_size?: number
          state: string
        }
        Update: {
          business_category?: string
          citation_frequency?: number
          city?: string
          id?: string
          measured_at?: string
          model_provider?: Database["public"]["Enums"]["model_provider"]
          platform?: string
          sample_query?: string | null
          sample_size?: number
          state?: string
        }
        Relationships: []
      }
      competitor_intercepts: {
        Row: {
          action_status: string | null
          competitor_name: string
          created_at: string | null
          gap_analysis: Json | null
          gap_magnitude: string | null
          id: string
          location_id: string | null
          model_provider: Database["public"]["Enums"]["model_provider"]
          org_id: string
          query_asked: string | null
          suggested_action: string | null
          winner: string | null
          winner_reason: string | null
          winning_factor: string | null
        }
        Insert: {
          action_status?: string | null
          competitor_name: string
          created_at?: string | null
          gap_analysis?: Json | null
          gap_magnitude?: string | null
          id?: string
          location_id?: string | null
          model_provider: Database["public"]["Enums"]["model_provider"]
          org_id: string
          query_asked?: string | null
          suggested_action?: string | null
          winner?: string | null
          winner_reason?: string | null
          winning_factor?: string | null
        }
        Update: {
          action_status?: string | null
          competitor_name?: string
          created_at?: string | null
          gap_analysis?: Json | null
          gap_magnitude?: string | null
          id?: string
          location_id?: string | null
          model_provider?: Database["public"]["Enums"]["model_provider"]
          org_id?: string
          query_asked?: string | null
          suggested_action?: string | null
          winner?: string | null
          winner_reason?: string | null
          winning_factor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_intercepts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_intercepts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      competitors: {
        Row: {
          competitor_address: string | null
          competitor_google_place_id: string | null
          competitor_name: string
          created_at: string | null
          id: string
          location_id: string | null
          notes: string | null
          org_id: string
        }
        Insert: {
          competitor_address?: string | null
          competitor_google_place_id?: string | null
          competitor_name: string
          created_at?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          org_id: string
        }
        Update: {
          competitor_address?: string | null
          competitor_google_place_id?: string | null
          competitor_name?: string
          created_at?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitors_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      content_drafts: {
        Row: {
          aeo_score: number | null
          approved_at: string | null
          content_type: string
          created_at: string
          draft_content: string
          draft_title: string
          embedding: string | null
          generation_notes: string | null
          human_approved: boolean
          id: string
          location_id: string | null
          org_id: string
          published_at: string | null
          published_url: string | null
          rejection_reason: string | null
          status: string
          target_keywords: string[]
          target_prompt: string | null
          trigger_id: string | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          aeo_score?: number | null
          approved_at?: string | null
          content_type: string
          created_at?: string
          draft_content: string
          draft_title: string
          embedding?: string | null
          generation_notes?: string | null
          human_approved?: boolean
          id?: string
          location_id?: string | null
          org_id: string
          published_at?: string | null
          published_url?: string | null
          rejection_reason?: string | null
          status?: string
          target_keywords?: string[]
          target_prompt?: string | null
          trigger_id?: string | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          aeo_score?: number | null
          approved_at?: string | null
          content_type?: string
          created_at?: string
          draft_content?: string
          draft_title?: string
          embedding?: string | null
          generation_notes?: string | null
          human_approved?: boolean
          id?: string
          location_id?: string | null
          org_id?: string
          published_at?: string | null
          published_url?: string | null
          rejection_reason?: string | null
          status?: string
          target_keywords?: string[]
          target_prompt?: string | null
          trigger_id?: string | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_drafts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_drafts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      correction_follow_ups: {
        Row: {
          correction_brief_id: string | null
          created_at: string
          hallucination_id: string
          id: string
          org_id: string
          rescan_ai_response: string | null
          rescan_completed_at: string | null
          rescan_due_at: string
          rescan_status: string
          updated_at: string
        }
        Insert: {
          correction_brief_id?: string | null
          created_at?: string
          hallucination_id: string
          id?: string
          org_id: string
          rescan_ai_response?: string | null
          rescan_completed_at?: string | null
          rescan_due_at?: string
          rescan_status?: string
          updated_at?: string
        }
        Update: {
          correction_brief_id?: string | null
          created_at?: string
          hallucination_id?: string
          id?: string
          org_id?: string
          rescan_ai_response?: string | null
          rescan_completed_at?: string | null
          rescan_due_at?: string
          rescan_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "correction_follow_ups_correction_brief_id_fkey"
            columns: ["correction_brief_id"]
            isOneToOne: false
            referencedRelation: "content_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_follow_ups_hallucination_id_fkey"
            columns: ["hallucination_id"]
            isOneToOne: true
            referencedRelation: "ai_hallucinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_follow_ups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crawler_hits: {
        Row: {
          bot_type: string
          crawled_at: string | null
          created_at: string | null
          id: string
          location_id: string | null
          menu_id: string
          org_id: string
          user_agent: string | null
        }
        Insert: {
          bot_type: string
          crawled_at?: string | null
          created_at?: string | null
          id?: string
          location_id?: string | null
          menu_id: string
          org_id: string
          user_agent?: string | null
        }
        Update: {
          bot_type?: string
          crawled_at?: string | null
          created_at?: string | null
          id?: string
          location_id?: string | null
          menu_id?: string
          org_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawler_hits_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawler_hits_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "magic_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawler_hits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_usage_log: {
        Row: {
          created_at: string
          credits_after: number
          credits_before: number
          credits_used: number
          id: string
          operation: string
          org_id: string
          reference_id: string | null
        }
        Insert: {
          created_at?: string
          credits_after: number
          credits_before: number
          credits_used: number
          id?: string
          operation: string
          org_id: string
          reference_id?: string | null
        }
        Update: {
          created_at?: string
          credits_after?: number
          credits_before?: number
          credits_used?: number
          id?: string
          operation?: string
          org_id?: string
          reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_usage_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_run_log: {
        Row: {
          completed_at: string | null
          created_at: string | null
          cron_name: string
          duration_ms: number | null
          error_message: string | null
          id: string
          started_at: string
          status: string
          summary: Json | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          cron_name: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          started_at?: string
          status?: string
          summary?: Json | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          cron_name?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          started_at?: string
          status?: string
          summary?: Json | null
        }
        Relationships: []
      }
      directories: {
        Row: {
          base_url: string | null
          created_at: string | null
          display_name: string
          feeds_ai_models: boolean | null
          icon_url: string | null
          id: string
          is_priority: boolean | null
          name: string
        }
        Insert: {
          base_url?: string | null
          created_at?: string | null
          display_name: string
          feeds_ai_models?: boolean | null
          icon_url?: string | null
          id?: string
          is_priority?: boolean | null
          name: string
        }
        Update: {
          base_url?: string | null
          created_at?: string | null
          display_name?: string
          feeds_ai_models?: boolean | null
          icon_url?: string | null
          id?: string
          is_priority?: boolean | null
          name?: string
        }
        Relationships: []
      }
      draft_locks: {
        Row: {
          draft_id: string
          expires_at: string
          id: string
          locked_at: string
          org_id: string
          user_email: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          draft_id: string
          expires_at?: string
          id?: string
          locked_at?: string
          org_id: string
          user_email: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          draft_id?: string
          expires_at?: string
          id?: string
          locked_at?: string
          org_id?: string
          user_email?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "draft_locks_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "content_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_locks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_preferences: {
        Row: {
          created_at: string
          digest_unsubscribed: boolean
          id: string
          org_id: string
          unsubscribe_token: string
          unsubscribed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          digest_unsubscribed?: boolean
          id?: string
          org_id: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          digest_unsubscribed?: boolean
          id?: string
          org_id?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_preferences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_authority_citations: {
        Row: {
          detected_at: string
          domain: string
          id: string
          is_sameas_candidate: boolean
          location_id: string
          org_id: string
          run_month: string
          sentiment: string | null
          snippet: string | null
          source_type: string
          tier: string
          url: string
        }
        Insert: {
          detected_at?: string
          domain: string
          id?: string
          is_sameas_candidate?: boolean
          location_id: string
          org_id: string
          run_month: string
          sentiment?: string | null
          snippet?: string | null
          source_type: string
          tier: string
          url: string
        }
        Update: {
          detected_at?: string
          domain?: string
          id?: string
          is_sameas_candidate?: boolean
          location_id?: string
          org_id?: string
          run_month?: string
          sentiment?: string | null
          snippet?: string | null
          source_type?: string
          tier?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_authority_citations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_authority_citations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_authority_profiles: {
        Row: {
          citation_velocity: number | null
          entity_authority_score: number
          id: string
          last_run_at: string
          location_id: string
          org_id: string
          platform_breadth_score: number
          recommendations: Json
          sameas_count: number
          sameas_gaps: Json
          sameas_score: number
          snapshot_at: string
          tier1_citation_score: number
          tier1_count: number
          tier2_count: number
          tier2_coverage_score: number
          tier3_count: number
          velocity_label: string | null
          velocity_score: number
        }
        Insert: {
          citation_velocity?: number | null
          entity_authority_score: number
          id?: string
          last_run_at?: string
          location_id: string
          org_id: string
          platform_breadth_score?: number
          recommendations?: Json
          sameas_count?: number
          sameas_gaps?: Json
          sameas_score?: number
          snapshot_at?: string
          tier1_citation_score?: number
          tier1_count?: number
          tier2_count?: number
          tier2_coverage_score?: number
          tier3_count?: number
          velocity_label?: string | null
          velocity_score?: number
        }
        Update: {
          citation_velocity?: number | null
          entity_authority_score?: number
          id?: string
          last_run_at?: string
          location_id?: string
          org_id?: string
          platform_breadth_score?: number
          recommendations?: Json
          sameas_count?: number
          sameas_gaps?: Json
          sameas_score?: number
          snapshot_at?: string
          tier1_citation_score?: number
          tier1_count?: number
          tier2_count?: number
          tier2_coverage_score?: number
          tier3_count?: number
          velocity_label?: string | null
          velocity_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "entity_authority_profiles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_authority_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_authority_snapshots: {
        Row: {
          created_at: string
          entity_authority_score: number
          id: string
          location_id: string
          org_id: string
          sameas_count: number
          snapshot_month: string
          tier1_count: number
          tier2_count: number
          tier3_count: number
          total_citations: number
        }
        Insert: {
          created_at?: string
          entity_authority_score: number
          id?: string
          location_id: string
          org_id: string
          sameas_count?: number
          snapshot_month: string
          tier1_count?: number
          tier2_count?: number
          tier3_count?: number
          total_citations?: number
        }
        Update: {
          created_at?: string
          entity_authority_score?: number
          id?: string
          location_id?: string
          org_id?: string
          sameas_count?: number
          snapshot_month?: string
          tier1_count?: number
          tier2_count?: number
          tier3_count?: number
          total_citations?: number
        }
        Relationships: [
          {
            foreignKeyName: "entity_authority_snapshots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_authority_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_checks: {
        Row: {
          apple_maps: string
          bing_places: string
          created_at: string
          entity_score: number
          google_business_profile: string
          google_knowledge_panel: string
          id: string
          last_checked_at: string
          location_id: string
          org_id: string
          platform_metadata: Json
          tripadvisor: string
          updated_at: string
          wikidata: string
          yelp: string
        }
        Insert: {
          apple_maps?: string
          bing_places?: string
          created_at?: string
          entity_score?: number
          google_business_profile?: string
          google_knowledge_panel?: string
          id?: string
          last_checked_at?: string
          location_id: string
          org_id: string
          platform_metadata?: Json
          tripadvisor?: string
          updated_at?: string
          wikidata?: string
          yelp?: string
        }
        Update: {
          apple_maps?: string
          bing_places?: string
          created_at?: string
          entity_score?: number
          google_business_profile?: string
          google_knowledge_panel?: string
          id?: string
          last_checked_at?: string
          location_id?: string
          org_id?: string
          platform_metadata?: Json
          tripadvisor?: string
          updated_at?: string
          wikidata?: string
          yelp?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_checks_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_checks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      google_oauth_tokens: {
        Row: {
          access_token: string
          account_id: string | null
          created_at: string
          expires_at: string
          gbp_account_name: string | null
          google_email: string | null
          id: string
          org_id: string
          refresh_token: string
          scopes: string | null
          token_type: string
          updated_at: string
        }
        Insert: {
          access_token: string
          account_id?: string | null
          created_at?: string
          expires_at: string
          gbp_account_name?: string | null
          google_email?: string | null
          id?: string
          org_id: string
          refresh_token: string
          scopes?: string | null
          token_type?: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          account_id?: string | null
          created_at?: string
          expires_at?: string
          gbp_account_name?: string | null
          google_email?: string | null
          id?: string
          org_id?: string
          refresh_token?: string
          scopes?: string | null
          token_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_oauth_tokens_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hijacking_alerts: {
        Row: {
          competitor_name: string
          created_at: string
          detected_at: string
          email_sent_at: string | null
          engine: string
          evidence_text: string
          hijack_type: string
          id: string
          location_id: string
          org_id: string
          our_business: string
          query_text: string
          resolved_at: string | null
          severity: string
          status: string
        }
        Insert: {
          competitor_name: string
          created_at?: string
          detected_at?: string
          email_sent_at?: string | null
          engine: string
          evidence_text: string
          hijack_type: string
          id?: string
          location_id: string
          org_id: string
          our_business: string
          query_text: string
          resolved_at?: string | null
          severity?: string
          status?: string
        }
        Update: {
          competitor_name?: string
          created_at?: string
          detected_at?: string
          email_sent_at?: string | null
          engine?: string
          evidence_text?: string
          hijack_type?: string
          id?: string
          location_id?: string
          org_id?: string
          our_business?: string
          query_text?: string
          resolved_at?: string | null
          severity?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hijacking_alerts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hijacking_alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      intent_discoveries: {
        Row: {
          brief_created: boolean
          client_cited: boolean
          competitors_cited: string[]
          content_draft_id: string | null
          created_at: string
          discovered_at: string
          id: string
          location_id: string
          opportunity_score: number
          org_id: string
          prompt: string
          run_id: string
          theme: string
        }
        Insert: {
          brief_created?: boolean
          client_cited?: boolean
          competitors_cited?: string[]
          content_draft_id?: string | null
          created_at?: string
          discovered_at?: string
          id?: string
          location_id: string
          opportunity_score?: number
          org_id: string
          prompt: string
          run_id: string
          theme: string
        }
        Update: {
          brief_created?: boolean
          client_cited?: boolean
          competitors_cited?: string[]
          content_draft_id?: string | null
          created_at?: string
          discovered_at?: string
          id?: string
          location_id?: string
          opportunity_score?: number
          org_id?: string
          prompt?: string
          run_id?: string
          theme?: string
        }
        Relationships: [
          {
            foreignKeyName: "intent_discoveries_content_draft_id_fkey"
            columns: ["content_draft_id"]
            isOneToOne: false
            referencedRelation: "content_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intent_discoveries_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intent_discoveries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_platform_ids: {
        Row: {
          created_at: string
          id: string
          location_id: string
          org_id: string
          platform: string
          platform_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          org_id: string
          platform: string
          platform_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          org_id?: string
          platform?: string
          platform_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_platform_ids_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_platform_ids_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_snapshots: {
        Row: {
          correction_fields: string[] | null
          correction_pushed_at: string | null
          fetch_status: string
          fetched_at: string
          id: string
          location_id: string
          org_id: string
          platform: string
          raw_nap_data: Json | null
        }
        Insert: {
          correction_fields?: string[] | null
          correction_pushed_at?: string | null
          fetch_status: string
          fetched_at?: string
          id?: string
          location_id: string
          org_id: string
          platform: string
          raw_nap_data?: Json | null
        }
        Update: {
          correction_fields?: string[] | null
          correction_pushed_at?: string | null
          fetch_status?: string
          fetched_at?: string
          id?: string
          location_id?: string
          org_id?: string
          platform?: string
          raw_nap_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_snapshots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          created_at: string | null
          directory_id: string
          error_details: string | null
          id: string
          last_checked_at: string | null
          last_synced_at: string | null
          listing_url: string | null
          location_id: string | null
          nap_address: string | null
          nap_consistency_score: number | null
          nap_name: string | null
          nap_phone: string | null
          org_id: string
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          directory_id: string
          error_details?: string | null
          id?: string
          last_checked_at?: string | null
          last_synced_at?: string | null
          listing_url?: string | null
          location_id?: string | null
          nap_address?: string | null
          nap_consistency_score?: number | null
          nap_name?: string | null
          nap_phone?: string | null
          org_id: string
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          directory_id?: string
          error_details?: string | null
          id?: string
          last_checked_at?: string | null
          last_synced_at?: string | null
          listing_url?: string | null
          location_id?: string | null
          nap_address?: string | null
          nap_consistency_score?: number | null
          nap_name?: string | null
          nap_phone?: string | null
          org_id?: string
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_directory_id_fkey"
            columns: ["directory_id"]
            isOneToOne: false
            referencedRelation: "directories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      local_occasions: {
        Row: {
          annual_date: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          occasion_type: string
          peak_query_patterns: Json
          relevant_categories: Json
          trigger_days_before: number
        }
        Insert: {
          annual_date?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          occasion_type: string
          peak_query_patterns?: Json
          relevant_categories?: Json
          trigger_days_before?: number
        }
        Update: {
          annual_date?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          occasion_type?: string
          peak_query_patterns?: Json
          relevant_categories?: Json
          trigger_days_before?: number
        }
        Relationships: []
      }
      location_integrations: {
        Row: {
          created_at: string
          external_id: string | null
          has_discrepancy: boolean | null
          id: string
          last_sync_at: string | null
          listing_url: string | null
          location_id: string
          org_id: string
          platform: string
          status: string
          verification_result: Json | null
          verified_at: string | null
          wp_app_password: string | null
          wp_username: string | null
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          has_discrepancy?: boolean | null
          id?: string
          last_sync_at?: string | null
          listing_url?: string | null
          location_id: string
          org_id: string
          platform: string
          status?: string
          verification_result?: Json | null
          verified_at?: string | null
          wp_app_password?: string | null
          wp_username?: string | null
        }
        Update: {
          created_at?: string
          external_id?: string | null
          has_discrepancy?: boolean | null
          id?: string
          last_sync_at?: string | null
          listing_url?: string | null
          location_id?: string
          org_id?: string
          platform?: string
          status?: string
          verification_result?: Json | null
          verified_at?: string | null
          wp_app_password?: string | null
          wp_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_integrations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_permissions: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          location_id: string
          membership_id: string
          role: Database["public"]["Enums"]["membership_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          location_id: string
          membership_id: string
          role?: Database["public"]["Enums"]["membership_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          location_id?: string
          membership_id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_permissions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_permissions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          accepting_new_patients: boolean | null
          address_line1: string | null
          address_line2: string | null
          agent_seo_audited_at: string | null
          agent_seo_cache: Json | null
          amenities: Json | null
          attributes: Json | null
          authority_last_run_at: string | null
          authority_score: number | null
          autopilot_last_run_at: string | null
          avg_customer_value: number | null
          avg_rating: number | null
          business_name: string
          categories: Json | null
          city: string | null
          country: string | null
          created_at: string | null
          data_health_score: number | null
          display_name: string | null
          drafts_pending_count: number | null
          embedding: string | null
          faq_cache: Json | null
          faq_excluded_hashes: Json | null
          faq_updated_at: string | null
          gbp_integration_id: string | null
          gbp_synced_at: string | null
          google_location_name: string | null
          google_place_id: string | null
          hours_data: Json | null
          id: string
          insurance_types: Json | null
          is_archived: boolean
          is_primary: boolean | null
          last_simulation_score: number | null
          llms_txt_updated_at: string | null
          location_order: number | null
          monthly_covers: number | null
          name: string
          nap_health_score: number | null
          nap_last_checked_at: string | null
          operational_status: string | null
          org_id: string
          phone: string | null
          place_details_refreshed_at: string | null
          playbook_cache: Json | null
          playbook_generated_at: string | null
          review_health_score: number | null
          reviews_last_synced_at: string | null
          schema_health_score: number | null
          schema_last_run_at: string | null
          simulation_last_run_at: string | null
          slug: string
          specialty_tags: string[] | null
          state: string | null
          telehealth_available: boolean | null
          timezone: string | null
          total_review_count: number | null
          updated_at: string | null
          vaio_last_run_at: string | null
          voice_readiness_score: number | null
          website_slug: string | null
          website_url: string | null
          widget_enabled: boolean
          widget_settings: Json | null
          zip: string | null
        }
        Insert: {
          accepting_new_patients?: boolean | null
          address_line1?: string | null
          address_line2?: string | null
          agent_seo_audited_at?: string | null
          agent_seo_cache?: Json | null
          amenities?: Json | null
          attributes?: Json | null
          authority_last_run_at?: string | null
          authority_score?: number | null
          autopilot_last_run_at?: string | null
          avg_customer_value?: number | null
          avg_rating?: number | null
          business_name: string
          categories?: Json | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          data_health_score?: number | null
          display_name?: string | null
          drafts_pending_count?: number | null
          embedding?: string | null
          faq_cache?: Json | null
          faq_excluded_hashes?: Json | null
          faq_updated_at?: string | null
          gbp_integration_id?: string | null
          gbp_synced_at?: string | null
          google_location_name?: string | null
          google_place_id?: string | null
          hours_data?: Json | null
          id?: string
          insurance_types?: Json | null
          is_archived?: boolean
          is_primary?: boolean | null
          last_simulation_score?: number | null
          llms_txt_updated_at?: string | null
          location_order?: number | null
          monthly_covers?: number | null
          name: string
          nap_health_score?: number | null
          nap_last_checked_at?: string | null
          operational_status?: string | null
          org_id: string
          phone?: string | null
          place_details_refreshed_at?: string | null
          playbook_cache?: Json | null
          playbook_generated_at?: string | null
          review_health_score?: number | null
          reviews_last_synced_at?: string | null
          schema_health_score?: number | null
          schema_last_run_at?: string | null
          simulation_last_run_at?: string | null
          slug: string
          specialty_tags?: string[] | null
          state?: string | null
          telehealth_available?: boolean | null
          timezone?: string | null
          total_review_count?: number | null
          updated_at?: string | null
          vaio_last_run_at?: string | null
          voice_readiness_score?: number | null
          website_slug?: string | null
          website_url?: string | null
          widget_enabled?: boolean
          widget_settings?: Json | null
          zip?: string | null
        }
        Update: {
          accepting_new_patients?: boolean | null
          address_line1?: string | null
          address_line2?: string | null
          agent_seo_audited_at?: string | null
          agent_seo_cache?: Json | null
          amenities?: Json | null
          attributes?: Json | null
          authority_last_run_at?: string | null
          authority_score?: number | null
          autopilot_last_run_at?: string | null
          avg_customer_value?: number | null
          avg_rating?: number | null
          business_name?: string
          categories?: Json | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          data_health_score?: number | null
          display_name?: string | null
          drafts_pending_count?: number | null
          embedding?: string | null
          faq_cache?: Json | null
          faq_excluded_hashes?: Json | null
          faq_updated_at?: string | null
          gbp_integration_id?: string | null
          gbp_synced_at?: string | null
          google_location_name?: string | null
          google_place_id?: string | null
          hours_data?: Json | null
          id?: string
          insurance_types?: Json | null
          is_archived?: boolean
          is_primary?: boolean | null
          last_simulation_score?: number | null
          llms_txt_updated_at?: string | null
          location_order?: number | null
          monthly_covers?: number | null
          name?: string
          nap_health_score?: number | null
          nap_last_checked_at?: string | null
          operational_status?: string | null
          org_id?: string
          phone?: string | null
          place_details_refreshed_at?: string | null
          playbook_cache?: Json | null
          playbook_generated_at?: string | null
          review_health_score?: number | null
          reviews_last_synced_at?: string | null
          schema_health_score?: number | null
          schema_last_run_at?: string | null
          simulation_last_run_at?: string | null
          slug?: string
          specialty_tags?: string[] | null
          state?: string | null
          telehealth_available?: boolean | null
          timezone?: string | null
          total_review_count?: number | null
          updated_at?: string | null
          vaio_last_run_at?: string | null
          voice_readiness_score?: number | null
          website_slug?: string | null
          website_url?: string | null
          widget_enabled?: boolean
          widget_settings?: Json | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_gbp_integration_id_fkey"
            columns: ["gbp_integration_id"]
            isOneToOne: false
            referencedRelation: "location_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      magic_menus: {
        Row: {
          ai_readability_score: number | null
          content_hash: string | null
          created_at: string | null
          extracted_data: Json | null
          extraction_confidence: number | null
          human_verified: boolean | null
          id: string
          is_published: boolean | null
          json_ld_schema: Json | null
          last_crawled_by: Json | null
          last_distributed_at: string | null
          llms_txt_content: string | null
          location_id: string | null
          org_id: string
          page_views: number | null
          processing_status:
            | Database["public"]["Enums"]["menu_processing_status"]
            | null
          propagation_events: Json | null
          public_slug: string | null
          source_type: string | null
          source_url: string | null
          updated_at: string | null
          verified_at: string | null
        }
        Insert: {
          ai_readability_score?: number | null
          content_hash?: string | null
          created_at?: string | null
          extracted_data?: Json | null
          extraction_confidence?: number | null
          human_verified?: boolean | null
          id?: string
          is_published?: boolean | null
          json_ld_schema?: Json | null
          last_crawled_by?: Json | null
          last_distributed_at?: string | null
          llms_txt_content?: string | null
          location_id?: string | null
          org_id: string
          page_views?: number | null
          processing_status?:
            | Database["public"]["Enums"]["menu_processing_status"]
            | null
          propagation_events?: Json | null
          public_slug?: string | null
          source_type?: string | null
          source_url?: string | null
          updated_at?: string | null
          verified_at?: string | null
        }
        Update: {
          ai_readability_score?: number | null
          content_hash?: string | null
          created_at?: string | null
          extracted_data?: Json | null
          extraction_confidence?: number | null
          human_verified?: boolean | null
          id?: string
          is_published?: boolean | null
          json_ld_schema?: Json | null
          last_crawled_by?: Json | null
          last_distributed_at?: string | null
          llms_txt_content?: string | null
          location_id?: string | null
          org_id?: string
          page_views?: number | null
          processing_status?:
            | Database["public"]["Enums"]["menu_processing_status"]
            | null
          propagation_events?: Json | null
          public_slug?: string | null
          source_type?: string | null
          source_url?: string | null
          updated_at?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "magic_menus_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_menus_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string | null
          id: string
          invited_by: string | null
          joined_at: string
          org_id: string
          role: Database["public"]["Enums"]["membership_role"] | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string
          org_id: string
          role?: Database["public"]["Enums"]["membership_role"] | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string
          org_id?: string
          role?: Database["public"]["Enums"]["membership_role"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string
          id: string
          menu_id: string
          name: string
          org_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          menu_id: string
          name: string
          org_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          menu_id?: string
          name?: string
          org_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "magic_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category_id: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          dietary_tags: Json | null
          embedding: string | null
          id: string
          is_available: boolean | null
          menu_id: string
          name: string
          org_id: string
          price: number | null
          price_note: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          dietary_tags?: Json | null
          embedding?: string | null
          id?: string
          is_available?: boolean | null
          menu_id: string
          name: string
          org_id: string
          price?: number | null
          price_note?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          dietary_tags?: Json | null
          embedding?: string | null
          id?: string
          is_available?: boolean | null
          menu_id?: string
          name?: string
          org_id?: string
          price?: number | null
          price_note?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "magic_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nap_discrepancies: {
        Row: {
          auto_correctable: boolean
          detected_at: string
          discrepant_fields: Json
          fix_instructions: string | null
          id: string
          location_id: string
          org_id: string
          platform: string
          resolved_at: string | null
          severity: string
          status: string
        }
        Insert: {
          auto_correctable?: boolean
          detected_at?: string
          discrepant_fields?: Json
          fix_instructions?: string | null
          id?: string
          location_id: string
          org_id: string
          platform: string
          resolved_at?: string | null
          severity?: string
          status: string
        }
        Update: {
          auto_correctable?: boolean
          detected_at?: string
          discrepant_fields?: Json
          fix_instructions?: string | null
          id?: string
          location_id?: string
          org_id?: string
          platform?: string
          resolved_at?: string | null
          severity?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "nap_discrepancies_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nap_discrepancies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      occasion_snoozes: {
        Row: {
          id: string
          occasion_id: string
          org_id: string
          snooze_count: number
          snoozed_at: string
          snoozed_until: string
          user_id: string
        }
        Insert: {
          id?: string
          occasion_id: string
          org_id: string
          snooze_count?: number
          snoozed_at?: string
          snoozed_until: string
          user_id: string
        }
        Update: {
          id?: string
          occasion_id?: string
          org_id?: string
          snooze_count?: number
          snoozed_at?: string
          snoozed_until?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "occasion_snoozes_occasion_id_fkey"
            columns: ["occasion_id"]
            isOneToOne: false
            referencedRelation: "local_occasions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occasion_snoozes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_steps: {
        Row: {
          completed: boolean
          completed_at: string | null
          completed_by_user_id: string | null
          created_at: string
          id: string
          org_id: string
          step_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          id?: string
          org_id: string
          step_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          id?: string
          org_id?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_steps_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_api_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_benchmark_cache: {
        Row: {
          category_key: string
          id: string
          location_key: string
          org_id: string
          org_sov_score: number
          percentile_rank: number
          snapshot_id: string
          week_of: string
        }
        Insert: {
          category_key: string
          id?: string
          location_key: string
          org_id: string
          org_sov_score: number
          percentile_rank: number
          snapshot_id: string
          week_of: string
        }
        Update: {
          category_key?: string
          id?: string
          location_key?: string
          org_id?: string
          org_sov_score?: number
          percentile_rank?: number
          snapshot_id?: string
          week_of?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_benchmark_cache_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_benchmark_cache_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "benchmark_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      org_domains: {
        Row: {
          created_at: string
          domain_type: string
          domain_value: string
          id: string
          last_checked_at: string | null
          org_id: string
          updated_at: string
          verification_status: string
          verification_token: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          domain_type: string
          domain_value: string
          id?: string
          last_checked_at?: string | null
          org_id: string
          updated_at?: string
          verification_status?: string
          verification_token?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          domain_type?: string
          domain_value?: string
          id?: string
          last_checked_at?: string | null
          org_id?: string
          updated_at?: string
          verification_status?: string
          verification_token?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_domains_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_settings: {
        Row: {
          created_at: string
          id: string
          notify_email_digest: boolean
          notify_in_app: boolean
          notify_slack_webhook_url: string | null
          notify_sov_drop_threshold: number
          org_id: string
          scan_frequency: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notify_email_digest?: boolean
          notify_in_app?: boolean
          notify_slack_webhook_url?: string | null
          notify_sov_drop_threshold?: number
          org_id: string
          scan_frequency?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notify_email_digest?: boolean
          notify_in_app?: boolean
          notify_slack_webhook_url?: string | null
          notify_sov_drop_threshold?: number
          org_id?: string
          scan_frequency?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_themes: {
        Row: {
          accent_color: string
          created_at: string
          font_family: string
          id: string
          logo_storage_path: string | null
          logo_url: string | null
          org_id: string
          primary_color: string
          show_powered_by: boolean
          text_on_primary: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          created_at?: string
          font_family?: string
          id?: string
          logo_storage_path?: string | null
          logo_url?: string | null
          org_id: string
          primary_color?: string
          show_powered_by?: boolean
          text_on_primary?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          created_at?: string
          font_family?: string
          id?: string
          logo_storage_path?: string | null
          logo_url?: string | null
          org_id?: string
          primary_color?: string
          show_powered_by?: boolean
          text_on_primary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_themes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          ai_audits_used_this_month: number | null
          audit_frequency: string | null
          canceled_at: string | null
          cancellation_reason: string | null
          created_at: string | null
          current_billing_period_start: string | null
          deletion_reason: string | null
          deletion_requested_at: string | null
          digest_last_sent_at: string | null
          id: string
          industry: string | null
          last_manual_scan_triggered_at: string | null
          manual_scan_status: string | null
          max_ai_audits_per_month: number | null
          max_locations: number | null
          monitored_ai_models: string[] | null
          name: string
          notify_hallucination_alerts: boolean | null
          notify_new_competitor: boolean | null
          notify_score_drop_alert: boolean | null
          notify_sov_alerts: boolean | null
          notify_weekly_digest: boolean | null
          onboarding_completed: boolean | null
          owner_user_id: string | null
          plan: Database["public"]["Enums"]["plan_tier"] | null
          plan_status: Database["public"]["Enums"]["plan_status"] | null
          scan_day_of_week: number | null
          score_drop_threshold: number | null
          seat_count: number
          seat_limit: number | null
          seat_overage_count: number | null
          seat_overage_flagged: boolean
          seat_overage_since: string | null
          seats_updated_at: string | null
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          stripe_subscription_item_id: string | null
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          ai_audits_used_this_month?: number | null
          audit_frequency?: string | null
          canceled_at?: string | null
          cancellation_reason?: string | null
          created_at?: string | null
          current_billing_period_start?: string | null
          deletion_reason?: string | null
          deletion_requested_at?: string | null
          digest_last_sent_at?: string | null
          id?: string
          industry?: string | null
          last_manual_scan_triggered_at?: string | null
          manual_scan_status?: string | null
          max_ai_audits_per_month?: number | null
          max_locations?: number | null
          monitored_ai_models?: string[] | null
          name: string
          notify_hallucination_alerts?: boolean | null
          notify_new_competitor?: boolean | null
          notify_score_drop_alert?: boolean | null
          notify_sov_alerts?: boolean | null
          notify_weekly_digest?: boolean | null
          onboarding_completed?: boolean | null
          owner_user_id?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"] | null
          plan_status?: Database["public"]["Enums"]["plan_status"] | null
          scan_day_of_week?: number | null
          score_drop_threshold?: number | null
          seat_count?: number
          seat_limit?: number | null
          seat_overage_count?: number | null
          seat_overage_flagged?: boolean
          seat_overage_since?: string | null
          seats_updated_at?: string | null
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          stripe_subscription_item_id?: string | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          ai_audits_used_this_month?: number | null
          audit_frequency?: string | null
          canceled_at?: string | null
          cancellation_reason?: string | null
          created_at?: string | null
          current_billing_period_start?: string | null
          deletion_reason?: string | null
          deletion_requested_at?: string | null
          digest_last_sent_at?: string | null
          id?: string
          industry?: string | null
          last_manual_scan_triggered_at?: string | null
          manual_scan_status?: string | null
          max_ai_audits_per_month?: number | null
          max_locations?: number | null
          monitored_ai_models?: string[] | null
          name?: string
          notify_hallucination_alerts?: boolean | null
          notify_new_competitor?: boolean | null
          notify_score_drop_alert?: boolean | null
          notify_sov_alerts?: boolean | null
          notify_weekly_digest?: boolean | null
          onboarding_completed?: boolean | null
          owner_user_id?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"] | null
          plan_status?: Database["public"]["Enums"]["plan_status"] | null
          scan_day_of_week?: number | null
          score_drop_threshold?: number | null
          seat_count?: number
          seat_limit?: number | null
          seat_overage_count?: number | null
          seat_overage_flagged?: boolean
          seat_overage_since?: string | null
          seats_updated_at?: string | null
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          stripe_subscription_item_id?: string | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      page_audits: {
        Row: {
          aeo_readability_score: number | null
          answer_first_score: number | null
          created_at: string
          entity_clarity_score: number | null
          faq_schema_present: boolean | null
          faq_schema_score: number | null
          id: string
          last_audited_at: string
          location_id: string | null
          org_id: string
          overall_score: number | null
          page_type: string
          page_url: string
          recommendations: Json | null
          schema_completeness_score: number | null
        }
        Insert: {
          aeo_readability_score?: number | null
          answer_first_score?: number | null
          created_at?: string
          entity_clarity_score?: number | null
          faq_schema_present?: boolean | null
          faq_schema_score?: number | null
          id?: string
          last_audited_at?: string
          location_id?: string | null
          org_id: string
          overall_score?: number | null
          page_type: string
          page_url: string
          recommendations?: Json | null
          schema_completeness_score?: number | null
        }
        Update: {
          aeo_readability_score?: number | null
          answer_first_score?: number | null
          created_at?: string
          entity_clarity_score?: number | null
          faq_schema_present?: boolean | null
          faq_schema_score?: number | null
          id?: string
          last_audited_at?: string
          location_id?: string | null
          org_id?: string
          overall_score?: number | null
          page_type?: string
          page_url?: string
          recommendations?: Json | null
          schema_completeness_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "page_audits_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_audits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      page_schemas: {
        Row: {
          confidence: number | null
          content_hash: string | null
          embed_snippet: string | null
          generated_at: string
          human_approved: boolean
          id: string
          json_ld: Json
          last_crawled_at: string
          location_id: string
          missing_fields: string[]
          org_id: string
          page_type: string
          page_url: string
          public_url: string | null
          published_at: string | null
          schema_types: string[]
          status: string
          validation_errors: string[]
        }
        Insert: {
          confidence?: number | null
          content_hash?: string | null
          embed_snippet?: string | null
          generated_at?: string
          human_approved?: boolean
          id?: string
          json_ld?: Json
          last_crawled_at?: string
          location_id: string
          missing_fields?: string[]
          org_id: string
          page_type: string
          page_url: string
          public_url?: string | null
          published_at?: string | null
          schema_types?: string[]
          status?: string
          validation_errors?: string[]
        }
        Update: {
          confidence?: number | null
          content_hash?: string | null
          embed_snippet?: string | null
          generated_at?: string
          human_approved?: boolean
          id?: string
          json_ld?: Json
          last_crawled_at?: string
          location_id?: string
          missing_fields?: string[]
          org_id?: string
          page_type?: string
          page_url?: string
          public_url?: string | null
          published_at?: string | null
          schema_types?: string[]
          status?: string
          validation_errors?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "page_schemas_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_schemas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_gbp_imports: {
        Row: {
          account_name: string | null
          created_at: string
          expires_at: string
          has_more: boolean
          id: string
          locations_data: Json
          org_id: string
        }
        Insert: {
          account_name?: string | null
          created_at?: string
          expires_at: string
          has_more?: boolean
          id?: string
          locations_data: Json
          org_id: string
        }
        Update: {
          account_name?: string | null
          created_at?: string
          expires_at?: string
          has_more?: boolean
          id?: string
          locations_data?: Json
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_gbp_imports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_id: string
          role: Database["public"]["Enums"]["membership_role"]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          org_id: string
          role?: Database["public"]["Enums"]["membership_role"]
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          org_id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      post_publish_audits: {
        Row: {
          baseline_score: number | null
          checked_at: string
          draft_id: string
          id: string
          improvement_delta: number | null
          location_id: string | null
          org_id: string
          post_publish_score: number | null
          target_query: string | null
        }
        Insert: {
          baseline_score?: number | null
          checked_at?: string
          draft_id: string
          id?: string
          improvement_delta?: number | null
          location_id?: string | null
          org_id: string
          post_publish_score?: number | null
          target_query?: string | null
        }
        Update: {
          baseline_score?: number | null
          checked_at?: string
          draft_id?: string
          id?: string
          improvement_delta?: number | null
          location_id?: string | null
          org_id?: string
          post_publish_score?: number | null
          target_query?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_publish_audits_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: true
            referencedRelation: "content_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_publish_audits_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_publish_audits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_config: {
        Row: {
          avg_ticket: number
          business_type: string
          created_at: string | null
          id: string
          local_conversion_rate: number
          location_id: string
          monthly_searches: number
          org_id: string
          updated_at: string | null
          walk_away_rate: number
        }
        Insert: {
          avg_ticket?: number
          business_type?: string
          created_at?: string | null
          id?: string
          local_conversion_rate?: number
          location_id: string
          monthly_searches?: number
          org_id: string
          updated_at?: string | null
          walk_away_rate?: number
        }
        Update: {
          avg_ticket?: number
          business_type?: string
          created_at?: string | null
          id?: string
          local_conversion_rate?: number
          location_id?: string
          monthly_searches?: number
          org_id?: string
          updated_at?: string | null
          walk_away_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "revenue_config_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_snapshots: {
        Row: {
          breakdown: Json
          created_at: string | null
          id: string
          inputs_snapshot: Json
          leak_high: number
          leak_low: number
          location_id: string
          org_id: string
          snapshot_date: string
        }
        Insert: {
          breakdown?: Json
          created_at?: string | null
          id?: string
          inputs_snapshot?: Json
          leak_high?: number
          leak_low?: number
          location_id: string
          org_id: string
          snapshot_date: string
        }
        Update: {
          breakdown?: Json
          created_at?: string | null
          id?: string
          inputs_snapshot?: Json
          leak_high?: number
          leak_low?: number
          location_id?: string
          org_id?: string
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_snapshots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          fetched_at: string
          id: string
          keywords: string[]
          last_updated_at: string
          location_id: string
          org_id: string
          platform: string
          platform_review_id: string
          platform_url: string | null
          published_at: string
          rating: number
          response_draft: string | null
          response_error: string | null
          response_published_at: string | null
          response_published_text: string | null
          response_status: string
          reviewer_name: string
          reviewer_photo_url: string | null
          sentiment_label: string
          sentiment_score: number | null
          text: string
          topics: Json
        }
        Insert: {
          fetched_at?: string
          id?: string
          keywords?: string[]
          last_updated_at?: string
          location_id: string
          org_id: string
          platform: string
          platform_review_id: string
          platform_url?: string | null
          published_at: string
          rating: number
          response_draft?: string | null
          response_error?: string | null
          response_published_at?: string | null
          response_published_text?: string | null
          response_status?: string
          reviewer_name: string
          reviewer_photo_url?: string | null
          sentiment_label?: string
          sentiment_score?: number | null
          text?: string
          topics?: Json
        }
        Update: {
          fetched_at?: string
          id?: string
          keywords?: string[]
          last_updated_at?: string
          location_id?: string
          org_id?: string
          platform?: string
          platform_review_id?: string
          platform_url?: string | null
          published_at?: string
          rating?: number
          response_draft?: string | null
          response_error?: string | null
          response_published_at?: string | null
          response_published_text?: string | null
          response_status?: string
          reviewer_name?: string
          reviewer_photo_url?: string | null
          sentiment_label?: string
          sentiment_score?: number | null
          text?: string
          topics?: Json
        }
        Relationships: [
          {
            foreignKeyName: "reviews_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sidebar_badge_state: {
        Row: {
          id: string
          last_seen_at: string
          org_id: string
          section: string
          user_id: string
        }
        Insert: {
          id?: string
          last_seen_at?: string
          org_id: string
          section: string
          user_id: string
        }
        Update: {
          id?: string
          last_seen_at?: string
          org_id?: string
          section?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sidebar_badge_state_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_runs: {
        Row: {
          claude_model: string
          content_source: string
          content_text: string
          content_word_count: number
          draft_id: string | null
          errors: string[]
          gap_analysis: Json | null
          hallucination_risk: string
          id: string
          ingestion_accuracy: number
          ingestion_result: Json | null
          input_tokens_used: number
          location_id: string
          modes_run: string[]
          org_id: string
          output_tokens_used: number
          query_coverage_rate: number
          query_results: Json
          run_at: string
          simulation_score: number
          status: string
        }
        Insert: {
          claude_model?: string
          content_source: string
          content_text: string
          content_word_count?: number
          draft_id?: string | null
          errors?: string[]
          gap_analysis?: Json | null
          hallucination_risk?: string
          id?: string
          ingestion_accuracy?: number
          ingestion_result?: Json | null
          input_tokens_used?: number
          location_id: string
          modes_run?: string[]
          org_id: string
          output_tokens_used?: number
          query_coverage_rate?: number
          query_results?: Json
          run_at?: string
          simulation_score?: number
          status?: string
        }
        Update: {
          claude_model?: string
          content_source?: string
          content_text?: string
          content_word_count?: number
          draft_id?: string | null
          errors?: string[]
          gap_analysis?: Json | null
          hallucination_risk?: string
          id?: string
          ingestion_accuracy?: number
          ingestion_result?: Json | null
          input_tokens_used?: number
          location_id?: string
          modes_run?: string[]
          org_id?: string
          output_tokens_used?: number
          query_coverage_rate?: number
          query_results?: Json
          run_at?: string
          simulation_score?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_runs_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "content_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_runs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sov_evaluations: {
        Row: {
          cited_sources: Json | null
          created_at: string
          engine: string
          id: string
          location_id: string
          mentioned_competitors: Json
          org_id: string
          query_id: string
          rank_position: number | null
          raw_response: string | null
          sentiment_data: Json | null
          source_mentions: Json | null
        }
        Insert: {
          cited_sources?: Json | null
          created_at?: string
          engine: string
          id?: string
          location_id: string
          mentioned_competitors?: Json
          org_id: string
          query_id: string
          rank_position?: number | null
          raw_response?: string | null
          sentiment_data?: Json | null
          source_mentions?: Json | null
        }
        Update: {
          cited_sources?: Json | null
          created_at?: string
          engine?: string
          id?: string
          location_id?: string
          mentioned_competitors?: Json
          org_id?: string
          query_id?: string
          rank_position?: number | null
          raw_response?: string | null
          sentiment_data?: Json | null
          source_mentions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sov_evaluations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sov_evaluations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sov_evaluations_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "target_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      sov_model_results: {
        Row: {
          ai_response: string | null
          citation_count: number
          cited: boolean
          confidence: string
          id: string
          location_id: string | null
          model_provider: string
          org_id: string
          query_id: string | null
          query_text: string
          run_at: string
          week_of: string
        }
        Insert: {
          ai_response?: string | null
          citation_count?: number
          cited: boolean
          confidence?: string
          id?: string
          location_id?: string | null
          model_provider: string
          org_id: string
          query_id?: string | null
          query_text: string
          run_at?: string
          week_of: string
        }
        Update: {
          ai_response?: string | null
          citation_count?: number
          cited?: boolean
          confidence?: string
          id?: string
          location_id?: string | null
          model_provider?: string
          org_id?: string
          query_id?: string | null
          query_text?: string
          run_at?: string
          week_of?: string
        }
        Relationships: [
          {
            foreignKeyName: "sov_model_results_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sov_model_results_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sov_model_results_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "target_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          error: string | null
          event_type: string
          id: string
          org_id: string | null
          payload: Json | null
          processed_at: string
          stripe_event_id: string
        }
        Insert: {
          error?: string | null
          event_type: string
          id?: string
          org_id?: string | null
          payload?: Json | null
          processed_at?: string
          stripe_event_id: string
        }
        Update: {
          error?: string | null
          event_type?: string
          id?: string
          org_id?: string | null
          payload?: Json | null
          processed_at?: string
          stripe_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_webhook_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      target_queries: {
        Row: {
          citation_rate: number | null
          created_at: string
          embedding: string | null
          id: string
          intent_modifier: string | null
          is_active: boolean
          is_system_seeded: boolean
          last_run_at: string | null
          location_id: string
          occasion_tag: string | null
          org_id: string
          query_category: string
          query_mode: string
          query_text: string
        }
        Insert: {
          citation_rate?: number | null
          created_at?: string
          embedding?: string | null
          id?: string
          intent_modifier?: string | null
          is_active?: boolean
          is_system_seeded?: boolean
          last_run_at?: string | null
          location_id: string
          occasion_tag?: string | null
          org_id: string
          query_category?: string
          query_mode?: string
          query_text: string
        }
        Update: {
          citation_rate?: number | null
          created_at?: string
          embedding?: string | null
          id?: string
          intent_modifier?: string | null
          is_active?: boolean
          is_system_seeded?: boolean
          last_run_at?: string | null
          location_id?: string
          occasion_tag?: string | null
          org_id?: string
          query_category?: string
          query_mode?: string
          query_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "target_queries_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_queries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_provider_id: string
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          auth_provider_id: string
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          auth_provider_id?: string
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      vaio_profiles: {
        Row: {
          crawler_audit: Json | null
          id: string
          last_run_at: string | null
          llms_txt_full: string | null
          llms_txt_generated_at: string | null
          llms_txt_standard: string | null
          llms_txt_status: string
          location_id: string
          org_id: string
          top_content_issues: Json
          voice_citation_rate: number
          voice_gaps: Json
          voice_queries_tracked: number
          voice_readiness_score: number
        }
        Insert: {
          crawler_audit?: Json | null
          id?: string
          last_run_at?: string | null
          llms_txt_full?: string | null
          llms_txt_generated_at?: string | null
          llms_txt_standard?: string | null
          llms_txt_status?: string
          location_id: string
          org_id: string
          top_content_issues?: Json
          voice_citation_rate?: number
          voice_gaps?: Json
          voice_queries_tracked?: number
          voice_readiness_score?: number
        }
        Update: {
          crawler_audit?: Json | null
          id?: string
          last_run_at?: string | null
          llms_txt_full?: string | null
          llms_txt_generated_at?: string | null
          llms_txt_standard?: string | null
          llms_txt_status?: string
          location_id?: string
          org_id?: string
          top_content_issues?: Json
          voice_citation_rate?: number
          voice_gaps?: Json
          voice_queries_tracked?: number
          voice_readiness_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "vaio_profiles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaio_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      visibility_analytics: {
        Row: {
          citation_rate: number | null
          created_at: string | null
          id: string
          location_id: string | null
          org_id: string
          sentiment_gap: number | null
          share_of_voice: number | null
          snapshot_date: string
        }
        Insert: {
          citation_rate?: number | null
          created_at?: string | null
          id?: string
          location_id?: string | null
          org_id: string
          sentiment_gap?: number | null
          share_of_voice?: number | null
          snapshot_date: string
        }
        Update: {
          citation_rate?: number | null
          created_at?: string | null
          id?: string
          location_id?: string | null
          org_id?: string
          sentiment_gap?: number | null
          share_of_voice?: number | null
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "visibility_analytics_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visibility_analytics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      visibility_scores: {
        Row: {
          accuracy_score: number | null
          created_at: string | null
          data_health_score: number | null
          id: string
          location_id: string | null
          org_id: string
          reality_score: number | null
          score_delta: number | null
          snapshot_date: string
          visibility_score: number | null
        }
        Insert: {
          accuracy_score?: number | null
          created_at?: string | null
          data_health_score?: number | null
          id?: string
          location_id?: string | null
          org_id: string
          reality_score?: number | null
          score_delta?: number | null
          snapshot_date: string
          visibility_score?: number | null
        }
        Update: {
          accuracy_score?: number | null
          created_at?: string | null
          data_health_score?: number | null
          id?: string
          location_id?: string | null
          org_id?: string
          reality_score?: number | null
          score_delta?: number | null
          snapshot_date?: string
          visibility_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "visibility_scores_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visibility_scores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      compute_benchmarks: {
        Args: never
        Returns: {
          avg_score: number
          city: string
          industry: string
          max_score: number
          min_score: number
          org_count: number
        }[]
      }
      current_user_org_id: { Args: never; Returns: string }
      increment_credits_used: { Args: { p_org_id: string }; Returns: undefined }
      match_content_drafts: {
        Args: {
          filter_org_id: string
          match_count?: number
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          draft_title: string
          id: string
          similarity: number
          status: string
          target_prompt: string
        }[]
      }
      match_hallucinations: {
        Args: {
          filter_org_id: string
          match_count?: number
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          claim_text: string
          correction_status: string
          id: string
          similarity: number
        }[]
      }
      match_menu_items: {
        Args: {
          filter_menu_id: string
          match_count?: number
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          category: string
          description: string
          id: string
          name: string
          price: number
          similarity: number
        }[]
      }
      match_target_queries: {
        Args: {
          filter_location_id: string
          match_count?: number
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          id: string
          query_text: string
          similarity: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      audit_prompt_type:
        | "status_check"
        | "hours_check"
        | "amenity_check"
        | "menu_check"
        | "recommendation"
      correction_status:
        | "open"
        | "verifying"
        | "fixed"
        | "dismissed"
        | "recurring"
        | "corrected"
      hallucination_severity: "critical" | "high" | "medium" | "low"
      membership_role: "owner" | "admin" | "member" | "viewer" | "analyst"
      menu_processing_status:
        | "uploading"
        | "processing"
        | "review_ready"
        | "published"
        | "failed"
      model_provider:
        | "openai-gpt4o"
        | "perplexity-sonar"
        | "google-gemini"
        | "anthropic-claude"
        | "microsoft-copilot"
        | "openai-gpt4o-mini"
      plan_status: "trialing" | "active" | "past_due" | "canceled" | "paused"
      plan_tier: "trial" | "starter" | "growth" | "agency"
      sync_status: "synced" | "mismatch" | "not_linked" | "error" | "needs_auth"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      audit_prompt_type: [
        "status_check",
        "hours_check",
        "amenity_check",
        "menu_check",
        "recommendation",
      ],
      correction_status: [
        "open",
        "verifying",
        "fixed",
        "dismissed",
        "recurring",
        "corrected",
      ],
      hallucination_severity: ["critical", "high", "medium", "low"],
      membership_role: ["owner", "admin", "member", "viewer", "analyst"],
      menu_processing_status: [
        "uploading",
        "processing",
        "review_ready",
        "published",
        "failed",
      ],
      model_provider: [
        "openai-gpt4o",
        "perplexity-sonar",
        "google-gemini",
        "anthropic-claude",
        "microsoft-copilot",
        "openai-gpt4o-mini",
      ],
      plan_status: ["trialing", "active", "past_due", "canceled", "paused"],
      plan_tier: ["trial", "starter", "growth", "agency"],
      sync_status: ["synced", "mismatch", "not_linked", "error", "needs_auth"],
    },
  },
} as const

