import Link from 'next/link';
import { listForms } from '@/domain/form/repository';

export const dynamic = 'force-dynamic';

export default async function FormsListPage() {
  const forms = await listForms();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Forms</h1>
        <Link href="/admin/forms/new" className="rounded bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 text-sm">
          + New form
        </Link>
      </div>

      {forms.length === 0 ? (
        <p className="text-sm opacity-60">No forms yet.</p>
      ) : (
        <div className="overflow-x-auto border border-black/10 dark:border-white/10 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-black/5 dark:bg-white/10 text-left">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2">Slug</th>
                <th className="p-2">Status</th>
                <th className="p-2">Fields</th>
                <th className="p-2">Submissions</th>
              </tr>
            </thead>
            <tbody>
              {forms.map((f) => {
                const json = f.toJSON();
                return (
                  <tr key={json.id} className="border-t border-black/10 dark:border-white/10">
                    <td className="p-2"><Link href={`/admin/forms/${json.id}`} className="underline">{json.name}</Link></td>
                    <td className="p-2 font-mono text-xs">{json.slug}</td>
                    <td className="p-2 capitalize">{json.status}</td>
                    <td className="p-2">{json.fields.length}</td>
                    <td className="p-2">{json.submissionCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
