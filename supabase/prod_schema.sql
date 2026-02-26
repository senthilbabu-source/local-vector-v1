


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."audit_prompt_type" AS ENUM (
    'status_check',
    'hours_check',
    'amenity_check',
    'menu_check',
    'recommendation'
);


ALTER TYPE "public"."audit_prompt_type" OWNER TO "postgres";


CREATE TYPE "public"."correction_status" AS ENUM (
    'open',
    'verifying',
    'fixed',
    'dismissed',
    'recurring'
);


ALTER TYPE "public"."correction_status" OWNER TO "postgres";


CREATE TYPE "public"."hallucination_severity" AS ENUM (
    'critical',
    'high',
    'medium',
    'low'
);


ALTER TYPE "public"."hallucination_severity" OWNER TO "postgres";


CREATE TYPE "public"."membership_role" AS ENUM (
    'owner',
    'admin',
    'member',
    'viewer'
);


ALTER TYPE "public"."membership_role" OWNER TO "postgres";


CREATE TYPE "public"."menu_processing_status" AS ENUM (
    'uploading',
    'processing',
    'review_ready',
    'published',
    'failed'
);


ALTER TYPE "public"."menu_processing_status" OWNER TO "postgres";


CREATE TYPE "public"."model_provider" AS ENUM (
    'openai-gpt4o',
    'perplexity-sonar',
    'google-gemini',
    'anthropic-claude',
    'microsoft-copilot',
    'openai-gpt4o-mini'
);


ALTER TYPE "public"."model_provider" OWNER TO "postgres";


CREATE TYPE "public"."plan_status" AS ENUM (
    'trialing',
    'active',
    'past_due',
    'canceled',
    'paused'
);


ALTER TYPE "public"."plan_status" OWNER TO "postgres";


CREATE TYPE "public"."plan_tier" AS ENUM (
    'trial',
    'starter',
    'growth',
    'agency'
);


ALTER TYPE "public"."plan_tier" OWNER TO "postgres";


CREATE TYPE "public"."sync_status" AS ENUM (
    'synced',
    'mismatch',
    'not_linked',
    'error',
    'needs_auth'
);


ALTER TYPE "public"."sync_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_org_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT m.org_id
  FROM public.memberships m
  WHERE m.user_id = (
    SELECT u.id FROM public.users u WHERE u.auth_provider_id = auth.uid()
  )
  LIMIT 1;
$$;


ALTER FUNCTION "public"."current_user_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_auth_user_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.users (auth_provider_id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (auth_provider_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_auth_user_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  new_org_id UUID;
  org_slug VARCHAR(100);
