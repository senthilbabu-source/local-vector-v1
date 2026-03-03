# Sprint 115 — White-Label: Theming + Emails

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`,
> `golden-tenant.ts`, `database.types.ts`, `lib/plan-enforcer.ts`,
> `lib/whitelabel/types.ts`, `lib/whitelabel/get-org-context-from-headers.ts`,
> `middleware.ts`, `emails/OrgInvitation.tsx`

---

## 🎯 Objective

Build **White-Label Theming + Emails** — per-org brand configuration (logo, colors, fonts), CSS custom property injection at the edge, themed email templates, a custom login page, and the "powered by LocalVector" toggle.

**What this sprint answers:** "How do I make the product look like my brand, not LocalVector's?"

**What Sprint 115 delivers:**
- `org_themes` table — per-org brand configuration (logo URL, primary color, accent color, font family, "powered by" toggle)
- `GET /api/whitelabel/theme` — fetch current theme for org
- `POST /api/whitelabel/theme` — save/update theme (owner only, Agency plan)
- `DELETE /api/whitelabel/theme/logo` — remove uploaded logo
- Theme injection: CSS custom properties (`--brand-primary`, `--brand-accent`, etc.) injected into every page via root layout when OrgContext is present
- Logo upload: to Supabase Storage bucket `org-logos` (owner only)
- `POST /api/whitelabel/theme/logo` — upload logo (returns public URL)
- Themed email templates: `OrgInvitation.tsx` (Sprint 112) updated to use org logo + primary color
- All future email templates use `buildThemedEmailWrapper()` — a pure function that wraps content with org branding
- Custom login page: `/login/[slug]` — branded login for orgs accessed via subdomain/custom domain. Uses org theme automatically via OrgContext header.
- "Powered by LocalVector" toggle: when enabled (default for Agency), shows "Powered by LocalVector" in the dashboard footer. When disabled, footer is blank.
- `/dashboard/settings/theme` — visual theme editor with live preview

**What this sprint does NOT build:** custom font file hosting (use Google Fonts only), full CSS override (only custom properties — no arbitrary CSS injection, security risk), multi-org white-label reseller billing (future).

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read AI_RULES.md                                       — All rules (52 rules as of Sprint 114)
Read CLAUDE.md                                         — Full implementation inventory
Read lib/whitelabel/types.ts                           — OrgContext, DomainConfig (Sprint 114)
Read lib/whitelabel/get-org-context-from-headers.ts    — Header reader (Sprint 114)
Read middleware.ts                                     — Current state after Sprint 114 edit
Read supabase/prod_schema.sql
  § FIND: organizations — all columns including slug (Sprint 114)
  § FIND: org_domains — Sprint 114 table
  § FIND: Supabase Storage configuration, if any
  § FIND: existing RLS policy pattern on org-scoped tables
Read lib/email.ts                                      — Existing email send pattern
Read emails/OrgInvitation.tsx                          — Sprint 112 template to update
Read emails/                                           — All existing email templates
Read app/layout.tsx                                    — Root layout (add theme injection here)
Read app/dashboard/settings/                           — Existing settings structure
Read lib/supabase/database.types.ts                   — All current types
Read src/__fixtures__/golden-tenant.ts                 — All existing fixtures
Read supabase/seed.sql                                 — Seed pattern
```

**Specifically understand before writing code:**

1. **How `app/layout.tsx` currently works.** Theme injection adds CSS custom properties to the `<html>` element via inline `style` prop. Read the root layout carefully before modifying it. The theme is server-side rendered — no flash of unstyled content.

2. **Supabase Storage for logo upload.** Logos are uploaded to a bucket named `org-logos`. Check whether this bucket already exists in `prod_schema.sql` or any migration. If not, create it in the migration. RLS on the bucket: any authenticated user can read (logos are public-facing), only the org owner can upload/delete their org's logo. Logo path pattern: `org-logos/{org_id}/logo.{ext}`.

3. **Google Fonts only for custom fonts.** Fetching arbitrary font URLs is a security and performance risk. Provide a curated list of 8-10 Google Fonts that agencies are likely to want. Sprint 115 loads the selected font via a `<link>` tag in the root layout. No custom font file upload.

4. **CSS custom properties — not arbitrary CSS.** The theme injects a specific set of CSS variables only: `--brand-primary`, `--brand-accent`, `--brand-text-on-primary`, `--brand-font-family`. Components use these variables. There is NO mechanism to inject arbitrary CSS strings — that is an XSS vector. Sanitize all color inputs to valid hex format.

5. **Email theming is a pure wrapper function.** `buildThemedEmailWrapper(content, theme)` is a pure function that wraps any email body with the org's logo and primary color header. It does not call any API. It produces an HTML string. All email templates call this wrapper.

6. **The OrgContext from Sprint 114 drives everything.** When a request comes in via subdomain or custom domain, middleware has already set `x-org-id` and `x-org-plan` headers. The root layout reads these via `getOrgContextFromHeaders()` to decide whether to apply theming.

---

## 🏗️ Architecture — What to Build

### Directory Structure

```
lib/whitelabel/
  theme-service.ts              — DB operations for theme config (pure, caller passes client)
  theme-utils.ts                — Pure color/font utilities + CSS property builder
  email-theme-wrapper.ts        — Pure branded email wrapper (no side effects)
  (update index.ts to export new modules)

app/api/whitelabel/
  theme/
    route.ts                    — GET, POST theme config
    logo/
      route.ts                  — POST (upload), DELETE (remove) logo

app/login/
  [slug]/
    page.tsx                    — Branded login page for subdomain/custom domain access

app/dashboard/settings/
  theme/
    page.tsx                    — Visual theme editor (server component)
    _components/
      ThemeEditorForm.tsx        — Color + font pickers + logo upload
      ThemePreview.tsx           — Live preview panel
      LogoUploader.tsx           — Logo upload with drag-and-drop
      PoweredByToggle.tsx        — "Powered by LocalVector" toggle

app/
  layout.tsx                    — MODIFY: inject CSS custom properties from theme
  dashboard/
    _components/
      DashboardFooter.tsx        — MODIFY or CREATE: show/hide "Powered by LocalVector"
```

---

### Component 1: Types — add to `lib/whitelabel/types.ts`

