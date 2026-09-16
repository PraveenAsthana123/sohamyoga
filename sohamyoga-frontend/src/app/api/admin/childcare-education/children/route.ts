import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const age_group = searchParams.get('age_group');
  const room = searchParams.get('room');
  const status = searchParams.get('status') || 'enrolled';
  const schedule = searchParams.get('schedule');
  const subsidy = searchParams.get('subsidy');
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const conds: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      if (age_group) { conds.push(`age_group = $${i++}`); vals.push(age_group); }
      if (room) { conds.push(`room_name = $${i++}`); vals.push(room); }
      if (status) { conds.push(`status = $${i++}`); vals.push(status); }
      if (schedule) { conds.push(`schedule = $${i++}`); vals.push(schedule); }
      if (subsidy === 'true') { conds.push(`subsidy_applied = true`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const { rows } = await client.query(`SELECT * FROM cc_child ${where} ORDER BY name ASC`, vals);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO cc_child
          (name, date_of_birth, age_group, room_name, group_name,
           parent1_name, parent1_email, parent1_phone, parent1_relation,
           parent2_name, parent2_email, parent2_phone, parent2_relation,
           emergency_contacts, authorized_pickups,
           allergies, medical_conditions, medications, immunization_up_to_date, health_card_number,
           enrollment_date, schedule, schedule_days, daily_rate, monthly_fee,
           subsidy_applied, subsidy_amount, cwelcc_enrolled, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)
         RETURNING *`,
        [body.name, body.date_of_birth, body.age_group, body.room_name, body.group_name,
         body.parent1_name, body.parent1_email, body.parent1_phone, body.parent1_relation,
         body.parent2_name, body.parent2_email, body.parent2_phone, body.parent2_relation,
         JSON.stringify(body.emergency_contacts ?? []), body.authorized_pickups ?? [],
         body.allergies ?? [], body.medical_conditions ?? [], body.medications ?? [],
         body.immunization_up_to_date ?? true, body.health_card_number,
         body.enrollment_date || new Date().toISOString().split('T')[0],
         body.schedule ?? 'full_time', body.schedule_days ?? [],
         body.daily_rate, body.monthly_fee,
         body.subsidy_applied ?? false, body.subsidy_amount,
         body.cwelcc_enrolled ?? false, body.status ?? 'enrolled', body.notes]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
