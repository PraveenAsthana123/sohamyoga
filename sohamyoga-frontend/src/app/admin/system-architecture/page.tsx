'use client';

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardStats {
  feature_count: number;
  current_version: string;
  tech_stack_count: number;
  vector_doc_count: number;
  synthetic_dataset_count: number;
}

interface TechStackEntry {
  id: number;
  category: string;
  name: string;
  version: string | null;
  purpose: string | null;
  docs_url: string | null;
  is_core: boolean;
  status: string;
  notes: string | null;
}

interface FeatureEntry {
  id: number;
  module_name: string;
  feature_name: string;
  feature_type: string;
  route_or_path: string | null;
  user_visible: boolean;
  admin_only: boolean;
  customer_accessible: boolean;
  status: string;
  test_coverage: string;
  navigation_path: string | null;
}

interface RefTable {
  table_name: string;
  row_count: number;
  purpose: string | null;
  key_columns: string | null;
  is_editable: boolean;
}

interface VersionEntry {
  id: number;
  version_string: string;
  release_type: string;
  summary: string;
  changes_count: number;
  modules_changed: string | null;
  breaking_changes: boolean;
  released_at: string;
  git_commit_hash: string | null;
}

interface VectorNamespace {
  namespace: string;
  total_docs: number;
  with_embeddings: number;
  coverage_pct: number;
}

interface VectorTotals {
  total_docs: number;
  with_embeddings: number;
  namespace_count: number;
}

interface SearchResult {
  id: number;
  namespace: string;
  source_type: string;
  content_text: string;
  rank: number;
  created_at: string;
}

interface SyntheticDataset {
  id: number;
  module_name: string;
  dataset_name: string;
  dataset_type: string;
  record_count: number;
  status: string;
  source_tag: string;
  generated_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TABS = [
  'Tech Stack', 'Feature Registry', 'Reference Tables',
  'Version Registry', 'Vector Store', 'Synthetic Data',
  'Navigation Map', 'Demo Scenarios',
] as const;
type Tab = typeof TABS[number];

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  built: 'bg-green-100 text-green-800',
  complete: 'bg-green-100 text-green-800',
  deprecated: 'bg-red-100 text-red-800',
  planned: 'bg-gray-100 text-gray-600',
  pending: 'bg-yellow-100 text-yellow-800',
  generating: 'bg-blue-100 text-blue-800',
  partial: 'bg-yellow-100 text-yellow-700',
  full: 'bg-green-100 text-green-800',
  none: 'bg-gray-100 text-gray-500',
};

const RELEASE_COLOR: Record<string, string> = {
  major: 'bg-purple-100 text-purple-800',
  minor: 'bg-blue-100 text-blue-800',
  patch: 'bg-gray-100 text-gray-700',
};

