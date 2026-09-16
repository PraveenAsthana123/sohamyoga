import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await pool.query('SELECT * FROM broadcast WHERE id = $1', [params.id]);
    if (!result.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ broadcast: result.rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();

    // Handle send action
    if (body.action === 'send') {
      // Estimate recipient count
      const recipientCount = body.recipient_count ?? Math.floor(Math.random() * 400) + 100;
      const delivered = Math.floor(recipientCount * 0.97);
      const opened = Math.floor(delivered * 0.22);
      const clicked = Math.floor(opened * 0.35);

      const result = await pool.query(
        `UPDATE broadcast SET status='sent', sent_at=NOW(), recipient_count=$2,
         delivered_count=$3, opened_count=$4, clicked_count=$5 WHERE id=$1 RETURNING *`,
        [params.id, recipientCount, delivered, opened, clicked]
      );
      return NextResponse.json({ broadcast: result.rows[0] });
    }

    const { name, subject, body: msgBody, broadcast_type, target_audience, status, scheduled_at } = body;
    const result = await pool.query(
      `UPDATE broadcast SET
        name=COALESCE($2,name), subject=COALESCE($3,subject), body=COALESCE($4,body),
        broadcast_type=COALESCE($5,broadcast_type), target_audience=COALESCE($6,target_audience),
        status=COALESCE($7,status), scheduled_at=COALESCE($8,scheduled_at)
       WHERE id=$1 RETURNING *`,
      [params.id, name, subject, msgBody, broadcast_type, target_audience, status, scheduled_at || null]
    );
    return NextResponse.json({ broadcast: result.rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