```typescript
// Append to existing types.ts from Sprint 114

export type FontFamily =
  | 'Inter'           // default — already loaded by the app
  | 'Roboto'
  | 'Open Sans'
  | 'Lato'
  | 'Poppins'
  | 'Montserrat'
  | 'Raleway'
  | 'Nunito'
  | 'DM Sans'
  | 'Plus Jakarta Sans';

export const GOOGLE_FONT_FAMILIES: FontFamily[] = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Poppins',
  'Montserrat', 'Raleway', 'Nunito', 'DM Sans', 'Plus Jakarta Sans',
];

// Google Fonts URL builder
// Returns null for 'Inter' (already loaded)
export function buildGoogleFontUrl(font: FontFamily): string | null {
  if (font === 'Inter') return null;
  const encoded = encodeURIComponent(font);
  return `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;500;600;700&display=swap`;
}

export interface OrgTheme {
  id: string;
  org_id: string;
  // Colors stored as validated hex strings: '#1a2b3c'
  primary_color: string;         // default: '#6366f1' (indigo)
  accent_color: string;          // default: '#8b5cf6' (violet)
  // Computed from primary_color for text contrast
  text_on_primary: string;       // '#ffffff' or '#000000' (auto-computed)
  font_family: FontFamily;       // default: 'Inter'
  logo_url: string | null;       // Supabase Storage public URL
  logo_storage_path: string | null;  // e.g. 'org-logos/{org_id}/logo.png'
  show_powered_by: boolean;      // default: true
  created_at: string;
  updated_at: string;
}

export interface OrgThemeSave {
  primary_color?: string;
  accent_color?: string;
  font_family?: FontFamily;
  show_powered_by?: boolean;
  // logo is saved via separate logo upload endpoint
}

// CSS custom properties generated from OrgTheme
export interface ThemeCssProps {
  '--brand-primary': string;
  '--brand-accent': string;
  '--brand-text-on-primary': string;
  '--brand-font-family': string;
}

// Default theme values (LocalVector brand)
export const DEFAULT_THEME: Omit<OrgTheme, 'id' | 'org_id' | 'logo_url' |
  'logo_storage_path' | 'created_at' | 'updated_at'> = {
  primary_color: '#6366f1',
  accent_color: '#8b5cf6',
  text_on_primary: '#ffffff',
  font_family: 'Inter',
  show_powered_by: true,
};
```

---

### Component 2: Migration — `supabase/migrations/[timestamp]_org_themes.sql`

```sql
-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 115: White-Label Theming + Emails
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. org_themes table
CREATE TABLE IF NOT EXISTS public.org_themes (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid          NOT NULL UNIQUE
                                      REFERENCES public.organizations(id) ON DELETE CASCADE,
  primary_color         text          NOT NULL DEFAULT '#6366f1'
                                      CHECK (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  accent_color          text          NOT NULL DEFAULT '#8b5cf6'
                                      CHECK (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  text_on_primary       text          NOT NULL DEFAULT '#ffffff'
                                      CHECK (text_on_primary IN ('#ffffff', '#000000')),
  font_family           text          NOT NULL DEFAULT 'Inter',
  logo_url              text,
  logo_storage_path     text,
  show_powered_by       boolean       NOT NULL DEFAULT true,
  created_at            timestamptz   NOT NULL DEFAULT NOW(),
  updated_at            timestamptz   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.org_themes IS
  'Per-org brand theme config for white-label. Sprint 115. '
  'One row per org (UNIQUE org_id). Colors validated as hex. '
  'text_on_primary is auto-computed and stored for email use. '
  'logo_url is the Supabase Storage public URL.';

-- 2. RLS
ALTER TABLE public.org_themes ENABLE ROW LEVEL SECURITY;

-- All org members can read the theme (needed for dashboard rendering)
CREATE POLICY "org_themes: members can read"
  ON public.org_themes FOR SELECT
  USING (org_id = public.current_user_org_id());

-- Owner only can insert/update
CREATE POLICY "org_themes: owner can insert"
  ON public.org_themes FOR INSERT
  WITH CHECK (
    org_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id  = public.current_user_org_id()
        AND om.user_id = auth.uid()
        AND om.role    = 'owner'
    )
  );

CREATE POLICY "org_themes: owner can update"
  ON public.org_themes FOR UPDATE
  USING (
    org_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id  = public.current_user_org_id()
        AND om.user_id = auth.uid()
        AND om.role    = 'owner'
    )
  );

-- Service role full access (root layout fetches theme via service role for perf)
CREATE POLICY "org_themes: service role full access"
  ON public.org_themes
  USING (auth.role() = 'service_role');

-- 3. Supabase Storage bucket for org logos
-- Note: Supabase Storage bucket creation via SQL may not be supported in all versions.
-- If bucket creation via SQL is not available, add a comment and handle in the
-- post-deployment checklist (create bucket 'org-logos' in Supabase dashboard with
-- public read access and 2MB file size limit).
-- Try the SQL approach first:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-logos',
  'org-logos',
  true,          -- public read (logos are shown on login pages)
  2097152,       -- 2MB max
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: public read, org owner write
CREATE POLICY "org-logos: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'org-logos');

CREATE POLICY "org-logos: owner upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'org-logos'
    AND auth.role() = 'authenticated'
    -- Path must start with the org_id of the authenticated user's org
    AND (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

CREATE POLICY "org-logos: owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'org-logos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = public.current_user_org_id()::text
  );
```

---

### Component 3: Theme Service — `lib/whitelabel/theme-service.ts`

```typescript
/**
 * Pure theme service. Caller passes Supabase client.
 *
 * ── getOrgTheme(supabase, orgId) ──────────────────────────────────────────────
 * SELECT * FROM org_themes WHERE org_id = $orgId LIMIT 1
 * Returns OrgTheme | null.
 * null means the org has never saved a theme — use DEFAULT_THEME.
 *
 * ── getOrgThemeOrDefault(supabase, orgId) ─────────────────────────────────────
 * Calls getOrgTheme(). If null, returns DEFAULT_THEME values as an OrgTheme
 * with id='default', org_id=$orgId, logo_url=null, logo_storage_path=null.
 * Never returns null — always returns a usable theme.
 * Used by root layout for theme injection.
 *
 * ── upsertOrgTheme(supabase, orgId, changes) ─────────────────────────────────
 * Validates all color inputs before saving.
 * For each color field in changes:
 *   validateHexColor(color) — throws 'invalid_color' if not #xxxxxx format
 * For font_family: must be in GOOGLE_FONT_FAMILIES — throws 'invalid_font'
 * If primary_color provided: compute text_on_primary via computeTextOnPrimary()
 * UPSERT into org_themes:
 *   ON CONFLICT (org_id) DO UPDATE SET
 *     [changed fields only], updated_at = NOW()
 * Returns updated OrgTheme.
 *
 * ── updateLogoUrl(supabase, orgId, logoUrl, storagePath) ──────────────────────
 * UPDATE org_themes SET logo_url = $logoUrl,
 *   logo_storage_path = $storagePath, updated_at = NOW()
 * WHERE org_id = $orgId
 * If no theme row exists yet: upsert with just logo fields + defaults.
 * Returns updated OrgTheme.
 *
 * ── removeLogo(supabase, orgId) ───────────────────────────────────────────────
 * 1. Fetch current logo_storage_path
 * 2. If path exists: delete from Supabase Storage
 * 3. UPDATE org_themes SET logo_url = NULL, logo_storage_path = NULL
 * Returns { success: true }
 */
```

---

### Component 4: Theme Utilities — `lib/whitelabel/theme-utils.ts`