function Badge({ label, color }: { label: string; color?: string }) {
  const cls = color ?? STATUS_COLOR[label] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center items-center py-12">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// Full admin navigation tree for Navigation Map tab
const NAV_TREE = [
  {
    group: 'Dashboard',
    items: [
      { label: 'Admin Home', route: '/admin', status: 'built' },
      { label: 'Command Center', route: '/admin/command-center', status: 'built' },
      { label: 'Executive Dashboard', route: '/admin/executive', status: 'built' },
      { label: 'Analytics', route: '/admin/analytics', status: 'built' },
      { label: 'CX Dashboard', route: '/admin/cx-dashboard', status: 'built' },
    ],
  },
  {
    group: 'CRM & Leads',
    items: [
      { label: 'Leads', route: '/admin/leads', status: 'built' },
      { label: 'Customer 360', route: '/admin/customer-360', status: 'built' },
      { label: 'Contact Submissions', route: '/admin/contact-submissions', status: 'built' },
      { label: 'Call Requests', route: '/admin/call-requests', status: 'built' },
      { label: 'CRM', route: '/admin/crm', status: 'built' },
    ],
  },
  {
    group: 'Content & Blog',
    items: [
      { label: 'Blog CMS', route: '/admin/blog-cms', status: 'built' },
      { label: 'Content Library', route: '/admin/content-library', status: 'built' },
      { label: 'Case Studies', route: '/admin/case-studies', status: 'built' },
      { label: 'FAQ', route: '/admin/faq', status: 'built' },
      { label: 'Banners', route: '/admin/banners', status: 'built' },
    ],
  },
  {
    group: 'Social Media',
    items: [
      { label: 'Social Compose', route: '/admin/social/compose', status: 'built' },
      { label: 'Social Scheduler', route: '/admin/social/scheduler', status: 'built' },
      { label: 'Content Calendar', route: '/admin/social/calendar', status: 'built' },
      { label: 'Social Platform Setup', route: '/admin/social/setup', status: 'built' },
      { label: 'Meta Setup Assistant', route: '/admin/social/meta-setup', status: 'built' },
      { label: 'Platform Setup Guide', route: '/admin/social/platform-setup-guide', status: 'built' },
    ],
  },
  {
    group: 'Marketing & Campaigns',
    items: [
      { label: 'Campaigns', route: '/admin/campaigns', status: 'built' },
      { label: 'Email', route: '/admin/email', status: 'built' },
      { label: 'Drip Campaigns', route: '/admin/drip-campaigns', status: 'built' },
      { label: 'Broadcast', route: '/admin/broadcast', status: 'built' },
      { label: 'Ad Planner', route: '/admin/ad-planner', status: 'built' },
      { label: 'Ads Manager', route: '/admin/ads', status: 'built' },
      { label: 'CTAs', route: '/admin/ctas', status: 'built' },
      { label: 'Forms', route: '/admin/forms', status: 'built' },
    ],
  },
  {
    group: 'Affiliates & Referrals',
    items: [
      { label: 'Affiliate Partners', route: '/admin/affiliate-partners', status: 'built' },
      { label: 'Affiliate Payouts', route: '/admin/affiliate-payouts', status: 'built' },
      { label: 'Affiliate Tiers', route: '/admin/affiliate-tiers', status: 'built' },
      { label: 'Affiliate Materials', route: '/admin/affiliate-materials', status: 'built' },
      { label: 'Affiliate Fraud', route: '/admin/affiliate-fraud', status: 'built' },
      { label: 'Affiliate Campaigns', route: '/admin/affiliate-campaigns', status: 'built' },
    ],
  },
  {
    group: 'Ecommerce & Billing',
    items: [
      { label: 'Ecommerce', route: '/admin/ecommerce', status: 'built' },
      { label: 'Billing', route: '/admin/billing', status: 'built' },
      { label: 'Coupons', route: '/admin/coupons', status: 'built' },
      { label: 'Orders Admin', route: '/admin/orders', status: 'built' },
    ],
  },
  {
    group: 'Classes & Booking',
    items: [
      { label: 'Classes', route: '/admin/classes', status: 'built' },
      { label: 'Bookings', route: '/admin/bookings', status: 'built' },
      { label: 'Calendar', route: '/admin/calendar', status: 'built' },
      { label: 'Attendance', route: '/admin/attendance', status: 'built' },
      { label: 'Events', route: '/admin/events', status: 'built' },
    ],
  },
  {
    group: 'Brand & Design',
    items: [
      { label: 'Brand Guide', route: '/admin/brand-guide', status: 'built' },
      { label: 'Brand Kits', route: '/admin/brand-kits', status: 'built' },
      { label: 'Brand Strategy', route: '/admin/brand-strategy', status: 'built' },
      { label: 'Brand Templates', route: '/admin/brand-templates', status: 'built' },
      { label: 'Branding', route: '/admin/branding', status: 'built' },
    ],
  },
  {
    group: 'AI & Agents',
    items: [
      { label: 'Agent Console', route: '/admin/agent-console', status: 'built' },
      { label: 'Agent Supervisor', route: '/admin/agent-supervisor', status: 'built' },
      { label: 'AI Governance', route: '/admin/ai-governance', status: 'built' },
      { label: 'AI Ingestion', route: '/admin/ai-ingestion', status: 'built' },
      { label: 'ChatGPT Feedback', route: '/admin/chatgpt-feedback', status: 'built' },
    ],
  },
  {
    group: 'Platform & Integrations',
    items: [
      { label: 'Platforms', route: '/admin/platforms', status: 'built' },
      { label: 'Platform Integration', route: '/admin/platform-integration', status: 'built' },
      { label: 'Platform Monitoring', route: '/admin/platform-monitoring', status: 'built' },
      { label: 'Platform Credentials', route: '/admin/platform-credentials', status: 'built' },
      { label: 'Platform Workflows', route: '/admin/platform-workflows', status: 'built' },
      { label: 'Platform API Catalog', route: '/admin/platform-api-catalog', status: 'built' },
      { label: 'Platform Setup', route: '/admin/platform-setup', status: 'built' },
    ],
  },
  {
    group: 'Market Research & Competitors',
    items: [
      { label: 'Competitors', route: '/admin/competitors', status: 'built' },
      { label: 'Competitors Benchmark', route: '/admin/competitors-benchmark', status: 'built' },
      { label: 'Geo/AEO', route: '/admin/geo-aeo', status: 'built' },
      { label: 'Evidence', route: '/admin/evidence', status: 'built' },
      { label: 'Experiments', route: '/admin/experiments', status: 'built' },
    ],
  },
  {
    group: 'Infrastructure & Dev',
    items: [
      { label: 'System Architecture Hub', route: '/admin/system-architecture', status: 'built' },
      { label: 'Architecture Center', route: '/admin/architecture-center', status: 'built' },
      { label: 'Build Status', route: '/admin/build-status', status: 'built' },
      { label: 'Demo Hub', route: '/admin/demo-hub', status: 'built' },
      { label: 'Audit', route: '/admin/audit', status: 'built' },
      { label: 'Config', route: '/admin/config', status: 'built' },
      { label: 'API Tracking', route: '/admin/api-tracking', status: 'built' },
      { label: 'Log Viewer', route: '/admin/logs', status: 'built' },
      { label: 'Quality Center', route: '/admin/quality-center', status: 'built' },
      { label: 'Module Assurance', route: '/admin/module-assurance', status: 'built' },
    ],
  },
];

// Demo scenarios for Tab 8
const DEMO_SCENARIOS = [
  {
    title: 'Platform Integration',
    icon: '🔌',
    description: 'Connect a new social platform end-to-end.',
    steps: [
      { step: 1, action: 'Navigate to Admin > Platform > Integration', detail: 'Open /admin/platform-integration' },
      { step: 2, action: 'Enable Facebook as a new platform', detail: 'Toggle Facebook ON, enter App ID and App Secret from Meta Developer Portal' },
      { step: 3, action: 'Create System User token', detail: 'Generate long-lived token via Meta Business Suite > System Users' },
      { step: 4, action: 'Configure Webhook', detail: 'Set webhook URL to /api/mcp/social with verify token. Subscribe to: messages, feed, mention events' },
      { step: 5, action: 'Test connection', detail: 'Click "Test Connection" — should return status: ok and page_name' },
      { step: 6, action: 'Verify in Platform Monitoring', detail: 'Navigate to /admin/platform-monitoring — Facebook shows as green/active' },
    ],
  },
  {
    title: 'Workflow Automation',
    icon: '⚡',
    description: 'Create and run an automated workflow.',
    steps: [
      { step: 1, action: 'Navigate to Platform Workflows', detail: 'Open /admin/platform-workflows' },
      { step: 2, action: 'Click "New Workflow"', detail: 'Enter name: "New Lead Welcome", trigger: customer_signup, status: active' },
      { step: 3, action: 'Add Step 1 — Send Welcome Email', detail: 'Action type: send_email, template: welcome, delay: 0 minutes' },
      { step: 4, action: 'Add Step 2 — Schedule Follow-up Call', detail: 'Action type: create_task, assignee: sales_team, delay: 1440 minutes (24h)' },
      { step: 5, action: 'Activate and test run', detail: 'Click Activate. Use "Run Now" in Demo Hub to trigger with a test customer record' },
      { step: 6, action: 'View run history', detail: 'Check platform_workflow_run table — status: complete, steps_completed: 2' },
    ],
  },
  {
    title: 'Bot Chat Flow',
    icon: '🤖',
    description: 'End-to-end customer chat bot interaction with escalation.',
    steps: [
      { step: 1, action: 'Customer opens chat widget', detail: 'Widget loads at bottom-right of any public page. Bot greets: "Hi! How can I help you today?"' },
      { step: 2, action: 'Customer asks billing question', detail: '"What is the cost of the monthly unlimited membership?"' },
      { step: 3, action: 'Bot queries knowledge base', detail: 'Searches bot_knowledge_base — finds FAQ: "Monthly unlimited = $89/month, Annual = $799/year"' },
      { step: 4, action: 'Bot responds with answer', detail: 'Displays answer. Offers: "Would you like to book a class or speak with our team?"' },
      { step: 5, action: 'Customer requests human escalation', detail: 'Customer: "I need to speak with someone about a billing issue"' },
      { step: 6, action: 'Escalation triggered', detail: 'Bot creates support ticket in /admin/chat-requests. Notifies admin via Novu. Shows customer: "I\'ve connected you with our team. ETA: 10 minutes."' },
    ],
  },
  {
    title: 'Lead Generation Pipeline',
    icon: '🎯',
    description: 'Import, qualify, and close a lead using AI scoring.',
    steps: [
      { step: 1, action: 'Import leads via CSV', detail: 'Admin > Leads > Import CSV. Upload file with: name, email, phone, source, notes' },
      { step: 2, action: 'AI qualification runs', detail: 'OpportunityScoringJob (daily 3:15am) assigns score 0-100 based on: engagement, source, demographics, class interest' },
      { step: 3, action: 'Review high-score leads', detail: 'Filter leads by score > 70 — these are "hot" prospects. Review in /admin/leads' },
      { step: 4, action: 'Send personalized outreach', detail: 'Select lead → "Send Drip Sequence" → choose "Hot Lead Welcome" campaign' },
      { step: 5, action: 'Track engagement', detail: 'Email opens, clicks tracked in campaign analytics. Lead status auto-updates to "engaged"' },
      { step: 6, action: 'Close deal', detail: 'Lead books trial class → converts to customer. CRM updates status: won. Triggers referral invitation if NPS > 8' },
    ],
  },
  {
    title: 'Market Research Report',
    icon: '📊',
    description: 'AI-powered competitor analysis and market report.',
    steps: [
      { step: 1, action: 'Navigate to Market Research', detail: 'Open /admin/competitors or /admin/competitors-benchmark' },
      { step: 2, action: 'Create research project', detail: 'Click "New Analysis" — enter: competitors (CorePower, Alo Moves, local studios), research dimensions (pricing, social, content, reviews)' },
      { step: 3, action: 'Run AI report', detail: 'MarketResearchPricingDigestJob (Monday 8am) ingests competitor data and calls Ollama llama3.2 to generate structured analysis' },
      { step: 4, action: 'View competitor analysis', detail: 'Dashboard shows: price positioning map, social share-of-voice, content gap analysis, review sentiment comparison' },
      { step: 5, action: 'Export and share', detail: 'Click Export PDF — generates formatted report with charts. Share link created for stakeholders' },
      { step: 6, action: 'Set up monitoring alert', detail: 'Configure alert: "Notify me if competitor pricing changes >10%". ViralDetectionJob monitors weekly.' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function SystemArchitecturePage() {
  const [activeTab, setActiveTab] = useState<Tab>('Tech Stack');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/system-architecture');
      if (res.ok) setStats(await res.json() as DashboardStats);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void fetchStats(); }, [fetchStats]);

  const handleSeedAll = async () => {
    setSeeding(true);
    setSeedMsg('');
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch('/api/admin/system-architecture/seed', { method: 'POST' }),
        fetch('/api/admin/vector-store/seed', { method: 'POST' }),
        fetch('/api/admin/synthetic-data/seed', { method: 'POST' }),
      ]);
      const [d1, d2, d3] = await Promise.all([r1.json(), r2.json(), r3.json()]) as [
        { tech_stack_rows?: number; feature_rows?: number; version_rows?: number },
        { seeded?: number },
        { seeded?: number },
      ];
      setSeedMsg(
        `Seeded: ${d1.tech_stack_rows ?? 0} tech entries, ${d1.feature_rows ?? 0} features, ${d1.version_rows ?? 0} versions | ${d2.seeded ?? 0} vector docs | ${d3.seeded ?? 0} synthetic datasets`
      );
      void fetchStats();
    } catch (e) {
      setSeedMsg(`Error: ${String(e)}`);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🏗️ System Architecture Hub</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tech stack · feature registry · version history · vector store · synthetic data · navigation map
          </p>
        </div>
        <button
          onClick={handleSeedAll}
          disabled={seeding}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {seeding ? 'Seeding…' : 'Seed All Tables'}
        </button>
      </div>

      {seedMsg && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          {seedMsg}
        </div>
      )}

      {/* KPI row */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: 'Features', value: stats.feature_count },
            { label: 'Tech Stack', value: stats.tech_stack_count },
            { label: 'Current Version', value: stats.current_version },
            { label: 'Vector Docs', value: stats.vector_doc_count },
            { label: 'Synthetic Datasets', value: stats.synthetic_dataset_count },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500">{label}</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors ${
                activeTab === tab
                  ? 'bg-white border border-b-0 border-gray-200 text-indigo-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'Tech Stack' && <TechStackTab />}
        {activeTab === 'Feature Registry' && <FeatureRegistryTab />}
        {activeTab === 'Reference Tables' && <RefTablesTab />}
        {activeTab === 'Version Registry' && <VersionRegistryTab />}
        {activeTab === 'Vector Store' && <VectorStoreTab />}
        {activeTab === 'Synthetic Data' && <SyntheticDataTab />}
        {activeTab === 'Navigation Map' && <NavigationMapTab />}
        {activeTab === 'Demo Scenarios' && <DemoScenariosTab />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: Tech Stack
// ---------------------------------------------------------------------------

function TechStackTab() {
  const [entries, setEntries] = useState<TechStackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ category: '', name: '', version: '', purpose: '', docs_url: '', is_core: false });

  useEffect(() => {
    fetch('/api/admin/system-architecture/tech-stack')
      .then((r) => r.json())
      .then((d: { entries?: TechStackEntry[] }) => setEntries(d.entries ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const grouped = entries.reduce<Record<string, TechStackEntry[]>>((acc, e) => {
    const cat = e.category ?? 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(e);
    return acc;
  }, {});

  const handleAdd = async () => {
    const res = await fetch('/api/admin/system-architecture/tech-stack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const d = await res.json() as { entry?: TechStackEntry };
      if (d.entry) setEntries((prev) => [...prev, d.entry!]);
      setShowAdd(false);
      setForm({ category: '', name: '', version: '', purpose: '', docs_url: '', is_core: false });
    }
  };

  const exportMarkdown = () => {
    const lines = ['# Tech Stack\n'];
    for (const [cat, items] of Object.entries(grouped)) {
      lines.push(`## ${cat}\n`);
      lines.push('| Name | Version | Purpose | Docs |\n|---|---|---|---|');
      for (const e of items) {
        lines.push(`| **${e.name}** | ${e.version ?? '—'} | ${e.purpose ?? '—'} | ${e.docs_url ? `[docs](${e.docs_url})` : '—'} |`);
      }
      lines.push('');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tech-stack.md';
    a.click();
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
          + Add Entry
        </button>
        <button onClick={exportMarkdown} className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
          Export Markdown
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 grid grid-cols-3 gap-3">
          {(['category', 'name', 'version', 'purpose', 'docs_url'] as const).map((f) => (
            <input
              key={f}
              placeholder={f.replace('_', ' ')}
              value={form[f]}
              onChange={(e) => setForm((prev) => ({ ...prev, [f]: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            />
          ))}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.is_core} onChange={(e) => setForm((p) => ({ ...p, is_core: e.target.checked }))} />
            Core
          </label>
          <button onClick={handleAdd} className="col-span-3 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
            Save
          </button>
        </div>
      )}

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">{cat}</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Name', 'Version', 'Purpose', 'Core', 'Status', 'Docs'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-50">
                {items.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">{e.name}</td>
                    <td className="px-4 py-2 text-gray-600">{e.version ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-600 max-w-xs truncate">{e.purpose ?? '—'}</td>
                    <td className="px-4 py-2">{e.is_core ? '⭐' : ''}</td>
                    <td className="px-4 py-2"><Badge label={e.status} /></td>
                    <td className="px-4 py-2">
                      {e.docs_url ? (
                        <a href={e.docs_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline text-xs">
                          docs ↗
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Feature Registry
// ---------------------------------------------------------------------------

function FeatureRegistryTab() {
  const [features, setFeatures] = useState<FeatureEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ module: '', type: '', status: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.module) params.set('module', filters.module);
    if (filters.type) params.set('type', filters.type);
    if (filters.status) params.set('status', filters.status);
    const res = await fetch(`/api/admin/system-architecture/features?${params}`);
    if (res.ok) {
      const d = await res.json() as { features?: FeatureEntry[] };
      setFeatures(d.features ?? []);
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => { void load(); }, [load]);

  const exportCSV = () => {
    const header = 'Module,Feature,Type,Route,Status,Admin,Customer,Coverage\n';
    const rows = features.map((f) =>
      `"${f.module_name}","${f.feature_name}","${f.feature_type}","${f.route_or_path ?? ''}","${f.status}","${f.admin_only}","${f.customer_accessible}","${f.test_coverage}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'feature-registry.csv';
    a.click();
  };

  const types = [...new Set(features.map((f) => f.feature_type))].sort();
  const modules = [...new Set(features.map((f) => f.module_name))].sort();

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <select
          value={filters.module}
          onChange={(e) => setFilters((p) => ({ ...p, module: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">All Modules</option>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={filters.type}
          onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">All Types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">All Statuses</option>
          {['built', 'partial', 'planned'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={exportCSV} className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
          Export CSV
        </button>
        <span className="ml-auto text-sm text-gray-500">{features.length} features</span>
      </div>

      {loading ? <Spinner /> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Module', 'Feature', 'Type', 'Route', 'Status', 'Admin', 'Customer', 'Coverage', 'Nav Path'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {features.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-700 font-medium whitespace-nowrap">{f.module_name}</td>
                  <td className="px-3 py-2 text-gray-900 whitespace-nowrap">{f.feature_name}</td>
                  <td className="px-3 py-2"><Badge label={f.feature_type} color="bg-blue-50 text-blue-700" /></td>
                  <td className="px-3 py-2 text-gray-500 text-xs max-w-[160px] truncate">{f.route_or_path ?? '—'}</td>
                  <td className="px-3 py-2"><Badge label={f.status} /></td>
                  <td className="px-3 py-2 text-center">{f.admin_only ? '✅' : ''}</td>
                  <td className="px-3 py-2 text-center">{f.customer_accessible ? '✅' : ''}</td>
                  <td className="px-3 py-2"><Badge label={f.test_coverage} /></td>
                  <td className="px-3 py-2 text-gray-500 text-xs max-w-[140px] truncate">{f.navigation_path ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Reference Tables
// ---------------------------------------------------------------------------

function RefTablesTab() {
  const [tables, setTables] = useState<RefTable[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/system-architecture/ref-tables');
    if (res.ok) {
      const d = await res.json() as { tables?: RefTable[] };
      setTables(d.tables ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{tables.length} tables in database</span>
        <button onClick={load} className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
          Refresh Counts
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Table', 'Row Count', 'Purpose', 'Key Columns', 'Editable'].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-50">
            {tables.map((t) => (
              <tr key={t.table_name} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs text-gray-900">{t.table_name}</td>
                <td className="px-4 py-2 text-gray-700 font-semibold">{t.row_count.toLocaleString()}</td>
                <td className="px-4 py-2 text-gray-600 max-w-sm text-xs">{t.purpose ?? '—'}</td>
                <td className="px-4 py-2 font-mono text-xs text-gray-500">{t.key_columns ?? '—'}</td>
                <td className="px-4 py-2">{t.is_editable ? <Badge label="editable" color="bg-green-50 text-green-700" /> : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 4: Version Registry
// ---------------------------------------------------------------------------

function VersionRegistryTab() {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ version_string: '', release_type: 'minor', summary: '', modules_changed: '', breaking_changes: false });

  useEffect(() => {
    fetch('/api/admin/system-architecture/versions')
      .then((r) => r.json())
      .then((d: { versions?: VersionEntry[] }) => setVersions(d.versions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCut = async () => {
    const res = await fetch('/api/admin/system-architecture/versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const d = await res.json() as { version?: VersionEntry };
      if (d.version) setVersions((prev) => [d.version!, ...prev]);
      setShowModal(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <button onClick={() => setShowModal(true)} className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
        Cut Release
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4">
            <h2 className="text-lg font-bold">Cut New Release</h2>
            <input placeholder="Version (e.g. 2.1.0)" value={form.version_string} onChange={(e) => setForm((p) => ({ ...p, version_string: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <select value={form.release_type} onChange={(e) => setForm((p) => ({ ...p, release_type: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {['major', 'minor', 'patch'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <textarea placeholder="Release summary" value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-24 resize-none" />
            <input placeholder="Affected modules (comma-separated)" value={form.modules_changed} onChange={(e) => setForm((p) => ({ ...p, modules_changed: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.breaking_changes} onChange={(e) => setForm((p) => ({ ...p, breaking_changes: e.target.checked }))} />
              Breaking changes?
            </label>
            <div className="flex gap-2">
              <button onClick={handleCut} className="flex-1 px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Create</button>
              <button onClick={() => setShowModal(false)} className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Version', 'Type', 'Summary', 'Modules', 'Breaking', 'Released', 'Commit'].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-50">
            {versions.map((v) => (
              <tr key={v.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-bold text-gray-900">{v.version_string}</td>
                <td className="px-4 py-2"><Badge label={v.release_type} color={RELEASE_COLOR[v.release_type] ?? ''} /></td>
                <td className="px-4 py-2 text-gray-600 max-w-xs text-xs">{v.summary}</td>
                <td className="px-4 py-2 text-gray-500 text-xs">{v.modules_changed ?? '—'}</td>
                <td className="px-4 py-2">{v.breaking_changes ? <Badge label="breaking" color="bg-red-100 text-red-700" /> : ''}</td>
                <td className="px-4 py-2 text-gray-500 text-xs">{new Date(v.released_at).toLocaleDateString()}</td>
                <td className="px-4 py-2 font-mono text-xs text-gray-500">{v.git_commit_hash ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 5: Vector Store
// ---------------------------------------------------------------------------

function VectorStoreTab() {
  const [namespaces, setNamespaces] = useState<VectorNamespace[]>([]);
  const [totals, setTotals] = useState<VectorTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searchNs, setSearchNs] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addForm, setAddForm] = useState({ namespace: '', source_type: 'manual', content_text: '' });
  const [embedding, setEmbedding] = useState('');

  const loadStats = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/vector-store');
    if (res.ok) {
      const d = await res.json() as { namespaces?: VectorNamespace[]; totals?: VectorTotals };
      setNamespaces(d.namespaces ?? []);
      setTotals(d.totals ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadStats(); }, [loadStats]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    const res = await fetch('/api/admin/vector-store/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, namespace: searchNs || undefined, limit: 10 }),
    });
    if (res.ok) {
      const d = await res.json() as { results?: SearchResult[] };
      setResults(d.results ?? []);
    }
    setSearching(false);
  };

  const handleReEmbed = async (ns: string) => {
    setEmbedding(ns);
    await fetch('/api/admin/vector-store/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ namespace: ns }),
    });
    setEmbedding('');
    void loadStats();
  };

  const handleAddDoc = async () => {
    await fetch('/api/admin/vector-store/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addForm),
    });
    setAddForm({ namespace: '', source_type: 'manual', content_text: '' });
    void loadStats();
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      {totals && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Docs', value: totals.total_docs },
            { label: 'With Embeddings', value: totals.with_embeddings },
            { label: 'Namespaces', value: totals.namespace_count },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500">{label}</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Namespace table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Namespace', 'Docs', 'Embedded', 'Coverage', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-50">
            {namespaces.map((ns) => (
              <tr key={ns.namespace} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs text-gray-900">{ns.namespace}</td>
                <td className="px-4 py-2 text-gray-700">{ns.total_docs}</td>
                <td className="px-4 py-2 text-gray-700">{ns.with_embeddings}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-500 h-2 rounded-full"
                        style={{ width: `${ns.coverage_pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600">{ns.coverage_pct}%</span>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => handleReEmbed(ns.namespace)}
                    disabled={embedding === ns.namespace}
                    className="px-2 py-1 text-xs bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 disabled:opacity-50"
                  >
                    {embedding === ns.namespace ? 'Embedding…' : 'Re-embed'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Search */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Semantic Search (Full-Text)</h3>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter search query..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={searchNs}
            onChange={(e) => setSearchNs(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All namespaces</option>
            {namespaces.map((ns) => <option key={ns.namespace} value={ns.namespace}>{ns.namespace}</option>)}
          </select>
          <button onClick={handleSearch} disabled={searching} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((r) => (
              <div key={r.id} className="bg-white rounded-lg border border-gray-200 p-3 text-sm">
                <div className="flex gap-2 mb-1">
                  <Badge label={r.namespace} color="bg-indigo-50 text-indigo-700" />
                  <Badge label={r.source_type} color="bg-gray-100 text-gray-600" />
                  <span className="ml-auto text-xs text-gray-400">rank: {Number(r.rank).toFixed(4)}</span>
                </div>
                <p className="text-gray-700 text-xs">{r.content_text.slice(0, 300)}{r.content_text.length > 300 ? '…' : ''}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Doc */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Add Document</h3>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Namespace" value={addForm.namespace} onChange={(e) => setAddForm((p) => ({ ...p, namespace: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Source type" value={addForm.source_type} onChange={(e) => setAddForm((p) => ({ ...p, source_type: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <textarea placeholder="Content text" value={addForm.content_text} onChange={(e) => setAddForm((p) => ({ ...p, content_text: e.target.value }))} className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm h-20 resize-none" />
        </div>
        <button onClick={handleAddDoc} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
          Add & Embed
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 6: Synthetic Data
// ---------------------------------------------------------------------------

function SyntheticDataTab() {
  const [datasets, setDatasets] = useState<SyntheticDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ module_name: '', dataset_name: '', dataset_type: 'leads', record_count: 10 });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/synthetic-data');
    if (res.ok) {
      const d = await res.json() as { datasets?: SyntheticDataset[] };
      setDatasets(d.datasets ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleGenerate = async (ds: SyntheticDataset) => {
    setGenerating(ds.id);
    const res = await fetch('/api/admin/synthetic-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module_name: ds.module_name, dataset_name: ds.dataset_name, dataset_type: ds.dataset_type, record_count: ds.record_count }),
    });
    if (res.ok) {
      const d = await res.json() as { data?: unknown[]; dataset?: SyntheticDataset };
      const data = d.data ?? [];
      // Download JSON
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${ds.dataset_name.replace(/\s+/g, '-').toLowerCase()}.json`;
      a.click();
    }
    setGenerating(null);
    void load();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/admin/synthetic-data/${id}`, { method: 'DELETE' });
    void load();
  };

  const handleCreateNew = async () => {
    await fetch('/api/admin/synthetic-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    void load();
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
          Generate Dataset
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 grid grid-cols-2 gap-3">
          <input placeholder="Module name" value={form.module_name} onChange={(e) => setForm((p) => ({ ...p, module_name: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Dataset name" value={form.dataset_name} onChange={(e) => setForm((p) => ({ ...p, dataset_name: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <select value={form.dataset_type} onChange={(e) => setForm((p) => ({ ...p, dataset_type: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            {['market_research', 'leads', 'blog', 'surveys', 'social_content', 'competitor'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="number" placeholder="Record count" value={form.record_count} onChange={(e) => setForm((p) => ({ ...p, record_count: Number(e.target.value) }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <button onClick={handleCreateNew} className="col-span-2 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
            Generate with Ollama
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Module', 'Dataset', 'Type', 'Records', 'Status', 'Source', 'Generated', 'Actions'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-50">
            {datasets.map((ds) => (
              <tr key={ds.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-700 font-medium">{ds.module_name}</td>
                <td className="px-3 py-2 text-gray-900">{ds.dataset_name}</td>
                <td className="px-3 py-2"><Badge label={ds.dataset_type} color="bg-blue-50 text-blue-700" /></td>
                <td className="px-3 py-2 text-gray-700">{ds.record_count}</td>
                <td className="px-3 py-2"><Badge label={ds.status} /></td>
                <td className="px-3 py-2"><Badge label={ds.source_tag} color="bg-yellow-50 text-yellow-700" /></td>
                <td className="px-3 py-2 text-xs text-gray-500">{ds.generated_at ? new Date(ds.generated_at).toLocaleDateString() : '—'}</td>
                <td className="px-3 py-2 flex gap-1">
                  <button
                    onClick={() => handleGenerate(ds)}
                    disabled={generating === ds.id}
                    className="px-2 py-1 text-xs bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 disabled:opacity-50"
                  >
                    {generating === ds.id ? 'Generating…' : 'Download JSON'}
                  </button>
                  <button
                    onClick={() => handleDelete(ds.id)}
                    className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
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

// ---------------------------------------------------------------------------
// Tab 7: Navigation Map
// ---------------------------------------------------------------------------

function NavigationMapTab() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (group: string) => setExpanded((p) => ({ ...p, [group]: !p[group] }));

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500 mb-4">
        Full admin navigation tree — {NAV_TREE.reduce((acc, g) => acc + g.items.length, 0)} routes across {NAV_TREE.length} groups
      </p>
      {NAV_TREE.map((group) => (
        <div key={group.group} className="border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => toggle(group.group)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-sm font-semibold text-gray-700"
          >
            <span>{group.group} <span className="text-gray-400 font-normal">({group.items.length})</span></span>
            <span className="text-gray-400">{expanded[group.group] ? '▲' : '▼'}</span>
          </button>
          {expanded[group.group] && (
            <div className="divide-y divide-gray-50">
              {group.items.map((item) => (
                <div key={item.route} className="flex items-center justify-between px-4 py-2 bg-white hover:bg-gray-50">
                  <div>
                    <span className="text-sm text-gray-900">{item.label}</span>
                    <code className="ml-3 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{item.route}</code>
                  </div>
                  <Badge label={item.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 8: Demo Scenarios
// ---------------------------------------------------------------------------

function DemoScenariosTab() {
  const [activeScenario, setActiveScenario] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const scenario = DEMO_SCENARIOS[activeScenario];

  const markComplete = (key: string) => setCompleted((prev) => new Set([...prev, key]));

  const nextStep = () => {
    const key = `${activeScenario}-${currentStep}`;
    markComplete(key);
    if (currentStep < scenario.steps.length - 1) {
      setCurrentStep((p) => p + 1);
    }
  };

  const reset = () => {
    setCurrentStep(0);
    setCompleted(new Set());
  };

  return (
    <div className="grid grid-cols-4 gap-6">
      {/* Scenario list */}
      <div className="col-span-1 space-y-2">
        {DEMO_SCENARIOS.map((s, i) => (
          <button
            key={i}
            onClick={() => { setActiveScenario(i); setCurrentStep(0); }}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${
              activeScenario === i
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="mr-2">{s.icon}</span>
            {s.title}
          </button>
        ))}
      </div>

      {/* Scenario player */}
      <div className="col-span-3 bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {scenario.icon} {scenario.title}
          </h2>
          <p className="text-sm text-gray-500 mt-1">{scenario.description}</p>
        </div>

        {/* Progress */}
        <div className="flex gap-2">
          {scenario.steps.map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1.5 rounded-full ${
                i < currentStep ? 'bg-green-500' : i === currentStep ? 'bg-indigo-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {scenario.steps.map((step, i) => {
            const key = `${activeScenario}-${i}`;
            const isDone = completed.has(key);
            const isCurrent = i === currentStep;

            return (
              <div
                key={i}
                className={`flex gap-4 p-4 rounded-xl border transition-all ${
                  isDone
                    ? 'border-green-200 bg-green-50'
                    : isCurrent
                    ? 'border-indigo-200 bg-indigo-50'
                    : 'border-gray-100 bg-gray-50 opacity-60'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  isDone ? 'bg-green-500 text-white' : isCurrent ? 'bg-indigo-600 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  {isDone ? '✓' : step.step}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{step.action}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{step.detail}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          {currentStep < scenario.steps.length - 1 ? (
            <button onClick={nextStep} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
              Next Step →
            </button>
          ) : (
            <div className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">
              ✅ Demo Complete!
            </div>
          )}
          <button onClick={reset} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
