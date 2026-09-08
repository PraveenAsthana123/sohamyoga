import { query, pool } from '@/lib/db';
import { BusinessCustomer, BusinessCustomerProps } from './BusinessCustomer';
import { ClinicServiceType } from '@/domain/script/CallScript';
import { hashPassword } from '@/lib/auth';

interface Row {
  id: string; email: string; business_name: string; service_type: ClinicServiceType;
  services_description: string; pricing_info: string; business_hours: string; holidays_closures: string;
  welcome_note: string; thank_you_note: string; payment_note: string;
  is_active: boolean; created_at: Date; updated_at: Date;
}

function toEntity(row: Row): BusinessCustomer {
  return new BusinessCustomer({
    id: row.id, email: row.email, businessName: row.business_name, serviceType: row.service_type,
    servicesDescription: row.services_description, pricingInfo: row.pricing_info,
    businessHours: row.business_hours, holidaysClosures: row.holidays_closures,
    welcomeNote: row.welcome_note, thankYouNote: row.thank_you_note, paymentNote: row.payment_note,
    isActive: row.is_active, createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at),
  });
}

export interface RegisterBusinessCustomerInput {
  email: string; password: string; businessName: string; serviceType: ClinicServiceType;
  servicesDescription?: string; pricingInfo?: string; businessHours?: string; holidaysClosures?: string;
}

export async function registerBusinessCustomer(input: RegisterBusinessCustomerInput): Promise<BusinessCustomer> {
  const passwordHash = hashPassword(input.password);
  const { rows } = await query<Row>(
    `INSERT INTO business_customer (email, password_hash, business_name, service_type, services_description, pricing_info, business_hours, holidays_closures)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [input.email.toLowerCase().trim(), passwordHash, input.businessName, input.serviceType,
     input.servicesDescription ?? '', input.pricingInfo ?? '', input.businessHours ?? '', input.holidaysClosures ?? ''],
  );
  return toEntity(rows[0]);
}

/** Admin-side listing of every business customer -- lets staff manage a
 * business's profile/contacts/scripts on their behalf when that business
 * doesn't want to self-serve, per explicit requirement: everything a
 * business customer can do for themselves, admin can also do for them. */
export async function listBusinessCustomers(): Promise<BusinessCustomer[]> {
  const { rows } = await query<Row>('SELECT * FROM business_customer ORDER BY created_at DESC');
  return rows.map(toEntity);
}

export async function getBusinessCustomer(id: string): Promise<BusinessCustomer | null> {
  const { rows } = await query<Row>('SELECT * FROM business_customer WHERE id = $1', [id]);
  return rows[0] ? toEntity(rows[0]) : null;
}

export interface UpdateProfileInput {
  businessName?: string; serviceType?: ClinicServiceType; servicesDescription?: string;
  pricingInfo?: string; businessHours?: string; holidaysClosures?: string;
  welcomeNote?: string; thankYouNote?: string; paymentNote?: string;
}

export async function updateBusinessCustomerProfile(id: string, input: UpdateProfileInput): Promise<BusinessCustomer> {
  const current = await getBusinessCustomer(id);
  if (!current) throw new Error('Business customer not found.');
  const merged = current.withProfile(input); // validates via the entity

  const { rows } = await query<Row>(
    `UPDATE business_customer SET
       business_name = $2, service_type = $3, services_description = $4,
       pricing_info = $5, business_hours = $6, holidays_closures = $7,
       welcome_note = $8, thank_you_note = $9, payment_note = $10, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, merged.businessName, merged.serviceType, merged.servicesDescription, merged.pricingInfo, merged.businessHours, merged.holidaysClosures,
     merged.welcomeNote, merged.thankYouNote, merged.paymentNote],
  );
  return toEntity(rows[0]);
}

export interface ContactRow {
  id: string; fullName: string; email: string | null; phone: string | null; status: string; source: string; createdAt: Date;
}