```typescript
/**
 * Pure utility functions. Zero API calls. Zero DB calls.
 * All functions are fully testable with zero mocks.
 *
 * ── validateHexColor(color) ───────────────────────────────────────────────────
 * Returns true if color matches /^#[0-9a-fA-F]{6}$/
 * Returns false otherwise.
 * Does not throw — callers decide what to do with false.
 *
 * ── sanitizeHexColor(color) ───────────────────────────────────────────────────
 * Input: any string (potentially user input)
 * 1. Trim whitespace
 * 2. Add '#' prefix if missing
 * 3. Uppercase → lowercase
 * 4. If validateHexColor returns false → return null
 * Returns: valid lowercase hex string or null
 *
 * ── computeTextOnPrimary(hexColor) ────────────────────────────────────────────
 * Determines whether white or black text has better contrast on the given background.
 * Uses the WCAG relative luminance formula.
 *
 * Steps:
 * 1. Parse hex to RGB: r, g, b in 0-255
 * 2. Normalize: r/255, g/255, b/255
 * 3. Apply gamma correction:
 *    c_linear = c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ^ 2.4
 * 4. Relative luminance L = 0.2126*R + 0.7152*G + 0.0722*B
 * 5. Contrast ratio with white: (1.0 + 0.05) / (L + 0.05)
 * 6. Contrast ratio with black: (L + 0.05) / (0.0 + 0.05)
 * 7. Return '#ffffff' if white contrast ratio > black contrast ratio, else '#000000'
 *
 * ── buildThemeCssProps(theme) ─────────────────────────────────────────────────
 * Pure function. Input: OrgTheme. Output: ThemeCssProps.
 * Returns:
 * {
 *   '--brand-primary': theme.primary_color,
 *   '--brand-accent': theme.accent_color,
 *   '--brand-text-on-primary': theme.text_on_primary,
 *   '--brand-font-family': theme.font_family === 'Inter'
 *     ? 'Inter, system-ui, sans-serif'
 *     : `'${theme.font_family}', Inter, system-ui, sans-serif`,
 * }
 *
 * ── cssPropsToStyleString(props) ──────────────────────────────────────────────
 * Pure function. Converts ThemeCssProps to inline style string.
 * Output: "--brand-primary: #6366f1; --brand-accent: #8b5cf6; ..."
 * Used for injecting into <html style="..."> in the root layout.
 *
 * ── cssPropsToObject(props) ───────────────────────────────────────────────────
 * Pure function. Converts ThemeCssProps to a React CSSProperties object.
 * Used for the React-style `style` prop on <html>.
 * Output: { '--brand-primary': '#6366f1', ... } as React.CSSProperties
 *
 * ── lightenColor(hexColor, amount) ────────────────────────────────────────────
 * Pure function. Lightens a hex color by the given amount (0.0 to 1.0).
 * Used for generating hover states in ThemePreview.
 * Simple implementation: blend with white by `amount` factor.
 *
 * ── buildLogoStoragePath(orgId, filename) ─────────────────────────────────────
 * Pure function. Returns: '{orgId}/logo.{ext}'
 * where ext is extracted from filename (lowercase).
 * Supported: png, jpg, jpeg, webp, svg
 * Returns null if extension not supported.
 */
```

---

### Component 5: Email Theme Wrapper — `lib/whitelabel/email-theme-wrapper.ts`

```typescript
/**
 * Pure email theme wrapper. No side effects. No API calls.
 * Used by all email templates to apply org branding.
 *
 * ── buildThemedEmailWrapper(params) ───────────────────────────────────────────
 * params: {
 *   theme: OrgTheme | null;    // null = use LocalVector default theme
 *   orgName: string;
 *   subject: string;
 *   bodyHtml: string;          // The email body content (pre-rendered)
 *   previewText?: string;      // Email client preview text
 * }
 *
 * Returns: { subject: string; html: string; text: string }
 *
 * HTML structure:
 * - If theme.logo_url: img tag at top with max-width 150px
 * - Header background: theme.primary_color
 * - Header text color: theme.text_on_primary
 * - Body: white background, dark text
 * - Footer: if theme.show_powered_by → "Powered by LocalVector"
 *           else → just the org name
 *
 * Default (no theme / null):
 *   Uses LocalVector brand: primary=#6366f1, no logo, show powered by text.
 *
 * IMPORTANT: This is pure HTML string construction, NOT React Email components.
 * The output is used for non-React email contexts and for testing.
 * React Email components (like OrgInvitation.tsx) call this function and
 * embed the returned HTML, OR they import the theme values directly.
 *
 * ── buildThemedEmailSubject(subject, orgName, theme) ──────────────────────────
 * Pure function.
 * If theme.show_powered_by = false: return subject as-is
 * If theme.show_powered_by = true: return subject as-is (powered by is footer only)
 * Returns: string
 * (Subject line is never modified — branding is in the body only)
 */
```

---

### Component 6: Root Layout Update — `app/layout.tsx`

```typescript
/**
 * MODIFY app/layout.tsx to inject CSS custom properties.
 *
 * Add at the top of the root layout server component:
 *
 * 1. Read OrgContext from headers:
 *    const orgContext = getOrgContextFromHeaders();
 *
 * 2. If orgContext present:
 *    Fetch theme using service role client:
 *    const theme = await getOrgThemeOrDefault(serviceClient, orgContext.org_id)
 *
 * 3. Build CSS props:
 *    const cssProps = orgContext ? buildThemeCssProps(theme) : null
 *    const styleObj = cssProps ? cssPropsToObject(cssProps) : undefined
 *
 * 4. Inject into <html> element:
 *    <html lang="en" style={styleObj}>
 *
 * 5. If theme has a non-Inter font, inject Google Fonts link:
 *    const fontUrl = buildGoogleFontUrl(theme.font_family)
 *    In <head>:
 *    {fontUrl && <link rel="stylesheet" href={fontUrl} />}
 *
 * CRITICAL RULES for this modification:
 * - Only add what's described above. Do not restructure the layout.
 * - If orgContext is null (direct access, no subdomain), styleObj is undefined
 *   and <html> renders without inline style — LocalVector defaults apply.
 * - The service role client call adds ~10-20ms to root layout render.
 *   Accept this trade-off. A Redis cache for theme can be added post-launch.
 * - Do not add Suspense or loading states to the layout for theme fetching.
 *   Themes are small and fast to fetch.
 */
```

---

### Component 7: API Routes

#### `app/api/whitelabel/theme/route.ts`

```typescript
/**
 * GET /api/whitelabel/theme
 * Returns current OrgTheme for authenticated user's org.
 * All org members can view.
 * Returns DEFAULT_THEME values if no theme saved yet.
 * Plan: Agency only for custom themes.
 *   Non-Agency: returns { theme: DEFAULT_THEME, upgrade_required: true }
 *
 * POST /api/whitelabel/theme
 * Saves/updates theme config.
 * Body: OrgThemeSave (partial — only provided fields updated)
 * Owner only. Agency plan only.
 *
 * Validation:
 * 1. primary_color: valid hex via sanitizeHexColor() → 400 'invalid_color' if null
 * 2. accent_color: valid hex → same
 * 3. font_family: must be in GOOGLE_FONT_FAMILIES → 400 'invalid_font'
 *
 * On success: recomputes text_on_primary from primary_color.
 *
 * Response: { ok: true; theme: OrgTheme }
 *
 * Error codes:
 * - 400: invalid_color | invalid_font
 * - 401: not authenticated
 * - 403: not_owner | plan_upgrade_required
 */
```

