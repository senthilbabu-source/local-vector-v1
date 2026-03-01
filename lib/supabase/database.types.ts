/**
 * Supabase Database Types — generated from prod_schema.sql + migrations.
 *
 * To regenerate after schema changes:
 *   npx supabase gen types typescript --project-id <project-id> > lib/supabase/database.types.ts
 *
 * Last manual sync: 2026-03-01 (Sprint 107 — review engine tables + brand_voice_profiles)
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      ai_audits: {
        Row: {
          id: string;
          org_id: string;
          location_id: string | null;
          model_provider: Database["public"]["Enums"]["model_provider"];
          prompt_type: Database["public"]["Enums"]["audit_prompt_type"];
          prompt_text: string | null;
          raw_response: string | null;
          response_metadata: Json | null;
          is_hallucination_detected: boolean | null;
          audit_date: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          location_id?: string | null;
          model_provider: Database["public"]["Enums"]["model_provider"];
          prompt_type: Database["public"]["Enums"]["audit_prompt_type"];
          prompt_text?: string | null;
          raw_response?: string | null;
          response_metadata?: Json | null;
          is_hallucination_detected?: boolean | null;
          audit_date?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          location_id?: string | null;
          model_provider?: Database["public"]["Enums"]["model_provider"];
          prompt_type?: Database["public"]["Enums"]["audit_prompt_type"];
          prompt_text?: string | null;
          raw_response?: string | null;
          response_metadata?: Json | null;
          is_hallucination_detected?: boolean | null;
          audit_date?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_audits_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_audits_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      api_credits: {
        Row: {
          id: string;
          org_id: string;
          plan: string;
          credits_used: number;
          credits_limit: number;
          reset_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          plan: string;
          credits_used?: number;
          credits_limit: number;
          reset_date: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          plan?: string;
          credits_used?: number;
          credits_limit?: number;
          reset_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "api_credits_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_evaluations: {
        Row: {
          id: string;
          org_id: string;
          location_id: string;
          engine: string;
          prompt_used: string | null;
          response_text: string | null;
          accuracy_score: number | null;
          hallucinations_detected: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          location_id: string;
          engine: string;
          prompt_used?: string | null;
          response_text?: string | null;
          accuracy_score?: number | null;
          hallucinations_detected?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          location_id?: string;
          engine?: string;
          prompt_used?: string | null;
          response_text?: string | null;
          accuracy_score?: number | null;
          hallucinations_detected?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_evaluations_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_evaluations_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_hallucinations: {
        Row: {
          id: string;
          org_id: string;
          location_id: string | null;
          audit_id: string | null;
          severity: Database["public"]["Enums"]["hallucination_severity"] | null;
          category: string | null;
          model_provider: Database["public"]["Enums"]["model_provider"];
          claim_text: string;
          expected_truth: string | null;
          correction_status: Database["public"]["Enums"]["correction_status"] | null;
          resolved_at: string | null;
          resolution_notes: string | null;
          first_detected_at: string | null;
          last_seen_at: string | null;
          occurrence_count: number | null;
          propagation_events: Json | null;
          detected_at: string | null;
          created_at: string | null;
          correction_query: string | null;
          verifying_since: string | null;
          follow_up_checked_at: string | null;
          follow_up_result: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          location_id?: string | null;
          audit_id?: string | null;
          severity?: Database["public"]["Enums"]["hallucination_severity"] | null;
          category?: string | null;
          model_provider: Database["public"]["Enums"]["model_provider"];
          claim_text: string;
          expected_truth?: string | null;
          correction_status?: Database["public"]["Enums"]["correction_status"] | null;
          resolved_at?: string | null;
          resolution_notes?: string | null;
          first_detected_at?: string | null;
          last_seen_at?: string | null;
          occurrence_count?: number | null;
          propagation_events?: Json | null;
          detected_at?: string | null;
          created_at?: string | null;
          correction_query?: string | null;
          verifying_since?: string | null;
          follow_up_checked_at?: string | null;
          follow_up_result?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          location_id?: string | null;
          audit_id?: string | null;
          severity?: Database["public"]["Enums"]["hallucination_severity"] | null;
          category?: string | null;
          model_provider?: Database["public"]["Enums"]["model_provider"];
          claim_text?: string;
          expected_truth?: string | null;
          correction_status?: Database["public"]["Enums"]["correction_status"] | null;
          resolved_at?: string | null;
          resolution_notes?: string | null;
          first_detected_at?: string | null;
          last_seen_at?: string | null;
          occurrence_count?: number | null;
          propagation_events?: Json | null;
          detected_at?: string | null;
          created_at?: string | null;
          correction_query?: string | null;
          verifying_since?: string | null;
          follow_up_checked_at?: string | null;
          follow_up_result?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_hallucinations_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_hallucinations_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_hallucinations_audit_id_fkey";
            columns: ["audit_id"];
            isOneToOne: false;
            referencedRelation: "ai_audits";
            referencedColumns: ["id"];
          },
        ];
      };
      benchmarks: {
        Row: {
          id: string;
          city: string;
          industry: string;
          org_count: number;
          avg_score: number;
          min_score: number;
          max_score: number;
          computed_at: string;
        };
        Insert: {
          id?: string;
          city: string;
          industry?: string;
          org_count: number;
          avg_score: number;
          min_score: number;
          max_score: number;
          computed_at?: string;
        };
        Update: {
          id?: string;
          city?: string;
          industry?: string;
          org_count?: number;
          avg_score?: number;
          min_score?: number;
          max_score?: number;
          computed_at?: string;
        };
        Relationships: [];
      };
      brand_voice_profiles: {
        Row: {
          id: string;
          location_id: string;
          org_id: string;
          tone: string;
          formality: string;
          use_emojis: boolean;
          sign_off: string;
          owner_name: string | null;
          highlight_keywords: string[];
          avoid_phrases: string[];
          custom_instructions: string | null;
          derived_from: string;
          last_updated_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          org_id: string;
          tone?: string;
          formality?: string;
          use_emojis?: boolean;
          sign_off?: string;
          owner_name?: string | null;
          highlight_keywords?: string[];
          avoid_phrases?: string[];
          custom_instructions?: string | null;
          derived_from?: string;
          last_updated_at?: string;
        };
        Update: {
          id?: string;
          location_id?: string;
          org_id?: string;
          tone?: string;
          formality?: string;
          use_emojis?: boolean;
          sign_off?: string;
          owner_name?: string | null;
          highlight_keywords?: string[];
          avoid_phrases?: string[];
          custom_instructions?: string | null;
          derived_from?: string;
          last_updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_voice_profiles_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: true;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_voice_profiles_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      business_info: {
        Row: {
          id: string;
          org_id: string;
          location_id: string | null;
          business_name: string;
          address: string | null;
          phone: string | null;
          website_url: string | null;
          hours_data: Json | null;
          amenities: Json | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          location_id?: string | null;
          business_name: string;
          address?: string | null;
          phone?: string | null;
          website_url?: string | null;
          hours_data?: Json | null;
          amenities?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          location_id?: string | null;
          business_name?: string;
          address?: string | null;
          phone?: string | null;
          website_url?: string | null;
          hours_data?: Json | null;
          amenities?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "business_info_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_info_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      citation_source_intelligence: {
        Row: {
          id: string;
          business_category: string;
          city: string;
          state: string;
          platform: string;
          citation_frequency: number;
          sample_query: string | null;
          sample_size: number;
          model_provider: Database["public"]["Enums"]["model_provider"];
          measured_at: string;
        };
        Insert: {
          id?: string;
          business_category: string;
          city: string;
          state: string;
          platform: string;
          citation_frequency: number;
          sample_query?: string | null;
          sample_size?: number;
          model_provider: Database["public"]["Enums"]["model_provider"];
          measured_at?: string;
        };
        Update: {
          id?: string;
          business_category?: string;
          city?: string;
          state?: string;
          platform?: string;
          citation_frequency?: number;
          sample_query?: string | null;
          sample_size?: number;
          model_provider?: Database["public"]["Enums"]["model_provider"];
          measured_at?: string;
        };
        Relationships: [];
      };
      competitor_intercepts: {
        Row: {
          id: string;
          org_id: string;
          location_id: string | null;
          competitor_name: string;
          query_asked: string | null;
          model_provider: Database["public"]["Enums"]["model_provider"];
          winner: string | null;
          winner_reason: string | null;
          winning_factor: string | null;
          gap_analysis: Json | null;
          gap_magnitude: string | null;
          suggested_action: string | null;
          action_status: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          location_id?: string | null;
          competitor_name: string;
          query_asked?: string | null;
          model_provider: Database["public"]["Enums"]["model_provider"];
          winner?: string | null;
          winner_reason?: string | null;
          winning_factor?: string | null;
          gap_analysis?: Json | null;
          gap_magnitude?: string | null;
          suggested_action?: string | null;
          action_status?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          location_id?: string | null;
          competitor_name?: string;
          query_asked?: string | null;
          model_provider?: Database["public"]["Enums"]["model_provider"];
          winner?: string | null;
          winner_reason?: string | null;
          winning_factor?: string | null;
          gap_analysis?: Json | null;
          gap_magnitude?: string | null;
          suggested_action?: string | null;
          action_status?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "competitor_intercepts_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "competitor_intercepts_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      competitors: {
        Row: {
          id: string;
          org_id: string;
          location_id: string | null;
          competitor_name: string;
          competitor_address: string | null;
          competitor_google_place_id: string | null;
          notes: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          location_id?: string | null;
          competitor_name: string;
          competitor_address?: string | null;
          competitor_google_place_id?: string | null;
          notes?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          location_id?: string | null;
          competitor_name?: string;
          competitor_address?: string | null;
          competitor_google_place_id?: string | null;
          notes?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "competitors_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "competitors_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      content_drafts: {
        Row: {
          id: string;
          org_id: string;
          location_id: string | null;
          trigger_type: string;
          trigger_id: string | null;
          draft_title: string;
          draft_content: string;
          target_prompt: string | null;
          content_type: string;
          aeo_score: number | null;
          status: string;
          human_approved: boolean;
          published_url: string | null;
          published_at: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          location_id?: string | null;
          trigger_type: string;
          trigger_id?: string | null;
          draft_title: string;
          draft_content: string;
          target_prompt?: string | null;
          content_type: string;
          aeo_score?: number | null;
          status?: string;
          human_approved?: boolean;
          published_url?: string | null;
          published_at?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          location_id?: string | null;
          trigger_type?: string;
          trigger_id?: string | null;
          draft_title?: string;
          draft_content?: string;
          target_prompt?: string | null;
          content_type?: string;
          aeo_score?: number | null;
          status?: string;
          human_approved?: boolean;
          published_url?: string | null;
          published_at?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "content_drafts_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_drafts_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      crawler_hits: {
        Row: {
          id: string;
          org_id: string;
          menu_id: string;
          location_id: string | null;
          bot_type: string;
          user_agent: string | null;
          crawled_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          menu_id: string;
          location_id?: string | null;
          bot_type: string;
          user_agent?: string | null;
          crawled_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          menu_id?: string;
          location_id?: string | null;
          bot_type?: string;
          user_agent?: string | null;
          crawled_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "crawler_hits_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crawler_hits_menu_id_fkey";
            columns: ["menu_id"];
            isOneToOne: false;
            referencedRelation: "magic_menus";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crawler_hits_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      cron_run_log: {
        Row: {
          id: string;
          cron_name: string;
          started_at: string;
          completed_at: string | null;
          duration_ms: number | null;
          status: string;
          summary: Json | null;
          error_message: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          cron_name: string;
          started_at?: string;
          completed_at?: string | null;
          duration_ms?: number | null;
          status?: string;
          summary?: Json | null;
          error_message?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          cron_name?: string;
          started_at?: string;
          completed_at?: string | null;
          duration_ms?: number | null;
          status?: string;
          summary?: Json | null;
          error_message?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      directories: {
        Row: {
          id: string;
          name: string;
          display_name: string;
          base_url: string | null;
          is_priority: boolean | null;
          feeds_ai_models: boolean | null;
          icon_url: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          display_name: string;
          base_url?: string | null;
          is_priority?: boolean | null;
          feeds_ai_models?: boolean | null;
          icon_url?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          display_name?: string;
          base_url?: string | null;
          is_priority?: boolean | null;
          feeds_ai_models?: boolean | null;
          icon_url?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      entity_checks: {
        Row: {
          id: string;
          org_id: string;
          location_id: string;
          google_knowledge_panel: string;
          google_business_profile: string;
          yelp: string;
          tripadvisor: string;
          apple_maps: string;
          bing_places: string;
          wikidata: string;
          platform_metadata: Json;
          entity_score: number;
          last_checked_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          location_id: string;
          google_knowledge_panel?: string;
          google_business_profile?: string;
          yelp?: string;
          tripadvisor?: string;
          apple_maps?: string;
          bing_places?: string;
          wikidata?: string;
          platform_metadata?: Json;
          entity_score?: number;
          last_checked_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          location_id?: string;
          google_knowledge_panel?: string;
          google_business_profile?: string;
          yelp?: string;
          tripadvisor?: string;
          apple_maps?: string;
          bing_places?: string;
          wikidata?: string;
          platform_metadata?: Json;
          entity_score?: number;
          last_checked_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entity_checks_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_checks_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      google_oauth_tokens: {
        Row: {
          id: string;
          org_id: string;
          access_token: string;
          refresh_token: string;
          token_type: string;
          expires_at: string;
          gbp_account_name: string | null;
          google_email: string | null;
          scopes: string | null;
          account_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          access_token: string;
          refresh_token: string;
          token_type?: string;
          expires_at: string;
          gbp_account_name?: string | null;
          google_email?: string | null;
          scopes?: string | null;
          account_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          access_token?: string;
          refresh_token?: string;
          token_type?: string;
          expires_at?: string;
          gbp_account_name?: string | null;
          google_email?: string | null;
          scopes?: string | null;
          account_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "google_oauth_tokens_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      listings: {
        Row: {
          id: string;
          org_id: string;
          location_id: string | null;
          directory_id: string;
          listing_url: string | null;
          sync_status: Database["public"]["Enums"]["sync_status"] | null;
          nap_name: string | null;
          nap_address: string | null;
          nap_phone: string | null;
          nap_consistency_score: number | null;
          last_checked_at: string | null;
          last_synced_at: string | null;
          error_details: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          location_id?: string | null;
          directory_id: string;
          listing_url?: string | null;
          sync_status?: Database["public"]["Enums"]["sync_status"] | null;
          nap_name?: string | null;
          nap_address?: string | null;
          nap_phone?: string | null;
          nap_consistency_score?: number | null;
          last_checked_at?: string | null;
          last_synced_at?: string | null;
          error_details?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          location_id?: string | null;
          directory_id?: string;
          listing_url?: string | null;
          sync_status?: Database["public"]["Enums"]["sync_status"] | null;
          nap_name?: string | null;
          nap_address?: string | null;
          nap_phone?: string | null;
          nap_consistency_score?: number | null;
          last_checked_at?: string | null;
          last_synced_at?: string | null;
          error_details?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "listings_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listings_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listings_directory_id_fkey";
            columns: ["directory_id"];
            isOneToOne: false;
            referencedRelation: "directories";
            referencedColumns: ["id"];
          },
        ];
      };
      local_occasions: {
        Row: {
          id: string;
          name: string;
          occasion_type: string;
          trigger_days_before: number;
          annual_date: string | null;
          peak_query_patterns: Json;
          relevant_categories: Json;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          occasion_type: string;
          trigger_days_before?: number;
          annual_date?: string | null;
          peak_query_patterns?: Json;
          relevant_categories?: Json;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          occasion_type?: string;
          trigger_days_before?: number;
          annual_date?: string | null;
          peak_query_patterns?: Json;
          relevant_categories?: Json;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      location_integrations: {
        Row: {
          id: string;
          org_id: string;
          location_id: string;
          platform: string;
          status: string;
          last_sync_at: string | null;
          external_id: string | null;
          created_at: string;
          listing_url: string | null;
          wp_username: string | null;
          wp_app_password: string | null;
          verified_at: string | null;
          verification_result: Record<string, unknown> | null;
          has_discrepancy: boolean;
        };
        Insert: {
          id?: string;
          org_id: string;
          location_id: string;
          platform: string;
          status?: string;
          last_sync_at?: string | null;
          external_id?: string | null;
          created_at?: string;
          listing_url?: string | null;
          wp_username?: string | null;
          wp_app_password?: string | null;
          verified_at?: string | null;
          verification_result?: Record<string, unknown> | null;
          has_discrepancy?: boolean;
        };
        Update: {
          id?: string;
          org_id?: string;
          location_id?: string;
          platform?: string;
          status?: string;
          last_sync_at?: string | null;
          external_id?: string | null;
          created_at?: string;
          listing_url?: string | null;
          wp_username?: string | null;
          wp_app_password?: string | null;
          verified_at?: string | null;
          verification_result?: Record<string, unknown> | null;
          has_discrepancy?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "location_integrations_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "location_integrations_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_platform_ids: {
        Row: {
          id: string;
          location_id: string;
          org_id: string;
          platform: string;
          platform_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          org_id: string;
          platform: string;
          platform_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          location_id?: string;
          org_id?: string;
          platform?: string;
          platform_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listing_platform_ids_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_platform_ids_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_snapshots: {
        Row: {
          id: string;
          location_id: string;
          org_id: string;
          platform: string;
          fetch_status: string;
          raw_nap_data: Json | null;
          fetched_at: string;
          correction_pushed_at: string | null;
          correction_fields: string[] | null;
        };
        Insert: {
          id?: string;
          location_id: string;
          org_id: string;
          platform: string;
          fetch_status: string;
          raw_nap_data?: Json | null;
          fetched_at?: string;
          correction_pushed_at?: string | null;
          correction_fields?: string[] | null;
        };
        Update: {
          id?: string;
          location_id?: string;
          org_id?: string;
          platform?: string;
          fetch_status?: string;
          raw_nap_data?: Json | null;
          fetched_at?: string;
          correction_pushed_at?: string | null;
          correction_fields?: string[] | null;
        };
        Relationships: [
          {
            foreignKeyName: "listing_snapshots_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_snapshots_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      nap_discrepancies: {
        Row: {
          id: string;
          location_id: string;
          org_id: string;
          platform: string;
          status: string;
          discrepant_fields: Json;
          severity: string;
          auto_correctable: boolean;
          fix_instructions: string | null;
          detected_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          location_id: string;
          org_id: string;
          platform: string;
          status: string;
          discrepant_fields?: Json;
          severity?: string;
          auto_correctable?: boolean;
          fix_instructions?: string | null;
          detected_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          location_id?: string;
          org_id?: string;
          platform?: string;
          status?: string;
          discrepant_fields?: Json;
          severity?: string;
          auto_correctable?: boolean;
          fix_instructions?: string | null;
          detected_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "nap_discrepancies_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nap_discrepancies_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      page_schemas: {
        Row: {
          id: string;
          location_id: string;
          org_id: string;
          page_url: string;
          page_type: string;
          schema_types: string[];
          json_ld: Json;
          embed_snippet: string | null;
          public_url: string | null;
          content_hash: string | null;
          status: string;
          human_approved: boolean;
          confidence: number | null;
          missing_fields: string[];
          validation_errors: string[];
          generated_at: string;
          published_at: string | null;
          last_crawled_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          org_id: string;
          page_url: string;
          page_type: string;
          schema_types?: string[];
          json_ld?: Json;
          embed_snippet?: string | null;
          public_url?: string | null;
          content_hash?: string | null;
          status?: string;
          human_approved?: boolean;
          confidence?: number | null;
          missing_fields?: string[];
          validation_errors?: string[];
          generated_at?: string;
          published_at?: string | null;
          last_crawled_at?: string;
        };
        Update: {
          id?: string;
          location_id?: string;
          org_id?: string;
          page_url?: string;
          page_type?: string;
          schema_types?: string[];
          json_ld?: Json;
          embed_snippet?: string | null;
          public_url?: string | null;
          content_hash?: string | null;
          status?: string;
          human_approved?: boolean;
          confidence?: number | null;
          missing_fields?: string[];
          validation_errors?: string[];
          generated_at?: string;
          published_at?: string | null;
          last_crawled_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "page_schemas_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "page_schemas_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      locations: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          slug: string;
          is_primary: boolean | null;
          business_name: string;
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          country: string | null;
          phone: string | null;
          website_url: string | null;
          google_place_id: string | null;
          place_details_refreshed_at: string | null;
          hours_data: Json | null;
          amenities: Json | null;
          categories: Json | null;
          attributes: Json | null;
          operational_status: string | null;
          created_at: string | null;
          updated_at: string | null;
          google_location_name: string | null;
          gbp_integration_id: string | null;
          gbp_synced_at: string | null;
          avg_customer_value: number | null;
          monthly_covers: number | null;
          llms_txt_updated_at: string | null;
          is_archived: boolean;
          display_name: string | null;
          timezone: string | null;
          location_order: number | null;
          nap_health_score: number | null;
          nap_last_checked_at: string | null;
          schema_health_score: number | null;
          schema_last_run_at: string | null;
          website_slug: string | null;
          review_health_score: number | null;
          reviews_last_synced_at: string | null;
          total_review_count: number | null;
          avg_rating: number | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          slug: string;
          is_primary?: boolean | null;
          business_name: string;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          country?: string | null;
          phone?: string | null;
          website_url?: string | null;
          google_place_id?: string | null;
          place_details_refreshed_at?: string | null;
          hours_data?: Json | null;
          amenities?: Json | null;
          categories?: Json | null;
          attributes?: Json | null;
          operational_status?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          google_location_name?: string | null;
          gbp_integration_id?: string | null;
          gbp_synced_at?: string | null;
          avg_customer_value?: number | null;
          monthly_covers?: number | null;
          llms_txt_updated_at?: string | null;
          is_archived?: boolean;
          display_name?: string | null;
          timezone?: string | null;
          location_order?: number | null;
          nap_health_score?: number | null;
          nap_last_checked_at?: string | null;
          schema_health_score?: number | null;
          schema_last_run_at?: string | null;
          website_slug?: string | null;
          review_health_score?: number | null;
          reviews_last_synced_at?: string | null;
          total_review_count?: number | null;
          avg_rating?: number | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          slug?: string;
          is_primary?: boolean | null;
          business_name?: string;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          country?: string | null;
          phone?: string | null;
          website_url?: string | null;
          google_place_id?: string | null;
          place_details_refreshed_at?: string | null;
          hours_data?: Json | null;
          amenities?: Json | null;
          categories?: Json | null;
          attributes?: Json | null;
          operational_status?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          google_location_name?: string | null;
          gbp_integration_id?: string | null;
          gbp_synced_at?: string | null;
          avg_customer_value?: number | null;
          monthly_covers?: number | null;
          llms_txt_updated_at?: string | null;
          is_archived?: boolean;
          display_name?: string | null;
          timezone?: string | null;
          location_order?: number | null;
          nap_health_score?: number | null;
          nap_last_checked_at?: string | null;
          schema_health_score?: number | null;
          schema_last_run_at?: string | null;
          website_slug?: string | null;
          review_health_score?: number | null;
          reviews_last_synced_at?: string | null;
          total_review_count?: number | null;
          avg_rating?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "locations_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "locations_gbp_integration_id_fkey";
            columns: ["gbp_integration_id"];
            isOneToOne: false;
            referencedRelation: "location_integrations";
            referencedColumns: ["id"];
          },
        ];
      };
      magic_menus: {
        Row: {
          id: string;
          org_id: string;
          location_id: string | null;
          source_url: string | null;
          source_type: string | null;
          processing_status: Database["public"]["Enums"]["menu_processing_status"] | null;
          extracted_data: Json | null;
          extraction_confidence: number | null;
          json_ld_schema: Json | null;
          human_verified: boolean | null;
          verified_at: string | null;
          is_published: boolean | null;
          public_slug: string | null;
          page_views: number | null;
          last_crawled_by: Json | null;
          ai_readability_score: number | null;
          llms_txt_content: string | null;
          propagation_events: Json | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          location_id?: string | null;
          source_url?: string | null;
          source_type?: string | null;
          processing_status?: Database["public"]["Enums"]["menu_processing_status"] | null;
          extracted_data?: Json | null;
          extraction_confidence?: number | null;
          json_ld_schema?: Json | null;
          human_verified?: boolean | null;
          verified_at?: string | null;
          is_published?: boolean | null;
          public_slug?: string | null;
          page_views?: number | null;
          last_crawled_by?: Json | null;
          ai_readability_score?: number | null;
          llms_txt_content?: string | null;
          propagation_events?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          location_id?: string | null;
          source_url?: string | null;
          source_type?: string | null;
          processing_status?: Database["public"]["Enums"]["menu_processing_status"] | null;
          extracted_data?: Json | null;
          extraction_confidence?: number | null;
          json_ld_schema?: Json | null;
          human_verified?: boolean | null;
          verified_at?: string | null;
          is_published?: boolean | null;
          public_slug?: string | null;
          page_views?: number | null;
          last_crawled_by?: Json | null;
          ai_readability_score?: number | null;
          llms_txt_content?: string | null;
          propagation_events?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "magic_menus_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "magic_menus_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      memberships: {
        Row: {
          id: string;
          user_id: string;
          org_id: string;
          role: Database["public"]["Enums"]["membership_role"] | null;
          invited_by: string | null;
          joined_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          org_id: string;
          role?: Database["public"]["Enums"]["membership_role"] | null;
          invited_by?: string | null;
          joined_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          org_id?: string;
          role?: Database["public"]["Enums"]["membership_role"] | null;
          invited_by?: string | null;
          joined_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memberships_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_categories: {
        Row: {
          id: string;
          org_id: string;
          menu_id: string;
          name: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          menu_id: string;
          name: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          menu_id?: string;
          name?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_categories_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_categories_menu_id_fkey";
            columns: ["menu_id"];
            isOneToOne: false;
            referencedRelation: "magic_menus";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_items: {
        Row: {
          id: string;
          org_id: string;
          menu_id: string;
          name: string;
          description: string | null;
          price: number | null;
          price_note: string | null;
          currency: string | null;
          dietary_tags: Json | null;
          is_available: boolean | null;
          sort_order: number | null;
          created_at: string | null;
          updated_at: string | null;
          category_id: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          menu_id: string;
          name: string;
          description?: string | null;
          price?: number | null;
          price_note?: string | null;
          currency?: string | null;
          dietary_tags?: Json | null;
          is_available?: boolean | null;
          sort_order?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
          category_id?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          menu_id?: string;
          name?: string;
          description?: string | null;
          price?: number | null;
          price_note?: string | null;
          currency?: string | null;
          dietary_tags?: Json | null;
          is_available?: boolean | null;
          sort_order?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
          category_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "menu_items_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_items_menu_id_fkey";
            columns: ["menu_id"];
            isOneToOne: false;
            referencedRelation: "magic_menus";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "menu_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          owner_user_id: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          plan: Database["public"]["Enums"]["plan_tier"] | null;
          plan_status: Database["public"]["Enums"]["plan_status"] | null;
          max_locations: number | null;
          audit_frequency: string | null;
          max_ai_audits_per_month: number | null;
          ai_audits_used_this_month: number | null;
          current_billing_period_start: string | null;
          onboarding_completed: boolean | null;
          created_at: string | null;
          updated_at: string | null;
          notify_hallucination_alerts: boolean | null;
          notify_weekly_digest: boolean | null;
          notify_sov_alerts: boolean | null;
          seat_limit: number | null;
          seats_updated_at: string | null;
          seat_overage_count: number | null;
          seat_overage_since: string | null;
          monitored_ai_models: string[] | null;
          score_drop_threshold: number | null;
          webhook_url: string | null;
          industry: string | null;
          scan_day_of_week: number | null;
          notify_score_drop_alert: boolean | null;
          notify_new_competitor: boolean | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          owner_user_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          plan?: Database["public"]["Enums"]["plan_tier"] | null;
          plan_status?: Database["public"]["Enums"]["plan_status"] | null;
          max_locations?: number | null;
          audit_frequency?: string | null;
          max_ai_audits_per_month?: number | null;
          ai_audits_used_this_month?: number | null;
          current_billing_period_start?: string | null;
          onboarding_completed?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          notify_hallucination_alerts?: boolean | null;
          notify_weekly_digest?: boolean | null;
          notify_sov_alerts?: boolean | null;
          seat_limit?: number | null;
          seats_updated_at?: string | null;
          seat_overage_count?: number | null;
          seat_overage_since?: string | null;
          monitored_ai_models?: string[] | null;
          score_drop_threshold?: number | null;
          webhook_url?: string | null;
          industry?: string | null;
          scan_day_of_week?: number | null;
          notify_score_drop_alert?: boolean | null;
          notify_new_competitor?: boolean | null;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          owner_user_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          plan?: Database["public"]["Enums"]["plan_tier"] | null;
          plan_status?: Database["public"]["Enums"]["plan_status"] | null;
          max_locations?: number | null;
          audit_frequency?: string | null;
          max_ai_audits_per_month?: number | null;
          ai_audits_used_this_month?: number | null;
          current_billing_period_start?: string | null;
          onboarding_completed?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          notify_hallucination_alerts?: boolean | null;
          notify_weekly_digest?: boolean | null;
          notify_sov_alerts?: boolean | null;
          seat_limit?: number | null;
          seats_updated_at?: string | null;
          seat_overage_count?: number | null;
          seat_overage_since?: string | null;
          monitored_ai_models?: string[] | null;
          score_drop_threshold?: number | null;
          webhook_url?: string | null;
          industry?: string | null;
          scan_day_of_week?: number | null;
          notify_score_drop_alert?: boolean | null;
          notify_new_competitor?: boolean | null;
        };
        Relationships: [];
      };
      pending_invitations: {
        Row: {
          id: string;
          org_id: string;
          email: string;
          role: Database["public"]["Enums"]["membership_role"];
          token: string;
          invited_by: string;
          status: string;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          email: string;
          role?: Database["public"]["Enums"]["membership_role"];
          token?: string;
          invited_by: string;
          status?: string;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          email?: string;
          role?: Database["public"]["Enums"]["membership_role"];
          token?: string;
          invited_by?: string;
          status?: string;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pending_invitations_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pending_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      page_audits: {
        Row: {
          id: string;
          org_id: string;
          location_id: string | null;
          page_url: string;
          page_type: string;
          aeo_readability_score: number | null;
          answer_first_score: number | null;
          schema_completeness_score: number | null;
          faq_schema_present: boolean | null;
          faq_schema_score: number | null;
          entity_clarity_score: number | null;
          overall_score: number | null;
          recommendations: Json | null;
          last_audited_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          location_id?: string | null;
          page_url: string;
          page_type: string;
          aeo_readability_score?: number | null;
          answer_first_score?: number | null;
          schema_completeness_score?: number | null;
          faq_schema_present?: boolean | null;
          faq_schema_score?: number | null;
          entity_clarity_score?: number | null;
          overall_score?: number | null;
          recommendations?: Json | null;
          last_audited_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          location_id?: string | null;
          page_url?: string;
          page_type?: string;
          aeo_readability_score?: number | null;
          answer_first_score?: number | null;
          schema_completeness_score?: number | null;
          faq_schema_present?: boolean | null;
          faq_schema_score?: number | null;
          entity_clarity_score?: number | null;
          overall_score?: number | null;
          recommendations?: Json | null;
          last_audited_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "page_audits_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "page_audits_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      pending_gbp_imports: {
        Row: {
          id: string;
          org_id: string;
          locations_data: Json;
          account_name: string | null;
          has_more: boolean;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          locations_data: Json;
          account_name?: string | null;
          has_more?: boolean;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          locations_data?: Json;
          account_name?: string | null;
          has_more?: boolean;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pending_gbp_imports_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      revenue_config: {
        Row: {
          id: string;
          org_id: string;
          location_id: string;
          business_type: string;
          avg_ticket: number;
          monthly_searches: number;
          local_conversion_rate: number;
          walk_away_rate: number;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          location_id: string;
          business_type?: string;
          avg_ticket?: number;
          monthly_searches?: number;
          local_conversion_rate?: number;
          walk_away_rate?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          location_id?: string;
          business_type?: string;
          avg_ticket?: number;
          monthly_searches?: number;
          local_conversion_rate?: number;
          walk_away_rate?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "revenue_config_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "revenue_config_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      revenue_snapshots: {
        Row: {
          id: string;
          org_id: string;
          location_id: string;
          leak_low: number;
          leak_high: number;
          breakdown: Json;
          inputs_snapshot: Json;
          snapshot_date: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          location_id: string;
          leak_low?: number;
          leak_high?: number;
          breakdown?: Json;
          inputs_snapshot?: Json;
          snapshot_date: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          location_id?: string;
          leak_low?: number;
          leak_high?: number;
          breakdown?: Json;
          inputs_snapshot?: Json;
          snapshot_date?: string;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "revenue_snapshots_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "revenue_snapshots_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          id: string;
          platform_review_id: string;
          platform: string;
          location_id: string;
          org_id: string;
          reviewer_name: string;
          reviewer_photo_url: string | null;
          rating: number;
          text: string;
          published_at: string;
          platform_url: string | null;
          sentiment_label: string;
          sentiment_score: number | null;
          keywords: string[];
          topics: Json;
          response_draft: string | null;
          response_status: string;
          response_published_at: string | null;
          response_published_text: string | null;
          response_error: string | null;
          fetched_at: string;
          last_updated_at: string;
        };
        Insert: {
          id?: string;
          platform_review_id: string;
          platform: string;
          location_id: string;
          org_id: string;
          reviewer_name: string;
          reviewer_photo_url?: string | null;
          rating: number;
          text?: string;
          published_at: string;
          platform_url?: string | null;
          sentiment_label?: string;
          sentiment_score?: number | null;
          keywords?: string[];
          topics?: Json;
          response_draft?: string | null;
          response_status?: string;
          response_published_at?: string | null;
          response_published_text?: string | null;
          response_error?: string | null;
          fetched_at?: string;
          last_updated_at?: string;
        };
        Update: {
          id?: string;
          platform_review_id?: string;
          platform?: string;
          location_id?: string;
          org_id?: string;
          reviewer_name?: string;
          reviewer_photo_url?: string | null;
          rating?: number;
          text?: string;
          published_at?: string;
          platform_url?: string | null;
          sentiment_label?: string;
          sentiment_score?: number | null;
          keywords?: string[];
          topics?: Json;
          response_draft?: string | null;
          response_status?: string;
          response_published_at?: string | null;
          response_published_text?: string | null;
          response_error?: string | null;
          fetched_at?: string;
          last_updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      sov_evaluations: {
        Row: {
          id: string;
          org_id: string;
          location_id: string;
          query_id: string;
          engine: string;
          rank_position: number | null;
          mentioned_competitors: Json;
          raw_response: string | null;
          cited_sources: Json | null;
          sentiment_data: Json | null;
          source_mentions: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          location_id: string;
          query_id: string;
          engine: string;
          rank_position?: number | null;
          mentioned_competitors?: Json;
          raw_response?: string | null;
          cited_sources?: Json | null;
          sentiment_data?: Json | null;
          source_mentions?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          location_id?: string;
          query_id?: string;
          engine?: string;
          rank_position?: number | null;
          mentioned_competitors?: Json;
          raw_response?: string | null;
          cited_sources?: Json | null;
          sentiment_data?: Json | null;
          source_mentions?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sov_evaluations_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sov_evaluations_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sov_evaluations_query_id_fkey";
            columns: ["query_id"];
            isOneToOne: false;
            referencedRelation: "target_queries";
            referencedColumns: ["id"];
          },
        ];
      };
      target_queries: {
        Row: {
          id: string;
          org_id: string;
          location_id: string;
          query_text: string;
          query_category: string;
          occasion_tag: string | null;
          intent_modifier: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          location_id: string;
          query_text: string;
          query_category?: string;
          occasion_tag?: string | null;
          intent_modifier?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          location_id?: string;
          query_text?: string;
          query_category?: string;
          occasion_tag?: string | null;
          intent_modifier?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "target_queries_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "target_queries_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          id: string;
          auth_provider_id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          auth_provider_id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          auth_provider_id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      visibility_analytics: {
        Row: {
          id: string;
          org_id: string;
          location_id: string | null;
          share_of_voice: number | null;
          citation_rate: number | null;
          sentiment_gap: number | null;
          snapshot_date: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          location_id?: string | null;
          share_of_voice?: number | null;
          citation_rate?: number | null;
          sentiment_gap?: number | null;
          snapshot_date: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          location_id?: string | null;
          share_of_voice?: number | null;
          citation_rate?: number | null;
          sentiment_gap?: number | null;
          snapshot_date?: string;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "visibility_analytics_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visibility_analytics_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      visibility_scores: {
        Row: {
          id: string;
          org_id: string;
          location_id: string | null;
          visibility_score: number | null;
          accuracy_score: number | null;
          data_health_score: number | null;
          reality_score: number | null;
          score_delta: number | null;
          snapshot_date: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          location_id?: string | null;
          visibility_score?: number | null;
          accuracy_score?: number | null;
          data_health_score?: number | null;
          reality_score?: number | null;
          score_delta?: number | null;
          snapshot_date: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          location_id?: string | null;
          visibility_score?: number | null;
          accuracy_score?: number | null;
          data_health_score?: number | null;
          reality_score?: number | null;
          score_delta?: number | null;
          snapshot_date?: string;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "visibility_scores_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visibility_scores_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      location_permissions: {
        Row: {
          id: string;
          membership_id: string;
          location_id: string;
          role: Database["public"]["Enums"]["membership_role"];
          granted_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          membership_id: string;
          location_id: string;
          role?: Database["public"]["Enums"]["membership_role"];
          granted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          membership_id?: string;
          location_id?: string;
          role?: Database["public"]["Enums"]["membership_role"];
          granted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "location_permissions_membership_id_fkey";
            columns: ["membership_id"];
            isOneToOne: false;
            referencedRelation: "memberships";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "location_permissions_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "location_permissions_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      occasion_snoozes: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          occasion_id: string;
          snoozed_until: string;
          snoozed_at: string;
          snooze_count: number;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          occasion_id: string;
          snoozed_until: string;
          snoozed_at?: string;
          snooze_count?: number;
        };
        Update: {
          id?: string;
          org_id?: string;
          user_id?: string;
          occasion_id?: string;
          snoozed_until?: string;
          snoozed_at?: string;
          snooze_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "occasion_snoozes_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "occasion_snoozes_occasion_id_fkey";
            columns: ["occasion_id"];
            isOneToOne: false;
            referencedRelation: "local_occasions";
            referencedColumns: ["id"];
          },
        ];
      };
      sidebar_badge_state: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          section: string;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          section: string;
          last_seen_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          user_id?: string;
          section?: string;
          last_seen_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sidebar_badge_state_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      stripe_webhook_events: {
        Row: {
          id: string;
          stripe_event_id: string;
          event_type: string;
          processed_at: string;
          org_id: string | null;
          payload: Json | null;
          error: string | null;
        };
        Insert: {
          id?: string;
          stripe_event_id: string;
          event_type: string;
          processed_at?: string;
          org_id?: string | null;
          payload?: Json | null;
          error?: string | null;
        };
        Update: {
          id?: string;
          stripe_event_id?: string;
          event_type?: string;
          processed_at?: string;
          org_id?: string | null;
          payload?: Json | null;
          error?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stripe_webhook_events_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_user_org_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      increment_credits_used: {
        Args: { p_org_id: string };
        Returns: undefined;
      };
      compute_benchmarks: {
        Args: Record<PropertyKey, never>;
        Returns: {
          city: string;
          industry: string;
          org_count: number;
          avg_score: number;
          min_score: number;
          max_score: number;
        }[];
      };
    };
    Enums: {
      audit_prompt_type:
        | "status_check"
        | "hours_check"
        | "amenity_check"
        | "menu_check"
        | "recommendation";
      correction_status:
        | "open"
        | "verifying"
        | "fixed"
        | "dismissed"
        | "recurring";
      hallucination_severity: "critical" | "high" | "medium" | "low";
      membership_role: "owner" | "admin" | "member" | "viewer";
      menu_processing_status:
        | "uploading"
        | "processing"
        | "review_ready"
        | "published"
        | "failed";
      model_provider:
        | "openai-gpt4o"
        | "perplexity-sonar"
        | "google-gemini"
        | "anthropic-claude"
        | "microsoft-copilot"
        | "openai-gpt4o-mini";
      plan_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "paused";
      plan_tier: "trial" | "starter" | "growth" | "agency";
      sync_status:
        | "synced"
        | "mismatch"
        | "not_linked"
        | "error"
        | "needs_auth";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never;
