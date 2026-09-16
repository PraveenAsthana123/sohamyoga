import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT * FROM contracts WHERE id = $1 AND deleted_at IS NULL`,
      [params.id],
    );
    if (!rows.length) return Response.json({ error: 'Contract not found.' }, { status: 404 });

    const c = rows[0];
    const stripHtml = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

    const lines: string[] = [
      '='.repeat(60),
      `CONTRACT: ${c.title}`,
      '='.repeat(60),
      '',
      `Client:         ${c.client_name}`,
      `Email:          ${c.client_email || 'N/A'}`,
      `Type:           ${c.contract_type}`,
      `Status:         ${c.status}`,
      `Value (CAD):    ${c.value_cad != null ? `$${Number(c.value_cad).toFixed(2)}` : 'N/A'}`,
      `Start Date:     ${c.start_date ? c.start_date.toString().slice(0, 10) : 'N/A'}`,
      `End Date:       ${c.end_date ? c.end_date.toString().slice(0, 10) : 'N/A'}`,
      `Created:        ${new Date(c.created_at).toLocaleString()}`,
      c.signed_at ? `Signed At:      ${new Date(c.signed_at).toLocaleString()}` : '',
      '',
      '-'.repeat(60),
      'CONTRACT BODY',
      '-'.repeat(60),
      '',
      c.content_html ? stripHtml(c.content_html) : '(No content)',
      '',
      c.notes ? ['-'.repeat(60), 'NOTES', '-'.repeat(60), '', c.notes, ''].join('\n') : '',
      '='.repeat(60),
      `Generated: ${new Date().toISOString()}`,
      '='.repeat(60),
    ];

    const text = lines.filter(l => l !== undefined).join('\n');
    const timestamp = Date.now();

    return new Response(text, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="contract-${c.id}-${timestamp}.txt"`,
      },
    });
  } finally {
    client.release();
  }
}
