import { countContacts } from '@/domain/contact/repository';
import { countSubmissions, countSubmissionsWithContact } from '@/domain/form/repository';
import { countScripts, scriptUsageCounts } from '@/domain/script/repository';
import { callsByStatus, callsPerDay, countCalls, totalCallCostUsd } from '@/domain/call/repository';

export const dynamic = 'force-dynamic';

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-black/10 dark:border-white/10 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide opacity-60">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const [contacts, submissions, submissionsWithContact, scripts, calls, perDay, byStatus, usage, totalCost] = await Promise.all([
    countContacts(),
    countSubmissions(),
    countSubmissionsWithContact(),
    countScripts(),
    countCalls(),
    callsPerDay(14),
    callsByStatus(),
    scriptUsageCounts(),
    totalCallCostUsd(),
  ]);

  const maxPerDay = Math.max(1, ...perDay.map((d) => d.count));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm opacity-60 mt-1">
          Live counts from the database. A 0 here means genuinely no data yet — nothing on this page is sample/demo data.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Contacts" value={contacts} />
        <StatCard label="Form submissions" value={submissions} />
        <StatCard label="Submissions → contact" value={submissionsWithContact} />
        <StatCard label="Call scripts" value={scripts} />
        <StatCard label="Calls logged" value={calls} />
        <StatCard label="Total Vapi cost ($)" value={Number(totalCost.toFixed(2))} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <h2 className="font-medium mb-3">Calls per day (last 14 days)</h2>
          {perDay.length === 0 ? (
            <p className="text-sm opacity-60">No calls logged yet.</p>
          ) : (
            <div className="space-y-1">
              {perDay.map((d) => (
                <div key={d.day} className="flex items-center gap-2 text-xs">
                  <span className="w-24 shrink-0 opacity-70">{d.day}</span>
                  <div className="flex-1 bg-black/5 dark:bg-white/10 rounded h-3 overflow-hidden">
                    <div
                      className="bg-black dark:bg-white h-3 rounded"
                      style={{ width: `${(d.count / maxPerDay) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right">{d.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border border-black/10 dark:border-white/10 rounded-lg p-4">
          <h2 className="font-medium mb-3">Calls by status</h2>
          {byStatus.length === 0 ? (
            <p className="text-sm opacity-60">No calls logged yet.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {byStatus.map((s) => (
                <li key={s.status} className="flex justify-between">
                  <span className="capitalize">{s.status.replace('_', ' ')}</span>
                  <span className="font-medium">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="border border-black/10 dark:border-white/10 rounded-lg p-4">
        <h2 className="font-medium mb-3">Script usage (calls per script)</h2>
        {usage.length === 0 ? (
          <p className="text-sm opacity-60">No call scripts yet.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {usage.map((u) => (
              <li key={u.scriptId} className="flex justify-between">
                <span>{u.scriptName}</span>
                <span className="font-medium">{u.callCount}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
