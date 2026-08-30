import { submissionConversionByForm } from '@/domain/form/repository';
import { scriptUsageCounts } from '@/domain/script/repository';
import { callsByStatus, callsPerDay } from '@/domain/call/repository';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const [conversion, usage, byStatus, perDay] = await Promise.all([
    submissionConversionByForm(),
    scriptUsageCounts(),
    callsByStatus(),
    callsPerDay(30),
  ]);

  const totalCalls = byStatus.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="text-sm opacity-60 mt-1">Real queries against the live database — empty tables mean genuinely no data yet.</p>
      </div>

      <div>
        <h2 className="font-medium mb-2">Form submission → contact conversion</h2>
        {conversion.length === 0 ? (
          <p className="text-sm opacity-60">No forms yet.</p>
        ) : (
          <div className="overflow-x-auto border border-black/10 dark:border-white/10 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-black/5 dark:bg-white/10 text-left">
                <tr><th className="p-2">Form</th><th className="p-2">Submissions</th><th className="p-2">Converted to contact</th><th className="p-2">Conversion rate</th></tr>
              </thead>
              <tbody>
                {conversion.map((c) => (
                  <tr key={c.formId} className="border-t border-black/10 dark:border-white/10">
                    <td className="p-2">{c.formName}</td>
                    <td className="p-2">{c.submissionCount}</td>
                    <td className="p-2">{c.convertedToContact}</td>
                    <td className="p-2">{c.submissionCount > 0 ? `${Math.round((c.convertedToContact / c.submissionCount) * 100)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="font-medium mb-2">Call script usage</h2>
        {usage.length === 0 ? (
          <p className="text-sm opacity-60">No call scripts yet.</p>
        ) : (
          <div className="overflow-x-auto border border-black/10 dark:border-white/10 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-black/5 dark:bg-white/10 text-left">
                <tr><th className="p-2">Script</th><th className="p-2">Calls using it</th></tr>
              </thead>
              <tbody>
                {usage.map((u) => (
                  <tr key={u.scriptId} className="border-t border-black/10 dark:border-white/10">
                    <td className="p-2">{u.scriptName}</td>
                    <td className="p-2">{u.callCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="font-medium mb-2">Calls by status ({totalCalls} total)</h2>
        {byStatus.length === 0 ? (
          <p className="text-sm opacity-60">No calls logged yet.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {byStatus.map((s) => (
              <li key={s.status} className="flex justify-between max-w-xs">
                <span className="capitalize">{s.status.replace('_', ' ')}</span>
                <span className="font-medium">{s.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="font-medium mb-2">Calls per day (last 30 days)</h2>
        {perDay.length === 0 ? (
          <p className="text-sm opacity-60">No calls logged yet.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {perDay.map((d) => (
              <li key={d.day} className="flex justify-between max-w-xs">
                <span>{d.day}</span>
                <span className="font-medium">{d.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
