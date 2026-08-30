import { query } from '@/lib/db';
import { FormDefinition, FormDefinitionProps, FormField, FormStatus } from './FormDefinition';
import { FormSubmission, FormSubmissionProps } from './FormSubmission';

interface FormRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  fields: FormField[];
  success_message: string;
  status: FormStatus;
  submission_count: number;
  created_at: Date;
  updated_at: Date;
}

function toEntity(row: FormRow): FormDefinition {
  const props: FormDefinitionProps = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    fields: row.fields,
    successMessage: row.success_message,
    status: row.status,
    submissionCount: row.submission_count,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
  return new FormDefinition(props);
}

export async function listForms(): Promise<FormDefinition[]> {
  const { rows } = await query<FormRow>('SELECT * FROM form_definition ORDER BY created_at DESC');
  return rows.map(toEntity);
}

export async function getForm(id: string): Promise<FormDefinition | null> {
  const { rows } = await query<FormRow>('SELECT * FROM form_definition WHERE id = $1', [id]);
  return rows[0] ? toEntity(rows[0]) : null;
}

export async function getFormBySlug(slug: string): Promise<FormDefinition | null> {
  const { rows } = await query<FormRow>('SELECT * FROM form_definition WHERE slug = $1', [slug]);
  return rows[0] ? toEntity(rows[0]) : null;
}

export interface CreateFormInput {
  slug: string;
  name: string;
  description?: string | null;
  fields: FormField[];
  successMessage?: string;
}

export async function createForm(input: CreateFormInput): Promise<FormDefinition> {
  // Validate via the entity first.
  new FormDefinition({
    id: '00000000-0000-0000-0000-000000000000',
    slug: input.slug,
    name: input.name,
    description: input.description ?? null,
    fields: input.fields,
    successMessage: input.successMessage ?? 'Thank you — we will be in touch shortly.',
    status: 'draft',
    submissionCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const { rows } = await query<FormRow>(
    `INSERT INTO form_definition (slug, name, description, fields, success_message)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [input.slug, input.name, input.description ?? null, JSON.stringify(input.fields), input.successMessage ?? 'Thank you — we will be in touch shortly.']
  );
  return toEntity(rows[0]);
}

export async function setFormStatus(id: string, status: FormStatus): Promise<FormDefinition | null> {
  const { rows } = await query<FormRow>('UPDATE form_definition SET status = $2, updated_at = now() WHERE id = $1 RETURNING *', [id, status]);
  return rows[0] ? toEntity(rows[0]) : null;
}

interface SubmissionRow {
  id: string;
  form_id: string;
  data: Record<string, unknown>;
  contact_id: string | null;
  created_at: Date;
}

function submissionToEntity(row: SubmissionRow): FormSubmission {
  const props: FormSubmissionProps = {
    id: row.id,
    formId: row.form_id,
    data: row.data,
    contactId: row.contact_id,
    createdAt: new Date(row.created_at),
  };
  return new FormSubmission(props);
}

export async function recordSubmission(formId: string, data: Record<string, unknown>, contactId: string | null): Promise<FormSubmission> {
  const { rows } = await query<SubmissionRow>(
    `INSERT INTO form_submission (form_id, data, contact_id) VALUES ($1, $2, $3) RETURNING *`,
    [formId, JSON.stringify(data), contactId]
  );
  await query('UPDATE form_definition SET submission_count = submission_count + 1, updated_at = now() WHERE id = $1', [formId]);
  return submissionToEntity(rows[0]);
}

export async function listSubmissions(formId: string): Promise<FormSubmission[]> {
  const { rows } = await query<SubmissionRow>('SELECT * FROM form_submission WHERE form_id = $1 ORDER BY created_at DESC', [formId]);
  return rows.map(submissionToEntity);
}

export async function countSubmissionsWithContact(): Promise<number> {
  const { rows } = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM form_submission WHERE contact_id IS NOT NULL');
  return Number(rows[0]?.count ?? 0);
}

export async function countSubmissions(): Promise<number> {
  const { rows } = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM form_submission');
  return Number(rows[0]?.count ?? 0);
}

export interface FormConversionRow {
  formId: string;
  formName: string;
  submissionCount: number;
  convertedToContact: number;
}

export async function submissionConversionByForm(): Promise<FormConversionRow[]> {
  const { rows } = await query<{ form_id: string; form_name: string; submission_count: string; converted: string }>(
    `SELECT fd.id AS form_id, fd.name AS form_name,
            COUNT(fs.id)::text AS submission_count,
            COUNT(fs.contact_id)::text AS converted
       FROM form_definition fd
       LEFT JOIN form_submission fs ON fs.form_id = fd.id
      GROUP BY fd.id, fd.name
      ORDER BY fd.name`
  );
  return rows.map((r) => ({
    formId: r.form_id,
    formName: r.form_name,
    submissionCount: Number(r.submission_count),
    convertedToContact: Number(r.converted),
  }));
}
