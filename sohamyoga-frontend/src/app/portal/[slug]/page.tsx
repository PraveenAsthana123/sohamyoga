'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface PortalAccount {
  id: string;
  company_name: string;
  primary_contact_name: string | null;
  primary_contact_email: string;
  slug: string;
  logo_url: string | null;
  brand_color: string;
  allowed_modules: string[];
  status: string;
  plan: string;
  created_at: string;
}

interface ReportData {
  campaigns: { count: number; totalSpendCad: number };
  leads: { count: number };
  revenue: { attributableCad: number };
  period: { from: string; to: string };
}

const MODULE_ICONS: Record<string, string> = {
  campaigns: '📣',
  analytics: '📈',
  reports: '📋',
  invoices: '🧾',
  social: '📱',
  ads: '💰',
};

const MODULE_DESCRIPTIONS: Record<string, string> = {
  campaigns: 'View your active and past marketing campaigns.',
  analytics: 'Track website traffic, conversions, and engagement.',
  reports: 'Download monthly performance reports.',
  invoices: 'View and download your invoices.',
  social: 'See scheduled and published social media posts.',
  ads: 'Monitor your paid advertising spend and results.',
};

export default function ClientPortalPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';

  const [portal, setPortal] = useState<PortalAccount | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/client-portal/slug/${slug}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? 'Portal not found.'); setLoading(false); return; }
        const p: PortalAccount = data.portal;
        setPortal(p);

        // Load report summary
        const rRes = await fetch(`/api/admin/client-portal/${p.id}/report`, { cache: 'no-store' });
        if (rRes.ok) {
          const rData = await rRes.json();
          setReport(rData.report ?? null);
        }
      } catch {
        setError('Failed to load portal.');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading portal…</p>
      </div>
    );
  }

  if (error || !portal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-4xl font-bold text-gray-300">404</p>
          <p className="mt-2 text-gray-600">{error || 'Portal not found.'}</p>
          <p className="mt-1 text-sm text-gray-400">This is a white-labeled client portal. Contact your agency for access.</p>
        </div>
      </div>
    );
  }

  const brandColor = portal.brand_color;
  const modules = portal.allowed_modules ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header style={{ backgroundColor: brandColor }} className="px-6 py-5 shadow-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            {portal.logo_url ? (
              <img src={portal.logo_url} alt={portal.company_name} className="h-10 rounded-lg object-contain bg-white p-1" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white bg-opacity-20 text-xl font-bold text-white">
                {portal.company_name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-white">{portal.company_name}</h1>
              <p className="text-xs text-white text-opacity-75">Client Portal</p>
            </div>
          </div>
          <div className="text-right text-xs text-white text-opacity-75">
            <p>{portal.primary_contact_name}</p>
            <p>{portal.primary_contact_email}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        {/* Notice */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          This is a white-labeled client portal. Contact your agency for access or questions.
        </div>

        {/* KPI cards (if report loaded) */}
        {report && (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Summary — {report.period.from} to {report.period.to}
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Campaigns</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{report.campaigns.count}</p>
                <p className="mt-1 text-sm text-gray-500">
                  ${Number(report.campaigns.totalSpendCad).toLocaleString()} CAD spend
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Leads</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{report.leads.count}</p>
                <p className="mt-1 text-sm text-gray-500">In your CRM</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Revenue Attributable</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">
                  ${Number(report.revenue.attributableCad).toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-gray-500">CAD (estimated)</p>
              </div>
            </div>
          </section>
        )}

        {/* Module cards */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Your Modules</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map(mod => (
              <div
                key={mod}
                className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div
                  className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                  style={{ backgroundColor: `${brandColor}20` }}
                >
                  {MODULE_ICONS[mod] ?? '📦'}
                </div>
                <p className="font-semibold capitalize text-gray-900">{mod}</p>
                <p className="mt-1 text-sm text-gray-500">{MODULE_DESCRIPTIONS[mod] ?? `Access your ${mod} data.`}</p>
                <button
                  style={{ borderColor: brandColor, color: brandColor }}
                  className="mt-4 rounded-lg border px-3 py-1.5 text-xs font-medium hover:opacity-80"
                >
                  Open {mod.charAt(0).toUpperCase() + mod.slice(1)} →
                </button>
              </div>
            ))}

            {modules.length === 0 && (
              <div className="col-span-3 rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400">
                No modules enabled yet. Contact your agency to enable access.
              </div>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-200 pt-6 text-center text-xs text-gray-400">
          <p>
            Powered by{' '}
            <span style={{ color: brandColor }} className="font-semibold">
              SohamYoga Agency Suite
            </span>{' '}
            · White-labeled for {portal.company_name}
          </p>
          <p className="mt-1">Plan: {portal.plan} · Member since {new Date(portal.created_at).toLocaleDateString()}</p>
        </footer>
      </main>
    </div>
  );
}
