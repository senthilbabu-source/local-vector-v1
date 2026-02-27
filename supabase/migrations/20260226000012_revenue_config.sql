-- Sprint 85: Revenue Impact Calculator — add revenue config fields to locations
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS avg_customer_value numeric(10,2) DEFAULT 45.00,
  ADD COLUMN IF NOT EXISTS monthly_covers integer DEFAULT 800;

COMMENT ON COLUMN public.locations.avg_customer_value
  IS 'Average revenue per customer visit. Used by Revenue Impact Calculator (Sprint 85).';
COMMENT ON COLUMN public.locations.monthly_covers
  IS 'Estimated monthly customer covers. Used by Revenue Impact Calculator (Sprint 85).';
