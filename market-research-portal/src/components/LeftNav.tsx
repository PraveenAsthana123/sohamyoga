'use client';
// Mandatory persistent left nav (policy §1) — Master, Studies, all 17
// phases (grouped, ordered by layer_number), Campaigns, Competitors.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface Phase {
  id: string;
  slug: string;
  name: string;
  layerNumber: number;
}

export default function LeftNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [phases, setPhases] = useState<Phase[]>([]);
  const [phasesOpen, setPhasesOpen] = useState(true);

  useEffect(() => {
    fetch('/api/phases', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { phases: [] }))
      .then(d => setPhases(d.phases ?? []))
      .catch(() => setPhases([]));
  }, []);

  const linkClass = (href: string) =>
    `block rounded px-3 py-1.5 text-sm ${pathname === href ? 'bg-brand-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`;

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <nav className="flex h-full w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-4">
        <div className="text-sm font-bold text-brand-800">Market Research Portal</div>
        <div className="text-xs text-gray-400">17-Layer Pipeline</div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          <Link href="/" className={linkClass('/')}>Master Pipeline</Link>
          <Link href="/studies" className={linkClass('/studies')}>Studies</Link>
        </div>

        <div>
          <button
            onClick={() => setPhasesOpen(o => !o)}
            className="mb-1 flex w-full items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-gray-400"
          >
            Phases ({phases.length})
            <span>{phasesOpen ? '−' : '+'}</span>
          </button>
          {phasesOpen && (
            <div className="space-y-0.5">
              {phases.map(p => (
                <Link key={p.id} href={`/phases/${p.slug}`} className={linkClass(`/phases/${p.slug}`)}>
                  <span className="mr-1.5 text-gray-400">{p.layerNumber}.</span>{p.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <Link href="/campaigns" className={linkClass('/campaigns')}>Campaigns</Link>
          <Link href="/crm" className={linkClass('/crm')}>CRM (Leads &amp; Templates)</Link>
          <Link href="/digital-marketing" className={linkClass('/digital-marketing')}>Digital Marketing</Link>
          <Link href="/content-factory" className={linkClass('/content-factory')}>AI Content Factory</Link>
          <Link href="/voice-ai" className={linkClass('/voice-ai')}>Voice AI</Link>
          <Link href="/construction-twin" className={linkClass('/construction-twin')}>Construction Twin</Link>
          <Link href="/spatial-learning" className={linkClass('/spatial-learning')}>Spatial Learning</Link>
          <Link href="/competitors" className={linkClass('/competitors')}>Competitors</Link>
          <Link href="/operations-alerts" className={linkClass('/operations-alerts')}>Operations &amp; Alerts</Link>
          <Link href="/research-library" className={linkClass('/research-library')}>Research Library</Link>
          <Link href="/meeting-reports" className={linkClass('/meeting-reports')}>Meeting Reports</Link>
          <Link href="/intake-submissions" className={linkClass('/intake-submissions')}>Intake Submissions</Link>
          <Link href="/hooks" className={linkClass('/hooks')}>Hook Management</Link>
        </div>
      </div>
      <div className="border-t border-gray-200 p-3">
        <button onClick={logout} className="w-full rounded px-3 py-1.5 text-left text-sm text-gray-500 hover:bg-gray-100">
          Log out
        </button>
      </div>
    </nav>
  );
}
