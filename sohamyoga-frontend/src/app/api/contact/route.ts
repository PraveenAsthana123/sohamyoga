// POST /api/contact — public contact-form submission. Previously this route
// didn't exist at all: ContactForm.tsx posted to it, but it targeted the now-
// deleted SLPSystems.Web ContactController.cs, so every real visitor
// submission has been silently failing. Creates a real campaign_lead row so
// the existing (Ollama-based) LeadNurturingJob has something real to score —
// that pipeline was fully built and correctly wired to the CRM Leads tab,
// but had zero rows to ever process.
//
// GET /api/contact — admin list of raw contact submissions (CRM Leads tab
// shows scored/qualified leads; this is the unfiltered raw inbox).

import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { findDuplicateLead, markAsDuplicate } from '@/domain/marketing/LeadDedup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TENANT_ID = '16fb3a23-5370-4572-bc93-2076534a4e99';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ContactBody {
  name?: string; email?: string; phone?: string; company?: string;
  subject?: string; serviceInterest?: string; message?: string;
}

export async function POST(req: NextRequest) {
  if (!databaseConfigured()) return Response.json({ detail: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as ContactBody | null;
  if (!body?.name?.trim()) return Response.json({ detail: 'Name is required.' }, { status: 400 });
  if (!body.email?.trim() || !EMAIL_RE.test(body.email.trim())) {
    return Response.json({ detail: 'A valid email is required.' }, { status: 400 });
  }
  if (!body.subject?.trim()) return Response.json({ detail: 'Subject is required.' }, { status: 400 });
  if (!body.message?.trim() || body.message.trim().length < 10) {
    return Response.json({ detail: 'Message must be at least 10 characters.' }, { status: 400 });
  }
  if (body.message.length > 5000) return Response.json({ detail: 'Message must be 5000 characters or fewer.' }, { status: 400 });

  const nameParts = body.name.trim().split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ') || null;

  const result = await query<{ id: string }>(
    `INSERT INTO campaign_lead
       (tenant_id, first_name, last_name, email, phone, source_platform, funnel_stage, subject, message, service_interest, company)
     VALUES ($1,$2,$3,$4,$5,'website_form','new',$6,$7,$8,$9)
     RETURNING id`,
    [TENANT_ID, firstName, lastName, body.email.trim(), body.phone?.trim() || null,
      body.subject.trim(), body.message.trim(), body.serviceInterest?.trim() || null, body.company?.trim() || null],
  );

  // Real dedup -- confirmed zero implementation before this (grep,
  // 2026-09-01). A repeat inquiry from the same email is flagged, not
  // silently duplicated as an unrelated new lead.
  const found = await findDuplicateLead(TENANT_ID, body.email.trim());
  const duplicateOf = found && found !== result.rows[0].id ? found : null;
  if (duplicateOf) {
    await markAsDuplicate(result.rows[0].id, duplicateOf);
  }

  return Response.json({ ok: true, id: result.rows[0].id, duplicateOfLeadId: duplicateOf }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 50, 200);
  const includeDuplicates = req.nextUrl.searchParams.get('includeDuplicates') === 'true';
  const rows = await query<{
    id: string; first_name: string; last_name: string | null; email: string; phone: string | null;
    subject: string | null; message: string | null; service_interest: string | null; company: string | null;
    funnel_stage: string; lead_score: number | null; lead_temperature: string | null; created_at: string;
    duplicate_of_lead_id: string | null; repeat_inquiry_count: string;
  }>(
    `SELECT cl.id, cl.first_name, cl.last_name, cl.email, cl.phone, cl.subject, cl.message, cl.service_interest, cl.company,
            cl.funnel_stage, cl.lead_score, cl.lead_temperature, cl.created_at, cl.duplicate_of_lead_id,
            (SELECT COUNT(*) FROM campaign_lead d WHERE d.duplicate_of_lead_id = cl.id) AS repeat_inquiry_count
     FROM campaign_lead cl
     WHERE cl.source_platform = 'website_form' ${includeDuplicates ? '' : 'AND cl.duplicate_of_lead_id IS NULL'}
     ORDER BY cl.created_at DESC LIMIT $1`,
    [limit],
  );

  return Response.json({
    submissions: rows.rows.map(r => ({
      id: r.id, name: [r.first_name, r.last_name].filter(Boolean).join(' '), email: r.email, phone: r.phone ?? undefined,
      subject: r.subject ?? undefined, message: r.message ?? undefined, serviceInterest: r.service_interest ?? undefined,
      company: r.company ?? undefined, funnelStage: r.funnel_stage, leadScore: r.lead_score ?? undefined,
      leadTemperature: r.lead_temperature ?? undefined, createdAt: r.created_at,
      duplicateOfLeadId: r.duplicate_of_lead_id ?? undefined, repeatInquiryCount: Number(r.repeat_inquiry_count),
    })),
  });
}
