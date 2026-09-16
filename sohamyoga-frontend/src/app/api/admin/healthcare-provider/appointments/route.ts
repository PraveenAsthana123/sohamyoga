export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const provider = searchParams.get('provider');
  const serviceType = searchParams.get('service_type');
  const status = searchParams.get('status');

  const client = await pool.connect();
  try {
    const where: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (dateFrom) { where.push(`ha.appointment_date >= $${i++}`); params.push(dateFrom); }
    if (dateTo) { where.push(`ha.appointment_date <= $${i++}`); params.push(dateTo); }
    if (provider) { where.push(`ha.provider_name ILIKE $${i++}`); params.push(`%${provider}%`); }
    if (serviceType) { where.push(`ha.service_type=$${i++}`); params.push(serviceType); }
    if (status) { where.push(`ha.status=$${i++}`); params.push(status); }

    const wStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await client.query(`
      SELECT ha.*, hp.name AS patient_name, hp.phone AS patient_phone, hp.insurance_provider
      FROM healthcare_appointment ha
      LEFT JOIN healthcare_patient hp ON hp.id=ha.patient_id
      ${wStr}
      ORDER BY ha.appointment_date DESC
      LIMIT 200
    `, params);

    return Response.json({ appointments: rows.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const body = await req.json();
    const { patient_id, provider_name, service_type, appointment_date, duration_minutes, notes } = body;
    if (!patient_id || !service_type || !appointment_date) {
      return Response.json({ error: 'patient_id, service_type, appointment_date required' }, { status: 400 });
    }

    const r = await client.query(`
      INSERT INTO healthcare_appointment (patient_id,provider_name,service_type,appointment_date,duration_minutes,notes)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [patient_id, provider_name, service_type, appointment_date, duration_minutes||30, notes]);

    return Response.json({ appointment: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
