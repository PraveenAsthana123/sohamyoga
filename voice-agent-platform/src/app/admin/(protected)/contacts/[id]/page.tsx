import { notFound } from 'next/navigation';
import { getContact } from '@/domain/contact/repository';
import { listVapiSyncedVersions } from '@/domain/script/repository';
import ContactStatusForm from './ContactStatusForm';
import PlaceCallButton from './PlaceCallButton';
import PreferenceForm from './PreferenceForm';
import { listPreferencesForContact } from '@/domain/contact/preferenceRepository';

export const dynamic = 'force-dynamic';

export default async function ContactDetailPage({ params }: { params: { id: string } }) {
  const contact = await getContact(params.id);
  if (!contact) notFound();
  const json = contact.toJSON();
  const versions = await listVapiSyncedVersions();
  const preferences = await listPreferencesForContact(params.id);

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">{json.fullName}</h1>
      <dl className="text-sm space-y-2 border border-black/10 dark:border-white/10 rounded-lg p-4">
        <div className="flex justify-between"><dt className="opacity-60">Email</dt><dd>{json.email ?? '—'}</dd></div>
        <div className="flex justify-between"><dt className="opacity-60">Phone</dt><dd>{json.phone ?? '—'}</dd></div>
        <div className="flex justify-between"><dt className="opacity-60">Clinic</dt><dd>{json.clinicName ?? '—'}</dd></div>
        <div className="flex justify-between"><dt className="opacity-60">Source</dt><dd>{json.source}</dd></div>
        <div className="flex justify-between"><dt className="opacity-60">Created</dt><dd>{new Date(json.createdAt).toLocaleString()}</dd></div>
        {json.notes && <div><dt className="opacity-60 mb-1">Notes</dt><dd>{json.notes}</dd></div>}
      </dl>
      <ContactStatusForm contactId={json.id} currentStatus={json.status} />
      <PlaceCallButton
        contactId={json.id}
        contactPhone={json.phone ?? null}
        callable={contact.isCallable}
        versions={versions}
      />
      <PreferenceForm contactId={json.id} existing={preferences.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))} />
    </div>
  );
}
