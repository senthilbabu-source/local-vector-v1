// ---------------------------------------------------------------------------
// lib/email/send-overage.ts — Seat Overage Email Sender (Sprint 99)
// ---------------------------------------------------------------------------

import { Resend } from 'resend';
import SeatOverageEmail from '@/emails/SeatOverageEmail';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendSeatOverageEmail(params: {
  ownerEmail: string;
  ownerName: string;
  orgName: string;
  overage: number;
  seatLimit: number;
  currentMembers: number;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.localvector.ai';

  await resend.emails.send({
    from: 'LocalVector <no-reply@localvector.ai>',
    to: params.ownerEmail,
    subject: `Action required: ${params.orgName} has ${params.overage} member${params.overage > 1 ? 's' : ''} over the seat limit`,
    react: SeatOverageEmail({
      ownerName: params.ownerName,
      orgName: params.orgName,
      overage: params.overage,
      seatLimit: params.seatLimit,
      currentMembers: params.currentMembers,
      manageTeamUrl: `${appUrl}/dashboard/settings/team`,
      manageBillingUrl: `${appUrl}/dashboard/billing`,
    }),
  });
}
