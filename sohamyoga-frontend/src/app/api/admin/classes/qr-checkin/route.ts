import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real data for the QR Check-in tab (/admin/classes) -- was 100% hardcoded
// mock data (fake "186" check-ins, a fake scanner-status list, a fake
// manual-override log) despite a fully real, working backend already
// existing: /api/checkin/validate (registration_token/registration_token_scan/
// attendance_record, with loyalty-points integration) and a real
// QrCheckInScanner.tsx component -- neither was ever wired into any page,
// confirmed via grep (zero imports of QrCheckInScanner anywhere in src/app).
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();

  const [sessions, qrCheckins, manualCheckins, failedScans, recentScans] = await Promise.all([
    query<{ id: string; class_name: string; teacher_name: string; start_time: string }>(
      `SELECT id, class_name, teacher_name, start_time FROM class_session
       WHERE tenant_id = $1 AND session_date = CURRENT_DATE ORDER BY start_time`,
      [tenantId],
    ),
    query<{ n: string }>(
      `SELECT count(*)::text AS n FROM attendance_record
       WHERE tenant_id = $1 AND check_in_method = 'qr_scan' AND attended_at::date = CURRENT_DATE`,
      [tenantId],
    ),
    query<{ n: string }>(
      `SELECT count(*)::text AS n FROM attendance_record
       WHERE tenant_id = $1 AND check_in_method IS DISTINCT FROM 'qr_scan' AND status = 'attended' AND attended_at::date = CURRENT_DATE`,
      [tenantId],
    ),
    query<{ n: string }>(
      `SELECT count(*)::text AS n FROM registration_token_scan rts
       JOIN registration_token rt ON rt.id = rts.token_id
       WHERE rt.tenant_id = $1 AND rts.result != 'valid' AND rts.scanned_at::date = CURRENT_DATE`,
      [tenantId],
    ),
    // registration_token.reference_id is TEXT (it points at different
    // reference tables depending on token type) while booking.id is UUID --
    // needs an explicit cast, caught live during verification (the
    // uncast join threw a real "operator does not exist: uuid = text").
    query<{ scanned_by: string; result: string; scanned_at: string; student_name: string | null }>(
      `SELECT rts.scanned_by, rts.result, rts.scanned_at, s.display_name AS student_name
       FROM registration_token_scan rts
       JOIN registration_token rt ON rt.id = rts.token_id
       LEFT JOIN booking b ON b.id::text = rt.reference_id
       LEFT JOIN student s ON s.id = b.student_id
       WHERE rt.tenant_id = $1
       ORDER BY rts.scanned_at DESC LIMIT 10`,
      [tenantId],
    ),
  ]);

  return Response.json({
    sessions: sessions.rows.map(s => ({ id: s.id, className: s.class_name, teacherName: s.teacher_name, startTime: s.start_time })),
    stats: {
      qrCheckins: Number(qrCheckins.rows[0]?.n ?? 0),
      manualCheckins: Number(manualCheckins.rows[0]?.n ?? 0),
      failedScans: Number(failedScans.rows[0]?.n ?? 0),
    },
    recentScans: recentScans.rows.map(r => ({
      scannedBy: r.scanned_by, result: r.result, scannedAt: r.scanned_at, studentName: r.student_name ?? 'Unknown',
    })),
  });
}
