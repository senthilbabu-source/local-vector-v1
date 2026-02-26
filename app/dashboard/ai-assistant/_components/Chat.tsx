// ---------------------------------------------------------------------------
// app/dashboard/ai-assistant/_components/Chat.tsx — AI Assistant Chat UI
//
// Surgery 6 + Sprint 57A Polish:
//   1. Error handling — onError callback, error banner with retry, 401 detection
//   2. Loading skeleton — 3 placeholder bubbles with animate-pulse
//   3. Quick-action buttons — use append() instead of hacky requestSubmit
//   4. Mobile responsiveness — responsive padding, bubble widths, input stacking
//   5. TrendList → recharts AreaChart sparkline (120px, signal-green, tooltip)
//   6. Stop generating button — stop() from useChat, square icon
//   7. Copy message content — clipboard API, "Copied!" tooltip, hover-only
//
// Tool result types → UI mapping:
//   visibility_score    → ScoreCard (colored metrics)
//   sov_trend           → TrendSparkline (recharts AreaChart)
//   hallucinations      → AlertList (severity-coded items)
//   competitor_comparison → CompetitorList (gap analysis)
// ---------------------------------------------------------------------------

'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { createClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Tool Result Card Components
// ---------------------------------------------------------------------------

function ScoreCard({ data }: { data: any }) {
    return (
        <div className="rounded-xl bg-surface-dark border border-white/10 p-4 my-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">AI Visibility Score</h4>
            <div className="grid grid-cols-2 gap-3">
                <Metric label="Share of Voice" value={data.share_of_voice != null ? `${data.share_of_voice}%` : '—'} color="green" />
                <Metric label="Reality Score" value={data.reality_score ?? '—'} color="green" />
                <Metric label="Accuracy" value={data.accuracy_score} color={data.accuracy_score >= 80 ? 'green' : 'red'} />
                <Metric label="Open Alerts" value={data.open_hallucinations} color={data.open_hallucinations > 0 ? 'red' : 'green'} />
            </div>
        </div>
    );
}

function Metric({ label, value, color }: { label: string; value: any; color: string }) {
    const colorClass = color === 'green' ? 'text-signal-green' : color === 'red' ? 'text-alert-crimson' : 'text-white';
    return (
        <div>
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`text-lg font-bold tabular-nums ${colorClass}`}>{value}</p>
        </div>
    );
}

