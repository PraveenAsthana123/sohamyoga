import Link from 'next/link';
import { listScripts } from '@/domain/script/repository';

export const dynamic = 'force-dynamic';

export default async function ScriptsListPage() {
  const scripts = await listScripts();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Call Scripts</h1>
        <Link href="/admin/scripts/new" className="rounded bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 text-sm">
          + New script
        </Link>
      </div>

      {scripts.length === 0 ? (
        <p className="text-sm opacity-60">No call scripts yet.</p>
      ) : (
        (() => {
          const groups = new Map<string, typeof scripts>();
          for (const s of scripts) {
            const key = s.category ?? 'Uncategorized';
            groups.set(key, [...(groups.get(key) ?? []), s]);
          }
          return Array.from(groups.entries()).map(([category, group]) => (
            <div key={category} className="space-y-2">
              <h2 className="text-sm font-medium opacity-70 capitalize">{category.replace(/_/g, ' ')} ({group.length})</h2>
              <div className="overflow-x-auto border border-black/10 dark:border-white/10 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-black/5 dark:bg-white/10 text-left">
                    <tr>
                      <th className="p-2">Name</th>
                      <th className="p-2">Direction</th>
                      <th className="p-2">Scenario</th>
                      <th className="p-2">Service type</th>
                      <th className="p-2">Published version</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.map((s) => {
                      const json = s.toJSON();
                      return (
                        <tr key={json.id} className="border-t border-black/10 dark:border-white/10">
                          <td className="p-2"><Link href={`/admin/scripts/${json.id}`} className="underline">{json.name}</Link></td>
                          <td className="p-2 capitalize">{json.direction}</td>
                          <td className="p-2 capitalize">{json.scenarioKey ? json.scenarioKey.replace(/_/g, ' ') : '—'}</td>
                          <td className="p-2 capitalize">{json.serviceType.replace('_', ' ')}</td>
                          <td className="p-2">{json.publishedVersionId ? 'Published' : 'No published version'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ));
        })()
      )}
    </div>
  );
}
