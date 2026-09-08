import { query } from '@/lib/db';
import { Contact, ContactProps, ContactStatus } from './Contact';

interface ContactRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  clinic_name: string | null;
  preferred_language: string;
  status: ContactStatus;
  source: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

function toEntity(row: ContactRow): Contact {
  const props: ContactProps = {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    clinicName: row.clinic_name,
    preferredLanguage: row.preferred_language,
    status: row.status,
    source: row.source,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
  return new Contact(props);
}

export async function listContacts(limit = 200): Promise<Contact[]> {
  const { rows } = await query<ContactRow>('SELECT * FROM contact ORDER BY created_at DESC LIMIT $1', [limit]);
  return rows.map(toEntity);
}

export async function getContact(id: string): Promise<Contact | null> {
  const { rows } = await query<ContactRow>('SELECT * FROM contact WHERE id = $1', [id]);
  return rows[0] ? toEntity(rows[0]) : null;
}

/** Used by the Vapi webhook receiver to match an inbound caller's number
 * back to an existing contact -- returns null (not an error) if unknown. */
export async function getContactByPhone(phone: string): Promise<Contact | null> {
  const { rows } = await query<ContactRow>('SELECT * FROM contact WHERE phone = $1 LIMIT 1', [phone]);
  return rows[0] ? toEntity(rows[0]) : null;
}

/** owner_customer_id is a real column (see customer/db-schema.sql) but the
 * Contact entity never surfaces it -- a direct query avoids widening the
 * entity's public shape just for this one internal cost-cap check. */
export async function getContactOwnerCustomerId(contactId: string): Promise<string | null> {
  const { rows } = await query<{ owner_customer_id: string | null }>(
    'SELECT owner_customer_id FROM contact WHERE id = $1', [contactId]
  );
  return rows[0]?.owner_customer_id ?? null;
}

export interface CreateContactInput {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  clinicName?: string | null;
  preferredLanguage?: string;
  source?: string;
  notes?: string | null;
}

export async function createContact(input: CreateContactInput): Promise<Contact> {
  // Validate via the entity before writing (throws on invalid input).
  new Contact({
    id: '00000000-0000-0000-0000-000000000000',
    fullName: input.fullName,
    email: input.email ?? null,
    phone: input.phone ?? null,
    clinicName: input.clinicName ?? null,
    preferredLanguage: input.preferredLanguage ?? 'en',
    status: 'new',
    source: input.source ?? 'manual',
    notes: input.notes ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const { rows } = await query<ContactRow>(
    `INSERT INTO contact (full_name, email, phone, clinic_name, preferred_language, source, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.fullName,
      input.email ?? null,
      input.phone ?? null,
      input.clinicName ?? null,
      input.preferredLanguage ?? 'en',
      input.source ?? 'manual',
      input.notes ?? null,
    ]
  );
  return toEntity(rows[0]);
}

export async function updateContactStatus(id: string, status: ContactStatus): Promise<Contact | null> {
  const { rows } = await query<ContactRow>(
    `UPDATE contact SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, status]
  );
  return rows[0] ? toEntity(rows[0]) : null;
}

export async function updateContactDetails(
  id: string,
  patch: Partial<Pick<CreateContactInput, 'fullName' | 'email' | 'phone' | 'clinicName' | 'preferredLanguage' | 'notes'>>
): Promise<Contact | null> {
  const existing = await getContact(id);
  if (!existing) return null;
  const updated = existing.updateDetails(patch);
  const json = updated.toJSON();
  const { rows } = await query<ContactRow>(
    `UPDATE contact SET full_name = $2, email = $3, phone = $4, clinic_name = $5, preferred_language = $6, notes = $7, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, json.fullName, json.email, json.phone, json.clinicName, json.preferredLanguage, json.notes]
  );
  return rows[0] ? toEntity(rows[0]) : null;
}

export async function countContacts(): Promise<number> {
  const { rows } = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM contact');
  return Number(rows[0]?.count ?? 0);
}