#### `app/api/whitelabel/theme/logo/route.ts`

```typescript
/**
 * POST /api/whitelabel/theme/logo
 * Uploads org logo to Supabase Storage.
 * Owner only. Agency plan only.
 *
 * Expects multipart/form-data with field 'logo' (File).
 *
 * Validation:
 * 1. File present → 400 'no_file'
 * 2. MIME type: image/png | image/jpeg | image/webp | image/svg+xml → 400 'invalid_type'
 * 3. File size: ≤ 2MB → 400 'file_too_large'
 * 4. Extension: buildLogoStoragePath() returns non-null → 400 'invalid_extension'
 *
 * Upload flow:
 * 1. Build storage path: '{org_id}/logo.{ext}'
 * 2. Upload via supabase.storage.from('org-logos').upload(path, file, { upsert: true })
 * 3. Get public URL: supabase.storage.from('org-logos').getPublicUrl(path)
 * 4. Call updateLogoUrl(supabase, orgId, publicUrl, storagePath)
 * 5. Return { ok: true; logo_url: string }
 *
 * DELETE /api/whitelabel/theme/logo
 * Removes the org logo from Storage and clears DB fields.
 * Owner only. Agency plan only.
 *
 * Flow:
 * 1. Fetch current logo_storage_path
 * 2. supabase.storage.from('org-logos').remove([storagePath])
 * 3. UPDATE org_themes SET logo_url = NULL, logo_storage_path = NULL
 * 4. Return { ok: true }
 *
 * If no logo exists: return { ok: true } (idempotent).
 *
 * Error codes:
 * - 400: no_file | invalid_type | file_too_large | invalid_extension
 * - 401: not authenticated
 * - 403: not_owner | plan_upgrade_required
 * - 500: upload_failed (Supabase Storage error)
 */
```

---

### Component 8: Branded Login Page — `app/login/[slug]/page.tsx`

```typescript
/**
 * PUBLIC server component — no auth required.
 * Route: /login/{slug} where slug matches organizations.slug
 *
 * This is the branded entry point for agency clients accessing the product
 * via their subdomain or custom domain. The OrgContext from middleware
 * already sets the x-org-* headers if accessed via subdomain.
 *
 * Resolution:
 * 1. Try getOrgContextFromHeaders() — set by middleware if via subdomain
 * 2. If null: fetch org by slug from URL param
 *    SELECT o.id, o.name, o.plan_tier, o.slug
 *    FROM organizations o WHERE o.slug = $slug LIMIT 1
 *    If not found → redirect to /login (default login)
 * 3. Fetch theme: getOrgThemeOrDefault(serviceClient, orgId)
 *
 * Layout:
 * ┌─────────────────────────────────────────────────┐
 * │              [Org Logo if set]                  │
 * │           Org Name                              │
 * │  ─────────────────────────────────────────────  │
 * │           Sign in to your account               │
 * │  [ Email                                    ]   │
 * │  [ Password                                 ]   │
 * │              [Sign In]  (brand primary color)   │
 * │  ─────────────────────────────────────────────  │
 * │  Powered by LocalVector  (if show_powered_by)   │
 * └─────────────────────────────────────────────────┘
 *
 * The [Sign In] button uses var(--brand-primary) via CSS custom property.
 * This works because the root layout injects the theme into <html>.
 *
 * After successful sign-in: redirect to /dashboard
 *
 * If the user is already authenticated: redirect to /dashboard
 *
 * DO NOT show: registration, "forgot password" link, social auth buttons.
 * This is an invite-only product — users join via invitation (Sprint 112).
 * Only show email + password sign in.
 *
 * data-testid:
 *   "branded-login-page"
 *   "org-logo"           (if logo_url present)
 *   "org-name-heading"
 *   "email-input"
 *   "password-input"
 *   "sign-in-btn"
 *   "powered-by-footer"  (if show_powered_by)
 */
```

---

### Component 9: Theme Editor — `app/dashboard/settings/theme/page.tsx`

```typescript
/**
 * Server Component. Fetches current theme server-side.
 * Route: /dashboard/settings/theme
 *
 * Plan gate:
 * - Non-Agency: show upgrade prompt
 *   "Brand theming is available on the Agency plan."
 * - Agency: show full theme editor
 *
 * Layout:
 * ┌──────────────────────────────────────────────────────────────┐
 * │  Brand Theme                                                 │
 * ├─────────────────────────┬────────────────────────────────────┤
 * │  Editor                 │  Preview                           │
 * │                         │                                    │
 * │  Logo: [Upload] [Remove]│  ┌──────────────────────────────┐ │
 * │                         │  │ [Logo]  Org Name             │ │
 * │  Primary Color: #6366f1 │  │ ─────────────────────────── │ │
 * │  [Color swatch input]   │  │  Dashboard content preview   │ │
 * │                         │  │  with brand colors applied   │ │
 * │  Accent Color: #8b5cf6  │  └──────────────────────────────┘ │
 * │  [Color swatch input]   │                                    │
 * │                         │  Login Page Preview                │
 * │  Font: [Dropdown]       │  ┌──────────────────────────────┐ │
 * │                         │  │ [Logo]  Sign In              │ │
 * │  [x] Show "Powered by   │  │ [Email] [Password] [Sign In] │ │
 * │      LocalVector"       │  └──────────────────────────────┘ │
 * │                         │                                    │
 * │  [Save Theme]           │                                    │
 * └─────────────────────────┴────────────────────────────────────┘
 *
 * Add to dashboard settings sidebar:
 *   Route: /dashboard/settings/theme
 *   Label: "Brand Theme"
 *   Agency plan badge for non-Agency users
 *
 * data-testid:
 *   "theme-settings-page"
 *   "primary-color-input"
 *   "accent-color-input"
 *   "font-family-select"
 *   "powered-by-toggle"
 *   "save-theme-btn"
 *   "theme-preview-panel"
 *   "login-preview-panel"
 *   "upgrade-prompt"
 */
```

---

### Component 10: ThemeEditorForm — `app/dashboard/settings/theme/_components/ThemeEditorForm.tsx`

