'use client';

import { useEffect, useState, useCallback } from 'react';

// ── Tab definitions ────────────────────────────────────────────────────────────

const TABS = ['architecture', 'demo-stories', 'data-flow', 'tech-stack', 'module-inventory'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  'architecture': 'System Architecture',
  'demo-stories': 'User Demo Stories',
  'data-flow': 'Data Flow',
  'tech-stack': 'Tech Stack',
  'module-inventory': 'Module Inventory',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface DemoStory {
  id: number;
  title: string;
  persona: string;
  steps: string[];
  outcome: string;
  tryLink: string;
}

interface DataFlowStep {
  label: string;
  description?: string;
}

interface DataFlowItem {
  title: string;
  steps: DataFlowStep[];
}

interface ModuleRegistry {
  total: number;
  built: number;
  partial: number;
  not_built: number;
  modules: Array<{
    id: string;
    name: string;
    status: string;
    user_flow?: string;
    admin_flow?: string;
    has_db?: boolean;
    has_report?: boolean;
    has_dashboard?: boolean;
  }>;
}

// ── Static data ───────────────────────────────────────────────────────────────

const DEMO_STORIES: DemoStory[] = [
  {
    id: 1,
    title: 'Customer First Purchase',
    persona: 'Customer',
    steps: [
      'Browse shop at /customer/shop',
      'Add item to cart',
      'Proceed to checkout',
      'Fill shipping & payment details',
      'Submit order → order confirmation page',
    ],
    outcome: 'Order created in DB, customer receives confirmation. Loyalty points credited.',
    tryLink: '/customer/shop',
  },
  {
    id: 2,
    title: 'Admin Campaign Launch',
    persona: 'Admin',
    steps: [
      'Navigate to /admin/ad-planner',
      'Create new campaign with name, budget, geo-targets',
      'Add ad groups and keywords',
      'Set bidding strategy',
      'Click Launch → campaign status → active',
      'Monitor in /admin/ads',
    ],
    outcome: 'Campaign record active in DB. Impressions start tracking as ads serve.',
    tryLink: '/admin/ad-planner',
  },
  {
    id: 3,
    title: 'Affiliate Referral Journey',
    persona: 'Customer',
    steps: [
      'Affiliate receives unique /r/[code] link from admin',
      'Affiliate shares link to a friend',
      'Friend clicks link → cookie set with ref=CODE',
      'Friend signs up or purchases',
      'Commission tracked in affiliate_click & affiliate_conversion tables',
    ],
    outcome: 'Commission credited. Admin sees conversion in /admin/affiliates.',
    tryLink: '/admin/affiliates',
  },
  {
    id: 4,
    title: 'Social Post Scheduling',
    persona: 'Admin',
    steps: [
      'Go to /admin/social/compose',
      'Write post content, optionally attach image',
      'Select target platforms (Instagram, LinkedIn, etc.)',
      'Pick scheduled publish date/time',
      'Click Schedule → stored in social_post table',
      'PostizSocialAutoPublishJob cron fires and publishes via Postiz API',
    ],
    outcome: 'Post appears on all selected platforms at scheduled time.',
    tryLink: '/admin/social/compose',
  },
  {
    id: 5,
    title: 'Survey Analysis with AI',
    persona: 'Admin',
    steps: [
      'Navigate to /admin/surveys',
      'Create a new survey and publish the link to customers',
      'Responses collected in survey_response table',
      'Click Analyze → POST /api/admin/surveys/[id]/analyze',
      'Ollama llama3.2 model generates themes and sentiment summary',
      'Results displayed in the survey detail page',
    ],
    outcome: 'AI-generated theme report saved. Admin can export findings.',
    tryLink: '/admin/surveys',
  },
  {
    id: 6,
    title: 'A/B Test Lifecycle',
    persona: 'Admin',
    steps: [
      'Go to /admin/ab-testing → Create New tab',
      'Define test name, page path, hypothesis, traffic split',
      'Set variant A (Control) and variant B names',
      'Launch test → status = running',
      'Impressions and conversions tracked per variant',
      'Compare CVR in Results tab → declare winner',
    ],
    outcome: 'Winning variant identified by CVR lift %. Admin implements winner.',
    tryLink: '/admin/ab-testing',
  },
  {
    id: 7,
    title: 'Customer Tracking Funnel',
    persona: 'Admin',
    steps: [
      'useTrack hook fires on every page load in customer portal',
      'POST /api/customer/track with event_type + page_path',
      'Events stored in customer_event table',
      'Admin views /admin/api-tracking → live event feed',
      'Filter by page_path to spot where users drop off',
      'Fix identified friction point',
    ],
    outcome: 'Funnel drop-off quantified. Conversion rate improves after fix.',
    tryLink: '/admin/api-tracking',
  },
  {
    id: 8,
    title: 'Pop-up CTA Campaign',
    persona: 'Admin',
    steps: [
      'Go to /admin/popups → Create popup',
      'Set trigger type (exit-intent / timer / scroll)',
      'Choose target pages and CTA destination URL',
      'Set status = active',
      'Customer portal fetches /api/popups/active and renders popup',
      'Impressions and clicks tracked automatically',
    ],
    outcome: 'Pop-up impressions and CTR visible in admin dashboard.',
    tryLink: '/admin/popups',
  },
  {
    id: 9,
    title: 'Loyalty Points Earn & Redeem',
    persona: 'Customer',
    steps: [
      'Customer makes a purchase → order placed',
      'Post-order job credits loyalty points to loyalty_account',
      'Customer visits /customer/loyalty to view balance',
      'At checkout, customer applies points as a discount',
      'Points redeemed, balance updated in loyalty_transaction',
    ],
    outcome: 'Seamless earn & redeem loop. Customer loyalty incentivised.',
    tryLink: '/customer/loyalty',
  },
  {
    id: 10,
    title: 'TalentsHill Agency Onboard',
    persona: 'Agency Client',
    steps: [
      'Agency client logs into /talentshill/login',
      'Onboarding wizard collects brand info and campaign goals',
      'Client views active campaigns in TalentsHill dashboard',
      'Client requests a new campaign via request form',
      'Admin sees request in /admin/talentshill → approves and creates campaign',
      'Client tracks campaign analytics in their portal',
    ],
    outcome: 'Agency client fully self-served. Campaign goes live without direct admin involvement.',
    tryLink: '/talentshill',
  },
];

const DATA_FLOWS: DataFlowItem[] = [
  {
    title: 'Cart → Order Flow',
    steps: [
      { label: 'Customer adds item', description: 'POST /api/customer/cart/items' },
      { label: 'Cart persisted', description: 'cart_item table updated in PostgreSQL' },
      { label: 'Checkout initiated', description: 'POST /api/customer/cart/checkout' },
      { label: 'Validation', description: 'Stock, pricing, discount codes verified' },
      { label: 'Order created', description: 'INSERT into orders + order_items tables' },
      { label: 'Cart cleared', description: 'Cart items removed, order confirmation returned' },
    ],
  },
  {
    title: 'Social Post Scheduling Flow',
    steps: [
      { label: 'Admin composes', description: 'UI at /admin/social/compose' },
      { label: 'Schedule saved', description: 'POST /api/admin/social/posts → social_post table' },
      { label: 'Cron fires', description: 'PostizSocialAutoPublishJob every 5 min' },
      { label: 'Due posts fetched', description: 'SELECT WHERE scheduled_at <= NOW() AND status = pending' },
      { label: 'Postiz API called', description: 'POST https://postiz.io/api/v1/posts' },
      { label: 'Status updated', description: 'social_post.status = published' },
    ],
  },
  {
    title: 'AI Content Generation Flow',
    steps: [
      { label: 'Admin triggers', description: 'Click Analyze / Generate in admin UI' },
      { label: 'API route called', description: 'POST /api/admin/[module]/analyze' },
      { label: 'Prompt constructed', description: 'System prompt + user data assembled server-side' },
      { label: 'Ollama called', description: 'POST http://localhost:11434/api/generate (llama3.2)' },
      { label: 'Response streamed', description: 'Ollama returns generated text chunks' },
      { label: 'Result stored', description: 'Analysis saved to DB, returned to UI' },
    ],
  },
  {
    title: 'Affiliate Tracking Flow',
    steps: [
      { label: 'Link shared', description: '/r/[code] URL distributed by affiliate' },
      { label: 'Click lands', description: 'GET /r/[code] → route handler fires' },
      { label: 'Link validated', description: 'affiliate_link record fetched by code' },
      { label: 'Click logged', description: 'INSERT into affiliate_click with IP, UA, timestamp' },
      { label: 'Cookie set', description: 'ref=CODE cookie (HttpOnly, SameSite=lax, 30d TTL)' },
      { label: 'Redirect issued', description: '302 to destination_path with ?ref=CODE appended' },
    ],
  },
  {
    title: 'Customer Tracking Flow',
    steps: [
      { label: 'Page loads', description: 'useTrack hook fires on mount' },
      { label: 'Event fired', description: 'POST /api/customer/track with event_type + page_path' },
      { label: 'Table ensured', description: 'CREATE TABLE IF NOT EXISTS customer_event' },
      { label: 'Row inserted', description: 'session_id, customer_id, event_type, IP, UA stored' },
      { label: 'Fire-and-forget', description: 'Insert errors caught silently — page load never blocked' },
      { label: 'Admin views', description: '/admin/api-tracking shows live event feed' },
    ],
  },
];

const TECH_STACK_SECTIONS = [
  {
    section: 'Frontend',
    color: 'blue',
    items: [
      { tech: 'Next.js 14', role: 'App Router, SSR/ISR, API Routes' },
      { tech: 'React 18', role: 'UI components, hooks, Suspense' },
      { tech: 'TypeScript 5', role: 'Type safety across all layers' },
      { tech: 'Tailwind CSS', role: 'Utility-first styling, glassmorphism' },
      { tech: 'Playwright', role: 'E2E tests (pos/neg/boundary)' },
    ],
  },
  {
    section: 'Backend',
    color: 'purple',
    items: [
      { tech: 'Next.js API Routes', role: '80+ REST endpoints under /api/*' },
      { tech: 'Node.js 20', role: 'Runtime for API routes and cron jobs' },
      { tech: 'next-auth / JWT', role: 'Session management and role-based auth' },
      { tech: 'Postiz API', role: 'Social media publishing integration' },
      { tech: 'MCP Gateway', role: 'Tool-calling protocol for AI agents' },
    ],
  },
  {
    section: 'Database',
    color: 'green',
    items: [
      { tech: 'PostgreSQL 16', role: 'Primary datastore, port 5437' },
      { tech: 'pg / postgres.js', role: 'Connection pools: @/lib/db and @/lib/postgres' },
      { tech: '80+ tables', role: 'Full schema for all 30+ modules' },
      { tech: 'JSONB columns', role: 'Flexible metadata on events/campaigns' },
    ],
  },
  {
    section: 'AI',
    color: 'yellow',
    items: [
      { tech: 'Ollama', role: 'Local LLM host, port 11434' },
      { tech: 'llama3.2', role: 'Primary model for ad copy, survey analysis' },
      { tech: 'RAG pipeline', role: 'Document embeddings for context-aware generation' },
      { tech: '@/lib/ollama', role: 'Health check + generate wrapper' },
    ],
  },
  {
    section: 'Jobs',
    color: 'orange',
    items: [
      { tech: '25 Cron Jobs', role: 'Scheduled via node-cron on server start' },
      { tech: 'PostizSocialAutoPublishJob', role: 'Publish due social posts every 5 min' },
      { tech: 'FirstWaveDispatchJob', role: 'Campaign email/SMS dispatch' },
      { tech: 'module-registry sync', role: 'Flags stale registry entries' },
    ],
  },
  {
    section: 'Monitoring',
    color: 'red',
    items: [
      { tech: '/admin/build-status', role: 'Live build and integration health' },
      { tech: 'IntegrationHealth lib', role: 'Probes for PG, Ollama, Postiz, etc.' },
      { tech: 'Continuity', role: 'Decision log and session notes (.continuity/)' },
      { tech: 'jest --coverage', role: 'Unit test coverage per module' },
    ],
  },
];

// ── Persona badge ─────────────────────────────────────────────────────────────

const PERSONA_COLORS: Record<string, string> = {
  Customer: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  Admin: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  'Marketing Manager': 'bg-green-500/20 text-green-300 border border-green-500/30',
  'Agency Client': 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
};

function PersonaBadge({ persona }: { persona: string }) {
  const cls = PERSONA_COLORS[persona] ?? 'bg-gray-500/20 text-gray-300 border border-gray-500/30';
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{persona}</span>
  );
}

