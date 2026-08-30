import { NextRequest, NextResponse } from 'next/server';
import { getFormBySlug, recordSubmission } from '@/domain/form/repository';
import { createContact } from '@/domain/contact/repository';

// Public, unauthenticated by design — this is the lead-capture endpoint a
// clinic's public site (or a form embed) posts to. Server-side validation
// only; never trust anything the client already "validated".
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const form = await getFormBySlug(params.slug);
  if (!form) return NextResponse.json({ error: 'Form not found.' }, { status: 404 });
  if (!form.acceptsSubmissions) {
    return NextResponse.json({ error: 'This form is not currently accepting submissions.' }, { status: 410 });
  }

  let data: Record<string, unknown>;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return NextResponse.json({ error: 'Request body must be a JSON object.' }, { status: 400 });
  }

  const errors = form.validate(data);
  if (errors.length > 0) {
    return NextResponse.json({ error: 'Validation failed.', details: errors }, { status: 400 });
  }

  // Best-effort extraction of contact fields from the submitted data —
  // clinics commonly name their fields this way; anything not recognized
  // still gets stored verbatim in form_submission.data.
  const fields = form.fields;
  const nameKey = fields.find((f) => /name/i.test(f.key))?.key;
  const emailKey = fields.find((f) => f.type === 'email')?.key ?? fields.find((f) => /email/i.test(f.key))?.key;
  const phoneKey = fields.find((f) => f.type === 'phone')?.key ?? fields.find((f) => /phone/i.test(f.key))?.key;
  const clinicKey = fields.find((f) => /clinic|business|company/i.test(f.key))?.key;

  const fullName = (nameKey && typeof data[nameKey] === 'string' ? (data[nameKey] as string).trim() : '') || 'Unknown';
  const email = emailKey && typeof data[emailKey] === 'string' ? (data[emailKey] as string).trim() : null;
  const phone = phoneKey && typeof data[phoneKey] === 'string' ? (data[phoneKey] as string).trim() : null;
  const clinicName = clinicKey && typeof data[clinicKey] === 'string' ? (data[clinicKey] as string).trim() : null;

  let contactId: string | null = null;
  if (email || phone) {
    try {
      const contact = await createContact({
        fullName,
        email,
        phone,
        clinicName,
        source: `form:${form.slug}`,
      });
      contactId = contact.id;
    } catch {
      // Contact creation failed validation (e.g. malformed email) even
      // though the form-level check passed — still record the raw
      // submission below so the lead isn't lost, just unlinked.
      contactId = null;
    }
  }

  const submission = await recordSubmission(form.id, data, contactId);

  return NextResponse.json(
    {
      ok: true,
      message: form.successMessage,
      submissionId: submission.id,
      contactId,
    },
    { status: 201 }
  );
}