export async function listContactsForCustomer(customerId: string): Promise<ContactRow[]> {
  const { rows } = await query<{ id: string; full_name: string; email: string | null; phone: string | null; status: string; source: string; created_at: Date }>(
    `SELECT id, full_name, email, phone, status, source, created_at FROM contact WHERE owner_customer_id = $1 ORDER BY created_at DESC`,
    [customerId],
  );
  return rows.map(r => ({ id: r.id, fullName: r.full_name, email: r.email, phone: r.phone, status: r.status, source: r.source, createdAt: new Date(r.created_at) }));
}

export async function addContactForCustomer(customerId: string, input: { fullName: string; email?: string; phone?: string }): Promise<ContactRow> {
  if (!input.email && !input.phone) throw new Error('Either email or phone is required.');
  const { rows } = await query<{ id: string; full_name: string; email: string | null; phone: string | null; status: string; source: string; created_at: Date }>(
    `INSERT INTO contact (full_name, email, phone, source, owner_customer_id) VALUES ($1,$2,$3,'customer_portal',$4) RETURNING id, full_name, email, phone, status, source, created_at`,
    [input.fullName, input.email ?? null, input.phone ?? null, customerId],
  );
  return { id: rows[0].id, fullName: rows[0].full_name, email: rows[0].email, phone: rows[0].phone, status: rows[0].status, source: rows[0].source, createdAt: new Date(rows[0].created_at) };
}

/** Bulk-imports contacts from parsed CSV rows -- real validation per row,
 * skips rows with neither email nor phone rather than failing the whole
 * batch, and reports exactly what happened (never silently drops rows). */
export async function bulkImportContacts(customerId: string, rows: { fullName: string; email?: string; phone?: string }[]): Promise<{ imported: number; skipped: { row: number; reason: string }[] }> {
  const skipped: { row: number; reason: string }[] = [];
  let imported = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.fullName?.trim()) { skipped.push({ row: i + 1, reason: 'missing name' }); continue; }
      if (!r.email && !r.phone) { skipped.push({ row: i + 1, reason: 'missing both email and phone' }); continue; }
      await client.query(
        `INSERT INTO contact (full_name, email, phone, source, owner_customer_id) VALUES ($1,$2,$3,'customer_portal_import',$4)`,
        [r.fullName.trim(), r.email?.trim() || null, r.phone?.trim() || null, customerId],
      );
      imported++;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return { imported, skipped };
}

export interface CustomerScriptRow {
  id: string; name: string; direction: string; scenarioKey: string | null; status: string;
  opening: string; discoveryQuestions: string[]; objectionHandling: string; closing: string; createdAt: Date;
}

/** Scripts scoped to only this customer's own business -- content only
 * (opening/discovery/objection/closing sections). Vapi technical config
 * (model/voice/transcriber) and the sync-to-Vapi action are deliberately
 * NOT exposed here -- those stay admin-only per explicit requirement. */
export async function listScriptsForCustomer(customerId: string): Promise<CustomerScriptRow[]> {
  const { rows } = await query<{
    id: string; name: string; direction: string; scenario_key: string | null; status: string;
    opening: string; discovery_questions: string[]; objection_handling: string; closing: string; created_at: Date;
  }>(
    `SELECT cs.id, cs.name, cs.direction, cs.scenario_key, csv.status,
            csv.sections->>'opening' AS opening,
            COALESCE(csv.sections->'discoveryQuestions', '[]'::jsonb) AS discovery_questions,
            csv.sections->>'objectionHandling' AS objection_handling,
            csv.sections->>'closing' AS closing,
            cs.created_at
     FROM call_script cs
     JOIN call_script_version csv ON csv.id = COALESCE(cs.published_version_id, (SELECT id FROM call_script_version WHERE script_id = cs.id ORDER BY version_number DESC LIMIT 1))
     WHERE cs.owner_customer_id = $1
     ORDER BY cs.direction, cs.name`,
    [customerId],
  );
  return rows.map(r => ({
    id: r.id, name: r.name, direction: r.direction, scenarioKey: r.scenario_key, status: r.status,
    opening: r.opening ?? '', discoveryQuestions: r.discovery_questions ?? [], objectionHandling: r.objection_handling ?? '',
    closing: r.closing ?? '', createdAt: new Date(r.created_at),
  }));
}

