/**
 * DNS Verifier — Sprint 114
 *
 * Edge-compatible DNS verification using Cloudflare DNS-over-HTTPS.
 * NO Node.js dns module — not available in Vercel Edge Runtime.
 * Never throws — always returns DomainVerificationResult.
 */

import type { DomainVerificationResult } from './types';
import { VERIFICATION_TXT_PREFIX } from './types';

const DOH_URL = 'https://cloudflare-dns.com/dns-query';
const DNS_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Verify that the org has added the required TXT record to their domain.
 * Uses Cloudflare DNS-over-HTTPS (JSON format).
 * Never throws — returns DomainVerificationResult on all code paths.
 */
export async function verifyCustomDomain(
  domainValue: string,
  verificationToken: string,
): Promise<DomainVerificationResult> {
  const checkedAt = new Date().toISOString();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DNS_TIMEOUT_MS);

    const url = `${DOH_URL}?name=${encodeURIComponent(domainValue)}&type=TXT`;
    const res = await fetch(url, {
      headers: { Accept: 'application/dns-json' },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return {
        verified: false,
        status: 'failed',
        checked_at: checkedAt,
        error: `DNS lookup failed: HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as DohResponse;
    const answers = data.Answer ?? [];

    // TXT records come with surrounding quotes in the data field
    const match = answers.some((a) => {
      if (a.type !== 16) return false; // 16 = TXT record type
      const cleaned = a.data.replace(/"/g, '').trim();
      return cleaned === verificationToken;
    });

    if (match) {
      return {
        verified: true,
        status: 'verified',
        checked_at: checkedAt,
        error: null,
      };
    }

    return {
      verified: false,
      status: 'failed',
      checked_at: checkedAt,
      error: 'TXT record not found',
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? 'DNS lookup timed out'
        : `DNS lookup failed: ${err instanceof Error ? err.message : String(err)}`;

    return {
      verified: false,
      status: 'failed',
      checked_at: checkedAt,
      error: message,
    };
  }
}

// ---------------------------------------------------------------------------
// Pure helper
// ---------------------------------------------------------------------------

/**
 * Build the full TXT record value from a verification token.
 * If the token already has the prefix, returns as-is.
 */
export function buildVerificationToken(rawToken: string): string {
  if (rawToken.startsWith(VERIFICATION_TXT_PREFIX)) return rawToken;
  return `${VERIFICATION_TXT_PREFIX}${rawToken}`;
}

// ---------------------------------------------------------------------------
// DNS-over-HTTPS response types (Cloudflare JSON format)
// ---------------------------------------------------------------------------

interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DohResponse {
  Status: number;
  Answer?: DohAnswer[];
}
