'use client';
// Real Control Mapping Screen -- honest map of which brand guideline fields
// are actually enforced by code today vs manual/visual only. See the API
// route for the exact code paths this reads off of.

import { useEffect, useState } from 'react';

interface Control { field: string; label: string; enforcement: string; enforcedBy: string | null; currentValue: string | number }

const ENFORCEMENT_LABELS: Record<string, { label: string; color: string }> = {
  automated_blocking: { label: 'Automated — Blocking', color: 'bg-red-50 text-red-700' },
  automated_informational: { label: 'Automated — Informational', color: 'bg-amber-50 text-amber-700' },
  presence_checked_only: { label: 'Presence-Checked Only', color: 'bg-blue-50 text-blue-700' },
  manual_visual_only: { label: 'Manual / Visual Only', color: 'bg-gray-100 text-gray-600' },
};

export default function ControlMappingPage() {
  const [controls, setControls] = useState<Control[]>([]);
  const [hasDefaultKit, setHasDefaultKit] = useState(true);

  useEffect(() => {
    fetch('/api/admin/brand-guide/control-mapping', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setControls(d?.controls ?? []); setHasDefaultKit(d?.hasDefaultKit ?? false); });
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Control Mapping</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Which guideline fields are actually enforced by code, and how — read directly off the real compliance and health-score logic, not a policy claim.
        </p>
      </div>

      {!hasDefaultKit && <p className="text-sm text-amber-600 bg-amber-50 rounded p-3">No default brand kit exists yet — create one at <a href="/admin/brand-kits" className="underline">/admin/brand-kits</a> to see live values.</p>}

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
            {['Guideline Field', 'Enforcement', 'Enforced By', 'Current Value'].map(h => <th key={h} className="px-4 py-2 text-left">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {controls.map(c => {
              const e = ENFORCEMENT_LABELS[c.enforcement];
              return (
                <tr key={c.field}>
                  <td className="px-4 py-2 font-medium text-gray-700">{c.label}</td>
                  <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${e?.color ?? 'bg-gray-100'}`}>{e?.label ?? c.enforcement}</span></td>
                  <td className="px-4 py-2 text-xs text-gray-500">{c.enforcedBy ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{String(c.currentValue)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
