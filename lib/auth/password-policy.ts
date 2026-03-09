// ---------------------------------------------------------------------------
// lib/auth/password-policy.ts — Password Policy Hardening (§314)
//
// Pure functions for password validation beyond basic Zod regex rules:
//   1. Max length 72 (bcrypt truncation limit)
//   2. Common password blocklist (top 200 most breached)
//   3. Email-in-password check
//   4. Password strength scoring for client UI
//
// All functions are pure — no I/O, no side effects.
// ---------------------------------------------------------------------------

/**
 * Top 200 most common passwords (Have I Been Pwned / NCSC data).
 * Stored lowercase for case-insensitive matching.
 * Only includes passwords that would pass our regex rules (8+ chars, uppercase, lowercase, digit).
 */
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  'password1', 'password12', 'password123', 'password1234',
  'qwerty123', 'qwerty1234', 'qwertyui1',
  'abc12345', 'abcdef123', 'abcdefg1', 'abcd1234',
  'welcome1', 'welcome12', 'welcome123',
  'letmein12', 'letmein123',
  'monkey123', 'dragon123', 'master123', 'shadow123',
  'michael1', 'jennifer1', 'jordan123', 'charlie1',
  'football1', 'baseball1', 'soccer123',
  'sunshine1', 'princess1', 'trustno1',
  'iloveyou1', 'iloveyou12',
  'superman1', 'batman123',
  'access123', 'admin123', 'login123', 'hello123',
  'charlie123', 'donald123', 'passw0rd', 'passw0rd1',
  'p@ssword1', 'p@ssw0rd1',
  'changeme1', 'changeme12',
  'test1234', 'testing123', 'testtest1',
  'computer1', 'internet1',
  'whatever1', 'nothing123',
  'summer123', 'spring123', 'winter123', 'autumn123',
  'monday123', 'friday123',
  'mypassword1', 'password01',
  'password99', 'pa55word1',
  'qwerty12345', 'zxcvbnm1',
  'asdfgh123', 'zxcvbn123',
  '1qaz2wsx', '1q2w3e4r',
  'q1w2e3r4', 'a1b2c3d4',
  'samsung1', 'samsung123',
  'google123', 'chrome123',
  'pokemon123', 'starwars1',
  'mustang1', 'ferrari1',
  'mercedes1', 'corvette1',
  'newyork1', 'london123',
  'liverpool1', 'arsenal123', 'chelsea1',
  'america1', 'freedom1',
  'richard1', 'william1', 'thomas123', 'robert123',
  'jessica1', 'ashley123', 'amanda123', 'melissa1',
  'diamond1', 'diamond123',
  'forever1', 'forever123',
  'myspace123', 'facebook1',
  'chocolate1', 'cookies123',
  'chicken123', 'pepper123',
  'orange123', 'banana123',
  'flower123', 'garden123',
  'purple123', 'silver123', 'golden123',
  'dragon1234', 'phoenix1', 'phoenix123',
  'midnight1', 'midnight123',
  'twilight1',
  'rainbow1', 'rainbow123',
  'butterfly1',
  'dolphin1', 'dolphin123',
  'snoopy123',
  'password2', 'password3', 'password4', 'password5',
  'password6', 'password7', 'password8', 'password9',
  'hockey123', 'tennis123', 'running1',
  'hunter123', 'killer123', 'george123',
  'daniel123', 'andrew123', 'joshua123',
  'matthew1', 'anthony1', 'nicholas1',
  'alexander1', 'elizabeth1', 'victoria1',
  'samantha1', 'stephanie1', 'christina1',
  'trustno12', 'qazwsx123',
  'password00', 'pass1234',
  'abcabc123', 'aaaaaa11',
  'baseball123', 'football123',
]);

/** Bcrypt truncates at 72 bytes. Anything longer is silently ignored → security risk. */
export const MAX_PASSWORD_LENGTH = 72;

/**
 * Check if a password is in the common passwords blocklist.
 * Case-insensitive comparison.
 */
export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}

/**
 * Check if the password contains the user's email local part.
 * Prevents passwords like "jane@company.com" → "janePass1".
 * Only checks if the local part is 3+ chars (to avoid false positives on short emails).
 */
export function passwordContainsEmail(password: string, email: string): boolean {
  const localPart = email.split('@')[0];
  if (!localPart || localPart.length < 3) return false;
  return password.toLowerCase().includes(localPart.toLowerCase());
}

/**
 * Compute a 0–4 password strength score for client-side UI.
 *
 * Scoring:
 *   0 = very weak (too short or common)
 *   1 = weak (meets minimum only)
 *   2 = fair (has variety)
 *   3 = good (long + variety)
 *   4 = strong (very long + diverse chars)
 */
export function computePasswordStrength(password: string): number {
  if (!password || password.length < 8) return 0;
  if (isCommonPassword(password)) return 0;

  let score = 1; // meets minimum length

  // Length bonus
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Character diversity
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const diversity = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;

  if (diversity >= 4) score += 1;

  return Math.min(score, 4);
}

/**
 * Get a human-readable label for a password strength score.
 */
export function getStrengthLabel(score: number): string {
  switch (score) {
    case 0: return 'Very weak';
    case 1: return 'Weak';
    case 2: return 'Fair';
    case 3: return 'Good';
    case 4: return 'Strong';
    default: return 'Unknown';
  }
}

/**
 * Get the CSS color class for a password strength score.
 * Uses the LocalVector design system color tokens.
 */
export function getStrengthColor(score: number): string {
  switch (score) {
    case 0: return 'bg-alert-crimson';
    case 1: return 'bg-alert-crimson';
    case 2: return 'bg-amber-500';
    case 3: return 'bg-signal-green/70';
    case 4: return 'bg-signal-green';
    default: return 'bg-slate-500';
  }
}
