'use client';

import { useState, useEffect, useCallback } from 'react';

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

const HIGH_PRIORITY = ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'google', 'tiktok'];

// ── Types ──────────────────────────────────────────────────────────────────

interface PlatformRow {
  platform: string;
  display_name: string;
  category: string;
  is_enabled: boolean;
  integration_mode: string;
  rate_limit_strategy: string;
  retry_enabled: boolean;
  sandbox_mode: boolean;
  debug_mode: boolean;
  auto_refresh_tokens: boolean;
  webhook_secret: string | null;
  notes: string | null;
  updated_at: string | null;
  system_account_count: string;
  webhook_count: string;
  active_webhook_count: string;
  customer_enabled_count: string;
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
  created_at: string;
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
  created_at: string;
}

// ── Helper Components ──────────────────────────────────────────────────────

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

function ModeBadge({ mode }: { mode: string }) {
  const colors: Record<string, string> = {
    personal_oauth: 'bg-blue-100 text-blue-700',
    system_user: 'bg-purple-100 text-purple-700',
    api_key: 'bg-orange-100 text-orange-700',
    manual: 'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${colors[mode] ?? 'bg-gray-100 text-gray-700'}`}>
      {mode.replace(/_/g, ' ')}
    </span>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${
        checked ? 'bg-indigo-600' : 'bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ── Add System Account Modal ────────────────────────────────────────────────

function AddAccountModal({
  platform,
  onClose,
  onSaved,
}: {
  platform: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const types = SYSTEM_ACCOUNT_TYPES[platform] ?? SYSTEM_ACCOUNT_TYPES.default;
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
  const [err, setErr] = useState('');

  async function save() {
    setSaving(true);
    setErr('');
    try {
      const r = await fetch(`/api/admin/platform-integration/${platform}/system-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error((await r.json() as { error: string }).error);
      onSaved();
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold">Add System Account — {platform}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Type *</label>
            <select
              value={form.account_type}
              onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
            <input
              value={form.account_label}
              onChange={e => setForm(f => ({ ...f, account_label: e.target.value }))}
              placeholder="e.g. Production FB System User"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">System User ID</label>
              <input
                value={form.system_user_id}
                onChange={e => setForm(f => ({ ...f, system_user_id: e.target.value }))}
                placeholder="Non-secret identifier"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Token Env Var Name</label>
            <input
              value={form.token_env_var}
              onChange={e => setForm(f => ({ ...f, token_env_var: e.target.value }))}
              placeholder="e.g. FB_SYSTEM_USER_TOKEN (never the actual token)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Only the env var name is stored — actual secrets stay in your .env file.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scopes Granted</label>
            <input
              value={form.scopes_granted}
              onChange={e => setForm(f => ({ ...f, scopes_granted: e.target.value }))}
              placeholder="e.g. pages_read_engagement,ads_read"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_primary"
              checked={form.is_primary}
              onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor="is_primary" className="text-sm text-gray-700">Mark as primary account</label>
          </div>
          {err && <p className="text-red-600 text-sm">{err}</p>}
        </div>
        <div className="p-6 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Webhook Modal ────────────────────────────────────────────────────────

function AddWebhookModal({
  platform,
  onClose,
  onSaved,
}: {
  platform: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const events = WEBHOOK_EVENTS[platform] ?? WEBHOOK_EVENTS.default;
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [verifyToken, setVerifyToken] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function toggleEvent(ev: string) {
    setSelectedEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);
  }

  async function save() {
    setSaving(true);
    setErr('');
    try {
      const r = await fetch(`/api/admin/platform-integration/${platform}/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhook_url: webhookUrl,
          events: selectedEvents.join(','),
          verify_token: verifyToken || null,
          is_active: isActive,
        }),
      });
      if (!r.ok) throw new Error((await r.json() as { error: string }).error);
      onSaved();
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold">Add Webhook — {platform}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <div className="p-6 space-y-4">
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
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Verify Token (optional)</label>
            <input
              value={verifyToken}
              onChange={e => setVerifyToken(e.target.value)}
              placeholder="Required by Meta/Google webhook verification"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Toggle checked={isActive} onChange={setIsActive} />
            <span className="text-sm text-gray-700">Activate immediately</span>
          </div>
          {err && <p className="text-red-600 text-sm">{err}</p>}
        </div>
        <div className="p-6 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add Webhook'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab 1: Overview ────────────────────────────────────────────────────────

function OverviewTab({ platforms, onToggle, loading }: {
  platforms: PlatformRow[];
  onToggle: (platform: string, enabled: boolean) => void;
  loading: boolean;
}) {
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [toggling, setToggling] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const enabledCount = platforms.filter(p => p.is_enabled).length;
  const disabledCount = platforms.filter(p => !p.is_enabled).length;
  const systemUserCount = platforms.filter(p => p.integration_mode === 'system_user').length;
  const webhookActiveCount = platforms.reduce((acc, p) => acc + parseInt(p.active_webhook_count, 10), 0);

  const filtered = platforms.filter(p => {
    if (filter === 'enabled' && !p.is_enabled) return false;
    if (filter === 'disabled' && p.is_enabled) return false;
    if (modeFilter !== 'all' && p.integration_mode !== modeFilter) return false;
    return true;
  });

  async function handleToggle(platform: string, enabled: boolean) {
    setToggling(platform);
    await onToggle(platform, enabled);
    setToggling(null);
  }

  async function bulkToggle(platforms_list: string[], enabled: boolean) {
    setBulkLoading(true);
    try {
      await fetch('/api/admin/platform-integration/bulk-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms: platforms_list, enabled }),
      });
      platforms_list.forEach(p => onToggle(p, enabled));
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* KPI Bar */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Enabled', value: enabledCount, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Disabled', value: disabledCount, color: 'text-gray-500', bg: 'bg-gray-50' },
          { label: 'System User Mode', value: systemUserCount, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Active Webhooks', value: webhookActiveCount, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map(kpi => (
          <div key={kpi.label} className={`${kpi.bg} rounded-xl p-4 text-center`}>
            <p className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-sm text-gray-600 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Bulk Actions + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => bulkToggle(platforms.map(p => p.platform), true)}
            disabled={bulkLoading}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            Enable All
          </button>
          <button
            onClick={() => bulkToggle(platforms.map(p => p.platform), false)}
            disabled={bulkLoading}
            className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            Disable All
          </button>
          <button
            onClick={() => bulkToggle(HIGH_PRIORITY, true)}
            disabled={bulkLoading}
            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            Enable High-Priority
          </button>
        </div>
        <div className="ml-auto flex gap-2">
          {(['all', 'enabled', 'disabled'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-lg capitalize ${filter === f ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              {f}
            </button>
          ))}
          <select
            value={modeFilter}
            onChange={e => setModeFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5"
          >
            <option value="all">All Modes</option>
            <option value="personal_oauth">Personal OAuth</option>
            <option value="system_user">System User</option>
            <option value="api_key">API Key</option>
            <option value="manual">Manual</option>
          </select>
        </div>
      </div>

      {/* Platform Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading platforms…</div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {filtered.map(p => (
            <div key={p.platform} className={`bg-white border rounded-xl p-4 transition-shadow hover:shadow-md ${p.is_enabled ? 'border-green-200' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{PLATFORM_EMOJIS[p.platform] ?? '🔌'}</span>
                  <div>
                    <p className="font-medium text-sm text-gray-900 capitalize">{p.display_name ?? p.platform}</p>
                    <p className="text-xs text-gray-400 capitalize">{p.category}</p>
                  </div>
                </div>
                <Toggle
                  checked={p.is_enabled}
                  onChange={v => handleToggle(p.platform, v)}
                  disabled={toggling === p.platform}
                />
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                <ModeBadge mode={p.integration_mode} />
                {p.sandbox_mode && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">sandbox</span>}
                {p.debug_mode && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">debug</span>}
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span title="System accounts">👤 {p.system_account_count}</span>
                <span title="Active webhooks">{parseInt(p.active_webhook_count, 10) > 0 ? '🟢' : '⚪'} {p.active_webhook_count}/{p.webhook_count}</span>
                <span title="Customers with access">👥 {p.customer_enabled_count}</span>
              </div>
              <div className="mt-3 flex gap-1">
                <a
                  href={`/admin/platform-integration/${p.platform}`}
                  className="flex-1 text-center text-xs py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-medium"
                >
                  Configure
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab 2: System Accounts ─────────────────────────────────────────────────

function SystemAccountsTab({ platforms }: { platforms: PlatformRow[] }) {
  const [accounts, setAccounts] = useState<SystemAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [addModal, setAddModal] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    const all: SystemAccount[] = [];
    await Promise.all(
      platforms.map(async p => {
        try {
          const r = await fetch(`/api/admin/platform-integration/${p.platform}/system-accounts`);
          if (r.ok) {
            const data = await r.json() as { accounts: SystemAccount[] };
            all.push(...data.accounts);
          }
        } catch { /* ignore */ }
      })
    );
    setAccounts(all.sort((a, b) => (a.is_primary ? -1 : 1) - (b.is_primary ? -1 : 1)));
    setLoading(false);
  }, [platforms]);

  useEffect(() => { void loadAccounts(); }, [loadAccounts]);

  async function deleteAccount(id: number, platform: string) {
    if (!confirm('Delete this system account?')) return;
    await fetch(`/api/admin/platform-integration/${platform}/system-accounts/${id}`, { method: 'DELETE' });
    void loadAccounts();
  }

  const filtered = accounts.filter(a => {
    if (filterPlatform !== 'all' && a.platform !== filterPlatform) return false;
    if (filterStatus !== 'all' && a.token_status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <select
            value={filterPlatform}
            onChange={e => setFilterPlatform(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
          >
            <option value="all">All Platforms</option>
            {platforms.map(p => <option key={p.platform} value={p.platform}>{p.display_name ?? p.platform}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
          >
            <option value="all">All Status</option>
            <option value="valid">Valid</option>
            <option value="expiring_soon">Expiring Soon</option>
            <option value="expired">Expired</option>
            <option value="unknown">Unknown</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>
        <div className="flex gap-2">
          {platforms.filter(p => p.is_enabled).map(p => (
            <button
              key={p.platform}
              onClick={() => setAddModal(p.platform)}
              className="text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              + Add for {p.display_name ?? p.platform}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading accounts…</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Platform', 'Type', 'Label', 'App ID', 'System User ID', 'Scopes', 'Token Status', 'Expires', 'Last Refreshed', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-gray-400">No system accounts found. Add one above.</td></tr>
              ) : filtered.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span>{PLATFORM_EMOJIS[a.platform] ?? '🔌'}</span>
                      <span className="capitalize">{a.platform}</span>
                      {a.is_primary && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">primary</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.account_type}</td>
                  <td className="px-4 py-3 text-gray-600">{a.account_label ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.app_id ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.system_user_id ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-32 truncate" title={a.scopes_granted ?? ''}>{a.scopes_granted ?? '—'}</td>
                  <td className="px-4 py-3"><TokenStatusBadge status={a.token_status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {a.token_expires_at ? new Date(a.token_expires_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {a.token_last_refreshed_at ? new Date(a.token_last_refreshed_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <a
                        href={`/admin/platform-integration/${a.platform}`}
                        className="text-xs text-indigo-600 hover:text-indigo-800"
                      >
                        Edit
                      </a>
                      <button
                        onClick={() => deleteAccount(a.id, a.platform)}
                        className="text-xs text-red-500 hover:text-red-700 ml-2"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addModal && (
        <AddAccountModal
          platform={addModal}
          onClose={() => setAddModal(null)}
          onSaved={() => { void loadAccounts(); }}
        />
      )}
    </div>
  );
}

// ── Tab 3: Webhooks ────────────────────────────────────────────────────────

function WebhooksTab({ platforms }: { platforms: PlatformRow[] }) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState<string | null>(null);
  const [filterPlatform, setFilterPlatform] = useState('all');

  const loadWebhooks = useCallback(async () => {
    setLoading(true);
    const all: Webhook[] = [];
    await Promise.all(
      platforms.map(async p => {
        try {
          const r = await fetch(`/api/admin/platform-integration/${p.platform}/webhooks`);
          if (r.ok) {
            const data = await r.json() as { webhooks: Webhook[] };
            all.push(...data.webhooks);
          }
        } catch { /* ignore */ }
      })
    );
    setWebhooks(all);
    setLoading(false);
  }, [platforms]);

  useEffect(() => { void loadWebhooks(); }, [loadWebhooks]);

  async function deleteWebhook(id: number, platform: string) {
    if (!confirm('Delete this webhook?')) return;
    await fetch(`/api/admin/platform-integration/${platform}/webhooks/${id}`, { method: 'DELETE' });
    void loadWebhooks();
  }

  async function toggleWebhook(id: number, platform: string, isActive: boolean) {
    await fetch(`/api/admin/platform-integration/${platform}/webhooks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive }),
    });
    void loadWebhooks();
  }

  const filtered = webhooks.filter(w => filterPlatform === 'all' || w.platform === filterPlatform);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <select
          value={filterPlatform}
          onChange={e => setFilterPlatform(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
        >
          <option value="all">All Platforms</option>
          {platforms.map(p => <option key={p.platform} value={p.platform}>{p.display_name ?? p.platform}</option>)}
        </select>
        <div className="flex gap-2">
          {platforms.filter(p => p.is_enabled).slice(0, 5).map(p => (
            <button
              key={p.platform}
              onClick={() => setAddModal(p.platform)}
              className="text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              + {p.display_name ?? p.platform}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading webhooks…</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Platform', 'Webhook URL', 'Events', 'Status', 'Verified', 'Last Event', 'Event Count', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">No webhooks configured.</td></tr>
              ) : filtered.map(w => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1">
                      <span>{PLATFORM_EMOJIS[w.platform] ?? '🔌'}</span>
                      <span className="capitalize">{w.platform}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 max-w-48 truncate" title={w.webhook_url ?? ''}>
                    {w.webhook_url ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-40 truncate" title={w.events ?? ''}>{w.events ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${w.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {w.is_active ? '🟢 Active' : '⚪ Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {w.verified
                      ? <span className="text-green-600 text-xs">✓ Verified</span>
                      : <span className="text-gray-400 text-xs">Not verified</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {w.last_event_at ? new Date(w.last_event_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{w.event_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => toggleWebhook(w.id, w.platform, w.is_active)}
                        className={`text-xs ${w.is_active ? 'text-gray-600 hover:text-gray-800' : 'text-green-600 hover:text-green-800'}`}
                      >
                        {w.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => deleteWebhook(w.id, w.platform)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addModal && (
        <AddWebhookModal
          platform={addModal}
          onClose={() => setAddModal(null)}
          onSaved={() => { void loadWebhooks(); }}
        />
      )}
    </div>
  );
}

// ── Tab 4: Customer Access ─────────────────────────────────────────────────

function CustomerAccessTab({ platforms }: { platforms: PlatformRow[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedPlatform = platforms.find(p => p.platform === selected);

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">Select a platform to view and manage customer access.</p>
      <div className="grid grid-cols-4 gap-4">
        {platforms.filter(p => p.is_enabled).map(p => (
          <button
            key={p.platform}
            onClick={() => setSelected(p.platform === selected ? null : p.platform)}
            className={`text-left border rounded-xl p-4 transition-all ${
              selected === p.platform
                ? 'border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50'
                : 'border-gray-200 hover:border-indigo-300 bg-white'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{PLATFORM_EMOJIS[p.platform] ?? '🔌'}</span>
              <span className="font-medium text-sm capitalize">{p.display_name ?? p.platform}</span>
            </div>
            <p className="text-xs text-gray-500">{p.customer_enabled_count} customers have access</p>
          </button>
        ))}
      </div>

      {selectedPlatform && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 mb-4">
            {PLATFORM_EMOJIS[selectedPlatform.platform] ?? '🔌'} {selectedPlatform.display_name ?? selectedPlatform.platform} — Customer Access
          </h3>
          <div className="flex gap-3 mb-4">
            <a
              href={`/admin/platform-integration/${selectedPlatform.platform}`}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Manage in Platform Detail View →
            </a>
          </div>
          <p className="text-sm text-gray-500">
            {selectedPlatform.customer_enabled_count} customers have this platform enabled. Use the per-platform detail page to manage individual customer toggles.
          </p>
        </div>
      )}

      {platforms.filter(p => !p.is_enabled).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-700">
            <strong>{platforms.filter(p => !p.is_enabled).length} platforms</strong> are globally disabled and not shown here.
            Enable them in the Overview tab to grant customer access.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Tab 5: Advanced Settings ────────────────────────────────────────────────

function AdvancedSettingsTab({ platforms, onRefresh }: { platforms: PlatformRow[]; onRefresh: () => void }) {
  const [saving, setSaving] = useState<string | null>(null);
  const [localSettings, setLocalSettings] = useState<Record<string, Partial<PlatformRow>>>({});

  function getSetting(platform: string, key: string, defaultVal: unknown): unknown {
    const local = localSettings[platform];
    if (local && key in local) return (local as Record<string, unknown>)[key];
    const p = platforms.find(pl => pl.platform === platform);
    return p ? (p as unknown as Record<string, unknown>)[key] ?? defaultVal : defaultVal;
  }

  function updateLocal(platform: string, key: string, value: unknown) {
    setLocalSettings(prev => ({
      ...prev,
      [platform]: { ...(prev[platform] ?? {}), [key]: value },
    }));
  }

  async function saveRow(platform: string) {
    const settings = localSettings[platform];
    if (!settings) return;
    setSaving(platform);
    try {
      await fetch(`/api/admin/platform-integration/${platform}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setLocalSettings(prev => { const n = { ...prev }; delete n[platform]; return n; });
      onRefresh();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            {['Platform', 'Rate Limit Strategy', 'Retry', 'Max Attempts', 'Backoff (s)', 'Sandbox', 'Debug', 'Auto Refresh', 'Actions'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {platforms.map(p => {
            const isDirty = Boolean(localSettings[p.platform]);
            return (
              <tr key={p.platform} className={isDirty ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span>{PLATFORM_EMOJIS[p.platform] ?? '🔌'}</span>
                    <span className="font-medium capitalize">{p.display_name ?? p.platform}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={getSetting(p.platform, 'rate_limit_strategy', 'conservative') as string}
                    onChange={e => updateLocal(p.platform, 'rate_limit_strategy', e.target.value)}
                    className="text-xs border border-gray-300 rounded px-2 py-1"
                  >
                    <option value="conservative">Conservative</option>
                    <option value="balanced">Balanced</option>
                    <option value="aggressive">Aggressive</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <Toggle
                    checked={getSetting(p.platform, 'retry_enabled', true) as boolean}
                    onChange={v => updateLocal(p.platform, 'retry_enabled', v)}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={getSetting(p.platform, 'retry_max_attempts', 3) as number}
                    onChange={e => updateLocal(p.platform, 'retry_max_attempts', parseInt(e.target.value, 10))}
                    className="w-16 text-xs border border-gray-300 rounded px-2 py-1"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={10}
                    max={3600}
                    value={getSetting(p.platform, 'retry_backoff_seconds', 60) as number}
                    onChange={e => updateLocal(p.platform, 'retry_backoff_seconds', parseInt(e.target.value, 10))}
                    className="w-20 text-xs border border-gray-300 rounded px-2 py-1"
                  />
                </td>
                <td className="px-4 py-3">
                  <Toggle
                    checked={getSetting(p.platform, 'sandbox_mode', false) as boolean}
                    onChange={v => updateLocal(p.platform, 'sandbox_mode', v)}
                  />
                </td>
                <td className="px-4 py-3">
                  <Toggle
                    checked={getSetting(p.platform, 'debug_mode', false) as boolean}
                    onChange={v => updateLocal(p.platform, 'debug_mode', v)}
                  />
                </td>
                <td className="px-4 py-3">
                  <Toggle
                    checked={getSetting(p.platform, 'auto_refresh_tokens', true) as boolean}
                    onChange={v => updateLocal(p.platform, 'auto_refresh_tokens', v)}
                  />
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => saveRow(p.platform)}
                    disabled={!isDirty || saving === p.platform}
                    className={`text-xs px-3 py-1.5 rounded-lg ${
                      isDirty
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    } disabled:opacity-50`}
                  >
                    {saving === p.platform ? 'Saving…' : 'Save'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

type Tab = 'overview' | 'accounts' | 'webhooks' | 'customers' | 'advanced';

export default function PlatformIntegrationPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [platforms, setPlatforms] = useState<PlatformRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');

  const loadPlatforms = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/platform-integration');
      if (r.ok) {
        const data = await r.json() as { platforms: PlatformRow[] };
        setPlatforms(data.platforms);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPlatforms(); }, [loadPlatforms]);

  async function seed() {
    setSeeding(true);
    try {
      const r = await fetch('/api/admin/platform-integration/seed');
      const data = await r.json() as { message?: string; error?: string };
      setSeedMsg(data.message ?? data.error ?? 'Done');
      void loadPlatforms();
    } finally {
      setSeeding(false);
    }
  }

  async function handleToggle(platform: string, enabled: boolean) {
    await fetch(`/api/admin/platform-integration/${platform}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    setPlatforms(prev => prev.map(p => p.platform === platform ? { ...p, is_enabled: enabled } : p));
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: '🌐 Overview' },
    { id: 'accounts', label: '👤 System Accounts' },
    { id: 'webhooks', label: '🔔 Webhooks' },
    { id: 'customers', label: '👥 Customer Access' },
    { id: 'advanced', label: '⚙️ Advanced Settings' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-2xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🔗 Platform Integration Manager</h1>
            <p className="text-sm text-gray-500 mt-1">Control all 36 platform integrations — enable/disable, system accounts, webhooks, and advanced settings.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={seed}
              disabled={seeding}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {seeding ? '⏳ Seeding…' : '🌱 Initialize / Seed Tables'}
            </button>
            <button
              onClick={() => void loadPlatforms()}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
            >
              ↺ Refresh
            </button>
          </div>
        </div>

        {seedMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
            {seedMsg}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-0 -mb-px">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
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

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <OverviewTab platforms={platforms} onToggle={handleToggle} loading={loading} />
        )}
        {activeTab === 'accounts' && (
          <SystemAccountsTab platforms={platforms} />
        )}
        {activeTab === 'webhooks' && (
          <WebhooksTab platforms={platforms} />
        )}
        {activeTab === 'customers' && (
          <CustomerAccessTab platforms={platforms} />
        )}
        {activeTab === 'advanced' && (
          <AdvancedSettingsTab platforms={platforms} onRefresh={() => void loadPlatforms()} />
        )}
      </div>
    </div>
  );
}