// Sprint 57A-5: Replace flat TrendList with recharts AreaChart sparkline
function TrendSparkline({ data }: { data: any }) {
    if (!data.data?.length) {
        return (
            <div className="rounded-xl bg-surface-dark border border-white/10 p-4 my-2 text-sm text-slate-500">
                No SOV trend data yet — first scan populates this.
            </div>
        );
    }
    return (
        <div className="rounded-xl bg-surface-dark border border-white/10 p-4 my-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">SOV Trend</h4>
            <div className="h-[120px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                        <defs>
                            <linearGradient id="sovGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#00F5A0" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#00F5A0" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10, fill: '#64748B' }}
                            axisLine={false}
                            tickLine={false}
                            interval="preserveStartEnd"
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#0A1628',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 8,
                                fontSize: 12,
                            }}
                            labelStyle={{ color: '#94A3B8' }}
                            itemStyle={{ color: '#00F5A0' }}
                            formatter={(value: number) => [`${value}%`, 'SOV']}
                        />
                        <Area
                            type="monotone"
                            dataKey="sov"
                            stroke="#00F5A0"
                            strokeWidth={2}
                            fill="url(#sovGradient)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function AlertList({ data }: { data: any }) {
    if (!data.items?.length) {
        return (
            <div className="rounded-xl bg-surface-dark border border-white/10 p-4 my-2 text-sm text-signal-green">
                No {data.filter} hallucinations found. Your AI presence is clean!
            </div>
        );
    }

    const severityColors: Record<string, string> = {
        critical: 'bg-alert-crimson/20 text-alert-crimson',
        high: 'bg-orange-500/20 text-orange-400',
        medium: 'bg-alert-amber/20 text-alert-amber',
        low: 'bg-slate-500/20 text-slate-400',
    };

    return (
        <div className="rounded-xl bg-surface-dark border border-white/10 p-4 my-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                {data.filter === 'all' ? 'All' : data.filter === 'open' ? 'Open' : 'Fixed'} Hallucinations ({data.total})
            </h4>
            <div className="space-y-2">
                {data.items.map((h: any, i: number) => (
                    <div key={i} className="rounded-lg bg-midnight-slate/50 border border-white/5 p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${severityColors[h.severity] ?? ''}`}>
                                {h.severity}
                            </span>
                            <span className="text-xs text-slate-500">{h.model} · {h.category}</span>
                        </div>
                        <p className="text-sm text-alert-crimson">&ldquo;{h.claim}&rdquo;</p>
                        <p className="text-sm text-signal-green mt-1">✓ {h.truth}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function CompetitorList({ data }: { data: any }) {
    if (!data.competitors?.length) {
        return (
            <div className="rounded-xl bg-surface-dark border border-white/10 p-4 my-2 text-sm text-slate-500">
                No competitor data yet — run an intercept analysis first.
            </div>
        );
    }
    return (
        <div className="rounded-xl bg-surface-dark border border-white/10 p-4 my-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Competitor Analysis</h4>
            <div className="space-y-2">
                {data.competitors.map((c: any, i: number) => (
                    <div key={i} className="rounded-lg bg-midnight-slate/50 border border-white/5 p-3">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-semibold text-white">{c.name}</span>
                            <span className="text-xs text-slate-500">{c.analyses} analyses</span>
                        </div>
                        {c.recommendation && (
                            <p className="text-xs text-slate-400 mt-1">{c.recommendation}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Tool result renderer — maps tool name to component
// ---------------------------------------------------------------------------

function ToolResult({ name, result }: { name: string; result: any }) {
    switch (result?.type) {
        case 'visibility_score':
            return <ScoreCard data={result} />;
        case 'sov_trend':
            return <TrendSparkline data={result} />;
        case 'hallucinations':
            return <AlertList data={result} />;
        case 'competitor_comparison':
            return <CompetitorList data={result} />;
        default:
            return (
                <pre className="rounded-lg bg-surface-dark border border-white/10 p-3 my-2 text-xs text-slate-400 overflow-x-auto">
                    {JSON.stringify(result, null, 2)}
                </pre>
            );
    }
}

// ---------------------------------------------------------------------------
// Copy Button — hover-only on assistant messages
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard API may fail in insecure contexts — silent fallback
        }
    }, [text]);

    return (
        <button
            type="button"
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 p-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
            title="Copy message"
        >
            {copied ? (
                <span className="text-xs text-signal-green font-medium px-1">Copied!</span>
            ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
            )}
        </button>
    );
}

// ---------------------------------------------------------------------------
// Loading Skeleton — shown before first message loads
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
    return (
        <div className="flex flex-col gap-4 px-2 sm:px-4 pt-8 animate-pulse">
            {/* Simulated user message */}
            <div className="flex justify-end">
                <div className="w-48 sm:w-56 h-10 rounded-xl bg-electric-indigo/20" />
            </div>
            {/* Simulated assistant message */}
            <div className="flex justify-start">
                <div className="w-64 sm:w-80 h-16 rounded-xl bg-surface-dark border border-white/5" />
            </div>
            {/* Simulated assistant message */}
            <div className="flex justify-start">
                <div className="w-56 sm:w-72 h-12 rounded-xl bg-surface-dark border border-white/5" />
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Error Banner
// ---------------------------------------------------------------------------

function ErrorBanner({ error, onRetry, sessionExpired }: { error: Error; onRetry: () => void; sessionExpired: boolean }) {
    return (
        <div className="mx-2 sm:mx-4 mb-3 rounded-xl bg-alert-crimson/10 border border-alert-crimson/20 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
                <p className="text-sm text-alert-crimson font-medium">
                    {sessionExpired
                        ? 'Session expired — please sign in again.'
                        : 'Something went wrong. Please try again.'}
                </p>
            </div>
            {sessionExpired ? (
                <a
                    href="/login"
                    className="shrink-0 text-xs font-semibold text-electric-indigo hover:text-white bg-electric-indigo/10 hover:bg-electric-indigo/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                    Sign in
                </a>
            ) : (
                <button
                    type="button"
                    onClick={onRetry}
                    className="shrink-0 text-xs font-semibold text-alert-crimson hover:text-white bg-alert-crimson/10 hover:bg-alert-crimson/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                    Retry
                </button>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Chat Component
// ---------------------------------------------------------------------------

export default function Chat() {
    const sessionRefreshAttempted = useRef(false);
    const [sessionExpired, setSessionExpired] = useState(false);

    const {
        messages,
        input,
        handleInputChange,
        handleSubmit,
        isLoading,
        error,
        reload,
        stop,
        append,
    } = useChat({
        api: '/api/chat',
        onResponse: async (response) => {
            if (response.status === 401 && !sessionRefreshAttempted.current) {
                // First 401 — silently refresh the session and auto-retry
                sessionRefreshAttempted.current = true;
                const supabase = createClient();
                const { error: refreshError } = await supabase.auth.refreshSession();
                if (!refreshError) {
                    // Session refreshed — useChat will throw an error, which triggers
                    // the onError callback. We schedule a reload after the error settles.
                    setTimeout(() => reload(), 100);
                } else {
                    // Refresh failed — session is truly expired
                    setSessionExpired(true);
                }
            } else if (response.status === 401) {
                // Already tried refreshing — session is truly expired
                setSessionExpired(true);
            }
        },
        onError: () => {
            // Reset the refresh flag so the next user-initiated retry can attempt refresh again
            if (!sessionRefreshAttempted.current) return;
            // Keep the flag set until a successful response resets it
        },
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Extract all text content from a message for the copy button
    const getMessageText = useCallback((m: typeof messages[0]): string => {
        if (m.parts?.length) {
            return m.parts
                .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
                .map((p) => p.text)
                .join('\n');
        }
        return m.content ?? '';
    }, []);

    if (!mounted) return null;

    // Show loading skeleton on very first load (no messages yet, not loading)
    // This is a one-time skeleton; once mounted with messages it won't show again.

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)]">
            {/* Error Banner */}
            {error && (
                <ErrorBanner error={error} onRetry={reload} sessionExpired={sessionExpired} />
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-2 sm:px-4 space-y-4">
                {messages.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center h-full text-center px-4">
                        <div className="text-3xl mb-3">🔍</div>
                        <h3 className="text-lg font-semibold text-white mb-1">AI Visibility Assistant</h3>
                        <p className="text-sm text-slate-400 max-w-md">
                            Ask me about your AI visibility score, hallucinations, competitor analysis, or how to improve your presence in AI answers.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-4 justify-center">
                            {[
                                'How visible is my business in AI?',
                                'Show me my open hallucinations',
                                'How do I compare to competitors?',
                                'Show my SOV trend',
                            ].map((q) => (
                                <button
                                    key={q}
                                    type="button"
                                    onClick={() => {
                                        append({ role: 'user', content: q });
                                    }}
                                    className="text-xs px-3 py-1.5 rounded-full bg-electric-indigo/10 text-electric-indigo border border-electric-indigo/20 hover:bg-electric-indigo/20 transition-colors"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Loading skeleton when first message is being generated */}
                {messages.length === 0 && isLoading && <LoadingSkeleton />}

                {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                            className={`relative max-w-[90%] sm:max-w-[85%] rounded-xl px-4 py-3 ${
                                m.role === 'user'
                                    ? 'bg-electric-indigo text-white'
                                    : 'bg-surface-dark border border-white/5 text-slate-200 group'
                            }`}
                        >
                            {/* Copy button — assistant messages only */}
                            {m.role === 'assistant' && getMessageText(m) && (
                                <CopyButton text={getMessageText(m)} />
                            )}

                            {/* Render text parts */}
                            {m.parts?.map((part, i) => {
                                if (part.type === 'text' && part.text) {
                                    return (
                                        <p key={i} className="text-sm whitespace-pre-wrap leading-relaxed">
                                            {part.text}
                                        </p>
                                    );
                                }
                                if (part.type === 'tool-invocation') {
                                    const toolPart = part as any;
                                    if ('result' in toolPart) {
                                        return <ToolResult key={i} name={toolPart.toolName} result={toolPart.result} />;
                                    }
                                    return (
                                        <div key={i} className="flex items-center gap-2 text-xs text-slate-500 my-1">
                                            <span className="animate-pulse">●</span> Looking up {toolPart.toolName?.replace(/([A-Z])/g, ' $1').toLowerCase()}...
                                        </div>
                                    );
                                }
                                return null;
                            })}

                            {/* Fallback for messages without parts */}
                            {!m.parts?.length && m.content && (
                                <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                    <div className="flex justify-start">
                        <div className="bg-surface-dark border border-white/5 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-signal-green rounded-full animate-pulse" />
                                <span className="w-1.5 h-1.5 bg-signal-green rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                                <span className="w-1.5 h-1.5 bg-signal-green rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSubmit} className="mt-3 flex flex-col sm:flex-row gap-2 px-2 sm:px-0">
                <input
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Ask about your AI visibility..."
                    disabled={isLoading}
                    className="flex-1 rounded-xl bg-surface-dark border border-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-electric-indigo/50 disabled:opacity-50"
                />
                <div className="flex gap-2">
                    {isLoading ? (
                        <button
                            type="button"
                            onClick={stop}
                            className="rounded-xl bg-alert-crimson/10 border border-alert-crimson/20 px-5 py-3 text-sm font-semibold text-alert-crimson hover:bg-alert-crimson/20 transition-colors flex items-center gap-2"
                        >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                                <rect width="12" height="12" rx="2" />
                            </svg>
                            Stop
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={!input.trim()}
                            className="rounded-xl bg-electric-indigo px-5 py-3 text-sm font-semibold text-white hover:bg-electric-indigo/80 disabled:opacity-40 transition-colors"
                        >
                            Send
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}
