/**
 * ThemePreview — Sprint 115
 *
 * Pure display component. Uses inline styles (NOT CSS custom props)
 * so the preview reflects unsaved state without affecting the live dashboard.
 */

interface ThemePreviewProps {
  primaryColor: string;
  accentColor: string;
  textOnPrimary: string;
  fontFamily: string;
  logoUrl: string | null;
  orgName: string;
  showPoweredBy: boolean;
}

export default function ThemePreview({
  primaryColor,
  accentColor,
  textOnPrimary,
  fontFamily,
  logoUrl,
  orgName,
  showPoweredBy,
}: ThemePreviewProps) {
  const fontStack = fontFamily === 'Inter'
    ? 'Inter, system-ui, sans-serif'
    : `'${fontFamily}', Inter, system-ui, sans-serif`;

  return (
    <div className="space-y-6">
      {/* Dashboard preview */}
      <div data-testid="theme-preview-panel">
        <h3 className="mb-3 text-sm font-semibold text-slate-400">Dashboard Preview</h3>
        <div className="overflow-hidden rounded-lg border border-white/10">
          {/* Header bar */}
          <div
            style={{ backgroundColor: primaryColor, color: textOnPrimary, fontFamily: fontStack }}
            className="flex items-center gap-3 px-4 py-3"
          >
            {logoUrl && (
              <img src={logoUrl} alt={orgName} style={{ maxWidth: '80px', maxHeight: '28px', objectFit: 'contain' }} />
            )}
            <span className="text-sm font-semibold">{orgName}</span>
          </div>
          {/* Content mock */}
          <div className="bg-[#050A15] p-4" style={{ fontFamily: fontStack }}>
            <div className="flex items-center gap-4">
              <div className="rounded-lg border border-white/10 bg-[#0A1628] p-4 flex-1">
                <p className="text-xs text-slate-400">Reality Score</p>
                <p className="text-2xl font-bold" style={{ color: primaryColor }}>87</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#0A1628] p-4 flex-1">
                <p className="text-xs text-slate-400">AI Health</p>
                <p className="text-2xl font-bold" style={{ color: accentColor }}>72%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Login preview */}
      <div data-testid="login-preview-panel">
        <h3 className="mb-3 text-sm font-semibold text-slate-400">Login Page Preview</h3>
        <div className="overflow-hidden rounded-lg border border-white/10 bg-[#050A15] p-6" style={{ fontFamily: fontStack }}>
          {/* Logo */}
          {logoUrl && (
            <div className="mb-4 flex justify-center">
              <img src={logoUrl} alt={orgName} style={{ maxWidth: '120px', maxHeight: '48px', objectFit: 'contain' }} />
            </div>
          )}
          <p className="mb-4 text-center text-sm font-semibold text-white">{orgName}</p>
          <p className="mb-3 text-center text-xs text-slate-400">Sign in to your account</p>

          {/* Mock form */}
          <div className="space-y-2">
            <div className="rounded border border-white/10 bg-[#0A1628] px-3 py-1.5 text-xs text-slate-500">
              you@example.com
            </div>
            <div className="rounded border border-white/10 bg-[#0A1628] px-3 py-1.5 text-xs text-slate-500">
              ********
            </div>
            <div
              className="rounded px-3 py-1.5 text-center text-xs font-semibold"
              style={{ backgroundColor: primaryColor, color: textOnPrimary }}
            >
              Sign In
            </div>
          </div>

          {/* Powered by */}
          {showPoweredBy && (
            <p className="mt-4 text-center text-[10px] text-slate-500">
              Powered by LocalVector
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
