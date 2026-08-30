import { listContacts } from '@/domain/contact/repository';
import { listPublishedVersions } from '@/domain/script/repository';
import LogCallForm from './LogCallForm';

export const dynamic = 'force-dynamic';

export default async function NewCallPage() {
  const [contacts, versions] = await Promise.all([listContacts(), listPublishedVersions()]);

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Log a call</h1>
        <p className="text-sm opacity-60 mt-1">
          Manual entry — no voice provider is configured, so this is how staff record what actually happened on a real call.
        </p>
      </div>
      <LogCallForm
        contacts={contacts.map((c) => ({ id: c.id, fullName: c.fullName }))}
        versions={versions}
      />
    </div>
  );
}
