// ---------------------------------------------------------------------------
// lib/security/scanner-guard.ts — Block known vulnerability scanner UAs
// P6-FIX-25: Returns true if the user-agent matches a known scanner.
// ---------------------------------------------------------------------------

const BLOCKED_SCANNERS: RegExp[] = [
  /sqlmap/i,
  /nikto/i,
  /nessus/i,
  /nmap/i,
  /masscan/i,
  /nuclei/i,
  /dirbuster/i,
  /gobuster/i,
  /wfuzz/i,
  /acunetix/i,
  /burpsuite/i,
  /openvas/i,
];

/**
 * Returns true if the given user-agent string matches a known vulnerability
 * scanner. Returns false for null/empty/normal user agents.
 */
export function isScannerUA(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return BLOCKED_SCANNERS.some((pattern) => pattern.test(ua));
}