```typescript
/**
 * 'use client'
 * Handles all theme editing interactions.
 *
 * State: current theme values, dirty state (changed but not saved), loading
 *
 * Color input: <input type="color"> + <input type="text"> side by side.
 * The color picker and hex text input stay in sync.
 * On hex text change: sanitizeHexColor() — only update state if valid hex returned.
 * On color picker change: always valid hex, update state directly.
 *
 * Font dropdown: <select> with all GOOGLE_FONT_FAMILIES as options.
 * On change: update local state + update the ThemePreview panel in real-time.
 *
 * Save flow:
 *   POST /api/whitelabel/theme with changed fields
 *   On success: show "Theme saved ✅" toast for 3 seconds
 *   On error: show inline error message
 *
 * Real-time preview:
 *   ThemePreview receives current (unsaved) color/font state as props.
 *   It renders a mock dashboard card with the brand colors applied.
 *   Use inline styles (not CSS custom properties) for the preview so it
 *   doesn't affect the actual dashboard chrome while editing.
 *
 * Powered by toggle:
 *   <input type="checkbox"> labeled "Show 'Powered by LocalVector' in footer"
 *   Saves immediately on toggle change (no need to click Save).
 *   POST /api/whitelabel/theme with { show_powered_by: newValue }
 *
 * data-testid: matches parent page spec
 */
```

---

### Component 11: LogoUploader — `app/dashboard/settings/theme/_components/LogoUploader.tsx`

```typescript
/**
 * 'use client'
 * Logo upload with preview.
 *
 * States:
 *   no_logo: Shows upload area with instructions
 *   has_logo: Shows current logo preview + [Remove] button
 *   uploading: Shows progress indicator
 *
 * Upload trigger: <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml">
 * Client-side validation before upload:
 *   - Size ≤ 2MB → show error if exceeded
 *   - MIME type check → show error if invalid
 *
 * Upload: POST /api/whitelabel/theme/logo (multipart/form-data)
 * On success: show new logo preview immediately (optimistic update)
 * On error: show error message, restore previous state
 *
 * Remove: DELETE /api/whitelabel/theme/logo
 * Confirm with window.confirm() before remove.
 * On success: clear logo preview
 *
 * Max display size for logo preview: 150px wide, 60px tall, object-fit: contain
 *
 * data-testid:
 *   "logo-upload-area"
 *   "logo-preview"
 *   "logo-upload-input"
 *   "remove-logo-btn"
 */
```

---

### Component 12: ThemePreview — `app/dashboard/settings/theme/_components/ThemePreview.tsx`

```typescript
/**
 * Pure display component. No state. No API calls.
 * Props: { theme: OrgThemeSave & { logo_url: string | null; org_name: string } }
 *
 * Renders two small preview cards:
 *
 * 1. Dashboard preview:
 *    - Header bar in primary_color with text in text_on_primary color
 *    - "Reality Score: 87" mock metric in brand colors
 *    - Font applied via inline style fontFamily
 *    - Logo (if present) in header
 *
 * 2. Login preview:
 *    - Logo (if present) centered
 *    - Org name as heading
 *    - Mock email + password fields
 *    - Sign In button in primary_color with text in text_on_primary
 *    - "Powered by LocalVector" footer if show_powered_by
 *
 * Uses inline styles (NOT CSS custom properties) so the preview reflects
 * the unsaved state without affecting the live dashboard chrome.
 *
 * data-testid:
 *   "theme-preview-panel"
 *   "login-preview-panel"
 */
```

---

### Component 13: OrgInvitation Email Update — `emails/OrgInvitation.tsx`

```typescript
/**
 * MODIFY Sprint 112's OrgInvitation.tsx to use org theme.
 *
 * Add new prop: theme?: OrgTheme | null
 * Default: null (uses LocalVector defaults)
 *
 * Changes:
 * 1. If theme.logo_url: show <Img> at top with src=theme.logo_url, max-width=150px
 * 2. Header section background: theme?.primary_color ?? '#6366f1'
 * 3. Header text color: theme?.text_on_primary ?? '#ffffff'
 * 4. CTA button background: theme?.primary_color ?? '#6366f1'
 * 5. CTA button text: theme?.text_on_primary ?? '#ffffff'
 * 6. Footer: if theme?.show_powered_by !== false → show "Powered by LocalVector"
 *
 * The invitation-service.ts (Sprint 112) sendInvitation() must be updated to:
 * 1. Fetch org theme: getOrgThemeOrDefault(supabase, orgId)
 * 2. Pass theme to the email template
 *
 * IMPORTANT: Do not change the subject line, body copy, or accept URL logic.
 * Only visual styling changes.
 */
```

---

### Component 14: Dashboard Footer — `app/dashboard/_components/DashboardFooter.tsx`

```typescript
/**
 * Create or modify the dashboard footer to respect show_powered_by.
 *
 * If a DashboardFooter component exists: modify it.
 * If not: create it and add it to the dashboard layout.
 *
 * The footer is a server component.
 * It reads OrgContext from headers.
 * If OrgContext present: fetch theme and check show_powered_by.
 * If no OrgContext (direct access): always show "Powered by LocalVector".
 *
 * Rendering:
 * - show_powered_by = true: "Powered by LocalVector" with link to localvector.ai
 * - show_powered_by = false: empty footer (renders but is invisible)
 *
 * data-testid:
 *   "dashboard-footer"
 *   "powered-by-link"  (only when showing)
 */
```

---

### Component 15: Seed Data

```sql
-- In supabase/seed.sql — add theme for golden tenant

DO $$
DECLARE
  v_org_id uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
BEGIN
  INSERT INTO public.org_themes (
    org_id,
    primary_color,
    accent_color,
    text_on_primary,
    font_family,
    logo_url,
    logo_storage_path,
    show_powered_by
  ) VALUES (
    v_org_id,
    '#1a1a2e',          -- deep navy — matches Charcoal N Chill aesthetic
    '#e94560',          -- red accent
    '#ffffff',          -- white text on dark primary
    'Poppins',
    NULL,               -- no logo in seed (test logo upload separately)
    NULL,
    true
  )
  ON CONFLICT (org_id) DO NOTHING;
END $$;
```

---

### Component 16: Golden Tenant Fixtures

```typescript
// Sprint 115 — theme fixtures
import type { OrgTheme, ThemeCssProps } from '@/lib/whitelabel/types';

export const MOCK_ORG_THEME: OrgTheme = {
  id: 'theme-golden-001',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  primary_color: '#1a1a2e',
  accent_color: '#e94560',
  text_on_primary: '#ffffff',
  font_family: 'Poppins',
  logo_url: null,
  logo_storage_path: null,
  show_powered_by: true,
  created_at: '2026-03-01T00:00:00.000Z',
  updated_at: '2026-03-01T00:00:00.000Z',
};

export const MOCK_ORG_THEME_WITH_LOGO: OrgTheme = {
  ...MOCK_ORG_THEME,
  logo_url: 'https://supabase.example.com/storage/v1/object/public/org-logos/a0eebc99/logo.png',
  logo_storage_path: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/logo.png',
};

export const MOCK_THEME_CSS_PROPS: ThemeCssProps = {
  '--brand-primary': '#1a1a2e',
  '--brand-accent': '#e94560',
  '--brand-text-on-primary': '#ffffff',
  '--brand-font-family': "'Poppins', Inter, system-ui, sans-serif",
};

export const MOCK_ORG_THEME_DEFAULT: OrgTheme = {
  id: 'default',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  primary_color: '#6366f1',
  accent_color: '#8b5cf6',
  text_on_primary: '#ffffff',
  font_family: 'Inter',
  logo_url: null,
  logo_storage_path: null,
  show_powered_by: true,
  created_at: '2026-03-01T00:00:00.000Z',
  updated_at: '2026-03-01T00:00:00.000Z',
};
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/theme-utils.test.ts`

