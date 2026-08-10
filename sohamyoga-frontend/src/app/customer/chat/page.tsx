'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import * as signalR from '@microsoft/signalr';
import { customerAuthApi, liveChatApi, ChatMessage, CustomerUser } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

function CustomerChatInner() {
  const searchParams = useSearchParams();
  const initialSession = searchParams.get('session') ?? '';

  const [user, setUser] = useState<CustomerUser | null>(null);
  const [sessionId] = useState(() => initialSession || crypto.randomUUID());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const hubRef = useRef<signalR.HubConnection | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    customerAuthApi.me().then(setUser).catch(() => null);
  }, []);

  // Load history
  useEffect(() => {
    liveChatApi
      .getHistory(sessionId)
      .then(setMessages)
      .catch(() => [])
      .finally(() => setLoading(false));
  }, [sessionId]);

  // SignalR connection
  useEffect(() => {
    const hub = new signalR.HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/chat`, { withCredentials: true })
      .withAutomaticReconnect()
      .build();

    hub.on('ReceiveMessage', (msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    hub
      .start()
      .then(() => {
        setConnected(true);
        return hub.invoke('JoinSession', sessionId, user?.name ?? 'Customer', user?.email ?? '');
      })
      .catch(() => {});

    hubRef.current = hub;
    return () => {
      hub.stop();
    };
  }, [sessionId, user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !hubRef.current || hubRef.current.state !== signalR.HubConnectionState.Connected) return;

    await hubRef.current.invoke(
      'SendMessage',
      sessionId,
      user?.name ?? 'Customer',
      user?.email ?? '',
      input.trim(),
      user?.id ?? null
    );
    setInput('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="max-w-3xl flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Live Chat Support</h1>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${connected ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
          {connected ? 'Connected' : 'Connecting...'}
        </span>
      </div>

      {/* Message list */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-y-auto p-4 space-y-3 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <span className="text-4xl mb-3">💬</span>
            <p className="text-sm">Start the conversation. Our team will reply shortly.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={`${msg.id}-${msg.createdAt}`}
              className={`flex ${msg.isFromAdmin ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm ${
                  msg.isFromAdmin
                    ? 'bg-gray-100 text-gray-800 rounded-tl-sm'
                    : 'bg-blue-600 text-white rounded-tr-sm'
                }`}
              >
                {msg.isFromAdmin && (
                  <p className="text-xs font-semibold text-blue-600 mb-1">{msg.senderName}</p>
                )}
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-xs mt-1 ${msg.isFromAdmin ? 'text-gray-400' : 'text-blue-100'}`}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2">
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a message… (Enter to send)"
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm resize-none"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || !connected}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-5 py-2 rounded-xl font-medium text-sm transition-colors self-end"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default function CustomerChatPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>}>
      <CustomerChatInner />
    </Suspense>
  );
}
