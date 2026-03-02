/**
 * invitation-email.test.ts — Sprint 112
 *
 * Tests for the pure email content builder.
 * Zero mocks — all functions are pure.
 */

import { describe, it, expect } from 'vitest';
import {
  buildInvitationEmailProps,
  buildInvitationSubject,
} from '@/lib/invitations/invitation-email';

describe('buildInvitationSubject — pure', () => {
  it('contains inviterName and orgName', () => {
    const subject = buildInvitationSubject('Aruna Babu', 'Charcoal N Chill');
    expect(subject).toContain('Aruna Babu');
    expect(subject).toContain('Charcoal N Chill');
    expect(subject).toContain('LocalVector');
  });
});

describe('buildInvitationEmailProps — pure', () => {
  const baseParams = {
    inviterName: 'Aruna Babu',
    orgName: 'Charcoal N Chill',
    role: 'analyst' as const,
    acceptUrl: 'https://app.localvector.ai/invitations/accept/abc123',
    expiresAt: '2026-03-08T00:00:00.000Z',
  };

  it('returns inviteUrl matching the acceptUrl', () => {
    const props = buildInvitationEmailProps(baseParams);
    expect(props.inviteUrl).toBe(baseParams.acceptUrl);
  });

  it('returns capitalized role string', () => {
    const props = buildInvitationEmailProps(baseParams);
    expect(props.role).toBe('Analyst');
  });

  it('returns role description for analyst', () => {
    const props = buildInvitationEmailProps(baseParams);
    expect(props.roleDescription).toContain('view all data');
  });

  it('returns formatted expiry date string', () => {
    const props = buildInvitationEmailProps(baseParams);
    expect(props.expiresIn).toContain('March');
    expect(props.expiresIn).toContain('2026');
  });

  it('returns correct role descriptions for each role', () => {
    const adminProps = buildInvitationEmailProps({ ...baseParams, role: 'admin' });
    expect(adminProps.roleDescription).toContain('invite');

    const viewerProps = buildInvitationEmailProps({ ...baseParams, role: 'viewer' });
    expect(viewerProps.roleDescription).toContain('read-only');
  });

  it('orgName and inviterName pass through unchanged', () => {
    const props = buildInvitationEmailProps(baseParams);
    expect(props.orgName).toBe('Charcoal N Chill');
    expect(props.inviterName).toBe('Aruna Babu');
  });
});