**Pure functions — zero mocks.**

```
describe('validateHexColor — pure')
  1.  '#6366f1' → true
  2.  '#FFFFFF' → true (uppercase)
  3.  '#fff' → false (3-char shorthand not accepted)
  4.  '6366f1' → false (missing #)
  5.  '#6366f1ff' → false (8-char with alpha not accepted)
  6.  '' → false
  7.  '#xyz123' → false (invalid hex chars)

describe('sanitizeHexColor — pure')
  8.  '  #6366F1  ' → '#6366f1' (trim + lowercase)
  9.  '6366f1' → '#6366f1' (adds prefix)
  10. 'notacolor' → null
  11. '#fff' → null (shorthand rejected)

describe('computeTextOnPrimary — pure')
  12. '#ffffff' (white) → '#000000' (black text for contrast)
  13. '#000000' (black) → '#ffffff' (white text for contrast)
  14. '#6366f1' (indigo) → '#ffffff' (white text — dark enough)
  15. '#fbbf24' (amber/yellow) → '#000000' (black text — light color)
  16. '#1a1a2e' (deep navy) → '#ffffff'

describe('buildThemeCssProps — pure')
  17. returns all 4 CSS custom property keys
  18. Inter font → uses system font stack without quotes
  19. Poppins font → wraps in quotes: "'Poppins', Inter, system-ui, sans-serif"
  20. primary_color matches theme.primary_color

describe('cssPropsToStyleString — pure')
  21. contains all 4 properties in output
  22. properties separated by '; '
  23. no trailing semicolon inconsistency (deterministic output)

describe('buildLogoStoragePath — pure')
  24. 'logo.png' → '{orgId}/logo.png'
  25. 'MyLogo.PNG' → '{orgId}/logo.png' (lowercases extension)
  26. 'logo.gif' → null (unsupported format)
  27. 'no-extension' → null
```

**27 tests.**

---

### Test File 2: `src/__tests__/unit/email-theme-wrapper.test.ts`

**Pure functions — zero mocks.**

```
describe('buildThemedEmailWrapper — pure')
  1.  null theme → uses DEFAULT_THEME colors
  2.  custom primary_color used in header background
  3.  text_on_primary used for header text color
  4.  logo_url present → <img> tag in output HTML
  5.  logo_url null → no <img> tag
  6.  show_powered_by = true → "Powered by LocalVector" in HTML
  7.  show_powered_by = false → "Powered by LocalVector" NOT in HTML
  8.  bodyHtml content appears in output
  9.  subject returned unchanged
  10. text version does not contain HTML tags
  11. previewText appears near top of HTML (email preview text pattern)
```

**11 tests.**

---

### Test File 3: `src/__tests__/unit/theme-service.test.ts`

**Supabase mocked.**

```
describe('getOrgTheme — Supabase mocked')
  1.  returns OrgTheme when row exists
  2.  returns null when no theme row

describe('getOrgThemeOrDefault — Supabase mocked')
  3.  returns theme from DB when exists
  4.  returns DEFAULT_THEME values when no DB row (never null)
  5.  returned default has org_id set correctly

describe('upsertOrgTheme — Supabase mocked')
  6.  throws 'invalid_color' when primary_color fails validateHexColor
  7.  throws 'invalid_color' when accent_color fails validateHexColor
  8.  throws 'invalid_font' when font_family not in GOOGLE_FONT_FAMILIES
  9.  computes text_on_primary from primary_color automatically
  10. UPSERTs — calls correct Supabase method on conflict
  11. returns updated OrgTheme

describe('updateLogoUrl — Supabase mocked')
  12. updates logo_url and logo_storage_path
  13. upserts if no theme row exists yet

describe('removeLogo — Supabase mocked')
  14. calls storage.remove() with correct path
  15. sets logo_url and logo_storage_path to null
  16. returns { success: true } when no logo (idempotent)
```

**16 tests.**

---

### Test File 4: `src/__tests__/unit/theme-routes.test.ts`

```
describe('GET /api/whitelabel/theme')
  1.  returns 401 when not authenticated
  2.  returns { theme: DEFAULT_THEME, upgrade_required: true } for non-Agency
  3.  returns OrgTheme for Agency plan member

describe('POST /api/whitelabel/theme')
  4.  returns 401 when not authenticated
  5.  returns 403 'plan_upgrade_required' for non-Agency
  6.  returns 403 'not_owner' for admin/analyst/viewer
  7.  returns 400 'invalid_color' for malformed primary_color
  8.  returns 400 'invalid_color' for malformed accent_color
  9.  returns 400 'invalid_font' for unknown font family
  10. text_on_primary auto-computed and NOT accepted from client
  11. returns { ok: true, theme: OrgTheme } on success

describe('POST /api/whitelabel/theme/logo')
  12. returns 401 when not authenticated
  13. returns 403 for non-owner
  14. returns 400 'no_file' when no file in request
  15. returns 400 'invalid_type' for image/gif
  16. returns 400 'file_too_large' for file > 2MB
  17. calls storage.upload() with correct bucket and path
  18. returns { ok: true, logo_url } on success

describe('DELETE /api/whitelabel/theme/logo')
  19. returns 401 when not authenticated
  20. returns 403 for non-owner
  21. calls storage.remove() with correct path
  22. returns { ok: true } when no logo exists (idempotent)
```

**22 tests.**

---

### Test File 5: `src/__tests__/e2e/theme-settings.spec.ts` — Playwright

```typescript
describe('Theme Settings', () => {

  test('Agency plan: shows full theme editor', async ({ page }) => {
    // Mock GET /api/whitelabel/theme → MOCK_ORG_THEME
    // Navigate to /dashboard/settings/theme
    // Assert: data-testid="theme-settings-page" visible
    // Assert: primary-color-input shows '#1a1a2e'
    // Assert: font-family-select shows 'Poppins'
    // Assert: theme-preview-panel visible
  });

  test('Non-Agency plan: shows upgrade prompt', async ({ page }) => {
    // Mock plan = 'growth'
    // Navigate to /dashboard/settings/theme
    // Assert: upgrade-prompt visible
    // Assert: theme-settings-page NOT visible
  });

  test('Color picker updates preview in real-time', async ({ page }) => {
    // Change primary-color-input to '#ff0000'
    // Assert: theme-preview-panel header background changes to red (inline style)
    // Assert: save-theme-btn enabled (dirty state)
  });

  test('Save theme shows success toast', async ({ page }) => {
    // Mock POST /api/whitelabel/theme → { ok: true, theme: MOCK_ORG_THEME }
    // Click save-theme-btn
    // Assert: "Theme saved ✅" visible
  });

  test('Powered by toggle saves immediately', async ({ page }) => {
    // Mock POST /api/whitelabel/theme → { ok: true }
    // Click powered-by-toggle
    // Assert: API called with { show_powered_by: false }
    // (No save button click needed)
  });

  test('Logo upload shows preview after success', async ({ page }) => {
    // Mock POST /api/whitelabel/theme/logo → { ok: true, logo_url: 'https://...' }
    // Attach file to logo-upload-input
    // Assert: logo-preview visible with new URL
  });

  test('Branded login page shows org branding', async ({ page }) => {
    // Mock org lookup for slug 'charcoal-n-chill'
    // Mock theme → MOCK_ORG_THEME
    // Navigate to /login/charcoal-n-chill
    // Assert: data-testid="branded-login-page" visible
    // Assert: org-name-heading shows 'Charcoal N Chill'
    // Assert: powered-by-footer visible (show_powered_by = true)
    // Assert: email-input and password-input visible
    // Assert: NO registration form visible
  });

  test('Dashboard footer shows powered by when enabled', async ({ page }) => {
    // Mock theme show_powered_by = true
    // Navigate to /dashboard
    // Assert: powered-by-link visible
  });

  test('Dashboard footer hidden when powered by disabled', async ({ page }) => {
    // Mock theme show_powered_by = false
    // Navigate to /dashboard
    // Assert: powered-by-link NOT visible
  });
});
```

