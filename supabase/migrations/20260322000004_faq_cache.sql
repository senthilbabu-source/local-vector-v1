-- Sprint 128: FAQ cache on locations.
-- Stores pre-generated FAQ Q&A pairs for injection into /m/[slug] as FAQPage JSON-LD.
-- Content hash exclusion: faq_excluded_hashes stores SHA-256 hashes of hidden question strings.

ALTER TABLE "public"."locations"
  ADD COLUMN IF NOT EXISTS "faq_cache" jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "faq_updated_at" timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "faq_excluded_hashes" jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN "public"."locations"."faq_cache" IS
  'Cached FAQPage Q&A pairs. Array of {id, question, answer, contentHash, source}. Updated nightly.';
COMMENT ON COLUMN "public"."locations"."faq_updated_at" IS
  'When the FAQ cache was last regenerated.';
COMMENT ON COLUMN "public"."locations"."faq_excluded_hashes" IS
  'Array of SHA-256 content hashes for FAQ pairs hidden by the owner.';
