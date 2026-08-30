import { notFound } from 'next/navigation';
import { getContact } from '@/domain/contact/repository';
import ContactStatusForm from './ContactStatusForm';

export const dynamic = 'force-dynamic';

export default async function ContactDetailPage({ params }: { params: { id: string } }) {
  const contact = await getContact(params.id);
  if (!contact) notFound();
  const json = contact.toJSON();

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
    </div>
  );
}
