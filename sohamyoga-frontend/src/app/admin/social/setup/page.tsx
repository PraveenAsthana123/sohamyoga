'use client';
// /admin/social/setup — One-time developer app credential setup per platform.
// You (the portal owner) fill this in ONCE. Your 100+ customers then connect
// their own accounts via OAuth using these credentials — they never see or touch
// these values.
//
// SECURITY MODEL:
//   App ID   → stored in .env (not secret, just identity)
//   App Secret → POST /api/social/setup sends to OpenBao; never stored in browser

import { useState, useCallback } from 'react';

interface PlatformDef {
  key:              string;
  label:            string;
  icon:             string;
  color:            string;
  idVar:            string;
  secretVar:        string;
  idLabel:          string;
  reviewRequired:   boolean;
  setupUrl:         string;
  redirectPath:     string;
  steps:            string[];
  note?:            string;
}

const PLATFORMS: PlatformDef[] = [
  {
    key: 'telegram', label: 'Telegram', icon: 'Tg', color: 'bg-sky-100 text-sky-700',
    idVar: 'TELEGRAM_BOT_TOKEN', secretVar: '', idLabel: 'Bot Token (from @BotFather)',
    reviewRequired: false, setupUrl: 'Open Telegram → @BotFather',
    redirectPath: '', // Bot token — no redirect needed
    steps: ['Open Telegram app', 'Search @BotFather', 'Send /newbot', 'Enter bot name & username', 'Copy token'],
  },
  {
    key: 'discord', label: 'Discord', icon: 'Di', color: 'bg-indigo-100 text-indigo-700',
    idVar: 'DISCORD_CLIENT_ID', secretVar: 'DISCORD_CLIENT_SECRET', idLabel: 'Application ID',
    reviewRequired: false, setupUrl: 'discord.com/developers/applications',
    redirectPath: '/api/socials/discord/callback',
    steps: ['New Application', 'Bot tab → Add Bot', 'OAuth2 tab → add redirect URI', 'Copy Client ID + Secret'],
  },
  {
    key: 'bluesky', label: 'Bluesky', icon: 'Bk', color: 'bg-blue-100 text-blue-700',
    idVar: 'BLUESKY_APP_PASSWORD', secretVar: '', idLabel: 'App Password (not your main password)',
    reviewRequired: false, setupUrl: 'bsky.app → Settings → App Passwords',
    redirectPath: '',
    steps: ['Log in to bsky.app', 'Settings → Privacy → App Passwords', 'Add App Password → name it "Postiz"', 'Copy generated password'],
    note: 'Uses App Password, not OAuth. Does not grant access to your main account.',
  },
  {
    key: 'reddit', label: 'Reddit', icon: 'Re', color: 'bg-orange-100 text-orange-700',
    idVar: 'REDDIT_CLIENT_ID', secretVar: 'REDDIT_CLIENT_SECRET', idLabel: 'Client ID',
    reviewRequired: false, setupUrl: 'reddit.com/prefs/apps',
    redirectPath: '/api/socials/reddit/callback',
    steps: ['"create another app"', 'Type: web app', 'Add redirect URI', 'Copy Client ID (under app name) + Secret'],
  },
  {
    key: 'youtube', label: 'YouTube', icon: 'YT', color: 'bg-red-100 text-red-700',
    idVar: 'YOUTUBE_CLIENT_ID', secretVar: 'YOUTUBE_CLIENT_SECRET', idLabel: 'OAuth Client ID',
    reviewRequired: false, setupUrl: 'console.cloud.google.com',
    redirectPath: '/api/socials/youtube/callback',
    steps: ['New project', 'Enable YouTube Data API v3', 'OAuth consent screen → External', 'Create OAuth 2.0 Client ID → Web app', 'Copy Client ID + Secret'],
  },
  {
    key: 'pinterest', label: 'Pinterest', icon: 'Pi', color: 'bg-rose-100 text-rose-700',
    idVar: 'PINTEREST_CLIENT_ID', secretVar: 'PINTEREST_CLIENT_SECRET', idLabel: 'App ID',
    reviewRequired: false, setupUrl: 'developers.pinterest.com',
    redirectPath: '/api/socials/pinterest/callback',
    steps: ['Create App', 'Add redirect URI', 'Copy App ID + Secret'],
  },
  {
    key: 'facebook', label: 'Facebook Pages', icon: 'Fb', color: 'bg-blue-100 text-blue-800',
    idVar: 'FACEBOOK_APP_ID', secretVar: 'FACEBOOK_APP_SECRET', idLabel: 'App ID',
    reviewRequired: true, setupUrl: 'developers.facebook.com',
    redirectPath: '/api/socials/facebook/callback',
    steps: ['Create App → Business', 'Add Facebook Login + Instagram Graph API products', 'Add redirect URI', 'Submit App Review for pages_manage_posts permission', 'Copy App ID + App Secret'],
    note: 'Instagram and Threads share this same App ID/Secret — no separate app needed.',
  },
  {
    key: 'linkedin', label: 'LinkedIn', icon: 'In', color: 'bg-blue-100 text-blue-900',
    idVar: 'LINKEDIN_CLIENT_ID', secretVar: 'LINKEDIN_CLIENT_SECRET', idLabel: 'Client ID',
    reviewRequired: true, setupUrl: 'linkedin.com/developers',
    redirectPath: '/api/socials/linkedin/callback',
    steps: ['Create App → attach Company Page', 'Request "Share on LinkedIn" product (approval required)', 'Add redirect URI', 'Copy Client ID + Secret'],
    note: 'Marketing API approval required — not instant. Apply early.',
  },
  {
    key: 'x', label: 'X (Twitter)', icon: 'X', color: 'bg-gray-100 text-gray-800',
    idVar: 'X_CLIENT_ID', secretVar: 'X_CLIENT_SECRET', idLabel: 'Client ID',
    reviewRequired: false, setupUrl: 'developer.twitter.com',
    redirectPath: '/api/socials/x/callback',
    steps: ['Create Project + App', 'User Auth Settings → OAuth 2.0 → Web App', 'Add redirect URI', 'Scopes: tweet.read tweet.write users.read offline.access', 'Copy Client ID + Secret'],
  },
  {
    key: 'tiktok', label: 'TikTok', icon: 'Tk', color: 'bg-pink-100 text-pink-700',
    idVar: 'TIKTOK_CLIENT_ID', secretVar: 'TIKTOK_CLIENT_SECRET', idLabel: 'Client Key',
    reviewRequired: true, setupUrl: 'developers.tiktok.com',
    redirectPath: '/api/socials/tiktok/callback',
    steps: ['Create App', 'Add Content Posting API product', 'Add redirect URI', 'Submit for app review', 'Copy Client Key + Secret'],
    note: 'Requires TikTok app review — can take weeks. Apply early.',
  },
];

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface FieldValues { appId: string; appSecret: string; }

