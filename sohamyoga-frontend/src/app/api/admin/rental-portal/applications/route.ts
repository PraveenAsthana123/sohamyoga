import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const listing_id       = searchParams.get('listing_id');
  const platform         = searchParams.get('platform');
  const screening_status = searchParams.get('screening_status');

  const conditions: string[] = [];
  const params: unknown[]    = [];
  let p = 1;

  if (listing_id)       { conditions.push(`a.listing_id = $${p++}`);        params.push(Number(listing_id)); }
  if (platform)         { conditions.push(`a.platform = $${p++}`);           params.push(platform); }
  if (screening_status) { conditions.push(`a.screening_status = $${p++}`);   params.push(screening_status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT a.*, l.address, l.neighbourhood, l.rental_type
       FROM rental_application a
       LEFT JOIN rental_listing l ON l.id = a.listing_id
       ${where}
       ORDER BY a.created_at DESC`,
      params,
    );
    return Response.json({ applications: res.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json() as Record<string, unknown>;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO rental_application (
        listing_id, platform, applicant_name, email, phone,
        move_in_date, monthly_income, employment_status,
        num_occupants, has_pets, pet_details, message,
        screening_status, credit_score, references_provided, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *`,
      [
        body.listing_id ?? null,
        body.platform ?? null,
        body.applicant_name,
        body.email ?? null,
        body.phone ?? null,
        body.move_in_date ?? null,
        body.monthly_income ?? null,
        body.employment_status ?? null,
        body.num_occupants ?? 1,
        body.has_pets ?? false,
        body.pet_details ?? null,
        body.message ?? null,
        body.screening_status ?? 'pending',
        body.credit_score ?? null,
        body.references_provided ?? false,
        body.notes ?? null,
      ],
    );
    return Response.json({ application: res.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
