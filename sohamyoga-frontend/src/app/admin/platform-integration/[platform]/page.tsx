'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';

// ── Constants ──────────────────────────────────────────────────────────────

const PLATFORM_EMOJIS: Record<string, string> = {
  facebook: '📘', instagram: '📸', twitter: '🐦', linkedin: '💼',
  youtube: '▶️', tiktok: '🎵', pinterest: '📌', snapchat: '👻',
  whatsapp: '💬', telegram: '✈️', reddit: '🤖', github: '🐙',
  gitlab: '🦊', slack: '💬', discord: '🎮', stripe: '💳',
  shopify: '🛍️', google: '🔍', microsoft: '🪟', apple: '🍎',
  amazon: '📦', twitch: '🎮', spotify: '🎧', medium: '📝',
  substack: '📧', patreon: '🎨', mailchimp: '🐒', hubspot: '🔶',
  salesforce: '☁️', zendesk: '🎫', intercom: '💬', typeform: '📋',
  notion: '📓', airtable: '🗃️', zapier: '⚡', make: '🔧',
};

const WEBHOOK_EVENTS: Record<string, string[]> = {
  facebook: ['messages', 'feed', 'mention', 'page', 'leadgen', 'ad_account'],
  instagram: ['messages', 'comments', 'mentions', 'story_insights'],
  whatsapp: ['messages', 'message_status', 'account_alerts'],
  twitter: ['tweet_create', 'direct_message', 'follow', 'mention'],
  linkedin: ['share_statistics', 'organization_events'],
  youtube: ['new_video', 'comment', 'subscription'],
  github: ['push', 'pull_request', 'issues', 'release', 'star'],
  gitlab: ['push', 'merge_request', 'issue', 'pipeline'],
  stripe: ['payment_intent', 'invoice', 'subscription'],
  shopify: ['order_created', 'order_paid', 'product_updated'],
  default: ['post_created', 'comment_received', 'mention', 'new_follower'],
};

const SYSTEM_ACCOUNT_TYPES: Record<string, string[]> = {
  facebook: ['Business Manager System User', 'Page Access Token', 'Ad Account'],
  instagram: ['Business Account', 'System User'],
  linkedin: ['Organization Admin', 'Partner App'],
  twitter: ['Developer App', 'OAuth 2.0 Client'],
  youtube: ['Service Account', 'OAuth Client'],
  github: ['GitHub App', 'Personal Access Token', 'Organization Bot'],
  gitlab: ['Project Access Token', 'Group Access Token', 'Service Account'],
  google: ['Service Account', 'OAuth Client'],
  default: ['API Key', 'Service Account', 'OAuth Client'],
};

// ── Types ──────────────────────────────────────────────────────────────────

interface PlatformDetail {
  id: number | null;
  platform: string;
  display_name: string;
  category: string;
  is_enabled: boolean;
  integration_mode: string;
  rate_limit_strategy: string;
  retry_enabled: boolean;
  retry_max_attempts: number;
  retry_backoff_seconds: number;
  sandbox_mode: boolean;
  debug_mode: boolean;
  auto_refresh_tokens: boolean;
  webhook_secret: string | null;
  notes: string | null;
  updated_at: string | null;
}

interface SystemAccount {
  id: number;
  platform: string;
  account_type: string;
  account_label: string | null;
  system_user_id: string | null;
  app_id: string | null;
  scopes_granted: string | null;
  token_env_var: string | null;
  token_expires_at: string | null;
  token_last_refreshed_at: string | null;
  token_status: string;
  is_primary: boolean;
  notes: string | null;
}

interface Webhook {
  id: number;
  platform: string;
  webhook_url: string | null;
  events: string | null;
  is_active: boolean;
  verified: boolean;
  verify_token: string | null;
  last_event_at: string | null;
  event_count: number;
}

interface CustomerToggle {
  customer_id: number;
  is_enabled: boolean;
  enabled_by: string;
  enabled_at: string;
}