export default function SocialSetupPage() {
  const [expanded, setExpanded]   = useState<string | null>('telegram');
  const [values, setValues]       = useState<Record<string, FieldValues>>({});
  const [status, setStatus]       = useState<Record<string, SaveStatus>>({});
  const [configured, setConfigured] = useState<Record<string, boolean>>({});

  const toggle = useCallback((key: string) => {
    setExpanded(e => e === key ? null : key);
  }, []);

  const save = useCallback(async (p: PlatformDef) => {
    const v = values[p.key];
    if (!v?.appId) return;
    setStatus(s => ({ ...s, [p.key]: 'saving' }));
    try {
      const res = await fetch('/api/social/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: p.key, appId: v.appId, appSecret: v.appSecret ?? '' }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus(s => ({ ...s, [p.key]: 'saved' }));
      setConfigured(c => ({ ...c, [p.key]: true }));
    } catch {
      setStatus(s => ({ ...s, [p.key]: 'error' }));
    }
  }, [values]);

  const reviewNeeded = PLATFORMS.filter(p => p.reviewRequired);
  const reviewFree   = PLATFORMS.filter(p => !p.reviewRequired);
  const configuredCount = Object.values(configured).filter(Boolean).length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Social Platform Setup</h1>
        <p className="text-gray-500 text-sm mt-1">
          Enter your developer app credentials once. Your customers then connect their own accounts via OAuth — they never see these values.
        </p>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="font-semibold text-blue-800 mb-2">How multi-tenant OAuth works</div>
        <div className="grid grid-cols-3 gap-4 text-sm text-blue-700">
          <div className="bg-white rounded p-3 border border-blue-100">
            <div className="font-medium mb-1">Step 1 — You do this once</div>
            Create a developer app on each platform. Enter the App ID + Secret here. Secrets saved to OpenBao.
          </div>
          <div className="bg-white rounded p-3 border border-blue-100">
            <div className="font-medium mb-1">Step 2 — Customer clicks Connect</div>
            Each of your 100+ customers clicks "Connect Facebook" in their portal settings. OAuth flow uses your app credentials.
          </div>
          <div className="bg-white rounded p-3 border border-blue-100">
            <div className="font-medium mb-1">Step 3 — Postiz stores their token</div>
            Customer grants permission. Their access token stored encrypted in Postiz DB. You never see their password.
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 bg-gray-100 rounded-full h-2">
          <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${(configuredCount / PLATFORMS.length) * 100}%` }} />
        </div>
        <span className="text-sm text-gray-600 whitespace-nowrap">{configuredCount} / {PLATFORMS.length} configured</span>
      </div>

      {/* Start here — no review needed */}
      <div className="mb-2">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Start here — no review required</div>
        <div className="space-y-2">
          {reviewFree.map(p => (
            <PlatformCard
              key={p.key} platform={p} expanded={expanded === p.key}
              onToggle={() => toggle(p.key)} value={values[p.key]}
              onChange={v => setValues(prev => ({ ...prev, [p.key]: v }))}
              onSave={() => save(p)} saveStatus={status[p.key] ?? 'idle'}
              isConfigured={!!configured[p.key]}
            />
          ))}
        </div>
      </div>

      {/* Review required */}
      <div className="mt-6">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Requires app review — apply early</div>
        <div className="space-y-2">
          {reviewNeeded.map(p => (
            <PlatformCard
              key={p.key} platform={p} expanded={expanded === p.key}
              onToggle={() => toggle(p.key)} value={values[p.key]}
              onChange={v => setValues(prev => ({ ...prev, [p.key]: v }))}
              onSave={() => save(p)} saveStatus={status[p.key] ?? 'idle'}
              isConfigured={!!configured[p.key]}
            />
          ))}
        </div>
      </div>

      {/* Security note */}
      <div className="mt-8 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <span className="font-semibold">Security: </span>
        App IDs are safe identifiers — not secret. App Secrets are sent via HTTPS to <code>/api/social/setup</code> which writes them to OpenBao at <code>sohamyoga-portal/&lt;platform&gt;</code>. They are never stored in the browser, git, or logs.
      </div>
    </div>
  );
}

function PlatformCard({
  platform, expanded, onToggle, value, onChange, onSave, saveStatus, isConfigured,
}: {
  platform:     PlatformDef;
  expanded:     boolean;
  onToggle:     () => void;
  value?:       FieldValues;
  onChange:     (v: FieldValues) => void;
  onSave:       () => void;
  saveStatus:   SaveStatus;
  isConfigured: boolean;
}) {
  const hasId     = !!value?.appId;
  const needSecret = !!platform.secretVar;
  const canSave   = hasId && (needSecret ? !!value?.appSecret : true) && saveStatus !== 'saving';
  const redirectUrl = platform.redirectPath
    ? `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}${platform.redirectPath}`
    : null;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header row */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${platform.color}`}>
          {platform.icon}
        </span>
        <span className="font-medium text-gray-900 flex-1">{platform.label}</span>
        {platform.reviewRequired && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Review required</span>
        )}
        {isConfigured && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Configured</span>
        )}
        <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
          {/* Steps */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Setup steps</div>
            <ol className="text-sm text-gray-700 space-y-1">
              {platform.steps.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-gray-400 font-medium w-4 shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <a
              href={`https://${platform.setupUrl}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:underline"
            >
              Open {platform.setupUrl} →
            </a>
          </div>

          {/* Redirect URI to copy */}
          {redirectUrl && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Redirect URI (paste into developer portal)</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white border border-gray-200 rounded px-3 py-1.5 text-xs text-gray-700 select-all">
                  {redirectUrl}
                </code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(redirectUrl)}
                  className="text-xs bg-white border border-gray-200 rounded px-2 py-1.5 hover:bg-gray-100"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          {/* Credential inputs */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                {platform.idLabel} <span className="text-gray-400">({platform.idVar})</span>
              </label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-white"
                placeholder={`Paste ${platform.idLabel}`}
                value={value?.appId ?? ''}
                onChange={e => onChange({ appId: e.target.value, appSecret: value?.appSecret ?? '' })}
              />
            </div>

            {platform.secretVar && (
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  App Secret <span className="text-gray-400">({platform.secretVar}) — saved to OpenBao, never stored here</span>
                </label>
                <input
                  type="password"
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-white"
                  placeholder="Paste App Secret"
                  value={value?.appSecret ?? ''}
                  onChange={e => onChange({ appId: value?.appId ?? '', appSecret: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
            )}
          </div>

          {platform.note && (
            <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded p-2">{platform.note}</div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!canSave}
              onClick={onSave}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                canSave
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {saveStatus === 'saving' ? 'Saving…' : 'Save to OpenBao'}
            </button>
            {saveStatus === 'saved' && <span className="text-sm text-green-600">Saved. Restart Postiz to apply.</span>}
            {saveStatus === 'error'  && <span className="text-sm text-red-600">Save failed — check OpenBao is running.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
