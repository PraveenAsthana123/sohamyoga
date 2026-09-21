'use client';
import { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DesignBrief {
  id: string;
  title: string;
  project_type: string;
  brand_name: string | null;
  target_audience: string | null;
  key_message: string | null;
  mood_tone: string | null;
  color_palette: string[] | null;
  fonts_preferred: string | null;
  dimensions: string | null;
  platform: string | null;
  examples_urls: string[] | null;
  deliverables: string | null;
  deadline: string | null;
  budget_cad: string | null;
  status: string;
  assigned_to: string | null;
  ai_brief: string | null;
  canva_template_url: string | null;
  output_url: string | null;
  notes: string | null;
  created_at: string;
}

interface BrandAsset {
  id: string;
  name: string;
  asset_type: string;
  file_url: string | null;
  thumbnail_url: string | null;
  format: string | null;
  dimensions: string | null;
  file_size_bytes: number | null;
  tags: string[] | null;
  usage_guidelines: string | null;
  version: string;
  is_primary: boolean;
  download_count: number;
  created_at: string;
}

interface DesignTemplate {
  id: string;
  name: string;
  category: string | null;
  platform: string | null;
  dimensions: string | null;
  thumbnail_url: string | null;
  canva_url: string | null;
  figma_url: string | null;
  description: string | null;
  use_count: number;
  tags: string[] | null;
  is_approved: boolean;
  created_at: string;
}

interface AdvocacyPost {
  id: string;
  title: string;
  content: string;
  platform: string;
  image_url: string | null;
  suggested_caption: string | null;
  hashtags: string[] | null;
  status: string;
  shared_count: number;
  reach: number;
  created_at: string;
}

interface Stats {
  activeBriefs: number;
  awaitingReview: number;
  brandAssets: number;
  templates: number;
  advocacyPosts: number;
  thisMonthDesigns: number;
  statusCounts: Record<string, number>;
  overdueBriefs: number;
}

interface AdvocacyStats {
  total_shared: number;
  total_reach: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
type Tab = 'dashboard' | 'briefs' | 'assets' | 'templates' | 'tools' | 'advocacy';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'briefs', label: 'Design Briefs' },
  { id: 'assets', label: 'Brand Asset Library' },
  { id: 'templates', label: 'Design Templates' },
  { id: 'tools', label: 'Canva & Tool Integration' },
  { id: 'advocacy', label: 'Employee Advocacy' },
];

const STATUS_PIPELINE = ['draft', 'briefed', 'in_design', 'review', 'approved', 'delivered'] as const;
type BriefStatus = typeof STATUS_PIPELINE[number];

const STATUS_COLORS: Record<string, string> = {
  draft: '#6B7280',
  briefed: '#3B82F6',
  in_design: '#8B5CF6',
  review: '#F59E0B',
  approved: '#10B981',
  delivered: '#059669',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  briefed: 'Briefed',
  in_design: 'In Design',
  review: 'Review',
  approved: 'Approved',
  delivered: 'Delivered',
};

const PLATFORM_DIMENSIONS: Record<string, string> = {
  instagram: '1080x1080',
  instagram_story: '1080x1920',
  facebook: '1200x628',
  linkedin: '1200x627',
  linkedin_banner: '1584x396',
  google_display: '300x250',
  google_leaderboard: '728x90',
  email_header: '600x200',
  business_card: '1050x600',
  youtube: '2560x1440',
};

const COLOR_NAMES: Record<string, string> = {
  '#4A90D9': 'Primary Blue',
  '#F5A623': 'Accent Orange',
  '#1ABC9C': 'Deep Teal',
  '#2C3E50': 'Charcoal Dark',
  '#27AE60': 'Forest Green',
  '#E74C3C': 'Vivid Red',
  '#9B59B6': 'Royal Purple',
  '#3498DB': 'Sky Blue',
  '#ECF0F1': 'Cloud White',
  '#FDEBD0': 'Peach Cream',
};

