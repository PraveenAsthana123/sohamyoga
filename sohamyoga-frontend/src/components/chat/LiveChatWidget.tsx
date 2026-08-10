'use client';

import { useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface Message {
  id: string;
  content: string;
  isFromAdmin: boolean;
  senderName: string;
  createdAt: Date;
}

export default function LiveChatWidget() {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<'form' | 'chat'>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [connected, setConnected] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const hubRef = useRef<signalR.HubConnection | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Start SignalR connection once user submits the intro form
  const startChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    const hub = new signalR.HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/chat`, { withCredentials: true })
      .withAutomaticReconnect()
      .build();

    hub.on('ReceiveMessage', (msg: { id: number; content: string; isFromAdmin: boolean; senderName: string; createdAt: string }) => {
      setMessages((prev) => {
        const key = `${msg.id}-${msg.createdAt}`;
        if (prev.some((m) => m.id === key)) return prev;
        return [
          ...prev,
          { id: key, content: msg.content, isFromAdmin: msg.isFromAdmin, senderName: msg.senderName, createdAt: new Date(msg.createdAt) },
        ];
      });
    });

    try {
      await hub.start();
      await hub.invoke('JoinSession', sessionId, name.trim(), email.trim());
      setConnected(true);
      hubRef.current = hub;

      // Welcome message
      setMessages([
        {
          id: 'welcome',
          content: `Hi ${name.split(' ')[0]}! 👋 Thanks for reaching out. Our team will be with you shortly.`,
          isFromAdmin: true,
          senderName: 'SohamYoga Support',
          createdAt: new Date(),
        },
      ]);
      setStage('chat');
    } catch {
      // Connection failure handled silently — user sees "Connecting..." status
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      hubRef.current?.stop();
    };
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || !hubRef.current || hubRef.current.state !== signalR.HubConnectionState.Connected) return;

    await hubRef.current.invoke('SendMessage', sessionId, name, email, input.trim(), null);
    setInput('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Chat window */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ height: '480px' }}>
          {/* Header */}
          <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-white font-semibold text-sm">SohamYoga Support</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-yellow-400'}`} />
                <span className="text-blue-100 text-xs">{connected ? 'Online' : 'Connecting…'}</span>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white hover:text-blue-200 transition-colors text-xl leading-none">
              &times;
            </button>
          </div>

          {/* Body */}
          {stage === 'form' ? (
            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-gray-600 text-sm mb-5">
                Chat with our team in real time. Enter your details to get started.
              </p>
              <form onSubmit={startChat} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Your Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="you@company.com"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors mt-1"
                >
                  Start Chat
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.isFromAdmin ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                        msg.isFromAdmin
                          ? 'bg-white border border-gray-200 text-gray-800'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      {msg.isFromAdmin && (
                        <p className="text-xs font-semibold text-blue-600 mb-0.5">{msg.senderName}</p>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="border-t border-gray-200 p-2 flex gap-2 bg-white">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Type a message…"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || !connected}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                >
                  ➤
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-50 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl transition-colors"
        aria-label="Open live chat"
      >
        {open ? '✕' : '💬'}
      </button>
    </>
  );
}
