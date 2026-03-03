'use client';

// ---------------------------------------------------------------------------
// app/widget/[slug]/WidgetChat.tsx — Chat Widget Client Component (Sprint 133)
//
// Minimal chat UI for iframe rendering. Stateless per session.
// ---------------------------------------------------------------------------

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  confidence?: 'high' | 'medium' | 'low';
}

interface WidgetChatProps {
  slug: string;
  businessName: string;
  phone: string | null;
  color: string;
  greeting: string;
  hideBranding: boolean;
}

export default function WidgetChat({
  slug,
  businessName,
  phone,
  color,
  greeting,
  hideBranding,
}: WidgetChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setLoading(true);

    try {
      const res = await fetch('/api/widget/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, question }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }));
        setError(data.error ?? 'Something went wrong');
        return;
      }

      const data = (await res.json()) as {
        answer: string;
        confidence: 'high' | 'medium' | 'low';
      };

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: data.answer, confidence: data.confidence },
      ]);
    } catch (_err) {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex h-screen flex-col bg-white"
      data-testid="widget-chat"
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 text-white"
        style={{ backgroundColor: color }}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
          {businessName.charAt(0)}
        </div>
        <div>
          <div className="text-sm font-semibold">{businessName}</div>
          <div className="text-xs opacity-80">Ask us anything</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Greeting */}
        {messages.length === 0 && (
          <div className="rounded-lg bg-gray-100 p-3 text-sm text-gray-700 max-w-[85%]">
            {greeting}
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-gray-900 text-white'
                  : msg.confidence === 'low'
                    ? 'border-2 border-amber-300 bg-amber-50 text-gray-800'
                    : 'bg-gray-100 text-gray-800'
              }`}
            >
              {msg.text}
              {msg.confidence === 'low' && phone && (
                <div className="mt-1 text-xs text-amber-700">
                  For more info: {phone}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-500">
              <span className="inline-flex gap-1">
                <span className="animate-bounce">.</span>
                <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-600">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question..."
            maxLength={500}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': color } as React.CSSProperties}
            disabled={loading}
            data-testid="widget-input"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: color }}
            data-testid="widget-send"
          >
            Send
          </button>
        </form>

        {!hideBranding && (
          <div className="mt-2 text-center text-[10px] text-gray-400">
            Powered by LocalVector
          </div>
        )}
      </div>
    </div>
  );
}
