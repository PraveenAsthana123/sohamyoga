import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../lib/session-auth';
import { query } from '../../../lib/postgres';
import { withApiErrorLog } from '../../../lib/api-error-log';
import { clientIp, isRateLimited } from '../../../lib/rate-limit';

// Deliberately unauthenticated POST — public intake form. B2C submissions can
// later be converted to B2B (segment flips, converted_from_b2c_at is stamped)
// rather than requiring a second separate submission, per the transition path
// called for in the source conversation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function wid() {
  const r = await query<{ id: string }>(`SELECT id FROM marketing_workspace ORDER BY created_at LIMIT 1`);
  return r.rows[0]?.id;
}

async function handleGet(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const w = await wid();
  if (!w) return Response.json({ error: 'Workspace missing.' }, { status: 503 });
  const segment = req.nextUrl.searchParams.get('segment');
  const conditions = ['workspace_id = $1'];
  const params: unknown[] = [w];
  if (segment) { params.push(segment); conditions.push(`segment = $${params.length}`); }
  const result = await query(
    `SELECT * FROM intake_submission WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
    params,
  );
  return Response.json({ submissions: result.rows });
}

async function handlePost(req: NextRequest) {
  if (isRateLimited(`intake:${clientIp(req)}`, 5, 60_000)) {
    return Response.json({ error: 'Too many submissions. Please try again in a minute.' }, { status: 429 });
  }
  const w = await wid();
  if (!w) return Response.json({ error: 'Workspace missing.' }, { status: 503 });
  const body = await req.json().catch(() => null) as {
    segment?: string; contactName?: string; email?: string; phone?: string;
    companyName?: string; role?: string; useCase?: string;
  } | null;
  if (!body?.segment || !['b2c', 'b2b'].includes(body.segment)) {
    return Response.json({ error: 'segment must be b2c or b2b.' }, { status: 400 });
  }
  if (!body.contactName || !body.email) {
    return Response.json({ error: 'contactName and email are required.' }, { status: 400 });
  }
  if (!EMAIL_RE.test(body.email)) {
    return Response.json({ error: 'A valid email address is required.' }, { status: 400 });
  }
  if (body.segment === 'b2b' && !body.companyName) {
    return Response.json({ error: 'companyName is required for a B2B submission.' }, { status: 400 });
  }
  const result = await query(
    `INSERT INTO intake_submission (workspace_id, segment, contact_name, email, phone, company_name, role, use_case)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [w, body.segment, body.contactName, body.email, body.phone || null, body.companyName || null, body.role || null, body.useCase || ''],
  );
  return Response.json({ submission: result.rows[0] }, { status: 201 });
}

async function handlePatch(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null) as {
    submissionId?: string; action?: string; companyName?: string; role?: string;
  } | null;
  if (!body?.submissionId || !['convert_to_b2b', 'contacted', 'qualified', 'converted', 'lost'].includes(body.action ?? '')) {
    return Response.json({ error: 'submissionId and a valid action are required.' }, { status: 400 });
  }
  if (body.action === 'convert_to_b2b') {
    const existing = await query<{ segment: string }>(`SELECT segment FROM intake_submission WHERE id = $1`, [body.submissionId]);
    if (!existing.rowCount) return Response.json({ error: 'Submission not found.' }, { status: 404 });
    if (existing.rows[0].segment !== 'b2c') {
      return Response.json({ error: 'Only a b2c submission can be converted to b2b.' }, { status: 400 });
    }
    if (!body.companyName) {
      return Response.json({ error: 'companyName is required to convert to B2B.' }, { status: 400 });
    }
    const result = await query(
      `UPDATE intake_submission
       SET segment = 'b2b', company_name = $2, role = COALESCE($3, role), status = 'qualified',
           converted_from_b2c_at = now(), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [body.submissionId, body.companyName, body.role || null],
    );
    return Response.json({ submission: result.rows[0] });
  }
  const result = await query(
    `UPDATE intake_submission SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [body.submissionId, body.action],
  );
  if (!result.rowCount) return Response.json({ error: 'Submission not found.' }, { status: 404 });
  return Response.json({ submission: result.rows[0] });
}

export const GET = withApiErrorLog(handleGet);
export const POST = withApiErrorLog(handlePost);
export const PATCH = withApiErrorLog(handlePatch);
