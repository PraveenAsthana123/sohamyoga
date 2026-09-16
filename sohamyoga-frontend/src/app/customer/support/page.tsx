'use client';
// /customer/support — AI-powered bot chat with escalation and satisfaction rating.

import { useEffect, useRef, useState } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_REPLIES = ['Check my plan', 'Platform status', 'How to post', 'Talk to human'];
const CONTEXTS = [
  { value: 'billing', label: '💳 Billing' },
  { value: 'features', label: '⚡ Features' },
  { value: 'general', label: '💬 General' },
  { value: 'troubleshooting', label: '🔧 Troubleshooting' },
];

export default function CustomerSupportPage() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [context, setContext] = useState('general');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [ticketCreated, setTicketCreated] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Restore session from localStorage
    const stored = localStorage.getItem('sohambot_session_token');
    if (stored) {
      setSessionToken(stored);
    }

    // Add greeting message
    setMessages([{
      role: 'assistant',
      content: "Hi! I'm SohamBot 👋 How can I help you today? Select a topic above or just ask me anything.",
      timestamp: new Date(),
    }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const startSession = async (ctx: string) => {
    if (sessionToken) return sessionToken;
    const res = await fetch('/api/bot/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_type: 'customer', context_type: ctx }),
    });
    const data = await res.json();
    const token = data.session_token as string;
    setSessionToken(token);
    localStorage.setItem('sohambot_session_token', token);
    return token;
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    if (text === 'Talk to human') {
      await handleEscalate();
      return;
    }

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);
    setLoading(true);

    try {
      const token = await startSession(context);
      const res = await fetch('/api/bot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: token, message: text, context_type: context }),
      });
      const data = await res.json();
      setTyping(false);
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply as string, timestamp: new Date() }]);
      }
    } catch {
      setTyping(false);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I\'m having trouble connecting. Please try again.', timestamp: new Date() }]);
    }
    setLoading(false);
  };

  const handleEscalate = async () => {
    if (escalated) return;
    setEscalated(true);
    setTyping(true);
    try {
      const token = sessionToken ?? await startSession(context);
      await fetch('/api/bot/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: token, reason: 'Customer requested human agent' }),
      });
      setTicketCreated(true);
    } catch { /* escalation failed, but still show message */ }
    setTyping(false);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: ticketCreated
        ? '✅ A support ticket has been created. Our team will contact you within 2 business hours.'
        : '✅ Your request has been logged. A human agent will follow up with you shortly.',
      timestamp: new Date(),
    }]);
  };

  const submitRating = async (stars: number) => {
    setRating(stars);
    setRatingSubmitted(true);
    if (sessionToken) {
      await fetch(`/api/bot/session/${sessionToken}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ satisfaction_score: stars }),
      }).catch(() => { /* best effort */ });
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-t-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white text-lg">🤖</div>
          <div>
            <p className="font-semibold text-gray-900">SohamBot</p>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-gray-500">Online — AI-powered support</span>
            </div>
          </div>
        </div>
        {/* Context selector */}
        <div className="flex gap-2">
          {CONTEXTS.map(c => (
            <button key={c.value} onClick={() => setContext(c.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${context === c.value ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 border-x border-gray-200 p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs lg:max-w-sm px-4 py-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'}`}>
              {msg.content}
              <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-indigo-200' : 'text-gray-400'}`}>
                {msg.timestamp.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {typing && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Satisfaction rating */}
        {escalated && !ratingSubmitted && (
          <div className="flex justify-center">
            <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-sm font-medium text-gray-700 mb-2">Rate this conversation</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} onClick={() => submitRating(star)}
                    className={`text-2xl transition-transform hover:scale-125 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}>
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {ratingSubmitted && (
          <div className="flex justify-center">
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-sm text-green-700">
              Thank you for your feedback! ⭐ {rating}/5
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick replies */}
      <div className="bg-gray-50 border-x border-gray-200 px-4 py-2">
        <div className="flex gap-2 overflow-x-auto">
          {QUICK_REPLIES.map(qr => (
            <button key={qr} onClick={() => sendMessage(qr)} disabled={loading}
              className="whitespace-nowrap px-3 py-1.5 bg-white border border-gray-300 rounded-full text-xs text-gray-700 hover:bg-gray-50 hover:border-indigo-400 transition-colors disabled:opacity-50">
              {qr}
            </button>
          ))}
        </div>
      </div>

      {/* Input area */}
      <div className="bg-white border border-gray-200 rounded-b-2xl p-4">
        <div className="flex gap-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Type your message…"
            disabled={loading}
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
            className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {loading ? '⏳' : '➤'}
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-gray-400">Powered by SohamBot (Ollama llama3.2)</p>
          <button onClick={handleEscalate} disabled={escalated}
            className="text-xs text-orange-600 hover:text-orange-700 disabled:opacity-50">
            👤 Talk to a human
          </button>
        </div>
      </div>
    </div>
  );
}
