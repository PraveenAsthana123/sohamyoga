'use client';
// /customer/social — Customer connects their own social accounts.
// Uses YOUR developer app credentials (transparent to customer).
// OAuth flow via Postiz — customer logs into their own Facebook/Instagram/etc.
// Their access token stored encrypted in Postiz DB. You never see their password.

import { useState } from 'react';

interface PlatformCard {
  key:         string;
  label:       string;
  icon:        string;
  color:       string;
  description: string;
  status:      'connected' | 'not_connected' | 'expired' | 'pending';
  handle?:     string;
  followers?:  number;
}

// In production: fetched from /api/customer/social/connections?tenantId=...
const DEMO_PLATFORMS: PlatformCard[] = [
  { key: 'facebook',  label: 'Facebook',  icon: 'f',  color: 'bg-blue-50 border-blue-200',  description: 'Post to your Facebook Page', status: 'connected',     handle: 'My Yoga Page',   followers: 1240 },
  { key: 'instagram', label: 'Instagram', icon: 'Ig', color: 'bg-pink-50 border-pink-200',   description: 'Share photos & reels',       status: 'connected',     handle: '@myyogastudio', followers: 3800 },
  { key: 'linkedin',  label: 'LinkedIn',  icon: 'In', color: 'bg-blue-50 border-blue-300',   description: 'Professional updates',       status: 'expired',       handle: 'My Yoga Co.' },
  { key: 'youtube',   label: 'YouTube',   icon: 'YT', color: 'bg-red-50 border-red-200',     description: 'Upload class recordings',    status: 'not_connected' },
  { key: 'telegram',  label: 'Telegram',  icon: 'Tg', color: 'bg-sky-50 border-sky-200',     description: 'Broadcast to your channel',  status: 'connected',     handle: 'My Yoga Channel', followers: 420 },
  { key: 'x',         label: 'X',         icon: 'X',  color: 'bg-gray-50 border-gray-200',   description: 'Short updates & threads',    status: 'not_connected' },
  { key: 'tiktok',    label: 'TikTok',    icon: 'Tk', color: 'bg-pink-50 border-pink-300',   description: 'Short yoga videos',          status: 'not_connected' },
  { key: 'discord',   label: 'Discord',   icon: 'Di', color: 'bg-indigo-50 border-indigo-200', description: 'Community server',          status: 'not_connected' },
  { key: 'bluesky',   label: 'Bluesky',   icon: 'Bk', color: 'bg-blue-50 border-blue-200',   description: 'Decentralized microblogging', status: 'not_connected' },
  { key: 'reddit',    label: 'Reddit',    icon: 'Re', color: 'bg-orange-50 border-orange-200', description: 'Post to yoga subreddits',  status: 'not_connected' },
  { key: 'pinterest', label: 'Pinterest', icon: 'Pi', color: 'bg-rose-50 border-rose-200',   description: 'Visual pins & boards',       status: 'not_connected' },
  { key: 'threads',   label: 'Threads',   icon: 'Th', color: 'bg-gray-50 border-gray-300',   description: 'Meta conversation platform', status: 'not_connected' },
];

export default function CustomerSocialPage() {
  const [platforms, setPlatforms] = useState<PlatformCard[]>(DEMO_PLATFORMS);
  const [connecting, setConnecting] = useState<string | null>(null);

  const connected    = platforms.filter(p => p.status === 'connected').length;
  const expired      = platforms.filter(p => p.status === 'expired').length;

  async function handleConnect(platform: PlatformCard) {
    if (platform.status === 'connected') return;
    setConnecting(platform.key);

    try {
      // In production: POST /api/customer/social/connect { provider: platform.key }
      // Returns { authUrl: "https://..." }
      // window.location.href = authUrl  ← redirects to platform's OAuth page
      // On return, Postiz stores the token; we redirect back to this page

      // Demo: simulate OAuth success after 1.5s
      await new Promise(r => setTimeout(r, 1500));
      setPlatforms(prev => prev.map(p =>
        p.key === platform.key
          ? { ...p, status: 'connected', handle: `@my_${p.key}_account` }
          : p,
      ));
    } finally {
      setConnecting(null);
    }
  }

  async function handleDisconnect(key: string) {
    if (!confirm('Disconnect this account? Scheduled posts to this platform will be cancelled.')) return;
    // In production: DELETE /api/customer/social/connect/{ provider }
    setPlatforms(prev => prev.map(p =>
      p.key === key ? { ...p, status: 'not_connected', handle: undefined, followers: undefined } : p,
    ));
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Connect Your Social Accounts</h1>
        <p className="text-gray-500 text-sm mt-1">
          Connect your existing social accounts to schedule posts, track performance, and manage your content calendar. Your passwords are never stored here — you authorize via each platform's secure login.
        </p>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex-1">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{connected} of {platforms.length} connected</span>
            {expired > 0 && <span className="text-amber-600">{expired} need re-authorization</span>}
          </div>
          <div className="bg-gray-200 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${(connected / platforms.length) * 100}%` }} />
          </div>
        </div>
        {expired > 0 && (
          <button
            onClick={() => platforms.filter(p => p.status === 'expired').forEach(p => handleConnect(p))}
            className="text-xs bg-amber-100 text-amber-800 px-3 py-1.5 rounded hover:bg-amber-200 whitespace-nowrap"
          >
            Re-authorize all expired
          </button>
        )}
      </div>

      {/* Privacy note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-sm text-blue-800">
        <span className="font-medium">Your privacy: </span>
        When you click Connect, you are redirected to that platform to log in with your own credentials. We receive only a permission token to post on your behalf. We never see your password. You can revoke access at any time from the platform's settings.
      </div>

      {/* Platform cards */}
      <div className="grid grid-cols-1 gap-3">
        {platforms.map(p => (
          <div key={p.key} className={`border rounded-lg p-4 flex items-center gap-4 ${p.color}`}>
            {/* Icon */}
            <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-sm font-bold text-gray-700 shrink-0">
              {p.icon}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{p.label}</span>
                {p.status === 'connected' && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Connected</span>
                )}
                {p.status === 'expired' && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Re-authorization needed</span>
                )}
              </div>
              <div className="text-sm text-gray-500">{p.description}</div>
              {p.handle && (
                <div className="text-xs text-gray-400 mt-0.5">
                  {p.handle}{p.followers ? ` · ${p.followers.toLocaleString()} followers` : ''}
                </div>
              )}
            </div>

            {/* Action */}
            {p.status === 'connected' ? (
              <button
                onClick={() => handleDisconnect(p.key)}
                className="text-xs text-red-500 hover:underline whitespace-nowrap"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={() => handleConnect(p)}
                disabled={connecting === p.key}
                className={`text-sm px-4 py-2 rounded font-medium whitespace-nowrap transition-colors ${
                  p.status === 'expired'
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } disabled:opacity-50`}
              >
                {connecting === p.key ? 'Opening…' : p.status === 'expired' ? 'Re-authorize' : 'Connect'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
