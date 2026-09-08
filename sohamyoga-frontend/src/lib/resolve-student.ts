import { query } from './postgres';

// The one correct way to resolve "this logged-in customer's student record":
// student.user_id = identity_user_id directly, exactly as the real, working
// /api/bookings route does it. customer.student_id looks like the obvious
// join but is NEVER set by any real code path in this app (verified live,
// 2026-09-01) -- using it silently produces "no student record" for every
// genuine customer. Do not resolve student via customer.student_id.
export async function resolveStudent(userId: string): Promise<{ id: string; tenantId: string } | null> {
  const result = await query<{ id: string; tenant_id: string }>(`SELECT id, tenant_id FROM student WHERE user_id = $1`, [userId]);
  if (!result.rowCount) return null;
  return { id: result.rows[0].id, tenantId: result.rows[0].tenant_id };
}
