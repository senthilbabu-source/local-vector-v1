// ---------------------------------------------------------------------------
// POST /api/partner-waitlist — Partner program email capture
//
// Stores partner leads into scan_leads table (service role, bypass RLS).
// Uses business_name for company, scan_status='pass' as partner sentinel.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { email, company } = await req.json();

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      // Fail open — don't block the user experience
      return NextResponse.json({ ok: true });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    await supabase.from('scan_leads').insert({
      email: email.trim().toLowerCase(),
      business_name: company?.trim() || 'Partner Waitlist',
      scan_status: 'pass',
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Fail open
    return NextResponse.json({ ok: true });
  }
}
