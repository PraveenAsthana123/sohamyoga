'use client';

import { useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { liveChatApi, ChatSession, ChatMessage } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface ActiveSession extends ChatSession {
  isActive?: boolean;
}

export default function AdminLiveChatPage() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const hubRef = useRef<signalR.HubConnection | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load existing sessions from REST
  useEffect(() => {
    liveChatApi
      .getSessions(72)
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoadingSessions(false));
  }, []);

  // SignalR connection for admin
  useEffect(() => {
    const hub = new signalR.HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/chat`, { withCredentials: true })
      .withAutomaticReconnect()
      .build();

    hub.on('ReceiveMessage', (msg: ChatMessage) => {
      // Update session list
      setSessions((prev) => {
        const existing = prev.find((s) => s.sessionId === msg.sessionId);
        if (existing) {
          return prev.map((s) =>
            s.sessionId === msg.sessionId
              ? { ...s, messageCount: s.messageCount + 1, lastMessage: msg.content, lastMessageAt: msg.createdAt, unreadCount: msg.isFromAdmin ? s.unreadCount : s.unreadCount + 1 }
              : s
          );
        }
        return [
          { sessionId: msg.sessionId, customerName: msg.senderName, customerEmail: msg.senderEmail, messageCount: 1, unreadCount: msg.isFromAdmin ? 0 : 1, lastMessage: msg.content, lastMessageAt: msg.createdAt, isActive: true },
          ...prev,
        ];
      });

      // Add to current session messages
      setMessages((prev) => {
        if (selected === msg.sessionId && !prev.some((m) => m.id === msg.id)) {
          return [...prev, msg];
        }
        return prev;
      });
    });

    hub.on('CustomerConnected', (info: { sessionId: string; name: string; email: string }) => {
      setSessions((prev) => {
        if (prev.some((s) => s.sessionId === info.sessionId)) return prev;
        return [
          { sessionId: info.sessionId, customerName: info.name, customerEmail: info.email, messageCount: 0, unreadCount: 0, isActive: true },
          ...prev,
        ];
      });
    });

    hub
      .start()
      .then(() => {
        setConnected(true);
        return hub.invoke('JoinAdminRoom');
      })
      .catch(() => {});

    hubRef.current = hub;
    return () => { hub.stop(); };
  }, [selected]);

  // Load messages when selecting a session
  const selectSession = async (sessionId: string) => {
    setSelected(sessionId);
    setMessages([]);
    try {
      const history = await liveChatApi.getHistory(sessionId);
      setMessages(history);
      // Mark as read
      if (hubRef.current?.state === signalR.HubConnectionState.Connected) {
        await hubRef.current.invoke('MarkRead', sessionId);
      }
      setSessions((prev) => prev.map((s) => s.sessionId === sessionId ? { ...s, unreadCount: 0 } : s));
    } catch {
      // Session load failure handled silently
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendReply = async () => {
    if (!input.trim() || !selected || !hubRef.current || hubRef.current.state !== signalR.HubConnectionState.Connected) return;
    await hubRef.current.invoke('AdminReply', selected, 'Support Team', input.trim());
    setInput('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
  };

  const selectedSession = sessions.find((s) => s.sessionId === selected);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Live Chat</h1>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-yellow-400'}`} />
          <span className="text-sm text-gray-500">{connected ? 'Listening for chats' : 'Connecting…'}</span>
        </div>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Session list */}
        <div className="w-72 bg-white rounded-xl border border-gray-200 flex flex-col min-h-0">
          <div className="p-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">Recent Sessions</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingSessions ? (
              <div className="flex items-center justify-center h-20">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-center text-sm text-gray-400 p-4">No chat sessions yet</p>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.sessionId}
                  onClick={() => selectSession(s.sessionId)}
                  className={`w-full text-left px-3 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selected === s.sessionId ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{s.customerName}</p>
                      <p className="text-xs text-gray-400 truncate">{s.customerEmail}</p>
                      {s.lastMessage && (
                        <p className="text-xs text-gray-500 truncate mt-1">{s.lastMessage}</p>
                      )}
                    </div>
                    {s.unreadCount > 0 && (
                      <span className="ml-2 shrink-0 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {s.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-h-0">
          {selected ? (
            <>
              <div className="bg-white rounded-t-xl border border-gray-200 border-b-0 px-4 py-3">
                <p className="font-semibold text-gray-800">{selectedSession?.customerName}</p>
                <p className="text-xs text-gray-400">{selectedSession?.customerEmail}</p>
              </div>

              <div className="flex-1 bg-white border border-gray-200 border-t-0 overflow-y-auto p-4 space-y-2 bg-gray-50 min-h-0">
                {messages.map((msg) => (
                  <div key={`${msg.id}-${msg.createdAt}`} className={`flex ${msg.isFromAdmin ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-xl text-sm ${msg.isFromAdmin ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
                      {!msg.isFromAdmin && <p className="text-xs font-semibold text-blue-600 mb-0.5">{msg.senderName}</p>}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <p className={`text-xs mt-1 ${msg.isFromAdmin ? 'text-blue-100' : 'text-gray-400'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <div className="bg-white border border-gray-200 border-t rounded-b-xl p-2 flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Reply to customer…"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <button
                  onClick={sendReply}
                  disabled={!input.trim() || !connected}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 bg-white rounded-xl border border-gray-200 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <p className="text-4xl mb-3">💬</p>
                <p className="text-sm">Select a session to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
