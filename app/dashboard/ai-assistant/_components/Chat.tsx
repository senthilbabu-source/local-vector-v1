// ---------------------------------------------------------------------------
// app/dashboard/ai-assistant/_components/Chat.tsx — AI Assistant Chat UI
//
// Surgery 6: Client component using useChat() from Vercel AI SDK.
// Renders tool call results as rich UI cards instead of plain text.
//
// Tool result types → UI mapping:
//   visibility_score    → ScoreCard (colored metrics)
//   sov_trend           → TrendList (date + percentage)
//   hallucinations      → AlertList (severity-coded items)
//   competitor_comparison → CompetitorList (gap analysis)
//
// Spec: Surgical Integration Plan §Surgery 6
// ---------------------------------------------------------------------------

'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useRef, useEffect } from 'react';

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

function TrendList({ data }: { data: any }) {
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
            <div className="space-y-1.5">
                {data.data.map((d: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                        <span className="text-slate-400">{d.date}</span>
                        <span className="text-signal-green font-semibold tabular-nums">{d.sov}%</span>
                    </div>
                ))}
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
            return <TrendList data={result} />;
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
// Chat Component
// ---------------------------------------------------------------------------

export default function Chat() {
    const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
        api: '/api/chat',
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (!mounted) return null;

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)]">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-1 space-y-4">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
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
                                        const fakeEvent = {
                                            target: { value: q },
                                        } as React.ChangeEvent<HTMLInputElement>;
                                        handleInputChange(fakeEvent);
                                        setTimeout(() => {
                                            const form = document.querySelector('form');
                                            form?.requestSubmit();
                                        }, 50);
                                    }}
                                    className="text-xs px-3 py-1.5 rounded-full bg-electric-indigo/10 text-electric-indigo border border-electric-indigo/20 hover:bg-electric-indigo/20 transition-colors"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                            className={`max-w-[85%] rounded-xl px-4 py-3 ${m.role === 'user'
                                    ? 'bg-electric-indigo text-white'
                                    : 'bg-surface-dark border border-white/5 text-slate-200'
                                }`}
                        >
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

            {/* Input */}
            <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
                <input
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Ask about your AI visibility..."
                    disabled={isLoading}
                    className="flex-1 rounded-xl bg-surface-dark border border-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-electric-indigo/50 disabled:opacity-50"
                />
                <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="rounded-xl bg-electric-indigo px-5 py-3 text-sm font-semibold text-white hover:bg-electric-indigo/80 disabled:opacity-40 transition-colors"
                >
                    Send
                </button>
            </form>
        </div>
    );
}