// ── Architecture Tab ──────────────────────────────────────────────────────────

function ArchitectureTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Platform Architecture</h2>
        <p className="text-white/50 text-sm">
          Visual overview of all layers — from user-facing portals down to the database and local AI.
        </p>
      </div>

      {/* Architecture diagram */}
      <div className="flex flex-col gap-1 text-sm font-mono">
        {/* Top layer — Portals */}
        <div className="flex gap-1">
          <div className="flex-1 bg-blue-500/20 border border-blue-400/40 rounded-lg p-3 text-center text-blue-200">
            <div className="font-bold text-blue-300 mb-1">Customer Portal</div>
            <div className="text-xs text-blue-200/70">/customer/*</div>
            <div className="text-xs text-blue-200/50 mt-1">Shop · Cart · Loyalty · Videos · Wellness</div>
          </div>
          <div className="flex-1 bg-cyan-500/20 border border-cyan-400/40 rounded-lg p-3 text-center text-cyan-200">
            <div className="font-bold text-cyan-300 mb-1">TalentsHill Portal</div>
            <div className="text-xs text-cyan-200/70">/talentshill/*</div>
            <div className="text-xs text-cyan-200/50 mt-1">Agency campaigns · Analytics · Requests</div>
          </div>
        </div>

        {/* Arrow */}
        <div className="text-center text-white/30 text-lg leading-none">↕</div>

        {/* Admin layer */}
        <div className="bg-purple-500/20 border border-purple-400/40 rounded-lg p-3 text-center text-purple-200">
          <div className="font-bold text-purple-300 mb-1">Admin Portal</div>
          <div className="text-xs text-purple-200/70">/admin/*  —  Role-gated (Admin / Editor / Sales)</div>
          <div className="text-xs text-purple-200/50 mt-1 flex flex-wrap justify-center gap-2">
            {['Campaigns', 'Social', 'Ads', 'Affiliates', 'A/B Tests', 'Popups', 'Surveys', 'Module Registry', 'Brand Guide', 'Analytics'].map(m => (
              <span key={m} className="bg-purple-500/20 px-1 rounded">{m}</span>
            ))}
          </div>
        </div>

        {/* Arrow */}
        <div className="text-center text-white/30 text-lg leading-none">↕</div>

        {/* App layer */}
        <div className="grid grid-cols-4 gap-1">
          <div className="bg-indigo-500/20 border border-indigo-400/40 rounded-lg p-3 text-center text-indigo-200">
            <div className="font-bold text-indigo-300 text-xs mb-1">Next.js Pages</div>
            <div className="text-xs text-indigo-200/50">SSR / ISR / CSR</div>
          </div>
          <div className="bg-violet-500/20 border border-violet-400/40 rounded-lg p-3 text-center text-violet-200">
            <div className="font-bold text-violet-300 text-xs mb-1">REST API Routes</div>
            <div className="text-xs text-violet-200/50">80+ /api/* endpoints</div>
          </div>
          <div className="bg-fuchsia-500/20 border border-fuchsia-400/40 rounded-lg p-3 text-center text-fuchsia-200">
            <div className="font-bold text-fuchsia-300 text-xs mb-1">Cron Jobs</div>
            <div className="text-xs text-fuchsia-200/50">25 scheduled jobs</div>
          </div>
          <div className="bg-pink-500/20 border border-pink-400/40 rounded-lg p-3 text-center text-pink-200">
            <div className="font-bold text-pink-300 text-xs mb-1">MCP Gateway</div>
            <div className="text-xs text-pink-200/50">/api/mcp/* tools</div>
          </div>
        </div>

        {/* Arrow */}
        <div className="text-center text-white/30 text-lg leading-none">↕</div>

        {/* Database layer */}
        <div className="bg-green-500/20 border border-green-400/40 rounded-lg p-3 text-center text-green-200">
          <div className="font-bold text-green-300 mb-1">PostgreSQL — port 5437</div>
          <div className="text-xs text-green-200/50">sohamyoga DB &middot; 80+ tables &middot; @/lib/db (pool) + @/lib/postgres (query)</div>
        </div>

        {/* Arrow */}
        <div className="text-center text-white/30 text-lg leading-none">↕</div>

        {/* AI layer */}
        <div className="bg-amber-500/20 border border-amber-400/40 rounded-lg p-3 text-center text-amber-200">
          <div className="font-bold text-amber-300 mb-1">Ollama — port 11434</div>
          <div className="text-xs text-amber-200/50">Local LLM &middot; llama3.2 &middot; Ad copy generation &middot; Survey analysis &middot; RAG pipeline</div>
        </div>

        {/* Arrow */}
        <div className="text-center text-white/30 text-lg leading-none">↕</div>

        {/* External services */}
        <div className="grid grid-cols-3 gap-1">
          <div className="bg-rose-500/20 border border-rose-400/40 rounded-lg p-3 text-center text-rose-200">
            <div className="font-bold text-rose-300 text-xs mb-1">Postiz API</div>
            <div className="text-xs text-rose-200/50">Social media publishing</div>
          </div>
          <div className="bg-teal-500/20 border border-teal-400/40 rounded-lg p-3 text-center text-teal-200">
            <div className="font-bold text-teal-300 text-xs mb-1">Activepieces</div>
            <div className="text-xs text-teal-200/50">Workflow automation</div>
          </div>
          <div className="bg-sky-500/20 border border-sky-400/40 rounded-lg p-3 text-center text-sky-200">
            <div className="font-bold text-sky-300 text-xs mb-1">n8n</div>
            <div className="text-xs text-sky-200/50">Instagram / YouTube automations</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h3 className="text-white font-semibold mb-3 text-sm">Legend</h3>
        <div className="grid grid-cols-2 gap-2 text-xs text-white/70">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-blue-500/40 border border-blue-400/50 shrink-0" />
            <span>Customer-facing portals (/customer/*, /talentshill/*)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-purple-500/40 border border-purple-400/50 shrink-0" />
            <span>Admin portals — role-gated access</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-indigo-500/40 border border-indigo-400/50 shrink-0" />
            <span>Application layer — Next.js pages + API routes</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-green-500/40 border border-green-400/50 shrink-0" />
            <span>PostgreSQL — primary persistence layer</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-amber-500/40 border border-amber-400/50 shrink-0" />
            <span>Ollama — local AI (private, no cloud dependency)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-rose-500/40 border border-rose-400/50 shrink-0" />
            <span>External 3rd-party integrations</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Demo Stories Tab ──────────────────────────────────────────────────────────

function DemoStoriesTab() {
  const [search, setSearch] = useState('');
  const [personaFilter, setPersonaFilter] = useState('All');

  const personas = ['All', ...Array.from(new Set(DEMO_STORIES.map(s => s.persona)))];

  const filtered = DEMO_STORIES.filter(s => {
    const matchesSearch =
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.persona.toLowerCase().includes(search.toLowerCase()) ||
      s.outcome.toLowerCase().includes(search.toLowerCase());
    const matchesPersona = personaFilter === 'All' || s.persona === personaFilter;
    return matchesSearch && matchesPersona;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">User Demo Stories</h2>
        <p className="text-white/50 text-sm">
          End-to-end journeys across all personas — use these to demo the platform to stakeholders.
        </p>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search stories..."
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
        <div className="flex gap-2 flex-wrap">
          {personas.map(p => (
            <button
              key={p}
              onClick={() => setPersonaFilter(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                personaFilter === p
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Story cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map(story => (
          <div
            key={story.id}
            className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="text-white/40 text-xs font-mono mr-2">#{story.id}</span>
                <h3 className="text-white font-semibold inline">{story.title}</h3>
              </div>
              <PersonaBadge persona={story.persona} />
            </div>

            <ol className="space-y-1 mb-4">
              {story.steps.map((step, i) => (
                <li key={i} className="text-white/60 text-sm flex gap-2">
                  <span className="text-indigo-400 font-mono text-xs mt-0.5 shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 mb-3">
              <span className="text-green-400 text-xs font-medium">Outcome: </span>
              <span className="text-green-300/80 text-xs">{story.outcome}</span>
            </div>

            <a
              href={story.tryLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors"
            >
              Try It →
            </a>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10 text-white/40 text-sm">No stories match your search.</div>
      )}
    </div>
  );
}

// ── Data Flow Tab ─────────────────────────────────────────────────────────────

function DataFlowTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Data Flow</h2>
        <p className="text-white/50 text-sm">
          Step-by-step data flows for the 5 key platform operations.
        </p>
      </div>

      {DATA_FLOWS.map((flow, fi) => (
        <div key={fi} className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">{flow.title}</h3>
          <div className="flex flex-wrap items-center gap-2">
            {flow.steps.map((step, si) => (
              <div key={si} className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <div className="bg-indigo-500/20 border border-indigo-400/30 rounded-lg px-3 py-2 text-center min-w-[110px]">
                    <div className="text-indigo-300 text-xs font-semibold">{step.label}</div>
                    {step.description && (
                      <div className="text-indigo-200/50 text-xs mt-0.5 leading-tight">{step.description}</div>
                    )}
                  </div>
                </div>
                {si < flow.steps.length - 1 && (
                  <span className="text-white/30 text-lg font-bold shrink-0">&rarr;</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tech Stack Tab ────────────────────────────────────────────────────────────

const SECTION_COLOR_MAP: Record<string, string> = {
  blue: 'border-blue-400/30 bg-blue-500/10',
  purple: 'border-purple-400/30 bg-purple-500/10',
  green: 'border-green-400/30 bg-green-500/10',
  yellow: 'border-amber-400/30 bg-amber-500/10',
  orange: 'border-orange-400/30 bg-orange-500/10',
  red: 'border-red-400/30 bg-red-500/10',
};
const SECTION_HEADER_COLOR_MAP: Record<string, string> = {
  blue: 'text-blue-300',
  purple: 'text-purple-300',
  green: 'text-green-300',
  yellow: 'text-amber-300',
  orange: 'text-orange-300',
  red: 'text-red-300',
};

function TechStackTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Tech Stack</h2>
        <p className="text-white/50 text-sm">All technologies in use, organised by layer.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TECH_STACK_SECTIONS.map(section => (
          <div
            key={section.section}
            className={`border rounded-xl p-4 ${SECTION_COLOR_MAP[section.color] ?? ''}`}
          >
            <h3 className={`font-bold text-sm mb-3 ${SECTION_HEADER_COLOR_MAP[section.color] ?? 'text-white'}`}>
              {section.section}
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/30 text-left">
                  <th className="pb-1 font-medium w-2/5">Technology</th>
                  <th className="pb-1 font-medium">Role / Version</th>
                </tr>
              </thead>
              <tbody>
                {section.items.map(item => (
                  <tr key={item.tech} className="border-t border-white/5">
                    <td className="py-1.5 text-white font-medium pr-3">{item.tech}</td>
                    <td className="py-1.5 text-white/50">{item.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Module Inventory Tab ──────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  built: 'bg-green-500/20 text-green-300 border border-green-500/30',
  partial: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  not_built: 'bg-red-500/20 text-red-300 border border-red-500/30',
  unknown: 'bg-gray-500/20 text-gray-300 border border-gray-500/30',
};

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full bg-white/10 rounded-full h-2">
      <div
        className={`h-2 rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function ModuleInventoryTab() {
  const [data, setData] = useState<ModuleRegistry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/module-registry');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load');

      // Compute summary from modules array
      const modules = json.modules ?? [];
      const built = modules.filter((m: { status: string }) => m.status === 'built').length;
      const partial = modules.filter((m: { status: string }) => m.status === 'partial').length;
      const not_built = modules.filter((m: { status: string }) => m.status === 'not_built').length;

      setData({ total: modules.length, built, partial, not_built, modules });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-10">
        <p className="text-red-400 text-sm mb-3">{error ?? 'No data'}</p>
        <button onClick={load} className="text-indigo-400 hover:text-indigo-300 text-sm">Retry</button>
      </div>
    );
  }

  const builtPct = data.total > 0 ? Math.round((data.built / data.total) * 100) : 0;
  const partialPct = data.total > 0 ? Math.round((data.partial / data.total) * 100) : 0;
  const notBuiltPct = data.total > 0 ? Math.round((data.not_built / data.total) * 100) : 0;

  const filtered = data.modules.filter(m =>
    m.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.id?.toLowerCase().includes(search.toLowerCase()),
  );

  // Compute dimension tallies
  const userFlowCount = data.modules.filter(m => m.user_flow).length;
  const adminFlowCount = data.modules.filter(m => m.admin_flow).length;
  const dbCount = data.modules.filter(m => m.has_db).length;
  const reportCount = data.modules.filter(m => m.has_report).length;
  const dashboardCount = data.modules.filter(m => m.has_dashboard).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Module Inventory</h2>
        <p className="text-white/50 text-sm">
          Live data from /api/admin/module-registry. {data.total} modules catalogued.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
          <div className="text-green-300 text-2xl font-bold">{data.built}</div>
          <div className="text-green-400/70 text-xs mt-1">Built ({builtPct}%)</div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
          <div className="text-amber-300 text-2xl font-bold">{data.partial}</div>
          <div className="text-amber-400/70 text-xs mt-1">Partial ({partialPct}%)</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
          <div className="text-red-300 text-2xl font-bold">{data.not_built}</div>
          <div className="text-red-400/70 text-xs mt-1">Not Built ({notBuiltPct}%)</div>
        </div>
      </div>

      {/* Dimension progress bars */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
        <h3 className="text-white font-semibold text-sm mb-2">Coverage by Dimension</h3>
        {[
          { label: 'User Flow', count: userFlowCount, color: 'bg-blue-500' },
          { label: 'Admin UI', count: adminFlowCount, color: 'bg-purple-500' },
          { label: 'Database', count: dbCount, color: 'bg-green-500' },
          { label: 'Report', count: reportCount, color: 'bg-amber-500' },
          { label: 'Dashboard', count: dashboardCount, color: 'bg-pink-500' },
        ].map(dim => {
          const pct = data.total > 0 ? Math.round((dim.count / data.total) * 100) : 0;
          return (
            <div key={dim.label}>
              <div className="flex justify-between text-xs text-white/60 mb-1">
                <span>{dim.label}</span>
                <span>{dim.count} / {data.total} ({pct}%)</span>
              </div>
              <ProgressBar value={pct} color={dim.color} />
            </div>
          );
        })}
      </div>

      {/* Module search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search modules..."
        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
      />

      {/* Module table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/40 text-left text-xs border-b border-white/10">
              <th className="pb-2 pr-4 font-medium">Module</th>
              <th className="pb-2 pr-4 font-medium">Status</th>
              <th className="pb-2 pr-4 font-medium text-center">User Flow</th>
              <th className="pb-2 pr-4 font-medium text-center">Admin UI</th>
              <th className="pb-2 pr-4 font-medium text-center">DB</th>
              <th className="pb-2 pr-4 font-medium text-center">Report</th>
              <th className="pb-2 font-medium text-center">Dashboard</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => (
              <tr key={m.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                <td className="py-2 pr-4 text-white font-medium">{m.name ?? m.id}</td>
                <td className="py-2 pr-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[m.status] ?? STATUS_STYLES.unknown}`}>
                    {m.status?.replace('_', ' ') ?? 'unknown'}
                  </span>
                </td>
                {[m.user_flow, m.admin_flow, m.has_db, m.has_report, m.has_dashboard].map((v, i) => (
                  <td key={i} className="py-2 pr-4 text-center text-sm">
                    {v ? <span className="text-green-400">✓</span> : <span className="text-white/20">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-6 text-white/40 text-sm">No modules match your search.</div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ArchitecturePage() {
  const [activeTab, setActiveTab] = useState<Tab>('architecture');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Architecture &amp; Docs</h1>
        <p className="text-white/50">
          Living documentation hub — architecture, demo stories, data flows, tech stack, and module inventory.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white/5  border border-white/10 rounded-2xl p-6">
        {activeTab === 'architecture'     && <ArchitectureTab />}
        {activeTab === 'demo-stories'     && <DemoStoriesTab />}
        {activeTab === 'data-flow'        && <DataFlowTab />}
        {activeTab === 'tech-stack'       && <TechStackTab />}
        {activeTab === 'module-inventory' && <ModuleInventoryTab />}
      </div>
    </div>
  );
}