// ── Helper Components ──────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
        checked ? 'bg-indigo-600' : 'bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function TokenStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; label: string }> = {
    valid: { color: 'bg-green-100 text-green-800', label: '🟢 Valid' },
    expiring_soon: { color: 'bg-yellow-100 text-yellow-800', label: '🟡 Expiring Soon' },
    expired: { color: 'bg-red-100 text-red-800', label: '🔴 Expired' },
    revoked: { color: 'bg-gray-100 text-gray-600', label: '⛔ Revoked' },
    unknown: { color: 'bg-gray-100 text-gray-500', label: '⚪ Unknown' },
  };
  const c = cfg[status] ?? cfg.unknown;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c.color}`}>{c.label}</span>;
}

// ── Tab: Overview ──────────────────────────────────────────────────────────

function OverviewTab({ detail, onSave }: { detail: PlatformDetail; onSave: (patch: Partial<PlatformDetail>) => Promise<void> }) {
  const [enabled, setEnabled] = useState(detail.is_enabled);
  const [mode, setMode] = useState(detail.integration_mode);
  const [notes, setNotes] = useState(detail.notes ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onSave({ is_enabled: enabled, integration_mode: mode, notes: notes || null });
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* Config Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <h3 className="font-semibold text-gray-900">Integration Configuration</h3>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-800">Global Enable</p>
              <p className="text-sm text-gray-500">Enables this platform system-wide for all operations.</p>
            </div>
            <Toggle checked={enabled} onChange={setEnabled} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Integration Mode</label>
            <select
              value={mode}
              onChange={e => setMode(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="personal_oauth">Personal OAuth</option>
              <option value="system_user">System User / Business Account</option>
              <option value="api_key">API Key</option>
              <option value="manual">Manual / Not Automated</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes about this platform integration..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
          >
            {saving ? 'Saving…' : 'Save Configuration'}
          </button>
        </div>

        {/* Info Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Platform Details</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Platform ID</dt>
              <dd className="font-mono text-gray-800">{detail.platform}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Display Name</dt>
              <dd className="text-gray-800">{detail.display_name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Category</dt>
              <dd className="text-gray-800 capitalize">{detail.category}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Last Updated</dt>
              <dd className="text-gray-800">{detail.updated_at ? new Date(detail.updated_at).toLocaleString() : '—'}</dd>
            </div>
          </dl>

          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Quick Links</p>
            <div className="flex flex-col gap-1">
              <a href="/admin/platform-credentials" className="text-sm text-indigo-600 hover:text-indigo-800">🔐 Platform Credentials →</a>
              <a href="/admin/platform-api-catalog" className="text-sm text-indigo-600 hover:text-indigo-800">🔌 API Catalog →</a>
              <a href="/admin/platform-scenarios" className="text-sm text-indigo-600 hover:text-indigo-800">🎭 Scenario Registry →</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: System Accounts ────────────────────────────────────────────────────

function SystemAccountsTab({ platform, accounts, onRefresh }: { platform: string; accounts: SystemAccount[]; onRefresh: () => void }) {
  const types = SYSTEM_ACCOUNT_TYPES[platform] ?? SYSTEM_ACCOUNT_TYPES.default;
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    account_type: types[0],
    account_label: '',
    app_id: '',
    system_user_id: '',
    token_env_var: '',
    scopes_granted: '',
    is_primary: false,
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingStatus, setEditingStatus] = useState<Record<number, string>>({});

  async function addAccount() {
    setSaving(true);
    await fetch(`/api/admin/platform-integration/${platform}/system-accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setSaving(false);
    onRefresh();
  }

  async function deleteAccount(id: number) {
    if (!confirm('Delete this account?')) return;
    setDeletingId(id);
    await fetch(`/api/admin/platform-integration/${platform}/system-accounts/${id}`, { method: 'DELETE' });
    setDeletingId(null);
    onRefresh();
  }

  async function updateStatus(id: number, token_status: string) {
    setEditingStatus(prev => ({ ...prev, [id]: token_status }));
    await fetch(`/api/admin/platform-integration/${platform}/system-accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token_status }),
    });
    setEditingStatus(prev => { const n = { ...prev }; delete n[id]; return n; });
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          {showForm ? '✕ Cancel' : '+ Add System Account'}
        </button>
      </div>

      {showForm && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 space-y-4">
          <h4 className="font-semibold text-indigo-900">New System Account</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Type *</label>
              <select
                value={form.account_type}
                onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {types.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
              <input
                value={form.account_label}
                onChange={e => setForm(f => ({ ...f, account_label: e.target.value }))}
                placeholder="e.g. Production System User"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">App / Client ID</label>
              <input
                value={form.app_id}
                onChange={e => setForm(f => ({ ...f, app_id: e.target.value }))}
                placeholder="Non-secret app ID"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">System User / Org ID</label>
              <input
                value={form.system_user_id}
                onChange={e => setForm(f => ({ ...f, system_user_id: e.target.value }))}
                placeholder="Non-secret identifier"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Token Env Var Name</label>
              <input
                value={form.token_env_var}
                onChange={e => setForm(f => ({ ...f, token_env_var: e.target.value }))}
                placeholder="e.g. FB_SYSTEM_TOKEN — actual value stays in .env, only the variable name is stored"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Scopes Granted</label>
              <input
                value={form.scopes_granted}
                onChange={e => setForm(f => ({ ...f, scopes_granted: e.target.value }))}
                placeholder="comma-separated scope names"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="prim" checked={form.is_primary} onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))} className="rounded" />
            <label htmlFor="prim" className="text-sm text-gray-700">Mark as primary account</label>
          </div>
          <button
            onClick={addAccount}
            disabled={saving}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add Account'}
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Type', 'Label', 'App ID', 'User ID', 'Token Env Var', 'Scopes', 'Status', 'Expires', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {accounts.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-gray-400">No system accounts. Add one above.</td></tr>
            ) : accounts.map(a => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  {a.account_type}
                  {a.is_primary && <span className="ml-1 text-xs bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded">primary</span>}
                </td>
                <td className="px-4 py-3 text-gray-600">{a.account_label ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.app_id ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.system_user_id ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-blue-600">{a.token_env_var ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-24 truncate" title={a.scopes_granted ?? ''}>{a.scopes_granted ?? '—'}</td>
                <td className="px-4 py-3">
                  <select
                    value={editingStatus[a.id] ?? a.token_status}
                    onChange={e => updateStatus(a.id, e.target.value)}
                    className="text-xs border border-gray-300 rounded px-1 py-0.5"
                  >
                    <option value="unknown">⚪ Unknown</option>
                    <option value="valid">🟢 Valid</option>
                    <option value="expiring_soon">🟡 Expiring Soon</option>
                    <option value="expired">🔴 Expired</option>
                    <option value="revoked">⛔ Revoked</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {a.token_expires_at ? new Date(a.token_expires_at).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => deleteAccount(a.id)}
                    disabled={deletingId === a.id}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab: Webhooks ──────────────────────────────────────────────────────────

function WebhooksTab({ platform, webhooks, onRefresh }: { platform: string; webhooks: Webhook[]; onRefresh: () => void }) {
  const events = WEBHOOK_EVENTS[platform] ?? WEBHOOK_EVENTS.default;
  const [showForm, setShowForm] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [verifyToken, setVerifyToken] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [saving, setSaving] = useState(false);

  function toggleEvent(ev: string) {
    setSelectedEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);
  }

  async function addWebhook() {
    setSaving(true);
    await fetch(`/api/admin/platform-integration/${platform}/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhook_url: webhookUrl, events: selectedEvents.join(','), verify_token: verifyToken || null, is_active: isActive }),
    });
    setShowForm(false);
    setSaving(false);
    onRefresh();
  }

  async function deleteWebhook(id: number) {
    if (!confirm('Delete this webhook?')) return;
    await fetch(`/api/admin/platform-integration/${platform}/webhooks/${id}`, { method: 'DELETE' });
    onRefresh();
  }

  async function toggleWebhook(id: number, current: boolean) {
    await fetch(`/api/admin/platform-integration/${platform}/webhooks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !current }),
    });
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          {showForm ? '✕ Cancel' : '+ Add Webhook'}
        </button>
      </div>

      {showForm && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 space-y-4">
          <h4 className="font-semibold text-indigo-900">New Webhook</h4>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
            <input
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
              placeholder="https://yourdomain.com/api/webhooks/..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Events to Subscribe</label>
            <div className="flex flex-wrap gap-2">
              {events.map(ev => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => toggleEvent(ev)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border ${
                    selectedEvents.includes(ev)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  {ev}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Verify Token</label>
            <input
              value={verifyToken}
              onChange={e => setVerifyToken(e.target.value)}
              placeholder="For Meta/Google webhook verification"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Toggle checked={isActive} onChange={setIsActive} />
            <span className="text-sm text-gray-700">Activate immediately</span>
          </div>
          <button onClick={addWebhook} disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg disabled:opacity-50">
            {saving ? 'Adding…' : 'Add Webhook'}
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['URL', 'Events', 'Status', 'Verified', 'Last Event', 'Event Count', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {webhooks.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No webhooks configured.</td></tr>
            ) : webhooks.map(w => (
              <tr key={w.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs max-w-48 truncate" title={w.webhook_url ?? ''}>{w.webhook_url ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-36 truncate" title={w.events ?? ''}>{w.events ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${w.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {w.is_active ? '🟢 Active' : '⚪ Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">{w.verified ? <span className="text-green-600">✓ Yes</span> : <span className="text-gray-400">No</span>}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{w.last_event_at ? new Date(w.last_event_at).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3 text-gray-600">{w.event_count}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => toggleWebhook(w.id, w.is_active)} className="text-xs text-indigo-600 hover:text-indigo-800">
                      {w.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => deleteWebhook(w.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab: OAuth Tokens ──────────────────────────────────────────────────────

function OAuthTokensTab({ accounts, platform, onRefresh }: { accounts: SystemAccount[]; platform: string; onRefresh: () => void }) {
  const oauthAccounts = accounts.filter(a =>
    ['personal_oauth', 'system_user'].includes(a.account_type) || a.token_env_var
  );

  async function revokeToken(id: number) {
    if (!confirm('Mark this token as revoked? You will need to re-authenticate.')) return;
    await fetch(`/api/admin/platform-integration/${platform}/system-accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token_status: 'revoked' }),
    });
    onRefresh();
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-lg">No system accounts configured yet.</p>
        <p className="text-sm mt-1">Add accounts in the System Accounts tab to track OAuth tokens here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
        <strong>Security note:</strong> Actual token values are never stored in the database. Only the environment variable name is stored. Tokens live exclusively in your server environment variables.
      </div>

      <div className="grid gap-4">
        {accounts.map(a => {
          const isExpiringSoon = a.token_expires_at
            ? (new Date(a.token_expires_at).getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000
            : false;

          return (
            <div key={a.id} className={`bg-white border rounded-xl p-5 ${isExpiringSoon ? 'border-yellow-300' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-gray-900">{a.account_label ?? a.account_type}</h4>
                  <p className="text-sm text-gray-500">{a.account_type}</p>
                </div>
                <TokenStatusBadge status={a.token_status} />
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-gray-500 text-xs uppercase font-medium mb-0.5">Env Var Name</dt>
                  <dd className="font-mono text-blue-600">{a.token_env_var ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs uppercase font-medium mb-0.5">Scopes</dt>
                  <dd className="text-gray-700 text-xs">{a.scopes_granted ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs uppercase font-medium mb-0.5">Expires</dt>
                  <dd className={`${isExpiringSoon ? 'text-yellow-700 font-medium' : 'text-gray-700'}`}>
                    {a.token_expires_at ? new Date(a.token_expires_at).toLocaleString() : 'Never / Not set'}
                    {isExpiringSoon && <span className="ml-1 text-xs text-yellow-600">⚠️ Expiring soon</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs uppercase font-medium mb-0.5">Last Refreshed</dt>
                  <dd className="text-gray-700">{a.token_last_refreshed_at ? new Date(a.token_last_refreshed_at).toLocaleString() : '—'}</dd>
                </div>
              </dl>

              <div className="mt-4 flex gap-2">
                {a.token_status !== 'revoked' && (
                  <button
                    onClick={() => revokeToken(a.id)}
                    className="text-xs px-3 py-1.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                  >
                    Revoke Token
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab: Advanced ──────────────────────────────────────────────────────────

function AdvancedTab({ detail, onSave }: { detail: PlatformDetail; onSave: (patch: Partial<PlatformDetail>) => Promise<void> }) {
  const [form, setForm] = useState({
    rate_limit_strategy: detail.rate_limit_strategy,
    retry_enabled: detail.retry_enabled,
    retry_max_attempts: detail.retry_max_attempts,
    retry_backoff_seconds: detail.retry_backoff_seconds,
    sandbox_mode: detail.sandbox_mode,
    debug_mode: detail.debug_mode,
    auto_refresh_tokens: detail.auto_refresh_tokens,
    webhook_secret: detail.webhook_secret ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onSave({ ...form, webhook_secret: form.webhook_secret || null });
    setSaving(false);
  }

  function setF<K extends keyof typeof form>(key: K, val: typeof form[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
      <h3 className="font-semibold text-gray-900">Advanced Integration Settings</h3>

      {/* Rate Limit */}
      <div>
        <h4 className="font-medium text-gray-800 mb-3">Rate Limit Strategy</h4>
        <div className="flex gap-3">
          {(['conservative', 'balanced', 'aggressive'] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setF('rate_limit_strategy', s)}
              className={`flex-1 py-2 text-sm rounded-lg border font-medium capitalize transition-colors ${
                form.rate_limit_strategy === s
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white border-gray-300 text-gray-600 hover:border-indigo-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Conservative: stay well within limits. Balanced: normal usage. Aggressive: use full quota.
        </p>
      </div>

      {/* Retry */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-800">Retry Policy</h4>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Enable Retries</p>
            <p className="text-xs text-gray-500">Automatically retry failed API calls.</p>
          </div>
          <Toggle checked={form.retry_enabled} onChange={v => setF('retry_enabled', v)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Attempts</label>
            <input
              type="number" min={1} max={10}
              value={form.retry_max_attempts}
              onChange={e => setF('retry_max_attempts', parseInt(e.target.value, 10))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Backoff (seconds)</label>
            <input
              type="number" min={10} max={3600}
              value={form.retry_backoff_seconds}
              onChange={e => setF('retry_backoff_seconds', parseInt(e.target.value, 10))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-800">Mode Flags</h4>
        {([
          { key: 'sandbox_mode' as const, label: 'Sandbox Mode', desc: 'Use sandbox/test endpoints instead of production.' },
          { key: 'debug_mode' as const, label: 'Debug Mode', desc: 'Log all API requests and responses for troubleshooting.' },
          { key: 'auto_refresh_tokens' as const, label: 'Auto-Refresh Tokens', desc: 'Automatically refresh OAuth tokens before they expire.' },
        ]).map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
            <div>
              <p className="text-sm font-medium text-gray-700">{label}</p>
              <p className="text-xs text-gray-500">{desc}</p>
            </div>
            <Toggle checked={form[key] as boolean} onChange={v => setF(key, v)} />
          </div>
        ))}
      </div>

      {/* Webhook Secret */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Webhook Secret (env var name)</label>
        <input
          value={form.webhook_secret}
          onChange={e => setF('webhook_secret', e.target.value)}
          placeholder="e.g. FB_WEBHOOK_SECRET — store actual value in .env"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
      >
        {saving ? 'Saving…' : 'Save Advanced Settings'}
      </button>
    </div>
  );
}

// ── Tab: Customers ─────────────────────────────────────────────────────────

function CustomersTab({ customerToggles }: { customerToggles: CustomerToggle[] }) {
  const enabled = customerToggles.filter(t => t.is_enabled);
  const disabled = customerToggles.filter(t => !t.is_enabled);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{enabled.length}</p>
          <p className="text-sm text-gray-600 mt-1">Customers with access enabled</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-gray-500">{disabled.length}</p>
          <p className="text-sm text-gray-600 mt-1">Customers with access disabled</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Customer ID', 'Status', 'Enabled By', 'Since'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customerToggles.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-gray-400">No customer access records yet.</td></tr>
            ) : customerToggles.map(t => (
              <tr key={t.customer_id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono">#{t.customer_id}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${t.is_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {t.is_enabled ? '✓ Enabled' : '✕ Disabled'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 capitalize">{t.enabled_by}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(t.enabled_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab: Audit Log ─────────────────────────────────────────────────────────

function AuditLogTab({ detail }: { detail: PlatformDetail }) {
  const events = [
    detail.updated_at ? {
      ts: detail.updated_at,
      action: 'Config updated',
      detail: `is_enabled=${detail.is_enabled}, mode=${detail.integration_mode}`,
    } : null,
  ].filter(Boolean) as { ts: string; action: string; detail: string }[];

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-900 text-sm">Recent Changes</h3>
        </div>
        {events.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No audit events yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {events.map((ev, i) => (
              <div key={i} className="px-5 py-4 flex items-start gap-4">
                <div className="w-24 text-xs text-gray-400 shrink-0">{new Date(ev.ts).toLocaleString()}</div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{ev.action}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{ev.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        Full operation history is available in the <a href="/admin/audit" className="underline font-medium">Audit Log</a> module.
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

type Tab = 'overview' | 'accounts' | 'webhooks' | 'oauth' | 'advanced' | 'customers' | 'audit';

export default function PlatformDetailPage() {
  const params = useParams();
  const platform = params.platform as string;

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [detail, setDetail] = useState<PlatformDetail | null>(null);
  const [accounts, setAccounts] = useState<SystemAccount[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [customerToggles, setCustomerToggles] = useState<CustomerToggle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`/api/admin/platform-integration/${platform}`);
      if (!r.ok) {
        setError('Platform not found or tables not seeded. Use the Initialize button on the Platform Integration page first.');
        setLoading(false);
        return;
      }
      const data = await r.json() as {
        config: PlatformDetail;
        system_accounts: SystemAccount[];
        webhooks: Webhook[];
        customer_toggles: CustomerToggle[];
      };
      setDetail(data.config);
      setAccounts(data.system_accounts);
      setWebhooks(data.webhooks);
      setCustomerToggles(data.customer_toggles);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [platform]);

  useEffect(() => { void loadData(); }, [loadData]);

  async function handleSave(patch: Partial<PlatformDetail>) {
    await fetch(`/api/admin/platform-integration/${platform}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    void loadData();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: '📋 Overview' },
    { id: 'accounts', label: '👤 System Accounts' },
    { id: 'webhooks', label: '🔔 Webhooks' },
    { id: 'oauth', label: '🔑 OAuth Tokens' },
    { id: 'advanced', label: '⚙️ Advanced' },
    { id: 'customers', label: '👥 Customers' },
    { id: 'audit', label: '📜 Audit Log' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading platform details…</div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
          <p className="font-semibold">Error loading platform</p>
          <p className="text-sm mt-1">{error}</p>
          <div className="mt-4 flex gap-2">
            <a href="/admin/platform-integration" className="text-sm text-indigo-600 underline">← Back to Platform Integration</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <a href="/admin/platform-integration" className="text-gray-400 hover:text-gray-600 text-sm">← All Platforms</a>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{PLATFORM_EMOJIS[platform] ?? '🔌'}</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 capitalize">{detail.display_name ?? platform}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-gray-500 capitalize">{detail.category}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${detail.is_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {detail.is_enabled ? '● Enabled' : '○ Disabled'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-0 -mb-px overflow-x-auto">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === t.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'overview' && <OverviewTab detail={detail} onSave={handleSave} />}
        {activeTab === 'accounts' && <SystemAccountsTab platform={platform} accounts={accounts} onRefresh={() => void loadData()} />}
        {activeTab === 'webhooks' && <WebhooksTab platform={platform} webhooks={webhooks} onRefresh={() => void loadData()} />}
        {activeTab === 'oauth' && <OAuthTokensTab accounts={accounts} platform={platform} onRefresh={() => void loadData()} />}
        {activeTab === 'advanced' && <AdvancedTab detail={detail} onSave={handleSave} />}
        {activeTab === 'customers' && <CustomersTab customerToggles={customerToggles} />}
        {activeTab === 'audit' && <AuditLogTab detail={detail} />}
      </div>
    </div>
  );
}