BEGIN
  -- Generate slug from email prefix
  org_slug := LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-z0-9]', '-', 'g'));
  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = org_slug) THEN
    org_slug := org_slug || '-' || SUBSTRING(uuid_generate_v4()::text FROM 1 FOR 8);
  END IF;

  -- Create organization
  INSERT INTO public.organizations (name, slug, owner_user_id)
  VALUES (COALESCE(NEW.full_name, SPLIT_PART(NEW.email, '@', 1)) || '''s Venue', org_slug, NEW.id)
  RETURNING id INTO new_org_id;

  -- Create membership (owner role)
  INSERT INTO public.memberships (user_id, org_id, role)
  VALUES (NEW.id, new_org_id, 'owner');

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_monthly_audit_counter"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.current_billing_period_start IS DISTINCT FROM OLD.current_billing_period_start THEN
    NEW.ai_audits_used_this_month := 0;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."reset_monthly_audit_counter"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_google_tos_refresh"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.place_details_refreshed_at < NOW() - INTERVAL '30 days' THEN
    PERFORM net.http_post(
      url:='https://<project>.supabase.co/functions/v1/refresh-google-data',
      headers:=jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
      body:=jsonb_build_object('location_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_google_tos_refresh"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ai_audits" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "model_provider" "public"."model_provider" NOT NULL,
    "prompt_type" "public"."audit_prompt_type" NOT NULL,
    "prompt_text" "text",
    "raw_response" "text",
    "response_metadata" "jsonb",
    "is_hallucination_detected" boolean DEFAULT false,
    "audit_date" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_audits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_evaluations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "engine" character varying(20) NOT NULL,
    "prompt_used" "text",
    "response_text" "text",
    "accuracy_score" integer,
    "hallucinations_detected" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_evaluations_accuracy_score_check" CHECK ((("accuracy_score" >= 0) AND ("accuracy_score" <= 100)))
);


ALTER TABLE "public"."ai_evaluations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_hallucinations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "audit_id" "uuid",
    "severity" "public"."hallucination_severity" DEFAULT 'high'::"public"."hallucination_severity",
    "category" character varying(50),
    "model_provider" "public"."model_provider" NOT NULL,
    "claim_text" "text" NOT NULL,
    "expected_truth" "text",
    "correction_status" "public"."correction_status" DEFAULT 'open'::"public"."correction_status",
    "resolved_at" timestamp with time zone,
    "resolution_notes" "text",
    "first_detected_at" timestamp with time zone DEFAULT "now"(),
    "last_seen_at" timestamp with time zone DEFAULT "now"(),
    "occurrence_count" integer DEFAULT 1,
    "propagation_events" "jsonb" DEFAULT '[]'::"jsonb",
    "detected_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_hallucinations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_info" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "business_name" character varying(255) NOT NULL,
    "address" "text",
    "phone" character varying(50),
    "website_url" "text",
    "hours_data" "jsonb",
    "amenities" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."business_info" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."citation_source_intelligence" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "business_category" character varying(100) NOT NULL,
    "city" character varying(100) NOT NULL,
    "state" character varying(50) NOT NULL,
    "platform" character varying(50) NOT NULL,
    "citation_frequency" double precision NOT NULL,
    "sample_query" "text",
    "sample_size" integer DEFAULT 1 NOT NULL,
    "model_provider" "public"."model_provider" NOT NULL,
    "measured_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "citation_source_intelligence_citation_frequency_check" CHECK ((("citation_frequency" >= (0)::double precision) AND ("citation_frequency" <= (1)::double precision)))
);


ALTER TABLE "public"."citation_source_intelligence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."competitor_intercepts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "competitor_name" character varying(255) NOT NULL,
    "query_asked" character varying(500),
    "model_provider" "public"."model_provider" NOT NULL,
    "winner" character varying(255),
    "winner_reason" "text",
    "winning_factor" character varying(255),
    "gap_analysis" "jsonb",
    "gap_magnitude" character varying(20),
    "suggested_action" "text",
    "action_status" character varying(20) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."competitor_intercepts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."competitors" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "competitor_name" character varying(255) NOT NULL,
    "competitor_address" "text",
    "competitor_google_place_id" character varying(255),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."competitors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_drafts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "trigger_type" character varying(50) NOT NULL,
    "trigger_id" "uuid",
    "draft_title" "text" NOT NULL,
    "draft_content" "text" NOT NULL,
    "target_prompt" "text",
    "content_type" character varying(50) NOT NULL,
    "aeo_score" integer,
    "status" character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    "human_approved" boolean DEFAULT false NOT NULL,
    "published_url" "text",
    "published_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "content_drafts_content_type_check" CHECK ((("content_type")::"text" = ANY ((ARRAY['faq_page'::character varying, 'occasion_page'::character varying, 'blog_post'::character varying, 'landing_page'::character varying, 'gbp_post'::character varying])::"text"[]))),
    CONSTRAINT "content_drafts_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['draft'::character varying, 'approved'::character varying, 'published'::character varying, 'rejected'::character varying, 'archived'::character varying])::"text"[]))),
    CONSTRAINT "content_drafts_trigger_type_check" CHECK ((("trigger_type")::"text" = ANY ((ARRAY['competitor_gap'::character varying, 'occasion'::character varying, 'prompt_missing'::character varying, 'first_mover'::character varying, 'manual'::character varying])::"text"[])))
);


ALTER TABLE "public"."content_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crawler_hits" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "menu_id" "uuid" NOT NULL,
    "bot_type" character varying(50) NOT NULL,
    "user_agent" "text",
    "crawled_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."crawler_hits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."directories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "display_name" character varying(100) NOT NULL,
    "base_url" "text",
    "is_priority" boolean DEFAULT false,
    "feeds_ai_models" boolean DEFAULT false,
    "icon_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."directories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."google_oauth_tokens" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "access_token" "text" NOT NULL,
    "refresh_token" "text" NOT NULL,
    "token_type" character varying(20) DEFAULT 'Bearer'::character varying NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "gbp_account_name" character varying(255),
    "google_email" character varying(255),
    "scopes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."google_oauth_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."listings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "directory_id" "uuid" NOT NULL,
    "listing_url" "text",
    "sync_status" "public"."sync_status" DEFAULT 'not_linked'::"public"."sync_status",
    "nap_name" character varying(255),
    "nap_address" "text",
    "nap_phone" character varying(50),
    "nap_consistency_score" integer,
    "last_checked_at" timestamp with time zone,
    "last_synced_at" timestamp with time zone,
    "error_details" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."local_occasions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "occasion_type" character varying(50) NOT NULL,
    "trigger_days_before" integer DEFAULT 28 NOT NULL,
    "annual_date" character varying(10),
    "peak_query_patterns" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "relevant_categories" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "local_occasions_occasion_type_check" CHECK ((("occasion_type")::"text" = ANY ((ARRAY['holiday'::character varying, 'celebration'::character varying, 'recurring'::character varying, 'seasonal'::character varying])::"text"[])))
);


ALTER TABLE "public"."local_occasions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."location_integrations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "platform" character varying(20) NOT NULL,
    "status" character varying(20) DEFAULT 'disconnected'::character varying NOT NULL,
    "last_sync_at" timestamp with time zone,
    "external_id" character varying(255),
    "listing_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."location_integrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "is_primary" boolean DEFAULT false,
    "business_name" character varying(255) NOT NULL,
    "address_line1" character varying(255),
    "address_line2" character varying(255),
    "city" character varying(100),
    "state" character varying(50),
    "zip" character varying(20),
    "country" character varying(50) DEFAULT 'US'::character varying,
    "phone" character varying(50),
    "website_url" "text",
    "google_place_id" character varying(255),
    "place_details_refreshed_at" timestamp with time zone DEFAULT "now"(),
    "hours_data" "jsonb",
    "amenities" "jsonb",
    "categories" "jsonb",
    "attributes" "jsonb",
    "operational_status" character varying(50) DEFAULT 'OPERATIONAL'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "google_location_name" character varying(255),
    "gbp_integration_id" "uuid"
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."magic_menus" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "source_url" "text",
    "source_type" character varying(20),
    "processing_status" "public"."menu_processing_status" DEFAULT 'uploading'::"public"."menu_processing_status",
    "extracted_data" "jsonb",
    "extraction_confidence" double precision,
    "json_ld_schema" "jsonb",
    "human_verified" boolean DEFAULT false,
    "verified_at" timestamp with time zone,
    "is_published" boolean DEFAULT false,
    "public_slug" character varying(100),
    "page_views" integer DEFAULT 0,
    "last_crawled_by" "jsonb",
    "ai_readability_score" double precision,
    "llms_txt_content" "text",
    "propagation_events" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "magic_menus_ai_readability_score_check" CHECK ((("ai_readability_score" >= (0)::double precision) AND ("ai_readability_score" <= (100)::double precision)))
);


ALTER TABLE "public"."magic_menus" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."memberships" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "role" "public"."membership_role" DEFAULT 'member'::"public"."membership_role",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "menu_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."menu_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "menu_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "price" numeric(10,2),
    "price_note" character varying(100),
    "currency" character varying(3) DEFAULT 'USD'::character varying,
    "dietary_tags" "jsonb",
    "is_available" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "category_id" "uuid"
);


ALTER TABLE "public"."menu_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "owner_user_id" "uuid",
    "stripe_customer_id" character varying(255),
    "stripe_subscription_id" character varying(255),
    "plan" "public"."plan_tier" DEFAULT 'trial'::"public"."plan_tier",
    "plan_status" "public"."plan_status" DEFAULT 'trialing'::"public"."plan_status",
    "max_locations" integer DEFAULT 1,
    "audit_frequency" character varying(20) DEFAULT 'weekly'::character varying,
    "max_ai_audits_per_month" integer DEFAULT 4,
    "ai_audits_used_this_month" integer DEFAULT 0,
    "current_billing_period_start" timestamp with time zone,
    "onboarding_completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."page_audits" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "page_url" "text" NOT NULL,
    "page_type" character varying(50) NOT NULL,
    "aeo_readability_score" integer,
    "answer_first_score" integer,
    "schema_completeness_score" integer,
    "faq_schema_present" boolean,
    "faq_schema_score" integer,
    "entity_clarity_score" integer,
    "overall_score" integer,
    "recommendations" "jsonb",
    "last_audited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "page_audits_page_type_check" CHECK ((("page_type")::"text" = ANY ((ARRAY['homepage'::character varying, 'menu'::character varying, 'about'::character varying, 'faq'::character varying, 'events'::character varying, 'occasion'::character varying, 'other'::character varying])::"text"[])))
);


ALTER TABLE "public"."page_audits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pending_gbp_imports" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "locations_data" "jsonb" NOT NULL,
    "account_name" character varying(255),
    "has_more" boolean DEFAULT false NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pending_gbp_imports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sov_evaluations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "query_id" "uuid" NOT NULL,
    "engine" character varying(20) NOT NULL,
    "rank_position" integer,
    "mentioned_competitors" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "raw_response" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sov_evaluations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."target_queries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "query_text" character varying(500) NOT NULL,
    "query_category" character varying(50) DEFAULT 'discovery'::character varying NOT NULL,
    "occasion_tag" character varying(50),
    "intent_modifier" character varying(50),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "target_queries_category_check" CHECK (((query_category)::text = ANY ((ARRAY['discovery'::character varying, 'comparison'::character varying, 'occasion'::character varying, 'near_me'::character varying, 'custom'::character varying])::text[])))
);


ALTER TABLE "public"."target_queries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "auth_provider_id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "full_name" character varying(255),
    "avatar_url" character varying(500),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visibility_analytics" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "share_of_voice" double precision,
    "citation_rate" double precision,
    "sentiment_gap" double precision,
    "snapshot_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."visibility_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visibility_scores" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "visibility_score" double precision,
    "accuracy_score" double precision,
    "data_health_score" double precision,
    "reality_score" double precision,
    "score_delta" double precision,
    "snapshot_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."visibility_scores" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ai_audits"
    ADD CONSTRAINT "ai_audits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_evaluations"
    ADD CONSTRAINT "ai_evaluations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_hallucinations"
    ADD CONSTRAINT "ai_hallucinations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_info"
    ADD CONSTRAINT "business_info_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."citation_source_intelligence"
    ADD CONSTRAINT "citation_source_intelligence_business_category_city_state_p_key" UNIQUE ("business_category", "city", "state", "platform", "model_provider");



ALTER TABLE ONLY "public"."citation_source_intelligence"
    ADD CONSTRAINT "citation_source_intelligence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."competitor_intercepts"
    ADD CONSTRAINT "competitor_intercepts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."competitors"
    ADD CONSTRAINT "competitors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_drafts"
    ADD CONSTRAINT "content_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crawler_hits"
    ADD CONSTRAINT "crawler_hits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."directories"
    ADD CONSTRAINT "directories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."directories"
    ADD CONSTRAINT "directories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."google_oauth_tokens"
    ADD CONSTRAINT "google_oauth_tokens_org_id_key" UNIQUE ("org_id");



ALTER TABLE ONLY "public"."google_oauth_tokens"
    ADD CONSTRAINT "google_oauth_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_org_id_location_id_directory_id_key" UNIQUE ("org_id", "location_id", "directory_id");



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."local_occasions"
    ADD CONSTRAINT "local_occasions_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."local_occasions"
    ADD CONSTRAINT "local_occasions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."location_integrations"
    ADD CONSTRAINT "location_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_org_id_slug_key" UNIQUE ("org_id", "slug");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."magic_menus"
    ADD CONSTRAINT "magic_menus_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_user_id_org_id_key" UNIQUE ("user_id", "org_id");



ALTER TABLE ONLY "public"."menu_categories"
    ADD CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."page_audits"
    ADD CONSTRAINT "page_audits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_gbp_imports"
    ADD CONSTRAINT "pending_gbp_imports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sov_evaluations"
    ADD CONSTRAINT "sov_evaluations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."target_queries"
    ADD CONSTRAINT "target_queries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."location_integrations"
    ADD CONSTRAINT "uq_location_platform" UNIQUE ("location_id", "platform");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_provider_id_key" UNIQUE ("auth_provider_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."visibility_analytics"
    ADD CONSTRAINT "visibility_analytics_org_id_location_id_snapshot_date_key" UNIQUE ("org_id", "location_id", "snapshot_date");



ALTER TABLE ONLY "public"."visibility_analytics"
    ADD CONSTRAINT "visibility_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."visibility_scores"
    ADD CONSTRAINT "visibility_scores_org_id_location_id_snapshot_date_key" UNIQUE ("org_id", "location_id", "snapshot_date");



ALTER TABLE ONLY "public"."visibility_scores"
    ADD CONSTRAINT "visibility_scores_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_ai_evaluations_location" ON "public"."ai_evaluations" USING "btree" ("location_id");



CREATE INDEX "idx_ai_evaluations_location_created" ON "public"."ai_evaluations" USING "btree" ("location_id", "created_at" DESC);



CREATE INDEX "idx_ai_evaluations_org" ON "public"."ai_evaluations" USING "btree" ("org_id");



CREATE INDEX "idx_audits_date" ON "public"."ai_audits" USING "btree" ("org_id", "audit_date" DESC);



CREATE INDEX "idx_audits_org" ON "public"."ai_audits" USING "btree" ("org_id");



CREATE INDEX "idx_citation_category_city" ON "public"."citation_source_intelligence" USING "btree" ("business_category", "city", "state");



CREATE INDEX "idx_competitors_org" ON "public"."competitors" USING "btree" ("org_id");



CREATE INDEX "idx_content_drafts_org_status" ON "public"."content_drafts" USING "btree" ("org_id", "status");



CREATE INDEX "idx_content_drafts_trigger" ON "public"."content_drafts" USING "btree" ("trigger_type", "trigger_id");



CREATE INDEX "idx_crawler_hits_menu_bot" ON "public"."crawler_hits" USING "btree" ("menu_id", "bot_type", "crawled_at" DESC);



CREATE INDEX "idx_hallucinations_open" ON "public"."ai_hallucinations" USING "btree" ("org_id", "correction_status") WHERE ("correction_status" = 'open'::"public"."correction_status");



CREATE INDEX "idx_hallucinations_org" ON "public"."ai_hallucinations" USING "btree" ("org_id");



CREATE INDEX "idx_intercepts_org" ON "public"."competitor_intercepts" USING "btree" ("org_id");



CREATE INDEX "idx_listings_org" ON "public"."listings" USING "btree" ("org_id");



CREATE INDEX "idx_location_integrations_location" ON "public"."location_integrations" USING "btree" ("location_id");



CREATE INDEX "idx_location_integrations_org" ON "public"."location_integrations" USING "btree" ("org_id");



CREATE INDEX "idx_locations_org" ON "public"."locations" USING "btree" ("org_id");



CREATE INDEX "idx_locations_slug" ON "public"."locations" USING "btree" ("org_id", "slug");



CREATE INDEX "idx_magic_menu_slug" ON "public"."magic_menus" USING "btree" ("public_slug") WHERE ("is_published" = true);



CREATE INDEX "idx_memberships_org" ON "public"."memberships" USING "btree" ("org_id");



CREATE INDEX "idx_memberships_user" ON "public"."memberships" USING "btree" ("user_id");



CREATE INDEX "idx_menu_categories_menu" ON "public"."menu_categories" USING "btree" ("menu_id");



CREATE INDEX "idx_menu_categories_org" ON "public"."menu_categories" USING "btree" ("org_id");



CREATE INDEX "idx_menu_items_category" ON "public"."menu_items" USING "btree" ("category_id");



CREATE INDEX "idx_menu_items_menu" ON "public"."menu_items" USING "btree" ("menu_id");



CREATE INDEX "idx_page_audits_org_url" ON "public"."page_audits" USING "btree" ("org_id", "page_url");



CREATE UNIQUE INDEX "idx_page_audits_org_url_unique" ON "public"."page_audits" USING "btree" ("org_id", "page_url");



CREATE INDEX "idx_pending_gbp_imports_org" ON "public"."pending_gbp_imports" USING "btree" ("org_id");



CREATE INDEX "idx_sov_evaluations_location" ON "public"."sov_evaluations" USING "btree" ("location_id");



CREATE INDEX "idx_sov_evaluations_org" ON "public"."sov_evaluations" USING "btree" ("org_id");



CREATE INDEX "idx_sov_evaluations_query" ON "public"."sov_evaluations" USING "btree" ("query_id");



CREATE INDEX "idx_sov_evaluations_query_created" ON "public"."sov_evaluations" USING "btree" ("query_id", "created_at" DESC);



CREATE INDEX "idx_target_queries_location" ON "public"."target_queries" USING "btree" ("location_id");



CREATE INDEX "idx_target_queries_org" ON "public"."target_queries" USING "btree" ("org_id");

CREATE INDEX "idx_target_queries_category" ON "public"."target_queries" USING "btree" ("query_category");



CREATE INDEX "idx_visibility_analytics_org_date" ON "public"."visibility_analytics" USING "btree" ("org_id", "snapshot_date" DESC);



CREATE INDEX "idx_visibility_org_date" ON "public"."visibility_scores" USING "btree" ("org_id", "snapshot_date" DESC);



CREATE OR REPLACE TRIGGER "on_user_created" AFTER INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();



CREATE OR REPLACE TRIGGER "reset_audit_counter" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."reset_monthly_audit_counter"();



CREATE OR REPLACE TRIGGER "set_updated_at_content_drafts" BEFORE UPDATE ON "public"."content_drafts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_google_oauth_tokens" BEFORE UPDATE ON "public"."google_oauth_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_listings" BEFORE UPDATE ON "public"."listings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_locations" BEFORE UPDATE ON "public"."locations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_magic_menus" BEFORE UPDATE ON "public"."magic_menus" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_menu_items" BEFORE UPDATE ON "public"."menu_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_organizations" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."ai_audits"
    ADD CONSTRAINT "ai_audits_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_audits"
    ADD CONSTRAINT "ai_audits_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_evaluations"
    ADD CONSTRAINT "ai_evaluations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_evaluations"
    ADD CONSTRAINT "ai_evaluations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_hallucinations"
    ADD CONSTRAINT "ai_hallucinations_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "public"."ai_audits"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_hallucinations"
    ADD CONSTRAINT "ai_hallucinations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_hallucinations"
    ADD CONSTRAINT "ai_hallucinations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_info"
    ADD CONSTRAINT "business_info_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_info"
    ADD CONSTRAINT "business_info_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."competitor_intercepts"
    ADD CONSTRAINT "competitor_intercepts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."competitor_intercepts"
    ADD CONSTRAINT "competitor_intercepts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."competitors"
    ADD CONSTRAINT "competitors_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."competitors"
    ADD CONSTRAINT "competitors_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_drafts"
    ADD CONSTRAINT "content_drafts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_drafts"
    ADD CONSTRAINT "content_drafts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crawler_hits"
    ADD CONSTRAINT "crawler_hits_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."magic_menus"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crawler_hits"
    ADD CONSTRAINT "crawler_hits_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."google_oauth_tokens"
    ADD CONSTRAINT "google_oauth_tokens_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_directory_id_fkey" FOREIGN KEY ("directory_id") REFERENCES "public"."directories"("id");



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."location_integrations"
    ADD CONSTRAINT "location_integrations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."location_integrations"
    ADD CONSTRAINT "location_integrations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_gbp_integration_id_fkey" FOREIGN KEY ("gbp_integration_id") REFERENCES "public"."location_integrations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."magic_menus"
    ADD CONSTRAINT "magic_menus_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."magic_menus"
    ADD CONSTRAINT "magic_menus_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_categories"
    ADD CONSTRAINT "menu_categories_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."magic_menus"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_categories"
    ADD CONSTRAINT "menu_categories_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."menu_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."magic_menus"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."page_audits"
    ADD CONSTRAINT "page_audits_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."page_audits"
    ADD CONSTRAINT "page_audits_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_gbp_imports"
    ADD CONSTRAINT "pending_gbp_imports_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sov_evaluations"
    ADD CONSTRAINT "sov_evaluations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sov_evaluations"
    ADD CONSTRAINT "sov_evaluations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sov_evaluations"
    ADD CONSTRAINT "sov_evaluations_query_id_fkey" FOREIGN KEY ("query_id") REFERENCES "public"."target_queries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."target_queries"
    ADD CONSTRAINT "target_queries_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."target_queries"
    ADD CONSTRAINT "target_queries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visibility_analytics"
    ADD CONSTRAINT "visibility_analytics_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visibility_analytics"
    ADD CONSTRAINT "visibility_analytics_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visibility_scores"
    ADD CONSTRAINT "visibility_scores_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visibility_scores"
    ADD CONSTRAINT "visibility_scores_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



CREATE POLICY "Directories are viewable by everyone" ON "public"."directories" FOR SELECT USING (true);



CREATE POLICY "Public profiles are viewable by everyone." ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Users can update their own profile." ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "auth_provider_id"));



ALTER TABLE "public"."ai_audits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_evaluations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_hallucinations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_info" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."citation_source_intelligence" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."competitor_intercepts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."competitors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_drafts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crawler_hits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."directories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."google_oauth_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."location_integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."magic_menus" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_isolation_delete" ON "public"."ai_evaluations" FOR DELETE USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_delete" ON "public"."ai_hallucinations" FOR DELETE USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_delete" ON "public"."competitor_intercepts" FOR DELETE USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_delete" ON "public"."competitors" FOR DELETE USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_delete" ON "public"."content_drafts" FOR DELETE USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_delete" ON "public"."listings" FOR DELETE USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_delete" ON "public"."location_integrations" FOR DELETE USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_delete" ON "public"."magic_menus" FOR DELETE USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_delete" ON "public"."menu_categories" FOR DELETE USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_delete" ON "public"."menu_items" FOR DELETE USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_delete" ON "public"."page_audits" FOR DELETE USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_delete" ON "public"."sov_evaluations" FOR DELETE USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_delete" ON "public"."target_queries" FOR DELETE USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_insert" ON "public"."ai_evaluations" FOR INSERT WITH CHECK (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_insert" ON "public"."ai_hallucinations" FOR INSERT WITH CHECK (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_insert" ON "public"."competitor_intercepts" FOR INSERT WITH CHECK (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_insert" ON "public"."competitors" FOR INSERT WITH CHECK (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_insert" ON "public"."content_drafts" FOR INSERT WITH CHECK (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_insert" ON "public"."listings" FOR INSERT WITH CHECK (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_insert" ON "public"."location_integrations" FOR INSERT WITH CHECK (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_insert" ON "public"."locations" FOR INSERT WITH CHECK (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_insert" ON "public"."magic_menus" FOR INSERT WITH CHECK (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_insert" ON "public"."menu_categories" FOR INSERT WITH CHECK (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_insert" ON "public"."menu_items" FOR INSERT WITH CHECK (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_insert" ON "public"."page_audits" FOR INSERT WITH CHECK (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_insert" ON "public"."sov_evaluations" FOR INSERT WITH CHECK (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_insert" ON "public"."target_queries" FOR INSERT WITH CHECK (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_select" ON "public"."ai_audits" FOR SELECT USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_select" ON "public"."ai_evaluations" FOR SELECT USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_select" ON "public"."ai_hallucinations" FOR SELECT USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_select" ON "public"."business_info" FOR SELECT USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "authenticated_select" ON "public"."citation_source_intelligence" FOR SELECT TO authenticated USING (true);



CREATE POLICY "org_isolation_select" ON "public"."competitor_intercepts" FOR SELECT USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_select" ON "public"."competitors" FOR SELECT USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_select" ON "public"."content_drafts" FOR SELECT USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_select" ON "public"."crawler_hits" FOR SELECT USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_select" ON "public"."listings" FOR SELECT USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_select" ON "public"."location_integrations" FOR SELECT USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_select" ON "public"."locations" FOR SELECT USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_select" ON "public"."magic_menus" FOR SELECT USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_select" ON "public"."menu_categories" FOR SELECT USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_select" ON "public"."menu_items" FOR SELECT USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_select" ON "public"."organizations" FOR SELECT USING (("id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_select" ON "public"."page_audits" FOR SELECT USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_select" ON "public"."sov_evaluations" FOR SELECT USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_select" ON "public"."target_queries" FOR SELECT USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_select" ON "public"."visibility_analytics" FOR SELECT USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_select" ON "public"."visibility_scores" FOR SELECT USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_update" ON "public"."ai_evaluations" FOR UPDATE USING (("org_id" = "public"."current_user_org_id"())) WITH CHECK (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_update" ON "public"."ai_hallucinations" FOR UPDATE USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_update" ON "public"."competitor_intercepts" FOR UPDATE USING (("org_id" = "public"."current_user_org_id"())) WITH CHECK (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_update" ON "public"."content_drafts" FOR UPDATE USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_update" ON "public"."listings" FOR UPDATE USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_update" ON "public"."location_integrations" FOR UPDATE USING (("org_id" = "public"."current_user_org_id"())) WITH CHECK (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_update" ON "public"."locations" FOR UPDATE USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_update" ON "public"."magic_menus" FOR UPDATE USING (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_update" ON "public"."menu_categories" FOR UPDATE USING (("org_id" = "public"."current_user_org_id"())) WITH CHECK (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_update" ON "public"."menu_items" FOR UPDATE USING (("org_id" = "public"."current_user_org_id"())) WITH CHECK (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_update" ON "public"."page_audits" FOR UPDATE USING (("org_id" = "public"."current_user_org_id"())) WITH CHECK (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_update" ON "public"."sov_evaluations" FOR UPDATE USING (("org_id" = "public"."current_user_org_id"())) WITH CHECK (("org_id" = "public"."current_user_org_id"()));



CREATE POLICY "org_isolation_update" ON "public"."target_queries" FOR UPDATE USING (("org_id" = "public"."current_user_org_id"())) WITH CHECK (("org_id" = "public"."current_user_org_id"()));



ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."page_audits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pending_gbp_imports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_menu_items" ON "public"."menu_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."magic_menus" "mm"
  WHERE (("mm"."id" = "menu_items"."menu_id") AND ("mm"."is_published" = true)))));



CREATE POLICY "public_published_categories" ON "public"."menu_categories" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."magic_menus" "mm"
  WHERE (("mm"."id" = "menu_categories"."menu_id") AND ("mm"."is_published" = true)))));



CREATE POLICY "public_published_location" ON "public"."locations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."magic_menus" "mm"
  WHERE (("mm"."location_id" = "locations"."id") AND ("mm"."is_published" = true)))));



CREATE POLICY "public_published_menus" ON "public"."magic_menus" FOR SELECT USING (("is_published" = true));



CREATE POLICY "service_role_insert" ON "public"."crawler_hits" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."sov_evaluations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."target_queries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_link_injection_update" ON "public"."magic_menus" FOR UPDATE USING (("org_id" = "public"."current_user_org_id"())) WITH CHECK (("org_id" = "public"."current_user_org_id"()));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."visibility_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."visibility_scores" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";































































































































































GRANT ALL ON FUNCTION "public"."current_user_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_org_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_auth_user_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_auth_user_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_auth_user_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_monthly_audit_counter"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_monthly_audit_counter"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_monthly_audit_counter"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_google_tos_refresh"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_google_tos_refresh"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_google_tos_refresh"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";


















GRANT ALL ON TABLE "public"."ai_audits" TO "anon";
GRANT ALL ON TABLE "public"."ai_audits" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_audits" TO "service_role";



GRANT ALL ON TABLE "public"."ai_evaluations" TO "anon";
GRANT ALL ON TABLE "public"."ai_evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_evaluations" TO "service_role";



GRANT ALL ON TABLE "public"."ai_hallucinations" TO "anon";
GRANT ALL ON TABLE "public"."ai_hallucinations" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_hallucinations" TO "service_role";



GRANT ALL ON TABLE "public"."business_info" TO "anon";
GRANT ALL ON TABLE "public"."business_info" TO "authenticated";
GRANT ALL ON TABLE "public"."business_info" TO "service_role";



GRANT ALL ON TABLE "public"."citation_source_intelligence" TO "anon";
GRANT ALL ON TABLE "public"."citation_source_intelligence" TO "authenticated";
GRANT ALL ON TABLE "public"."citation_source_intelligence" TO "service_role";



GRANT ALL ON TABLE "public"."competitor_intercepts" TO "anon";
GRANT ALL ON TABLE "public"."competitor_intercepts" TO "authenticated";
GRANT ALL ON TABLE "public"."competitor_intercepts" TO "service_role";



GRANT ALL ON TABLE "public"."competitors" TO "anon";
GRANT ALL ON TABLE "public"."competitors" TO "authenticated";
GRANT ALL ON TABLE "public"."competitors" TO "service_role";



GRANT ALL ON TABLE "public"."content_drafts" TO "anon";
GRANT ALL ON TABLE "public"."content_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."content_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."crawler_hits" TO "anon";
GRANT ALL ON TABLE "public"."crawler_hits" TO "authenticated";
GRANT ALL ON TABLE "public"."crawler_hits" TO "service_role";



GRANT ALL ON TABLE "public"."directories" TO "anon";
GRANT ALL ON TABLE "public"."directories" TO "authenticated";
GRANT ALL ON TABLE "public"."directories" TO "service_role";



GRANT ALL ON TABLE "public"."google_oauth_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."listings" TO "anon";
GRANT ALL ON TABLE "public"."listings" TO "authenticated";
GRANT ALL ON TABLE "public"."listings" TO "service_role";



GRANT ALL ON TABLE "public"."local_occasions" TO "anon";
GRANT ALL ON TABLE "public"."local_occasions" TO "authenticated";
GRANT ALL ON TABLE "public"."local_occasions" TO "service_role";



GRANT ALL ON TABLE "public"."location_integrations" TO "anon";
GRANT ALL ON TABLE "public"."location_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."location_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."locations" TO "anon";
GRANT ALL ON TABLE "public"."locations" TO "authenticated";
GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT ALL ON TABLE "public"."magic_menus" TO "anon";
GRANT ALL ON TABLE "public"."magic_menus" TO "authenticated";
GRANT ALL ON TABLE "public"."magic_menus" TO "service_role";



GRANT ALL ON TABLE "public"."memberships" TO "anon";
GRANT ALL ON TABLE "public"."memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."memberships" TO "service_role";



GRANT ALL ON TABLE "public"."menu_categories" TO "anon";
GRANT ALL ON TABLE "public"."menu_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_categories" TO "service_role";



GRANT ALL ON TABLE "public"."menu_items" TO "anon";
GRANT ALL ON TABLE "public"."menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_items" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."page_audits" TO "anon";
GRANT ALL ON TABLE "public"."page_audits" TO "authenticated";
GRANT ALL ON TABLE "public"."page_audits" TO "service_role";



GRANT ALL ON TABLE "public"."pending_gbp_imports" TO "service_role";



GRANT ALL ON TABLE "public"."sov_evaluations" TO "anon";
GRANT ALL ON TABLE "public"."sov_evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."sov_evaluations" TO "service_role";



GRANT ALL ON TABLE "public"."target_queries" TO "anon";
GRANT ALL ON TABLE "public"."target_queries" TO "authenticated";
GRANT ALL ON TABLE "public"."target_queries" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."visibility_analytics" TO "anon";
GRANT ALL ON TABLE "public"."visibility_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."visibility_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."visibility_scores" TO "anon";
GRANT ALL ON TABLE "public"."visibility_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."visibility_scores" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































