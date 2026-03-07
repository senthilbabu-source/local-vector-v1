-- S74: Add digest_preferences JSONB column to org_settings
-- Stores { frequency: 'weekly'|'biweekly'|'monthly', sections: string[] }
ALTER TABLE public.org_settings
  ADD COLUMN IF NOT EXISTS digest_preferences jsonb DEFAULT NULL;
