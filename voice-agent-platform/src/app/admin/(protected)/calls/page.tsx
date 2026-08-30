import Link from 'next/link';
import { listCalls } from '@/domain/call/repository';

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
        No voice-provider credentials are configured yet (see VoiceProviderAdapter), so every row here was recorded
        by a staff member manually via the form above — none of it is a real placed call.
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
                <th className="p-2">Provider</th>
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
                  <td className="p-2">{c.provider}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