**9 Playwright tests.**

---

### Run Commands

```bash
npx vitest run src/__tests__/unit/theme-utils.test.ts          # 27 tests
npx vitest run src/__tests__/unit/email-theme-wrapper.test.ts  # 11 tests
npx vitest run src/__tests__/unit/theme-service.test.ts        # 16 tests
npx vitest run src/__tests__/unit/theme-routes.test.ts         # 22 tests
npx vitest run                                                   # ALL — zero regressions
npx playwright test src/__tests__/e2e/theme-settings.spec.ts   # 9 Playwright tests
npx tsc --noEmit                                                 # 0 type errors
```

**Total: 76 Vitest + 9 Playwright = 85 tests**

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/whitelabel/types.ts` | **MODIFY** | Add FontFamily, OrgTheme, OrgThemeSave, ThemeCssProps, DEFAULT_THEME |
| 2 | `lib/whitelabel/theme-service.ts` | **CREATE** | DB operations for theme |
| 3 | `lib/whitelabel/theme-utils.ts` | **CREATE** | Pure color/font/CSS utilities |
| 4 | `lib/whitelabel/email-theme-wrapper.ts` | **CREATE** | Pure branded email wrapper |
| 5 | `lib/whitelabel/index.ts` | **MODIFY** | Export new modules |
| 6 | `app/api/whitelabel/theme/route.ts` | **CREATE** | GET + POST theme |
| 7 | `app/api/whitelabel/theme/logo/route.ts` | **CREATE** | POST + DELETE logo |
| 8 | `app/layout.tsx` | **MODIFY** | Inject CSS custom properties from theme |
| 9 | `app/login/[slug]/page.tsx` | **CREATE** | Branded login page |
| 10 | `app/dashboard/settings/theme/page.tsx` | **CREATE** | Theme editor page |
| 11 | `app/dashboard/settings/theme/_components/ThemeEditorForm.tsx` | **CREATE** | Editor form |
| 12 | `app/dashboard/settings/theme/_components/ThemePreview.tsx` | **CREATE** | Live preview |
| 13 | `app/dashboard/settings/theme/_components/LogoUploader.tsx` | **CREATE** | Logo upload |
| 14 | `app/dashboard/settings/theme/_components/PoweredByToggle.tsx` | **CREATE** | Toggle |
| 15 | `app/dashboard/_components/DashboardFooter.tsx` | **CREATE/MODIFY** | Powered by footer |
| 16 | `emails/OrgInvitation.tsx` | **MODIFY** | Add theme props + apply branding |
| 17 | `lib/invitations/invitation-service.ts` | **MODIFY** | Fetch + pass theme to email |
| 18 | `supabase/migrations/[timestamp]_org_themes.sql` | **CREATE** | Full migration + storage bucket |
| 19 | `supabase/prod_schema.sql` | **MODIFY** | Append org_themes |
| 20 | `lib/supabase/database.types.ts` | **MODIFY** | Add org_themes types |
| 21 | `supabase/seed.sql` | **MODIFY** | Theme for golden tenant |
| 22 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | 4 theme fixtures |
| 23 | `src/__tests__/unit/theme-utils.test.ts` | **CREATE** | 27 tests |
| 24 | `src/__tests__/unit/email-theme-wrapper.test.ts` | **CREATE** | 11 tests |
| 25 | `src/__tests__/unit/theme-service.test.ts` | **CREATE** | 16 tests |
| 26 | `src/__tests__/unit/theme-routes.test.ts` | **CREATE** | 22 tests |
| 27 | `src/__tests__/e2e/theme-settings.spec.ts` | **CREATE** | 9 Playwright tests |

**Total: 27 files**

---

## 🚫 What NOT to Do

1. **DO NOT accept arbitrary CSS from user input** — only accept validated hex colors and whitelisted font families. The theme system uses a fixed set of CSS custom properties. There is no "custom CSS" field. This is an XSS prevention requirement.

2. **DO NOT store `text_on_primary` from the client request body** — always compute it server-side via `computeTextOnPrimary(primary_color)`. Clients cannot override the text contrast calculation.

3. **DO NOT allow custom font file uploads** — Google Fonts only. The curated list of 10 font families is sufficient. Font file hosting introduces storage, licensing, and performance complexity. Use `GOOGLE_FONT_FAMILIES` array as the exclusive allowlist.

4. **DO NOT apply theme in the root layout for direct access** — only apply theme when `getOrgContextFromHeaders()` returns a non-null OrgContext. Direct access at `app.localvector.ai` always shows LocalVector branding (no custom theme injection).

5. **DO NOT call `getOrgThemeOrDefault()` on every server component** — only call it in the root layout once per request. Child server components read the CSS custom properties via CSS inheritance (the properties cascade down from `<html>`). Do not create a per-component theme fetch.

6. **DO NOT modify `OrgInvitation.tsx` subject line** — only visual changes. The copy, CTA URL, and text content stay identical to Sprint 112.

7. **DO NOT hard-block login at `/login/[slug]`** — if the slug doesn't match any org, redirect to `/login` (default). Do not show a 404 — slugs may be valid but change.

8. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12). ThemePreview uses inline styles for preview rendering — this is intentional and correct.

9. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).

10. **DO NOT use `page.waitForTimeout()` in Playwright** — event-driven waits only.

11. **DO NOT edit `middleware.ts`** (AI_RULES §6). Sprint 114 already made the authorized edit. Sprint 115 adds NO middleware changes.

---

## ✅ Definition of Done

- [ ] `lib/whitelabel/types.ts` MODIFIED — FontFamily (10 values), GOOGLE_FONT_FAMILIES, buildGoogleFontUrl(), OrgTheme, OrgThemeSave, ThemeCssProps, DEFAULT_THEME
- [ ] `theme-service.ts` — getOrgTheme(), getOrgThemeOrDefault() (never null), upsertOrgTheme() (validates colors + font, computes text_on_primary), updateLogoUrl(), removeLogo()
- [ ] `theme-utils.ts` — validateHexColor(), sanitizeHexColor(), computeTextOnPrimary() (WCAG formula), buildThemeCssProps(), cssPropsToObject(), lightenColor(), buildLogoStoragePath()
- [ ] `email-theme-wrapper.ts` — buildThemedEmailWrapper() (pure, logo + colors + powered-by), never throws
- [ ] `app/layout.tsx` MODIFIED — OrgContext read, theme fetched, CSS props injected into `<html>`, Google Fonts `<link>` conditionally added
- [ ] `GET /api/whitelabel/theme` — all members, DEFAULT_THEME + upgrade_required for non-Agency
- [ ] `POST /api/whitelabel/theme` — owner + Agency, validates colors + font, computes text_on_primary server-side
- [ ] `POST /api/whitelabel/theme/logo` — owner + Agency, 4 validations, uploads to `org-logos/{org_id}/logo.{ext}`
- [ ] `DELETE /api/whitelabel/theme/logo` — owner + Agency, removes from storage + clears DB, idempotent
- [ ] `/login/[slug]` — resolves org by slug, applies theme via OrgContext, shows email+password only, no registration
- [ ] `/dashboard/settings/theme` — plan gate, two-column editor + preview layout, all data-testid
- [ ] `ThemeEditorForm` — color picker + hex text input synced, font dropdown, real-time preview update, save + powered-by toggle
- [ ] `ThemePreview` — dashboard + login preview panels, uses inline styles (not CSS custom props)
- [ ] `LogoUploader` — client-side validation, upload + remove flows, preview
- [ ] `DashboardFooter` — reads OrgContext, respects show_powered_by, powered-by-link data-testid
- [ ] `OrgInvitation.tsx` MODIFIED — theme prop added, logo/colors/powered-by applied
- [ ] `invitation-service.ts` MODIFIED — fetches theme and passes to email template
- [ ] Migration: org_themes table + storage bucket `org-logos` + 3 storage RLS policies
- [ ] prod_schema.sql updated
- [ ] database.types.ts updated
- [ ] seed.sql: theme row for golden tenant (navy + red, Poppins)
- [ ] golden-tenant.ts: 4 theme fixtures
- [ ] `npx vitest run src/__tests__/unit/theme-utils.test.ts` — **27 tests passing**
- [ ] `npx vitest run src/__tests__/unit/email-theme-wrapper.test.ts` — **11 tests passing**
- [ ] `npx vitest run src/__tests__/unit/theme-service.test.ts` — **16 tests passing**
- [ ] `npx vitest run src/__tests__/unit/theme-routes.test.ts` — **22 tests passing**
- [ ] `npx vitest run` — ALL tests passing, zero regressions
- [ ] `npx playwright test src/__tests__/e2e/theme-settings.spec.ts` — **9 tests passing**
- [ ] `npx tsc --noEmit` — 0 type errors
- [ ] DEVLOG.md entry written
- [ ] AI_RULES Rule 53 written
- [ ] roadmap.md Sprint 115 marked ✅

---

## ⚠️ Edge Cases

1. **Google Fonts link tag and CSP headers** — if the app has a Content-Security-Policy header that blocks external stylesheets, the Google Fonts link will be blocked. Check `next.config.ts` or middleware for CSP headers. If present, add `fonts.googleapis.com` and `fonts.gstatic.com` to `style-src` and `font-src` directives.

2. **Logo URL becomes stale after removal and re-upload** — Supabase Storage uses the same path (`{org_id}/logo.{ext}`). Re-uploading the same extension overwrites the file. If the org uploads `logo.png`, removes it, then uploads `logo.jpg`, two paths exist. `updateLogoUrl()` stores the new path. The old `.png` file stays in storage (orphaned). This is acceptable for MVP — add a cleanup job post-launch.

3. **`computeTextOnPrimary` for edge case colors** — colors near the WCAG 4.5:1 threshold may compute differently than designers expect. This is correct behavior per the spec. No override mechanism is provided. If an org wants specific text color, they must choose a primary color that produces their desired result.

4. **Root layout theme fetch adds latency** — every page request now potentially fetches from the DB. For direct access (no OrgContext), this fetch is skipped. For subdomain/custom domain access, it adds ~10-20ms. This is acceptable. Post-launch: add 5-minute Redis cache keyed on `theme:{org_id}`, invalidated on theme save.

5. **Org with no theme row but accessed via subdomain** — `getOrgThemeOrDefault()` returns DEFAULT_THEME. The dashboard renders in LocalVector colors. The org owner sees the theme editor with default values pre-filled. No error.

6. **Font loading on slow connections** — Google Fonts loads asynchronously. The `display=swap` parameter in the font URL causes text to render in the fallback font first, then swap. This is standard behavior and acceptable.

7. **Supabase Storage bucket creation via SQL** — the migration includes an INSERT into `storage.buckets`. This works in Supabase hosted environments. In some self-hosted or local dev setups it may not. Add a comment and post-deployment checklist note: if the migration fails on the storage INSERT, create the bucket manually in the Supabase dashboard with public=true, 2MB limit, and allowed MIME types.

---

## 🔮 AI_RULES Update (Add Rule 53)

```markdown
## 53. 🎨 White-Label Theming in `lib/whitelabel/` (Sprint 115)

