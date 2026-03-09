/**
 * §317: Cloudflare Turnstile — Server-Side Token Verification
 *
 * Validates the Turnstile token submitted with registration forms.
 * Fail-open in development: if TURNSTILE_SECRET_KEY is not set, verification
 * is skipped so local dev / CI works without Cloudflare credentials.
 *
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerifyResult {
  success: boolean;
  /** ISO timestamp of the challenge solve. */
  challenge_ts?: string;
  /** Hostname the widget was loaded on. */
  hostname?: string;
  /** Error codes from Turnstile API. */
  error_codes: string[];
}

/**
 * Returns true when Turnstile is configured (secret key is set).
 * When false, verification should be skipped (dev/CI fail-open).
 */
export function isTurnstileEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

/**
 * Verify a Turnstile token against the Cloudflare API.
 *
 * @param token  The `cf-turnstile-response` value from the client form.
 * @param ip     Optional connecting IP for additional validation.
 * @returns      Verification result with success flag and error codes.
 */
export async function verifyTurnstileToken(
  token: string,
  ip?: string,
): Promise<TurnstileVerifyResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    // Fail-open: no secret key → treat as valid (dev/CI)
    return { success: true, error_codes: [] };
  }

  if (!token || token.trim().length === 0) {
    return { success: false, error_codes: ['missing-input-response'] };
  }

  const formData = new URLSearchParams();
  formData.append('secret', secretKey);
  formData.append('response', token);
  if (ip) {
    formData.append('remoteip', ip);
  }

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    if (!res.ok) {
      return {
        success: false,
        error_codes: [`http-error-${res.status}`],
      };
    }

    const data = (await res.json()) as {
      success: boolean;
      challenge_ts?: string;
      hostname?: string;
      'error-codes'?: string[];
    };

    return {
      success: data.success,
      challenge_ts: data.challenge_ts,
      hostname: data.hostname,
      error_codes: data['error-codes'] ?? [],
    };
  } catch (_e) {
    // Network failure → fail-open to avoid blocking registration
    return { success: true, error_codes: ['network-error-failopen'] };
  }
}
