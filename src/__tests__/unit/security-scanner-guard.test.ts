/**
 * Unit Tests — Scanner UA Guard (P6-FIX-25)
 *
 * Verifies known vulnerability scanner user agents are blocked
 * while normal browser user agents pass through.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/security-scanner-guard.test.ts
 */

import { describe, it, expect } from 'vitest';
import { isScannerUA } from '@/lib/security/scanner-guard';

describe('lib/security/scanner-guard — isScannerUA()', () => {
  const BLOCKED_UAS = [
    'sqlmap/1.7.3#stable',
    'Mozilla/5.0 (Nikto/2.1.6)',
    'Nessus SOAP v0.4.0 (Nessus 10.5.0)',
    'Nmap Scripting Engine',
    'masscan/1.3.2',
    'Nuclei - Open-source project',
    'DirBuster-1.0-RC1',
    'gobuster/3.6',
    'Wfuzz/3.1.0',
    'Acunetix Web Vulnerability Scanner',
    'BurpSuite Professional',
    'OpenVAS 22.4.0',
  ];

  BLOCKED_UAS.forEach((ua) => {
    it(`blocks scanner: ${ua.slice(0, 40)}`, () => {
      expect(isScannerUA(ua)).toBe(true);
    });
  });

  it('is case-insensitive for scanner detection', () => {
    expect(isScannerUA('SQLMAP/1.0')).toBe(true);
    expect(isScannerUA('Nmap scripting ENGINE')).toBe(true);
  });

  const ALLOWED_UAS = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)',
    'curl/8.4.0',
    'PostmanRuntime/7.36.0',
  ];

  ALLOWED_UAS.forEach((ua) => {
    it(`allows normal UA: ${ua.slice(0, 50)}...`, () => {
      expect(isScannerUA(ua)).toBe(false);
    });
  });

  it('returns false for null user agent', () => {
    expect(isScannerUA(null)).toBe(false);
  });

  it('returns false for undefined user agent', () => {
    expect(isScannerUA(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isScannerUA('')).toBe(false);
  });
});