const CATEGORY_COLORS: Record<string, string> = {
  social: '#3B82F6',
  ads: '#F59E0B',
  email: '#10B981',
  print: '#8B5CF6',
  presentation: '#EF4444',
  web: '#06B6D4',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || '#6B7280';
  return (
    <span style={{
      background: color + '20', color, border: `1px solid ${color}40`,
      borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
    }}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const colors: Record<string, string> = {
    linkedin: '#0077B5', instagram: '#E1306C', facebook: '#1877F2',
    youtube: '#FF0000', twitter: '#1DA1F2', web: '#4B5563', print: '#92400E',
  };
  const color = colors[platform] || '#6B7280';
  return (
    <span style={{
      background: color, color: '#fff', borderRadius: 5,
      padding: '2px 7px', fontSize: 11, fontWeight: 600,
    }}>
      {platform}
    </span>
  );
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function GraphicDesignPage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [briefs, setBriefs] = useState<DesignBrief[]>([]);
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [templates, setTemplates] = useState<DesignTemplate[]>([]);
  const [advocacy, setAdvocacy] = useState<AdvocacyPost[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [advStats, setAdvStats] = useState<AdvocacyStats>({ total_shared: 0, total_reach: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/graphic-design');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as {
        briefs: DesignBrief[];
        assets: BrandAsset[];
        templates: DesignTemplate[];
        advocacy: AdvocacyPost[];
        stats: Stats;
      };
      setBriefs(data.briefs);
      setAssets(data.assets);
      setTemplates(data.templates);
      setAdvocacy(data.advocacy);
      setStats(data.stats);

      const totalShared = data.advocacy.reduce((s, p) => s + p.shared_count, 0);
      const totalReach = data.advocacy.reduce((s, p) => s + p.reach, 0);
      setAdvStats({ total_shared: totalShared, total_reach: totalReach });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#6B7280' }}>
      Loading Creative Hub...
    </div>
  );

  if (error) return (
    <div style={{ padding: 32, color: '#EF4444' }}>Error: {error} <button onClick={load} style={{ marginLeft: 12, color: '#3B82F6', cursor: 'pointer' }}>Retry</button></div>
  );

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#F9FAFB', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: '#1E293B', padding: '20px 32px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 22, color: '#fff', fontWeight: 700 }}>Creative Hub</div>
        <div style={{ fontSize: 13, color: '#94A3B8', marginLeft: 8 }}>Graphic Design & Brand Assets</div>
        <button onClick={load} style={{ marginLeft: 'auto', background: '#334155', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 16px', cursor: 'pointer', fontSize: 13 }}>Refresh</button>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', padding: '0 32px', gap: 0 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '14px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none',
              background: 'none', color: activeTab === t.id ? '#3B82F6' : '#6B7280',
              borderBottom: activeTab === t.id ? '2px solid #3B82F6' : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '24px 32px' }}>
        {activeTab === 'dashboard' && <DashboardTab stats={stats} briefs={briefs} />}
        {activeTab === 'briefs' && <BriefsTab briefs={briefs} onRefresh={load} />}
        {activeTab === 'assets' && <AssetsTab assets={assets} onRefresh={load} />}
        {activeTab === 'templates' && <TemplatesTab templates={templates} onRefresh={load} />}
        {activeTab === 'tools' && <ToolsTab />}
        {activeTab === 'advocacy' && <AdvocacyTab posts={advocacy} stats={advStats} onRefresh={load} />}
      </div>
    </div>
  );
}

// ─── Tab 1: Dashboard ─────────────────────────────────────────────────────────
function DashboardTab({ stats, briefs }: { stats: Stats | null; briefs: DesignBrief[] }) {
  if (!stats) return null;

  const today = new Date().toISOString().split('T')[0];
  const overdueBriefs = briefs.filter(b => b.deadline && b.deadline < today && b.status !== 'delivered');
  const recentBriefs = [...briefs].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10);

  const kpis = [
    { label: 'Active Briefs', value: stats.activeBriefs, color: '#3B82F6' },
    { label: 'Awaiting Review', value: stats.awaitingReview, color: '#F59E0B' },
    { label: 'Brand Assets', value: stats.brandAssets ?? 0, color: '#8B5CF6' },
    { label: 'Templates', value: stats.templates ?? 0, color: '#06B6D4' },
    { label: 'Advocacy Posts', value: stats.advocacyPosts ?? 0, color: '#10B981' },
    { label: 'Delivered This Month', value: stats.thisMonthDesigns, color: '#059669' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 12, padding: '20px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderTop: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Design Pipeline */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <h3 style={{ fontWeight: 700, color: '#1E293B', margin: '0 0 16px' }}>Design Pipeline</h3>
        <div style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
          {STATUS_PIPELINE.map((s, i) => {
            const count = stats.statusCounts[s] || 0;
            const color = STATUS_COLORS[s];
            return (
              <div key={s} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0 }}>
                <div style={{ flex: 1, background: color + '18', border: `1px solid ${color}40`, borderRadius: 8, padding: '12px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color }}>{count}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{STATUS_LABELS[s]}</div>
                </div>
                {i < STATUS_PIPELINE.length - 1 && (
                  <div style={{ padding: '0 4px', color: '#CBD5E1', fontSize: 18 }}>›</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Overdue Briefs */}
      {overdueBriefs.length > 0 && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontWeight: 700, color: '#DC2626', margin: '0 0 12px', fontSize: 14 }}>
            Overdue Briefs ({overdueBriefs.length})
          </h3>
          {overdueBriefs.map(b => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', borderBottom: '1px solid #FECACA' }}>
              <span style={{ fontWeight: 600, color: '#991B1B', fontSize: 13 }}>{b.title}</span>
              <span style={{ fontSize: 12, color: '#EF4444' }}>Due: {b.deadline}</span>
              <StatusBadge status={b.status} />
              {b.assigned_to && <span style={{ fontSize: 12, color: '#6B7280' }}>→ {b.assigned_to}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Recent Briefs Table */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <h3 style={{ fontWeight: 700, color: '#1E293B', margin: '0 0 16px' }}>Recent Briefs</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #F1F5F9' }}>
              {['Title', 'Type', 'Platform', 'Status', 'Deadline', 'Assigned To'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#6B7280', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentBriefs.map(b => (
              <tr key={b.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1E293B' }}>{b.title}</td>
                <td style={{ padding: '10px 12px', color: '#6B7280' }}>{b.project_type?.replace('_', ' ')}</td>
                <td style={{ padding: '10px 12px' }}>{b.platform && <PlatformBadge platform={b.platform} />}</td>
                <td style={{ padding: '10px 12px' }}><StatusBadge status={b.status} /></td>
                <td style={{ padding: '10px 12px', color: '#6B7280' }}>{b.deadline || '—'}</td>
                <td style={{ padding: '10px 12px', color: '#6B7280' }}>{b.assigned_to || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab 2: Design Briefs ─────────────────────────────────────────────────────
function BriefsTab({ briefs, onRefresh }: { briefs: DesignBrief[]; onRefresh: () => void }) {
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<DesignBrief | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<Partial<DesignBrief>>({});
  const [showAiBrief, setShowAiBrief] = useState(false);

  const filtered = filter === 'all' ? briefs : briefs.filter(b => b.status === filter);
  const today = new Date().toISOString().split('T')[0];

  const selectBrief = (b: DesignBrief) => {
    setSelected(b);
    setEditForm({
      title: b.title, project_type: b.project_type, brand_name: b.brand_name ?? '',
      target_audience: b.target_audience ?? '', key_message: b.key_message ?? '',
      mood_tone: b.mood_tone ?? '', color_palette: b.color_palette ?? [],
      fonts_preferred: b.fonts_preferred ?? '', dimensions: b.dimensions ?? '',
      platform: b.platform ?? '', deliverables: b.deliverables ?? '',
      deadline: b.deadline ?? '', budget_cad: b.budget_cad ?? '',
      status: b.status, assigned_to: b.assigned_to ?? '',
      canva_template_url: b.canva_template_url ?? '', notes: b.notes ?? '',
    });
    setShowAiBrief(false);
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    await fetch(`/api/admin/graphic-design/brief/${selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm),
    });
    setSaving(false);
    onRefresh();
  };

  const aiEnhance = async () => {
    if (!selected) return;
    setEnhancing(true);
    const res = await fetch(`/api/admin/graphic-design/brief/${selected.id}/ai-enhance`, { method: 'POST' });
    const data = await res.json() as { ai_brief?: string };
    if (data.ai_brief) {
      setSelected(prev => prev ? { ...prev, ai_brief: data.ai_brief! } : prev);
      setShowAiBrief(true);
    }
    setEnhancing(false);
    onRefresh();
  };

  const deleteBrief = async () => {
    if (!selected || !confirm('Delete this brief?')) return;
    await fetch(`/api/admin/graphic-design/brief/${selected.id}`, { method: 'DELETE' });
    setSelected(null);
    onRefresh();
  };

  const advanceStatus = async (newStatus: string) => {
    if (!selected) return;
    await fetch(`/api/admin/graphic-design/brief/${selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }),
    });
    setSelected(prev => prev ? { ...prev, status: newStatus } : prev);
    setEditForm(prev => ({ ...prev, status: newStatus }));
    onRefresh();
  };

  return (
    <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 180px)' }}>
      {/* Left: Brief List */}
      <div style={{ width: 300, background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 16px 8px' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{ flex: 1, border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px 8px', fontSize: 12, color: '#374151' }}
            >
              <option value="all">All Briefs</option>
              {STATUS_PIPELINE.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <button onClick={() => setShowNew(true)} style={{ background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>+ New</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.map(b => {
            const overdue = b.deadline && b.deadline < today && b.status !== 'delivered';
            return (
              <div
                key={b.id}
                onClick={() => selectBrief(b)}
                style={{
                  padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9',
                  background: selected?.id === b.id ? '#EFF6FF' : 'transparent',
                  borderLeft: overdue ? '3px solid #EF4444' : '3px solid transparent',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, color: '#1E293B' }}>{b.title}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  <StatusBadge status={b.status} />
                  {b.platform && <PlatformBadge platform={b.platform} />}
                </div>
                {b.deadline && <div style={{ fontSize: 11, color: overdue ? '#EF4444' : '#94A3B8', marginTop: 4 }}>Due: {b.deadline}</div>}
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ padding: 24, color: '#9CA3AF', fontSize: 13, textAlign: 'center' }}>No briefs found.</div>}
        </div>
      </div>

      {/* Right: Brief Detail */}
      <div style={{ flex: 1, background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflowY: 'auto', padding: 24 }}>
        {!selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9CA3AF' }}>
            <div style={{ fontSize: 40 }}>🎨</div>
            <div style={{ marginTop: 12, fontSize: 14 }}>Select a brief to view details</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1E293B', flex: 1 }}>{selected.title}</h2>
              <button onClick={aiEnhance} disabled={enhancing} style={{ background: '#8B5CF6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {enhancing ? 'Enhancing...' : 'AI Enhance Brief'}
              </button>
              {selected.canva_template_url && (
                <a href={selected.canva_template_url} target="_blank" rel="noreferrer" style={{ background: '#06B6D4', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                  Open in Canva
                </a>
              )}
              <button onClick={deleteBrief} style={{ background: '#FEF2F2', color: '#EF4444', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}>Delete</button>
            </div>

            {/* Status Pipeline Stepper */}
            <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: 600 }}>STATUS PIPELINE</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {STATUS_PIPELINE.map((s, i) => {
                  const active = s === (editForm.status || selected.status);
                  const past = STATUS_PIPELINE.indexOf(s as BriefStatus) < STATUS_PIPELINE.indexOf((editForm.status || selected.status) as BriefStatus);
                  const color = STATUS_COLORS[s];
                  return (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        onClick={() => advanceStatus(s)}
                        style={{
                          background: active ? color : past ? color + '30' : '#F1F5F9',
                          color: active ? '#fff' : past ? color : '#9CA3AF',
                          border: `2px solid ${active ? color : 'transparent'}`,
                          borderRadius: 20, padding: '4px 12px', fontSize: 11, cursor: 'pointer',
                          fontWeight: active ? 700 : 500,
                        }}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                      {i < STATUS_PIPELINE.length - 1 && <span style={{ color: '#CBD5E1', fontSize: 14 }}>›</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Brief Card */}
            {(selected.ai_brief || showAiBrief) && (
              <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: '#7C3AED', fontSize: 13 }}>AI Creative Brief</span>
                  <button onClick={() => setShowAiBrief(!showAiBrief)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7C3AED', fontSize: 12 }}>
                    {showAiBrief ? 'Collapse' : 'Expand'}
                  </button>
                </div>
                {showAiBrief && (
                  <div style={{ fontSize: 13, color: '#4C1D95', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {selected.ai_brief}
                  </div>
                )}
              </div>
            )}

            {/* Edit Form */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'Title', key: 'title' },
                { label: 'Brand Name', key: 'brand_name' },
                { label: 'Target Audience', key: 'target_audience' },
                { label: 'Key Message', key: 'key_message' },
                { label: 'Assigned To', key: 'assigned_to' },
                { label: 'Canva Template URL', key: 'canva_template_url' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input
                    value={(editForm as Record<string, unknown>)[f.key] as string || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              ))}

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Project Type</label>
                <select value={editForm.project_type || ''} onChange={e => setEditForm(prev => ({ ...prev, project_type: e.target.value }))}
                  style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}>
                  {['social_post','logo','banner','brochure','infographic','presentation','email_header','ad_creative','business_card','packaging'].map(t =>
                    <option key={t} value={t}>{t.replace('_', ' ')}</option>
                  )}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Mood/Tone</label>
                <select value={editForm.mood_tone || ''} onChange={e => setEditForm(prev => ({ ...prev, mood_tone: e.target.value }))}
                  style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}>
                  {['professional','playful','bold','minimal','luxury','friendly'].map(m =>
                    <option key={m} value={m}>{m}</option>
                  )}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Platform</label>
                <select value={editForm.platform || ''} onChange={e => {
                  const p = e.target.value;
                  const dim = PLATFORM_DIMENSIONS[p] || '';
                  setEditForm(prev => ({ ...prev, platform: p, dimensions: dim }));
                }}
                  style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}>
                  <option value="">Select platform</option>
                  {Object.keys(PLATFORM_DIMENSIONS).map(p => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Dimensions</label>
                <input
                  value={editForm.dimensions || ''}
                  onChange={e => setEditForm(prev => ({ ...prev, dimensions: e.target.value }))}
                  style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }}
                  placeholder="e.g. 1080x1080"
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Deadline</label>
                <input type="date" value={editForm.deadline || ''} onChange={e => setEditForm(prev => ({ ...prev, deadline: e.target.value }))}
                  style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Budget (CAD)</label>
                <input type="number" value={editForm.budget_cad || ''} onChange={e => setEditForm(prev => ({ ...prev, budget_cad: e.target.value }))}
                  style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Color Palette */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Color Palette</label>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[0,1,2,3,4].map(i => {
                  const hex = editForm.color_palette?.[i] || '';
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, background: hex || '#F1F5F9',
                        border: '1px solid #E2E8F0',
                      }} />
                      <input
                        value={hex}
                        onChange={e => {
                          const pal = [...(editForm.color_palette || [])];
                          pal[i] = e.target.value;
                          setEditForm(prev => ({ ...prev, color_palette: pal }));
                        }}
                        placeholder="#RRGGBB"
                        style={{ width: 90, border: '1px solid #E2E8F0', borderRadius: 6, padding: '4px 8px', fontSize: 12, fontFamily: 'monospace' }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Fonts & Deliverables */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Fonts Preferred</label>
                <input value={editForm.fonts_preferred || ''} onChange={e => setEditForm(prev => ({ ...prev, fonts_preferred: e.target.value }))}
                  style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Deliverables</label>
                <input value={editForm.deliverables || ''} onChange={e => setEditForm(prev => ({ ...prev, deliverables: e.target.value }))}
                  style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Notes</label>
              <textarea value={editForm.notes || ''} onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))} rows={3}
                style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            <button onClick={save} disabled={saving} style={{ background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontWeight: 600, fontSize: 14, alignSelf: 'flex-start' }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {showNew && <NewBriefModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); onRefresh(); }} />}
    </div>
  );
}

function NewBriefModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: '', project_type: 'social_post', brand_name: 'SohamYoga', target_audience: '',
    key_message: '', mood_tone: 'professional', platform: 'instagram', dimensions: '1080x1080',
    deliverables: '', deadline: '', budget_cad: '', assigned_to: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    await fetch('/api/admin/graphic-design', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    setSaving(false);
    onCreated();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 640, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 24px', fontWeight: 700, color: '#1E293B' }}>New Design Brief</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { label: 'Title *', key: 'title' }, { label: 'Brand Name', key: 'brand_name' },
            { label: 'Target Audience', key: 'target_audience' }, { label: 'Key Message', key: 'key_message' },
            { label: 'Assigned To', key: 'assigned_to' }, { label: 'Budget (CAD)', key: 'budget_cad' },
            { label: 'Deliverables', key: 'deliverables' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{f.label}</label>
              <input value={(form as Record<string, string>)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Project Type</label>
            <select value={form.project_type} onChange={e => setForm(prev => ({ ...prev, project_type: e.target.value }))}
              style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}>
              {['social_post','logo','banner','brochure','infographic','presentation','email_header','ad_creative','business_card','packaging'].map(t =>
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
              )}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Platform → Auto-fills dimensions</label>
            <select value={form.platform} onChange={e => {
              const p = e.target.value;
              setForm(prev => ({ ...prev, platform: p, dimensions: PLATFORM_DIMENSIONS[p] || prev.dimensions }));
            }}
              style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}>
              {Object.entries(PLATFORM_DIMENSIONS).map(([p, d]) => <option key={p} value={p}>{p.replace('_', ' ')} — {d}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Dimensions</label>
            <input value={form.dimensions} onChange={e => setForm(prev => ({ ...prev, dimensions: e.target.value }))}
              style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Mood/Tone</label>
            <select value={form.mood_tone} onChange={e => setForm(prev => ({ ...prev, mood_tone: e.target.value }))}
              style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}>
              {['professional','playful','bold','minimal','luxury','friendly'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Deadline</label>
            <input type="date" value={form.deadline} onChange={e => setForm(prev => ({ ...prev, deadline: e.target.value }))}
              style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Notes</label>
          <textarea value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} rows={3}
            style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: '#F1F5F9', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontWeight: 600 }}>
            {saving ? 'Creating...' : 'Create Brief'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 3: Brand Asset Library ───────────────────────────────────────────────
function AssetsTab({ assets, onRefresh }: { assets: BrandAsset[]; onRefresh: () => void }) {
  const [typeFilter, setTypeFilter] = useState('all');
  const [showUpload, setShowUpload] = useState(false);

  const types = ['all', 'logo', 'color', 'font', 'template', 'photo', 'illustration', 'video', 'audio'];
  const filtered = typeFilter === 'all' ? assets : assets.filter(a => a.asset_type === typeFilter);
  const primaryColors = assets.filter(a => a.asset_type === 'color' && a.is_primary);

  const download = async (asset: BrandAsset) => {
    await fetch(`/api/admin/graphic-design/assets?action=increment_download&id=${asset.id}`);
    if (asset.file_url) window.open(asset.file_url, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Primary Colors Row */}
      {primaryColors.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h3 style={{ fontWeight: 700, color: '#1E293B', margin: '0 0 12px', fontSize: 14 }}>Brand Color Palette</h3>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {assets.filter(a => a.asset_type === 'color').map(a => {
              const hex = a.usage_guidelines?.match(/#[0-9A-Fa-f]{6}/)?.[0] || '#888888';
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: hex, border: '1px solid #E2E8F0', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#1E293B' }}>{a.name}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>{hex}</div>
                    {a.is_primary && <div style={{ fontSize: 10, color: '#10B981', fontWeight: 600 }}>PRIMARY</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {types.map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            style={{ background: typeFilter === t ? '#3B82F6' : '#F1F5F9', color: typeFilter === t ? '#fff' : '#374151', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
        <button onClick={() => setShowUpload(true)} style={{ marginLeft: 'auto', background: '#10B981', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
          + Upload Asset
        </button>
      </div>

      {/* Asset Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {filtered.map(a => (
          <AssetCard key={a.id} asset={a} onDownload={download} />
        ))}
      </div>

      {filtered.length === 0 && <div style={{ padding: 32, color: '#9CA3AF', textAlign: 'center' }}>No assets found for this type.</div>}

      {showUpload && <UploadAssetModal onClose={() => setShowUpload(false)} onCreated={() => { setShowUpload(false); onRefresh(); }} />}
    </div>
  );
}

function AssetCard({ asset, onDownload }: { asset: BrandAsset; onDownload: (a: BrandAsset) => void }) {
  const [copied, setCopied] = useState(false);
  const hex = asset.usage_guidelines?.match(/#[0-9A-Fa-f]{6}/)?.[0] || '';

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', border: asset.is_primary ? '2px solid #3B82F6' : '1px solid #F1F5F9' }}>
      {/* Preview */}
      {asset.asset_type === 'color' ? (
        <div style={{ height: 80, background: hex || '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>{hex}</span>
        </div>
      ) : asset.asset_type === 'font' ? (
        <div style={{ height: 80, background: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px' }}>
          <span style={{ fontFamily: 'serif', fontSize: 22, color: '#F8FAFC', fontWeight: 600 }}>Aa Bb Cc 123</span>
        </div>
      ) : asset.thumbnail_url || asset.file_url ? (
        <div style={{ height: 80, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset.thumbnail_url || asset.file_url || ''} alt={asset.name} style={{ maxHeight: 76, maxWidth: '100%', objectFit: 'contain' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        </div>
      ) : (
        <div style={{ height: 80, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#9CA3AF', fontSize: 12 }}>{asset.asset_type}</span>
        </div>
      )}

      {/* Info */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#1E293B', flex: 1 }}>{asset.name}</span>
          {asset.is_primary && <span style={{ fontSize: 9, fontWeight: 700, color: '#3B82F6', background: '#EFF6FF', padding: '2px 5px', borderRadius: 4 }}>PRIMARY</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {asset.format && <span style={{ fontSize: 10, background: '#F1F5F9', color: '#374151', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{asset.format}</span>}
          {asset.version && <span style={{ fontSize: 10, background: '#F0FDF4', color: '#166534', padding: '2px 6px', borderRadius: 4 }}>v{asset.version}</span>}
          {asset.dimensions && <span style={{ fontSize: 10, color: '#6B7280' }}>{asset.dimensions}</span>}
        </div>
        {asset.tags && asset.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            {asset.tags.slice(0, 3).map(t => <span key={t} style={{ fontSize: 10, background: '#F5F3FF', color: '#6D28D9', padding: '1px 5px', borderRadius: 4 }}>#{t}</span>)}
          </div>
        )}
        {asset.usage_guidelines && (
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8, lineHeight: 1.4 }}>
            {asset.usage_guidelines.substring(0, 80)}{asset.usage_guidelines.length > 80 ? '…' : ''}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>{asset.download_count} downloads · {formatBytes(asset.file_size_bytes)}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {asset.asset_type === 'color' && hex && (
              <button onClick={() => copy(hex)} style={{ background: '#F1F5F9', color: '#374151', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}>
                {copied ? 'Copied!' : 'Copy HEX'}
              </button>
            )}
            <button onClick={() => onDownload(asset)} style={{ background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadAssetModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', asset_type: 'logo', file_url: '', thumbnail_url: '', format: '', dimensions: '', usage_guidelines: '', version: '1.0', is_primary: false });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await fetch('/api/admin/graphic-design/assets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    setSaving(false);
    onCreated();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 520 }}>
        <h2 style={{ margin: '0 0 24px', fontWeight: 700, color: '#1E293B' }}>Upload Brand Asset</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Name *', key: 'name' }, { label: 'File URL', key: 'file_url' },
            { label: 'Thumbnail URL', key: 'thumbnail_url' }, { label: 'Format (PNG/SVG/TTF…)', key: 'format' },
            { label: 'Dimensions', key: 'dimensions' }, { label: 'Version', key: 'version' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{f.label}</label>
              <input value={(form as unknown as Record<string, string>)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Asset Type</label>
            <select value={form.asset_type} onChange={e => setForm(prev => ({ ...prev, asset_type: e.target.value }))}
              style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}>
              {['logo','icon','color','font','template','photo','illustration','video','audio'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Usage Guidelines</label>
            <textarea value={form.usage_guidelines} onChange={e => setForm(prev => ({ ...prev, usage_guidelines: e.target.value }))} rows={3}
              style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_primary} onChange={e => setForm(prev => ({ ...prev, is_primary: e.target.checked }))} />
            Mark as Primary Asset
          </label>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: '#F1F5F9', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ background: '#10B981', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontWeight: 600 }}>
            {saving ? 'Uploading...' : 'Upload Asset'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 4: Design Templates ──────────────────────────────────────────────────
function TemplatesTab({ templates, onRefresh }: { templates: DesignTemplate[]; onRefresh: () => void }) {
  const [catFilter, setCatFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);

  const categories = ['all', 'social', 'ads', 'email', 'print', 'presentation', 'web'];
  const filtered = catFilter === 'all' ? templates : templates.filter(t => t.category === catFilter);

  const applyTemplate = async (t: DesignTemplate) => {
    await fetch('/api/admin/graphic-design/templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'increment_use', id: t.id, name: t.name }),
    });
    const url = t.canva_url || t.figma_url;
    if (url) window.open(url, '_blank');
    onRefresh();
  };

  const sizeGuide = [
    { platform: 'Instagram', format: 'Feed Post', size: '1080×1080 px' },
    { platform: 'Instagram', format: 'Story/Reel', size: '1080×1920 px' },
    { platform: 'Facebook', format: 'Feed Ad', size: '1200×628 px' },
    { platform: 'LinkedIn', format: 'Post', size: '1200×627 px' },
    { platform: 'LinkedIn', format: 'Banner', size: '1584×396 px' },
    { platform: 'Google Display', format: 'Medium Rectangle', size: '300×250 px' },
    { platform: 'Google Display', format: 'Leaderboard', size: '728×90 px' },
    { platform: 'Email', format: 'Header', size: '600×200 px' },
    { platform: 'Business Card', format: 'Standard', size: '1050×600 px (3.5×2" 300dpi)' },
    { platform: 'YouTube', format: 'Channel Art', size: '2560×1440 px' },
    { platform: 'Print', format: 'A4 Brochure', size: '210×297 mm' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {categories.map(c => (
          <button key={c} onClick={() => setCatFilter(c)}
            style={{ background: catFilter === c ? (CATEGORY_COLORS[c] || '#3B82F6') : '#F1F5F9', color: catFilter === c ? '#fff' : '#374151', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
            {c}
          </button>
        ))}
        <button onClick={() => setShowAdd(true)} style={{ marginLeft: 'auto', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
          + Add Template
        </button>
      </div>

      {/* Template Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {filtered.map(t => {
          const catColor = CATEGORY_COLORS[t.category || ''] || '#6B7280';
          return (
            <div key={t.id} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
              {/* Thumbnail placeholder colored by category */}
              <div style={{ height: 100, background: catColor + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: `3px solid ${catColor}` }}>
                {t.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.thumbnail_url} alt={t.name} style={{ maxHeight: 96, maxWidth: '100%', objectFit: 'contain' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: catColor, textTransform: 'uppercase' }}>{t.category}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{t.dimensions}</div>
                  </div>
                )}
              </div>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1E293B', marginBottom: 4 }}>{t.name}</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                  {t.platform && <PlatformBadge platform={t.platform} />}
                  {t.dimensions && <span style={{ fontSize: 10, color: '#6B7280', fontFamily: 'monospace' }}>{t.dimensions}</span>}
                </div>
                {t.description && <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>{t.description.substring(0, 70)}…</div>}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>Used {t.use_count}×</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {t.canva_url && <span style={{ fontSize: 9, fontWeight: 700, background: '#DBEAFE', color: '#1D4ED8', padding: '2px 6px', borderRadius: 4 }}>Canva</span>}
                    {t.figma_url && <span style={{ fontSize: 9, fontWeight: 700, background: '#EDE9FE', color: '#6D28D9', padding: '2px 6px', borderRadius: 4 }}>Figma</span>}
                    <button onClick={() => applyTemplate(t)} style={{ background: catColor, color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                      Use Template
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && <div style={{ padding: 32, color: '#9CA3AF', textAlign: 'center' }}>No templates found.</div>}

      {/* Size Guide */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <h3 style={{ fontWeight: 700, color: '#1E293B', margin: '0 0 16px' }}>Platform Size Reference Guide</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #F1F5F9' }}>
              {['Platform', 'Format', 'Recommended Size'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#6B7280', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sizeGuide.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #F8FAFC' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600, color: '#374151' }}>{r.platform}</td>
                <td style={{ padding: '8px 12px', color: '#6B7280' }}>{r.format}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#3B82F6', fontWeight: 600 }}>{r.size}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && <AddTemplateModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); onRefresh(); }} />}
    </div>
  );
}

function AddTemplateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', category: 'social', platform: 'instagram', dimensions: '1080x1080', canva_url: '', figma_url: '', description: '' });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await fetch('/api/admin/graphic-design/templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    setSaving(false);
    onCreated();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 520 }}>
        <h2 style={{ margin: '0 0 24px', fontWeight: 700, color: '#1E293B' }}>Add Design Template</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[{ label: 'Name *', key: 'name' }, { label: 'Dimensions', key: 'dimensions' }, { label: 'Canva URL', key: 'canva_url' }, { label: 'Figma URL', key: 'figma_url' }].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{f.label}</label>
              <input value={(form as Record<string, string>)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Category</label>
            <select value={form.category} onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
              style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}>
              {['social','ads','email','print','presentation','web'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Platform</label>
            <input value={form.platform} onChange={e => setForm(prev => ({ ...prev, platform: e.target.value }))}
              style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Description</label>
          <textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={3}
            style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: '#F1F5F9', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontWeight: 600 }}>
            {saving ? 'Adding...' : 'Add Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 5: Canva & Tools ─────────────────────────────────────────────────────
function ToolsTab() {
  const designTools = [
    { name: 'Adobe Express', desc: 'Quick graphic creation with brand templates', url: 'https://new.express.adobe.com/', color: '#FF0000' },
    { name: 'Figma', desc: 'Collaborative UI/UX and design system tool', url: 'https://figma.com/new', color: '#F24E1E' },
    { name: 'Piktochart', desc: 'Infographic and data visualization creator', url: 'https://create.piktochart.com/', color: '#00BC7D' },
    { name: 'Remove.bg', desc: 'One-click AI background remover', url: 'https://remove.bg', color: '#FF6B6B' },
    { name: 'Unsplash', desc: 'High-quality free stock photography', url: 'https://unsplash.com', color: '#111827' },
    { name: 'Coolors', desc: 'Color palette generator and explorer', url: 'https://coolors.co', color: '#F59E0B' },
    { name: 'Google Fonts', desc: 'Free open-source font library', url: 'https://fonts.google.com', color: '#4285F4' },
  ];

  const aiTools = [
    { name: 'Midjourney', desc: 'AI-generated art and image creation', url: 'https://midjourney.com', color: '#7C3AED' },
    { name: 'DALL-E (OpenAI)', desc: 'Text-to-image generation by OpenAI', url: 'https://labs.openai.com', color: '#10B981' },
    { name: 'Adobe Firefly', desc: 'Generative AI integrated in Adobe tools', url: 'https://firefly.adobe.com', color: '#FF4081' },
    { name: 'Stable Diffusion', desc: 'Open-source AI image generation', url: 'https://stablediffusionweb.com', color: '#6366F1' },
  ];

  const canvaQuickCreate = [
    { label: 'New Instagram Post', url: 'https://www.canva.com/design/new?type=SocialMedia' },
    { label: 'New Presentation', url: 'https://www.canva.com/design/new?type=Presentation' },
    { label: 'New Facebook Ad', url: 'https://www.canva.com/design/new?type=FacebookAd' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Canva Integration */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#1E293B' }}>Canva Integration</div>
          <span style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>OAuth Placeholder</span>
        </div>
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>
            Connect your Canva account to sync Brand Kit (colors, fonts, logos) and create designs directly from this portal.
          </div>
          <a
            href="https://www.canva.com/api/oauth/authorize?client_id=YOUR_CLIENT_ID&scope=design:meta:read&response_type=code"
            target="_blank" rel="noreferrer"
            style={{ display: 'inline-block', background: '#7C3AED', color: '#fff', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
          >
            Connect Canva Account
          </a>
          <span style={{ marginLeft: 12, fontSize: 12, color: '#9CA3AF' }}>Status: Not configured</span>
        </div>
        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#374151' }}>Quick Create in Canva</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {canvaQuickCreate.map(q => (
            <a key={q.label} href={q.url} target="_blank" rel="noreferrer"
              style={{ background: '#7C3AED', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
              {q.label} →
            </a>
          ))}
        </div>
      </div>

      {/* Design Tools */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1E293B', marginBottom: 16 }}>Design Tools</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {designTools.map(t => (
            <ToolCard key={t.name} {...t} />
          ))}
        </div>
      </div>

      {/* AI Design Tools */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1E293B', marginBottom: 4 }}>AI Design Tools</div>
        <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 16 }}>Generative AI for image creation and design assistance</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {aiTools.map(t => (
            <ToolCard key={t.name} {...t} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ToolCard({ name, desc, url, color }: { name: string; desc: string; url: string; color: string }) {
  return (
    <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 16, border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#1E293B' }}>{name}</div>
      <div style={{ fontSize: 11, color: '#6B7280', flex: 1, lineHeight: 1.4 }}>{desc}</div>
      <a href={url} target="_blank" rel="noreferrer"
        style={{ display: 'inline-block', background: color, color: '#fff', borderRadius: 7, padding: '6px 12px', fontSize: 11, fontWeight: 600, textDecoration: 'none', textAlign: 'center' }}>
        Open →
      </a>
    </div>
  );
}

// ─── Tab 6: Employee Advocacy ─────────────────────────────────────────────────
function AdvocacyTab({ posts, stats, onRefresh }: { posts: AdvocacyPost[]; stats: AdvocacyStats; onRefresh: () => void }) {
  const [showNew, setShowNew] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiOutput, setAiOutput] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const approve = async (id: string) => {
    await fetch('/api/admin/graphic-design/advocacy', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'approved' }),
    });
    onRefresh();
  };

  const share = async (post: AdvocacyPost) => {
    await fetch('/api/admin/graphic-design/advocacy', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: post.id, action: 'increment_share', estimated_reach: 150 }),
    });
    const shareUrl = `${window.location.origin}/share/advocacy/${post.id}`;
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    onRefresh();
  };

  const copyCaption = (post: AdvocacyPost) => {
    const text = post.suggested_caption || post.content;
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(post.id);
    setTimeout(() => setCopied(null), 1500);
  };

  const aiGenerate = async () => {
    setGenerating(true);
    const res = await fetch('/api/admin/graphic-design/advocacy', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ai_generate' }),
    });
    const data = await res.json() as { generated?: string };
    setAiOutput(data.generated || '');
    setGenerating(false);
  };

  const platformColors: Record<string, string> = {
    linkedin: '#0077B5', instagram: '#E1306C', facebook: '#1877F2', twitter: '#1DA1F2',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderTop: '3px solid #3B82F6' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#3B82F6' }}>{posts.length}</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>Total Posts</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderTop: '3px solid #10B981' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#10B981' }}>{stats.total_shared}</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>Total Shares</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderTop: '3px solid #8B5CF6' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#8B5CF6' }}>{stats.total_reach.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>Estimated Total Reach</div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => setShowNew(true)} style={{ background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
          + Create Advocacy Post
        </button>
        <button onClick={aiGenerate} disabled={generating} style={{ background: '#8B5CF6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
          {generating ? 'Generating...' : 'AI Generate Post'}
        </button>
      </div>

      {/* AI Output */}
      {aiOutput && (
        <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 700, color: '#7C3AED', fontSize: 13, marginBottom: 10 }}>AI Generated Post Variations</div>
          <pre style={{ fontFamily: 'inherit', fontSize: 13, color: '#4C1D95', whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0 }}>{aiOutput}</pre>
          <button onClick={() => setAiOutput('')} style={{ marginTop: 10, background: 'none', border: '1px solid #DDD6FE', color: '#7C3AED', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>Dismiss</button>
        </div>
      )}

      {/* Posts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {posts.map(p => {
          const platColor = platformColors[p.platform] || '#6B7280';
          return (
            <div key={p.id} style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: `4px solid ${platColor}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ background: platColor, color: '#fff', padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{p.platform}</span>
                    <StatusBadge status={p.status} />
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#1E293B' }}>{p.title}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5, marginBottom: 8 }}>
                    {p.suggested_caption || p.content.substring(0, 200)}{(p.suggested_caption || p.content).length > 200 ? '…' : ''}
                  </div>
                  {p.hashtags && p.hashtags.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      {p.hashtags.map(h => <span key={h} style={{ fontSize: 11, color: platColor, fontWeight: 600 }}>{h}</span>)}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>
                    {p.shared_count} shares · {p.reach.toLocaleString()} reach
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {p.status === 'draft' && (
                    <button onClick={() => approve(p.id)} style={{ background: '#10B981', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      Approve for Sharing
                    </button>
                  )}
                  <button onClick={() => copyCaption(p)} style={{ background: '#F1F5F9', color: '#374151', border: 'none', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    {copied === p.id ? 'Copied!' : 'Copy Caption'}
                  </button>
                  <button onClick={() => share(p)} style={{ background: platColor + '18', color: platColor, border: `1px solid ${platColor}40`, borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    Share Link
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {posts.length === 0 && <div style={{ padding: 32, color: '#9CA3AF', textAlign: 'center' }}>No advocacy posts yet. Create one to get started.</div>}
      </div>

      {showNew && <NewAdvocacyModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); onRefresh(); }} />}
    </div>
  );
}

function NewAdvocacyModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ title: '', content: '', platform: 'linkedin', image_url: '', suggested_caption: '', hashtags: '' });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    const hashtags = form.hashtags.split(/[\s,]+/).map(h => h.trim()).filter(Boolean).map(h => h.startsWith('#') ? h : `#${h}`);
    await fetch('/api/admin/graphic-design/advocacy', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, hashtags }),
    });
    setSaving(false);
    onCreated();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 560 }}>
        <h2 style={{ margin: '0 0 24px', fontWeight: 700, color: '#1E293B' }}>Create Advocacy Post</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Title *</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Platform</label>
            <select value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))}
              style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}>
              {['linkedin','instagram','facebook','twitter'].map(pl => <option key={pl} value={pl}>{pl}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Content *</label>
            <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={4}
              style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Suggested Caption</label>
            <input value={form.suggested_caption} onChange={e => setForm(p => ({ ...p, suggested_caption: e.target.value }))}
              style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }} placeholder="Short caption for sharing" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Hashtags (space or comma separated)</label>
            <input value={form.hashtags} onChange={e => setForm(p => ({ ...p, hashtags: e.target.value }))}
              style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }} placeholder="#YogaLife #Wellness" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Image URL</label>
            <input value={form.image_url} onChange={e => setForm(p => ({ ...p, image_url: e.target.value }))}
              style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: '#F1F5F9', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontWeight: 600 }}>
            {saving ? 'Creating...' : 'Create Post'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Suppress unused import warning
void hexToRgb;
void COLOR_NAMES;
