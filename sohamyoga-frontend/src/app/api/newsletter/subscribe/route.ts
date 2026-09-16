export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(req: NextRequest): Promise<Response> {
  const client = await pool.connect();
  try {
    const body = await req.json() as {
      email: string;
      first_name?: string;
      last_name?: string;
      source?: string;
      tags?: string[];
    };
    const { email, first_name, last_name, source = 'website', tags = [] } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return Response.json({ error: 'Valid email is required' }, { status: 400 });
    }

    await client.query(
      `INSERT INTO email_subscriber (email, first_name, last_name, status, source, tags)
       VALUES ($1, $2, $3, 'active', $4, $5)
       ON CONFLICT (email) DO UPDATE
         SET status = CASE WHEN email_subscriber.status = 'unsubscribed' THEN 'active' ELSE email_subscriber.status END,
             first_name = COALESCE(EXCLUDED.first_name, email_subscriber.first_name),
             last_name  = COALESCE(EXCLUDED.last_name,  email_subscriber.last_name)`,
      [email.toLowerCase().trim(), first_name ?? null, last_name ?? null, source, tags]
    );

    return Response.json({ success: true, message: 'Subscribed' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
