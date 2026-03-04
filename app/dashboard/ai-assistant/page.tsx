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

export const metadata = { title: 'AI Assistant | LocalVector.ai' };

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
                    Ask questions about how AI sees your business, mistakes it makes, and how you compare to competitors.
                </p>
            </div>
            <Chat />
        </div>
    );
}