export interface AddCustomerScriptInput {
  name: string; direction: 'inbound' | 'outbound'; scenarioKey?: string;
  opening: string; discoveryQuestions: string[]; objectionHandling: string; closing: string;
}

export async function addScriptForCustomer(customerId: string, serviceType: ClinicServiceType, input: AddCustomerScriptInput): Promise<string> {
  const slug = `${customerId.slice(0, 8)}-${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now().toString(36)}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const scriptResult = await client.query<{ id: string }>(
      `INSERT INTO call_script (slug, name, service_type, direction, scenario_key, owner_customer_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [slug, input.name, serviceType, input.direction, input.scenarioKey ?? null, customerId],
    );
    await client.query(
      `INSERT INTO call_script_version (script_id, version_number, sections, status, created_by)
       VALUES ($1, 1, $2, 'draft', 'business_customer')`,
      [scriptResult.rows[0].id, JSON.stringify({ opening: input.opening, discoveryQuestions: input.discoveryQuestions, objectionHandling: input.objectionHandling, closing: input.closing })],
    );
    await client.query('COMMIT');
    return scriptResult.rows[0].id;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export interface CustomerCallLogRow {
  id: string; contactName: string | null; direction: string; status: string;
  durationSeconds: number | null; outcomeNotes: string | null; needsFollowUp: boolean; createdAt: Date;
}

/** Real call history scoped to only this customer's own contacts -- never
 * another business's calls. Empty until real calls are logged against
 * their contacts (manually today, automatically once a webhook exists). */
export async function listCallLogForCustomer(customerId: string): Promise<CustomerCallLogRow[]> {
  const { rows } = await query<{ id: string; full_name: string | null; direction: string; status: string; duration_seconds: number | null; outcome_notes: string | null; needs_follow_up: boolean; created_at: Date }>(
    `SELECT cl.id, c.full_name, cl.direction, cl.status, cl.duration_seconds, cl.outcome_notes, cl.needs_follow_up, cl.created_at
     FROM call_log cl JOIN contact c ON c.id = cl.contact_id
     WHERE c.owner_customer_id = $1 ORDER BY cl.created_at DESC LIMIT 200`,
    [customerId],
  );
  return rows.map(r => ({
    id: r.id, contactName: r.full_name, direction: r.direction, status: r.status,
    durationSeconds: r.duration_seconds, outcomeNotes: r.outcome_notes, needsFollowUp: r.needs_follow_up, createdAt: new Date(r.created_at),
  }));
}

/** Real, minimal "price tracking and control" (Topic Q) -- an admin-set
 * monthly Vapi spend cap per business, kept separate from the business's
 * own self-editable profile fields (this is an operational control, not
 * business content). NULL means no cap configured. */
export async function setMonthlyCostCap(customerId: string, capUsd: number | null): Promise<void> {
  await query('UPDATE business_customer SET monthly_cost_cap_usd = $2, updated_at = now() WHERE id = $1', [customerId, capUsd]);
}

export async function getMonthlyCostCap(customerId: string): Promise<number | null> {
  const { rows } = await query<{ monthly_cost_cap_usd: string | null }>(
    'SELECT monthly_cost_cap_usd FROM business_customer WHERE id = $1', [customerId]
  );
  return rows[0]?.monthly_cost_cap_usd ? Number(rows[0].monthly_cost_cap_usd) : null;
}

/** Real month-to-date Vapi spend for one business, derived from cost_usd
 * the webhook actually captured -- never estimated. */
export async function monthToDateCostForCustomer(customerId: string): Promise<number> {
  const { rows } = await query<{ total: string | null }>(
    `SELECT SUM(cl.cost_usd)::text AS total
       FROM call_log cl JOIN contact c ON c.id = cl.contact_id
      WHERE c.owner_customer_id = $1 AND date_trunc('month', cl.created_at) = date_trunc('month', now())`,
    [customerId]
  );
  return rows[0]?.total ? Number(rows[0].total) : 0;
}
