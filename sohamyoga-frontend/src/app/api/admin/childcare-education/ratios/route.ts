import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUIRED_RATIOS: Record<string, number> = { infant: 3, toddler: 4, preschool: 8, kindergarten: 15, school_age: 15 };

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const [childRes, staffRes] = await Promise.all([
        client.query(`SELECT age_group, room_name, COUNT(*) AS child_count FROM cc_child WHERE status = 'enrolled' GROUP BY age_group, room_name ORDER BY age_group`),
        client.query(`SELECT assigned_room, COUNT(*) AS staff_count FROM cc_staff WHERE status = 'active' GROUP BY assigned_room`),
      ]);
      const staffByRoom: Record<string, number> = {};
      for (const row of staffRes.rows) {
        staffByRoom[row.assigned_room] = parseInt(row.staff_count);
      }
      const ratios = childRes.rows.map(row => {
        const required_ratio = REQUIRED_RATIOS[row.age_group] ?? 15;
        const staff_count = staffByRoom[row.room_name] ?? 0;
        const child_count = parseInt(row.child_count);
        const required_staff = Math.ceil(child_count / required_ratio);
        return {
          age_group: row.age_group,
          room_name: row.room_name,
          child_count,
          staff_count,
          required_ratio,
          required_staff,
          compliant: staff_count >= required_staff,
          ratio_string: `1:${required_ratio}`,
        };
      });
      return Response.json(ratios);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
