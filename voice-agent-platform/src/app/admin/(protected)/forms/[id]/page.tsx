import { notFound } from 'next/navigation';
import { getForm, listSubmissions } from '@/domain/form/repository';
import FormStatusControls from './FormStatusControls';

export const dynamic = 'force-dynamic';

export default async function FormDetailPage({ params }: { params: { id: string } }) {
  const form = await getForm(params.id);
  if (!form) notFound();
  const json = form.toJSON();
  const submissions = await listSubmissions(json.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{json.name}</h1>
        <p className="text-sm opacity-60 mt-1">
          Public submit endpoint: <code className="font-mono">POST /api/public/forms/{json.slug}/submit</code>
        </p>
      </div>

      <FormStatusControls formId={json.id} currentStatus={json.status} />

      <div>
        <h2 className="font-medium mb-2">Fields</h2>
        <ul className="text-sm space-y-1">
          {json.fields.map((f) => (
            <li key={f.key} className="flex gap-2">
              <span className="font-mono opacity-60">{f.key}</span>
              <span>{f.label}</span>
              <span className="opacity-60">({f.type}{f.required ? ', required' : ''})</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="font-medium mb-2">Submissions ({submissions.length})</h2>
        {submissions.length === 0 ? (
          <p className="text-sm opacity-60">No submissions yet.</p>
        ) : (
          <div className="overflow-x-auto border border-black/10 dark:border-white/10 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-black/5 dark:bg-white/10 text-left">
                <tr>
                  <th className="p-2">Submitted</th>
                  <th className="p-2">Data</th>
                  <th className="p-2">Linked contact</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => {
                  const sJson = s.toJSON();
                  return (
                    <tr key={sJson.id} className="border-t border-black/10 dark:border-white/10 align-top">
                      <td className="p-2 whitespace-nowrap">{new Date(sJson.createdAt).toLocaleString()}</td>
                      <td className="p-2 font-mono text-xs whitespace-pre-wrap">{JSON.stringify(sJson.data, null, 2)}</td>
                      <td className="p-2">{sJson.contactId ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
