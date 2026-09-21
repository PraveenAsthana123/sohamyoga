import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS midwifery_client (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT,
        due_date DATE, pregnancy_week INT DEFAULT 1,
        gravida INT DEFAULT 1, para INT DEFAULT 0,
        blood_type TEXT, gbs_status TEXT,
        midwife TEXT, birth_preference TEXT DEFAULT 'hospital',
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS midwifery_appointment (
        id SERIAL PRIMARY KEY, client_id INT REFERENCES midwifery_client(id) ON DELETE CASCADE,
        client_name TEXT, midwife TEXT,
        appointment_type TEXT DEFAULT 'prenatal-checkup',
        scheduled_at TIMESTAMPTZ, duration_min INT DEFAULT 30,
        notes TEXT, bp_reading TEXT, fundal_height_cm INT,
        fetal_hr_bpm INT, status TEXT DEFAULT 'scheduled',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally { client.release(); }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ clients: [], appointments: [] });
  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [clients, appointments] = await Promise.all([
      client.query('SELECT * FROM midwifery_client ORDER BY due_date ASC LIMIT 100'),
      client.query('SELECT * FROM midwifery_appointment ORDER BY scheduled_at ASC LIMIT 200'),
    ]);
    return Response.json({ clients: clients.rows, appointments: appointments.rows });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  await ensureTables();
  const body = await req.json() as Record<string, unknown>;
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (body.type === 'appointment') {
      const r = await client.query(
        'INSERT INTO midwifery_appointment (client_name, midwife, appointment_type, scheduled_at) VALUES ($1,$2,$3,$4) RETURNING *',
        [body.client_name ?? '', body.midwife ?? '', body.appointment_type ?? 'prenatal-checkup', body.scheduled_at ?? new Date()]
      );
      return Response.json(r.rows[0]);
    }
    const r = await client.query(
      'INSERT INTO midwifery_client (name, email, due_date, midwife) VALUES ($1,$2,$3,$4) RETURNING *',
      [body.name ?? '', body.email ?? '', body.due_date ?? null, body.midwife ?? '']
    );
    return Response.json(r.rows[0]);
  } finally { client.release(); }
}
