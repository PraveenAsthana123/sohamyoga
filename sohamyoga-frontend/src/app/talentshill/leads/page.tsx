'use client';

import { useEffect, useState } from 'react';

interface Lead {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  source?: string;
  status?: string;
  value?: number;
  createdAt?: string;
  notes?: string;
  [key: string]: unknown;
}

interface LeadsApiResponse {
  leads?: Lead[];
  data?: Lead[];
  [key: string]: unknown;
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
  contacted: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30',
  qualified: 'bg-purple-500/20 text-purple-300 border-purple-400/30',
  converted: 'bg-green-500/20 text-green-300 border-green-400/30',
  lost: 'bg-red-500/20 text-red-300 border-red-400/30',
};

const SOURCE_ICONS: Record<string, string> = {
  google: '🔍',
  facebook: '👤',
  instagram: '📸',
  linkedin: '💼',
  email: '📧',
  organic: '🌱',
  referral: '🤝',
  direct: '🎯',
  default: '📋',
};

const STATUSES = ['All', 'new', 'contacted', 'qualified', 'converted', 'lost'];

const STATIC_LEADS: Lead[] = [
  { id: '1', name: 'Acme Corp', email: 'cmo@acme.com', phone: '+1 555 0100', source: 'Google', status: 'qualified', value: 12000, createdAt: '2026-09-14T10:30:00Z' },
  { id: '2', name: 'BuildRight Ltd', email: 'info@buildright.com', phone: '+1 555 0200', source: 'LinkedIn', status: 'new', value: 8500, createdAt: '2026-09-13T15:00:00Z' },
  { id: '3', name: 'FreshBrew Co', email: 'hello@freshbrew.com', phone: '+1 555 0300', source: 'Facebook', status: 'contacted', value: 4200, createdAt: '2026-09-12T09:00:00Z' },
  { id: '4', name: 'DigitalEdge Inc', email: 'growth@digitaledge.io', phone: '+1 555 0400', source: 'Referral', status: 'converted', value: 22000, createdAt: '2026-09-10T11:00:00Z' },
  { id: '5', name: 'SunRise Studios', email: 'ops@sunrisestudios.co', phone: '+1 555 0500', source: 'Email', status: 'lost', value: 6800, createdAt: '2026-09-08T14:00:00Z' },
  { id: '6', name: 'NovaTech Systems', email: 'partnerships@novatech.ai', phone: '+1 555 0600', source: 'Organic', status: 'new', value: 15000, createdAt: '2026-09-15T08:30:00Z' },
];

function fmt(n: number | undefined, prefix = ''): string {
  if (n === undefined || n === null) return '—';
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(1)}K`;
  return `${prefix}${n.toLocaleString()}`;
}

export default function TalentsHillLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.any([
      fetch('/api/admin/crm/leads', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/admin/leads-mgmt', { cache: 'no-store' }).then((r) => r.json()),
    ])
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setLeads(data as Lead[]);
        } else {
          const d = data as LeadsApiResponse;
          setLeads(d.leads ?? d.data ?? []);
        }
      })
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, []);

  const displayLeads = leads.length > 0 ? leads : STATIC_LEADS;

  const filtered = displayLeads.filter((l) => {
    const statusMatch = filterStatus === 'All' || l.status === filterStatus;
    const searchMatch =
      !search ||
      (l.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (l.email ?? '').toLowerCase().includes(search.toLowerCase());
    return statusMatch && searchMatch;
  });

  const totalValue = displayLeads
    .filter((l) => l.status === 'converted')
    .reduce((s, l) => s + (l.value ?? 0), 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Leads & CRM</h1>
        <p className="text-white/50 mt-1 text-sm">Track and manage all leads generated from your marketing campaigns.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: displayLeads.length, icon: '🎯' },
          { label: 'New', value: displayLeads.filter((l) => l.status === 'new').length, icon: '🆕' },
          { label: 'Converted', value: displayLeads.filter((l) => l.status === 'converted').length, icon: '✅' },
          { label: 'Pipeline Value', value: fmt(totalValue, '$'), icon: '💰' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-slate-800/70 border border-white/20 rounded-2xl shadow-xl p-5 text-center">
            <div className="text-2xl mb-2">{icon}</div>
            <div className="text-xl font-bold text-white">{value}</div>
            <div className="text-white/50 text-xs mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-2.5 text-sm  focus:outline-none focus:border-blue-400/60 transition-all w-64"
        />
        <div className="flex items-center gap-2">
          <span className="text-white/50 text-sm">Status:</span>
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${filterStatus === s ? 'bg-blue-500/30 text-white border-blue-400/30' : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-slate-800/70 border border-white/20 rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-white/40">Loading leads…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-white/40">
            <div className="text-4xl mb-3">🎯</div>
            <p>No leads match your current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-white/50 font-medium px-6 py-3">Lead</th>
                  <th className="text-left text-white/50 font-medium px-4 py-3">Source</th>
                  <th className="text-left text-white/50 font-medium px-4 py-3">Status</th>
                  <th className="text-right text-white/50 font-medium px-4 py-3">Value</th>
                  <th className="text-left text-white/50 font-medium px-6 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead, i) => (
                  <tr key={lead.id ?? i} className="border-b border-white/10 hover:bg-white/5 transition-colors last:border-0">
                    <td className="px-6 py-4">
                      <div className="text-white font-medium text-sm">{lead.name ?? '—'}</div>
                      <div className="text-white/40 text-xs mt-0.5">{lead.email ?? lead.phone ?? '—'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="flex items-center gap-1.5 text-white/70 text-sm">
                        {SOURCE_ICONS[(lead.source ?? '').toLowerCase()] ?? SOURCE_ICONS['default']}
                        {lead.source ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[lead.status ?? ''] ?? 'bg-white/10 text-white/60 border-white/20'}`}>
                        {lead.status ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-white/80 font-medium">
                      {fmt(lead.value, '$')}
                    </td>
                    <td className="px-6 py-4 text-white/50 text-xs">
                      {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
