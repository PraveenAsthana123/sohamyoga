'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  Local-Ollama AI assistant — streams from /api/ai/chat (SSE).       */
/*  Separate from the lead-capture ChatWidget; sits bottom-left so the  */
/*  two floating buttons never overlap.                                 */
/* ------------------------------------------------------------------ */

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface HealthStatus {
  ok: boolean;
  model: string;
  modelInstalled: boolean;
  installedCount: number;
  error?: string;
}

const SUGGESTIONS = [
  'What services does SLP Systems offer?',
  'Can you help scope a data migration project?',
  'How do you approach an AI/ML engagement?',
];

const GREETING =
  "Hi! I'm the SLP Assistant, running on a local AI model. Ask me about our Data Engineering, AI/ML, or Cloud services — or how we'd approach your project.";

function SparkleIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
      />
    </svg>
  );
}

function CloseIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function SendIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
      />
    </svg>
  );
}

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [healthMessage, setHealthMessage] = useState('Checking local AI model…');
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/health', { cache: 'no-store' });
      const data = (await res.json()) as HealthStatus;
      if (!res.ok || !data.ok) {
        setHealthStatus('offline');
        setHealthMessage(data.error ? `Unavailable: ${data.error}` : 'Local AI is offline');
        return;
      }
      setHealthStatus('online');
      setHealthMessage(`Ready · ${data.model}`);
    } catch {
      setHealthStatus('offline');
      setHealthMessage('Local AI is unreachable');
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      if (healthStatus !== 'online') {
        const nextMessages: Message[] = [...messages, { role: 'user', content: trimmed }];
        setMessages([...nextMessages, { role: 'assistant', content: 'The local AI service is currently unavailable. Please check that Ollama is running and the configured model is installed.' }]);
        setInput('');
        return;
      }

      const nextMessages: Message[] = [...messages, { role: 'user', content: trimmed }];
      setMessages([...nextMessages, { role: 'assistant', content: '' }]);
      setInput('');
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: nextMessages }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let acc = '';

        // Parse the SSE stream: `data: {json}\n\n` frames, `data: [DONE]` ends.
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 2);
            if (!frame.startsWith('data:')) continue;
            const payload = frame.slice(5).trim();
            if (payload === '[DONE]') continue;
            try {
              const obj = JSON.parse(payload) as { delta?: string; error?: string };
              if (obj.error) {
                acc += `\n\n⚠️ ${obj.error}`;
              } else if (obj.delta) {
                acc += obj.delta;
              }
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: acc };
                return copy;
              });
            } catch {
              /* ignore partial frames */
            }
          }
        }

        if (!acc) {
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = {
              role: 'assistant',
              content: "I couldn't reach the local AI service just now. Please try again, or use the contact form and our team will follow up.",
            };
            return copy;
          });
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = {
              role: 'assistant',
              content: 'Sorry — something went wrong reaching the assistant. Please try again.',
            };
            return copy;
          });
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [healthStatus, messages, streaming],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open AI assistant"
        className="fixed bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary-700 text-white shadow-lg transition-transform hover:scale-105 hover:bg-primary-800"
      >
        {open ? <CloseIcon /> : <SparkleIcon />}
      </button>

      {open && (
        <div className="fixed bottom-24 left-6 z-40 flex h-[32rem] w-[22rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 bg-primary-700 px-4 py-3 text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
              <SparkleIcon className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">SLP Assistant</p>
              <p className="text-[11px] text-white/70">
                {healthStatus === 'checking'
                  ? 'Checking local model…'
                  : healthStatus === 'online'
                    ? `Ready · ${healthMessage}`
                    : healthMessage}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-gray-700 shadow-sm">
                  {GREETING}
                </div>
                <div className="space-y-2 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="block w-full rounded-lg border border-primary-200 bg-white px-3 py-2 text-left text-xs text-primary-700 transition-colors hover:bg-primary-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-primary-600 px-3 py-2 text-sm text-white'
                      : 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-gray-800 shadow-sm'
                  }
                >
                  {m.content || (streaming && i === messages.length - 1 ? '▍' : '')}
                </div>
              </div>
            ))}
          </div>

          {/* Composer */}
          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-gray-200 bg-white px-3 py-3">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about our services…"
              className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-800 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
            {streaming ? (
              <button
                type="button"
                onClick={stop}
                aria-label="Stop"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300"
              >
                <span className="block h-3 w-3 rounded-sm bg-gray-600" />
              </button>
            ) : (
              <button
                type="submit"
                aria-label="Send"
                disabled={!input.trim() || healthStatus !== 'online'}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-700 text-white transition-colors hover:bg-primary-800 disabled:opacity-40"
              >
                <SendIcon />
              </button>
            )}
          </form>
        </div>
      )}
    </>
  );
}
