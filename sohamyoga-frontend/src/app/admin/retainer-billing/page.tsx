'use client';
import { useEffect, useState } from 'react';

const TABS = ['dashboard', 'invoices', 'generate', 'overdue', 'reports'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard',
  invoices: 'All Invoices',
  generate: 'Generate Invoice',
  overdue: 'Overdue',
  reports: 'Reports',
};

interface RetainerInvoice {
  id: string;
  client_name: string;
  client_email: string | null;
  invoice_number: string;
  period_month: string;
  retainer_amount_cad: string;
  additional_charges: string;
  additional_charges_desc: string | null;
  total_cad: string;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

interface Stats {
  total_collected: string;
  outstanding: string;
  overdue_amount: string;
  overdue_count: string;
  mrr: string;
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
};

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>;
}

function fmtCad(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === '') return '—';
  return `$${Number(val).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-CA');
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export default function RetainerBillingPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [invoices, setInvoices] = useState<RetainerInvoice[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [saving, setSaving] = useState(false);

  // Generate form state
  const [genForm, setGenForm] = useState({
    client_name: '',
    client_email: '',
    period_month: new Date().toISOString().slice(0, 7),
    retainer_amount_cad: '',
    additional_charges: '',
    additional_charges_desc: '',
    due_date: '',
    notes: '',
  });
  const [genError, setGenError] = useState('');
  const [genSuccess, setGenSuccess] = useState('');
  const [genLoading, setGenLoading] = useState(false);

  const load = () => {
    setLoading(true);
    const url = statusFilter ? `/api/admin/retainer-billing?status=${statusFilter}` : '/api/admin/retainer-billing';
    fetch(url, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setInvoices(d.invoices ?? []); setStats(d.stats ?? null); setLoading(false); })
      .catch(() => { setError('Failed to load invoices.'); setLoading(false); });
  };

  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function markPaid(id: string) {
    setSaving(true);
    await fetch(`/api/admin/retainer-billing/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid', payment_method: paymentMethod || undefined }),
    });
    setMarkPaidId(null);
    setPaymentMethod('');
    setSaving(false);
    load();
  }

  async function markSent(id: string) {
    await fetch(`/api/admin/retainer-billing/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sent' }),
    });
    load();
  }

  async function generateInvoice(e: React.FormEvent) {
    e.preventDefault();
    setGenError('');
    setGenSuccess('');
    setGenLoading(true);
    const body = {
      ...genForm,
      retainer_amount_cad: Number(genForm.retainer_amount_cad),
      additional_charges: Number(genForm.additional_charges || 0),
    };
    const res = await fetch('/api/admin/retainer-billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    setGenLoading(false);
    if (!res.ok) { setGenError(d.error ?? 'Failed to generate invoice.'); return; }
    setGenSuccess(`Invoice ${d.invoice.invoice_number} created for ${fmtCad(d.invoice.total_cad)}.`);
    setGenForm({ client_name: '', client_email: '', period_month: new Date().toISOString().slice(0, 7), retainer_amount_cad: '', additional_charges: '', additional_charges_desc: '', due_date: '', notes: '' });
    load();
  }

  const overdue = invoices.filter(i => i.status === 'overdue');
  const dueSoon = invoices.filter(i => {
    if (i.status !== 'pending' && i.status !== 'sent') return false;
    const d = daysUntil(i.due_date);
    return d >= 0 && d <= 7;
  });

  // Revenue by month (from all invoices, for text-based chart)
  const byMonth: Record<string, number> = {};
  invoices.filter(i => i.status === 'paid').forEach(i => {
    byMonth[i.period_month] = (byMonth[i.period_month] ?? 0) + Number(i.total_cad);
  });
  const sortedMonths = Object.keys(byMonth).sort();
  const maxRev = Math.max(1, ...Object.values(byMonth));

  // Client breakdown
  const byClient: Record<string, number> = {};
  invoices.forEach(i => {
    byClient[i.client_name] = (byClient[i.client_name] ?? 0) + Number(i.total_cad);
  });

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Agency Retainer Billing</h1>
        <p className="mt-1 text-sm text-gray-500">Generate, track, and manage monthly retainer invoices for all agency clients.</p>
      </header>

      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {TAB_LABELS[t]}
            {t === 'overdue' && overdue.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{overdue.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading && tab !== 'generate' && <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">Loading invoices…</div>}
      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 text-sm">{error}</div>}

      {!loading && !error && (
        <>
          {/* DASHBOARD TAB */}
          {tab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-lg p-4 border-l-4 border-green-500 bg-green-50">
                  <p className="text-sm text-gray-500">MRR (This Month)</p>
                  <p className="text-2xl font-bold mt-1">{fmtCad(stats?.mrr)}</p>
                </div>
                <div className="rounded-lg p-4 border-l-4 border-blue-500 bg-blue-50">
                  <p className="text-sm text-gray-500">Outstanding</p>
                  <p className="text-2xl font-bold mt-1">{fmtCad(stats?.outstanding)}</p>
                </div>
                <div className="rounded-lg p-4 border-l-4 border-red-500 bg-red-50">
                  <p className="text-sm text-gray-500">Overdue</p>
                  <p className="text-2xl font-bold mt-1">{fmtCad(stats?.overdue_amount)}</p>
                  <p className="text-xs text-gray-400 mt-1">{stats?.overdue_count ?? 0} invoice{Number(stats?.overdue_count ?? 0) !== 1 ? 's' : ''}</p>
                </div>
                <div className="rounded-lg p-4 border-l-4 border-purple-500 bg-purple-50">
                  <p className="text-sm text-gray-500">Total Collected</p>
                  <p className="text-2xl font-bold mt-1">{fmtCad(stats?.total_collected)}</p>
                </div>
              </div>

              {dueSoon.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h3 className="font-semibold text-amber-800 mb-2">Due in the Next 7 Days</h3>
                  <ul className="space-y-1">
                    {dueSoon.map(i => (
                      <li key={i.id} className="flex justify-between text-sm">
                        <span className="text-amber-900">{i.invoice_number} — {i.client_name}</span>
                        <span className="font-medium text-amber-800">{fmtCad(i.total_cad)} · due {fmtDate(i.due_date)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ALL INVOICES TAB */}
          {tab === 'invoices' && (
            <div className="space-y-4">
              <div className="flex gap-2 items-center">
                <label className="text-sm text-gray-600">Filter by status:</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-2">Invoice #</th>
                      <th className="px-4 py-2">Client</th>
                      <th className="px-4 py-2">Period</th>
                      <th className="px-4 py-2">Total</th>
                      <th className="px-4 py-2">Due Date</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoices.map(i => (
                      <tr key={i.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{i.invoice_number}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{i.client_name}</div>
                          <div className="text-xs text-gray-400">{i.client_email}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{i.period_month}</td>
                        <td className="px-4 py-3 font-medium">{fmtCad(i.total_cad)}</td>
                        <td className="px-4 py-3 text-gray-500">{fmtDate(i.due_date)}</td>
                        <td className="px-4 py-3">
                          <Badge label={i.status} cls={STATUS_COLOR[i.status] ?? 'bg-gray-100 text-gray-600'} />
                        </td>
                        <td className="px-4 py-3">
                          {markPaidId === i.id ? (
                            <div className="flex gap-1 items-center">
                              <input
                                value={paymentMethod}
                                onChange={e => setPaymentMethod(e.target.value)}
                                placeholder="Method (EFT, Wire…)"
                                className="border border-gray-300 rounded px-2 py-1 text-xs w-28"
                              />
                              <button
                                onClick={() => markPaid(i.id)}
                                disabled={saving}
                                className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                              >
                                {saving ? '…' : 'Confirm'}
                              </button>
                              <button onClick={() => setMarkPaidId(null)} className="text-xs text-gray-400 hover:underline">×</button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              {i.status !== 'paid' && (
                                <button onClick={() => setMarkPaidId(i.id)} className="text-xs text-green-700 hover:underline">Mark Paid</button>
                              )}
                              {i.status === 'pending' && (
                                <button onClick={() => markSent(i.id)} className="text-xs text-blue-600 hover:underline">Mark Sent</button>
                              )}
                              {i.client_email && (
                                <a
                                  href={`mailto:${i.client_email}?subject=Invoice ${i.invoice_number} — ${fmtCad(i.total_cad)} due ${fmtDate(i.due_date)}`}
                                  className="text-xs text-gray-500 hover:underline"
                                >
                                  Remind
                                </a>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {invoices.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">No invoices found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* GENERATE INVOICE TAB */}
          {tab === 'generate' && (
            <div className="max-w-xl space-y-4">
              <p className="text-sm text-gray-500">Create a monthly retainer invoice. Invoice number is auto-generated as RET-YYYY-MM-NNN.</p>
              {genError && <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{genError}</div>}
              {genSuccess && <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">{genSuccess}</div>}
              <form onSubmit={generateInvoice} className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
                    <input
                      required
                      value={genForm.client_name}
                      onChange={e => setGenForm(f => ({ ...f, client_name: e.target.value }))}
                      placeholder="e.g. Maple Leaf Retail Co."
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Client Email</label>
                    <input
                      type="email"
                      value={genForm.client_email}
                      onChange={e => setGenForm(f => ({ ...f, client_email: e.target.value }))}
                      placeholder="client@company.ca"
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Period Month *</label>
                    <input
                      required
                      type="month"
                      value={genForm.period_month}
                      onChange={e => setGenForm(f => ({ ...f, period_month: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={genForm.due_date}
                      onChange={e => setGenForm(f => ({ ...f, due_date: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Retainer Amount (CAD) *</label>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={genForm.retainer_amount_cad}
                      onChange={e => setGenForm(f => ({ ...f, retainer_amount_cad: e.target.value }))}
                      placeholder="2800.00"
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Additional Charges (CAD)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={genForm.additional_charges}
                      onChange={e => setGenForm(f => ({ ...f, additional_charges: e.target.value }))}
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Additional Charges Description</label>
                    <input
                      value={genForm.additional_charges_desc}
                      onChange={e => setGenForm(f => ({ ...f, additional_charges_desc: e.target.value }))}
                      placeholder="e.g. Extra creative hours for campaign photoshoot"
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      rows={2}
                      value={genForm.notes}
                      onChange={e => setGenForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Internal notes…"
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                {genForm.retainer_amount_cad && (
                  <div className="bg-gray-50 border border-gray-200 rounded p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Retainer:</span>
                      <span>{fmtCad(Number(genForm.retainer_amount_cad))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Additional:</span>
                      <span>{fmtCad(Number(genForm.additional_charges || 0))}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t border-gray-200 mt-1 pt-1">
                      <span>Total:</span>
                      <span>{fmtCad(Number(genForm.retainer_amount_cad) + Number(genForm.additional_charges || 0))}</span>
                    </div>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={genLoading}
                  className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 font-medium text-sm disabled:opacity-50"
                >
                  {genLoading ? 'Generating…' : 'Generate Invoice'}
                </button>
              </form>
            </div>
          )}

          {/* OVERDUE TAB */}
          {tab === 'overdue' && (
            <div className="space-y-4">
              {overdue.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">No overdue invoices.</div>
              )}
              {overdue.map(i => {
                const days = daysSince(i.due_date);
                return (
                  <div key={i.id} className="bg-white rounded-lg border border-red-200 p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-mono text-xs text-gray-400">{i.invoice_number}</div>
                        <h3 className="font-semibold text-gray-900">{i.client_name}</h3>
                        <p className="text-sm text-gray-500">{i.client_email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-red-600">{fmtCad(i.total_cad)}</p>
                        <Badge label={`${days} days overdue`} cls="bg-red-100 text-red-700" />
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">Due: {fmtDate(i.due_date)} · Period: {i.period_month}</div>
                    {i.notes && <p className="text-xs text-gray-400 italic">{i.notes}</p>}
                    <div className="flex gap-3 pt-2 border-t border-red-100">
                      <button
                        onClick={() => setMarkPaidId(i.id)}
                        className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                      >
                        Mark Paid
                      </button>
                      {i.client_email && (
                        <a
                          href={`mailto:${i.client_email}?subject=OVERDUE: Invoice ${i.invoice_number} — Action Required&body=Dear ${i.client_name},%0A%0AYour invoice ${i.invoice_number} for ${fmtCad(i.total_cad)} is ${days} days overdue.%0A%0APlease arrange payment at your earliest convenience.%0A%0AThank you.`}
                          className="text-sm border border-red-300 text-red-600 px-3 py-1 rounded hover:bg-red-50"
                        >
                          Send Escalation Email
                        </a>
                      )}
                    </div>
                    {markPaidId === i.id && (
                      <div className="flex gap-2 items-center">
                        <input
                          value={paymentMethod}
                          onChange={e => setPaymentMethod(e.target.value)}
                          placeholder="Payment method"
                          className="border border-gray-300 rounded px-2 py-1 text-xs"
                        />
                        <button
                          onClick={() => markPaid(i.id)}
                          disabled={saving}
                          className="text-xs bg-green-600 text-white px-2 py-1 rounded disabled:opacity-50"
                        >
                          {saving ? '…' : 'Confirm Paid'}
                        </button>
                        <button onClick={() => setMarkPaidId(null)} className="text-xs text-gray-400">Cancel</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* REPORTS TAB */}
          {tab === 'reports' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-4">Monthly Revenue (Paid Invoices)</h3>
                {sortedMonths.length === 0 ? (
                  <p className="text-sm text-gray-400">No paid invoices yet.</p>
                ) : (
                  <div className="space-y-2">
                    {sortedMonths.map(month => {
                      const rev = byMonth[month];
                      const barPct = Math.round((rev / maxRev) * 100);
                      return (
                        <div key={month} className="flex items-center gap-3">
                          <span className="text-sm w-20 text-gray-600 font-mono">{month}</span>
                          <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                            <div className="h-full bg-green-500 rounded" style={{ width: `${barPct}%` }} />
                          </div>
                          <span className="text-sm font-medium w-24 text-right">{fmtCad(rev)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-4">Client-wise Billing Breakdown</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                      <th className="pb-2">Client</th>
                      <th className="pb-2 text-right">Total Invoiced</th>
                      <th className="pb-2 text-right">Invoices</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Object.entries(byClient).sort((a, b) => b[1] - a[1]).map(([name, total]) => (
                      <tr key={name} className="hover:bg-gray-50">
                        <td className="py-2 font-medium">{name}</td>
                        <td className="py-2 text-right">{fmtCad(total)}</td>
                        <td className="py-2 text-right text-gray-500">{invoices.filter(i => i.client_name === name).length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
