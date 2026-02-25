// ---------------------------------------------------------------------------
// app/dashboard/ai-assistant/page.tsx — AI Assistant Page
//
// Surgery 6: Dashboard page that renders the AI chat interface.
// Server component that handles auth, then delegates to Chat client component.
//
// Spec: Surgical Integration Plan §Surgery 6
// ---------------------------------------------------------------------------

import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import Chat from './_components/Chat';

export default async function AIAssistantPage() {
    const ctx = await getSafeAuthContext();
    if (!ctx) {
        redirect('/login');
    }

    return (
        <div className="space-y-3">
            <div>
                <h1 className="text-xl font-semibold text-white tracking-tight">
                    AI Assistant
                </h1>
                <p className="mt-0.5 text-sm text-slate-400">
                    Ask questions about your AI visibility, hallucinations, and competitive position.
                </p>
            </div>
            <Chat />
        </div>
    );
}
