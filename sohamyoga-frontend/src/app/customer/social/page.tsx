'use client';
// /customer/social — "Follow us" status page. Previously showed hardcoded
// fake "connected, 1,240 followers" data with a setTimeout-simulated fake
// OAuth flow that called no real backend (no Postiz client exists in this
// codebase). Rewired to real state: connecting the studio's own social
// accounts is a staff operation (see /admin/social/provisioning, backed by
// a real provisioning-job state machine and Skyvern-assisted browser
// automation), so this page is read-only and honestly reports "not
// connected yet" until a real account-provisioning job actually reaches
// ACTIVE.

import { useEffect, useState } from 'react';

interface PlatformStatus {
  platform: string;
  businessUse: string | null;
  connected: boolean;
  accountName: string | null;
  profileUrl: string | null;
}

const LABELS: Record<string, string> = {
  facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', youtube: 'YouTube',
  telegram: 'Telegram', x_twitter: 'X', tiktok: 'TikTok', discord: 'Discord', bluesky: 'Bluesky',
  reddit: 'Reddit', pinterest: 'Pinterest', threads: 'Threads', whatsapp_business: 'WhatsApp Business',
  snapchat: 'Snapchat', twitch: 'Twitch', medium: 'Medium', substack: 'Substack', quora_manual: 'Quora',
  tumblr: 'Tumblr', mastodon: 'Mastodon', github: 'GitHub', gitlab: 'GitLab', stack_overflow: 'Stack Overflow',
  google_business: 'Google Business Profile', yelp: 'Yelp', tripadvisor: 'Tripadvisor', trustpilot: 'Trustpilot',
  vimeo: 'Vimeo', dailymotion: 'Dailymotion', spotify: 'Spotify', apple_podcasts: 'Apple Podcasts',
  soundcloud: 'SoundCloud', patreon: 'Patreon', slack: 'Slack', dribbble: 'Dribbble',
};

export default function CustomerSocialPage() {
  const [platforms, setPlatforms] = useState<PlatformStatus[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/customer/social/status', { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setPlatforms(d.platforms); })
      .catch(e => setError(e.message));
  }, []);

  const connected = platforms?.filter(p => p.connected) ?? [];
  const notYet = platforms?.filter(p => !p.connected) ?? [];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Follow Us</h1>
        <p className="text-gray-500 text-sm mt-1">
          Where our studio is genuinely live right now. Connecting new channels is handled by our team, not from this page.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {platforms && (
        <>
          {connected.length > 0 && (
            <div className="mb-6 space-y-2">
              <h2 className="text-sm font-semibold text-gray-600">Live now</h2>
              {connected.map(p => (
                <a key={p.platform} href={p.profileUrl ?? '#'} target="_blank" rel="noreferrer"
                  className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3 text-sm hover:bg-green-100">
                  <span className="font-medium text-gray-800">{LABELS[p.platform] ?? p.platform}</span>
                  <span className="text-xs text-green-700">{p.accountName}</span>
                </a>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-600">Not connected yet</h2>
            {notYet.map(p => (
              <div key={p.platform} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 text-sm">
                <span className="text-gray-700">{LABELS[p.platform] ?? p.platform}</span>
                {p.businessUse && <span className="text-xs text-gray-400">{p.businessUse}</span>}
              </div>
            ))}
            {!notYet.length && !connected.length && <p className="text-sm text-gray-400">No channels configured yet.</p>}
          </div>
        </>
      )}
    </div>
  );
}
