import Link from 'next/link';
import { listContacts } from '@/domain/contact/repository';

export const dynamic = 'force-dynamic';

export default async function ContactsListPage() {
  const contacts = await listContacts();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Contacts</h1>
        <Link href="/admin/contacts/new" className="rounded bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 text-sm">
          + New contact
        </Link>
      </div>

      {contacts.length === 0 ? (
        <p className="text-sm opacity-60">No contacts yet. Create one manually, or wait for a form submission.</p>
      ) : (
        <div className="overflow-x-auto border border-black/10 dark:border-white/10 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-black/5 dark:bg-white/10 text-left">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2">Clinic</th>
                <th className="p-2">Email</th>
                <th className="p-2">Phone</th>
                <th className="p-2">Status</th>
                <th className="p-2">Source</th>
                <th className="p-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const json = c.toJSON();
                return (
                  <tr key={json.id} className="border-t border-black/10 dark:border-white/10">
                    <td className="p-2">
                      <Link href={`/admin/contacts/${json.id}`} className="underline">
                        {json.fullName}
                      </Link>
                    </td>
                    <td className="p-2">{json.clinicName ?? '—'}</td>
                    <td className="p-2">{json.email ?? '—'}</td>
                    <td className="p-2">{json.phone ?? '—'}</td>
                    <td className="p-2 capitalize">{json.status.replace('_', ' ')}</td>
                    <td className="p-2">{json.source}</td>
                    <td className="p-2">{new Date(json.createdAt).toLocaleString()}</td>
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