* **No arbitrary CSS injection:** Theme = 4 CSS custom properties only:
  --brand-primary, --brand-accent, --brand-text-on-primary, --brand-font-family.
  Never accept arbitrary CSS strings from user input (XSS risk).
* **Colors validated server-side:** sanitizeHexColor() before any DB write.
  text_on_primary always computed via computeTextOnPrimary() — never accepted from client.
* **Google Fonts only:** GOOGLE_FONT_FAMILIES is the exclusive allowlist (10 fonts).
  No custom font file uploads. Load via <link> tag in root layout.
* **Theme injection in root layout only:** getOrgContextFromHeaders() → 
  getOrgThemeOrDefault() → buildThemeCssProps() → cssPropsToObject() → <html style={...}>.
  Never fetch theme in individual server components.
* **ThemePreview uses inline styles:** NOT CSS custom properties. This lets the 
  preview show unsaved values without affecting live dashboard chrome.
* **Default theme always returned:** getOrgThemeOrDefault() never returns null.
  Non-Agency orgs and orgs with no saved theme both get DEFAULT_THEME.
* **Logo storage path:** 'org-logos/{org_id}/logo.{ext}'. Upsert (overwrite on 
  re-upload). 2MB max. PNG/JPEG/WebP/SVG only.
```

---

## 🗺️ What Comes Next

**Sprint 116 — Supabase Realtime:** Live draft co-editing locks, cross-user notification toasts, dashboard auto-refresh on cron completion, team presence indicators. The white-label foundation (114 + 115) is now complete — domains resolve and branding renders. Realtime adds the live collaboration layer that multi-user agency teams need.
