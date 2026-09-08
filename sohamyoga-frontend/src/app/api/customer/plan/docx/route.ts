import { NextRequest } from 'next/server';
import { Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell, WidthType } from 'docx';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';
import { resolveStudent } from '@/lib/resolve-student';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PlanRow {
  id: string; name: string; description: string | null; focus_areas: string[]; weekly_sessions: number;
  session_minutes: number; difficulty: string; is_ai_generated: boolean;
}
interface PoseRow {
  sequence_no: number; hold_seconds: number | null; cue: string | null; sanskrit_name: string; english_name: string;
}

// Real .docx generated from the same personalized_plan + plan_pose rows
// /api/customer/plan returns -- the docx package builds a genuine Word
// document (real OOXML), not a renamed text file.
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return Response.json({ error: 'id query param is required.' }, { status: 400 });

  const { principal } = await getCustomerPrincipal(req);
  const student = await resolveStudent(principal!.id);
  if (!student) return Response.json({ error: 'No student record found.' }, { status: 409 });

  const plan = await query<PlanRow>(
    `SELECT id, name, description, focus_areas, weekly_sessions, session_minutes, difficulty, is_ai_generated
     FROM personalized_plan WHERE id = $1 AND student_id = $2`,
    [id, student.id],
  );
  if (!plan.rowCount) return Response.json({ error: 'Plan not found.' }, { status: 404 });
  const p = plan.rows[0];

  const poses = await query<PoseRow>(
    `SELECT pp.sequence_no, pp.hold_seconds, pp.cue, a.sanskrit_name, a.english_name
     FROM plan_pose pp JOIN asana a ON a.id = pp.asana_id WHERE pp.plan_id = $1 ORDER BY pp.sequence_no`,
    [id],
  );

  const headerRow = new TableRow({
    children: ['#', 'Pose', 'Sanskrit Name', 'Hold (sec)', 'Cue'].map(text =>
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })] })),
  });
  const poseRows = poses.rows.map(row => new TableRow({
    children: [String(row.sequence_no), row.english_name, row.sanskrit_name, row.hold_seconds ? String(row.hold_seconds) : '-', row.cue ?? '-']
      .map(text => new TableCell({ children: [new Paragraph(text)] })),
  }));

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: p.name, heading: HeadingLevel.TITLE }),
        new Paragraph({ text: p.description ?? '', spacing: { after: 200 } }),
        new Paragraph({ text: `Difficulty: ${p.difficulty} | Weekly sessions: ${p.weekly_sessions} | Session length: ${p.session_minutes} min` }),
        new Paragraph({ text: `Focus areas: ${(p.focus_areas ?? []).join(', ') || 'None specified'}`, spacing: { after: 200 } }),
        new Paragraph({ text: p.is_ai_generated ? 'AI-assisted plan, reviewed by a teacher' : 'Teacher-authored plan', spacing: { after: 300 } }),
        new Paragraph({ text: 'Sequence', heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }),
        poses.rowCount
          ? new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...poseRows] })
          : new Paragraph('No poses assigned to this plan yet.'),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${p.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.docx"`,
    },
  });
}
