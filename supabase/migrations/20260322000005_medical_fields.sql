-- Sprint 127: Medical/dental practice fields on locations.

ALTER TABLE "public"."locations"
  ADD COLUMN IF NOT EXISTS "accepting_new_patients" boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "telehealth_available" boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "insurance_types" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "specialty_tags" text[] DEFAULT '{}';

COMMENT ON COLUMN "public"."locations"."accepting_new_patients" IS
  'NULL = not set, TRUE = accepting, FALSE = not accepting. Medical/dental only.';
COMMENT ON COLUMN "public"."locations"."telehealth_available" IS
  'Whether this practice offers telehealth/virtual visits. Medical/dental only.';
COMMENT ON COLUMN "public"."locations"."insurance_types" IS
  'Array of insurance plan names accepted. Medical/dental only. e.g. ["Delta Dental","Cigna","Aetna"]';
COMMENT ON COLUMN "public"."locations"."specialty_tags" IS
  'Medical specialties or dental procedure types offered. e.g. {orthodontics,cosmetic_dentistry}';
