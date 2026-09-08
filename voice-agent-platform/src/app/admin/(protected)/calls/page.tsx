import Link from 'next/link';
import { listCalls } from '@/domain/call/repository';
import QualityReviewCell from './QualityReviewCell';

export const dynamic = 'force-dynamic';

export default async function CallsListPage() {
  const calls = await listCalls();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Call Log</h1>
        <Link href="/admin/calls/new" className="rounded bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 text-sm">
          + Log a call
        </Link>
      </div>
      <p className="text-xs opacity-60">
        &quot;manual&quot; rows were hand-entered by staff. &quot;vapi&quot; rows came from a real placed/received call and its
        outcome was reported by the /api/webhooks/vapi receiver — cost/transcript are only ever set by that webhook,
        never estimated.
      </p>

      {calls.length === 0 ? (
        <p className="text-sm opacity-60">No calls logged yet.</p>
      ) : (
        <div className="overflow-x-auto border border-black/10 dark:border-white/10 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-black/5 dark:bg-white/10 text-left">
              <tr>
                <th className="p-2">When</th>
                <th className="p-2">Direction</th>
                <th className="p-2">Contact</th>
                <th className="p-2">Script</th>
                <th className="p-2">Status</th>
                <th className="p-2">Duration</th>
                <th className="p-2">Cost</th>
                <th className="p-2">Provider</th>
                <th className="p-2">Transcript</th>
                <th className="p-2">QA</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id} className="border-t border-black/10 dark:border-white/10">
                  <td className="p-2 whitespace-nowrap">{new Date(c.createdAt).toLocaleString()}</td>
                  <td className="p-2 capitalize">{c.direction}</td>
                  <td className="p-2">{c.contactName ?? '—'}</td>
                  <td className="p-2">{c.scriptName ?? '—'}</td>
                  <td className="p-2 capitalize">{c.status.replace('_', ' ')}</td>
                  <td className="p-2">{c.durationSeconds !== null ? `${c.durationSeconds}s` : '—'}</td>
                  <td className="p-2">{c.costUsd !== null ? `$${c.costUsd.toFixed(2)}` : '—'}</td>
                  <td className="p-2">{c.provider}</td>
                  <td className="p-2 max-w-xs truncate" title={c.transcript ?? ''}>{c.transcript ?? '—'}</td>
                  <td className="p-2"><QualityReviewCell callId={c.id} qualityScore={c.qualityScore} isIncident={c.isIncident} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
