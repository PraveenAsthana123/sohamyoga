import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';
import { NextRequest } from 'next/server';
import type { PoolClient } from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function provision(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS gmail_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_email TEXT NOT NULL,
      connection_name TEXT,
      status TEXT DEFAULT 'connected',
      labels_to_sync TEXT[] DEFAULT ARRAY['INBOX','SENT','IMPORTANT'],
      auto_tag_leads BOOLEAN DEFAULT true,
      auto_tag_orders BOOLEAN DEFAULT true,
      emails_synced INT DEFAULT 0,
      last_sync_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const existing = await client.query(`SELECT id FROM gmail_connections LIMIT 1`);
  if (existing.rowCount === 0) {
    await client.query(`
      INSERT INTO gmail_connections
        (account_email, connection_name, status, labels_to_sync, auto_tag_leads, auto_tag_orders, emails_synced, last_sync_at)
      VALUES
        ('marketing@sohamyoga.com', 'Marketing Inbox', 'connected',
         ARRAY['INBOX','SENT','IMPORTANT','CATEGORY_PROMOTIONS'], true, true, 247, NOW() - INTERVAL '30 minutes')
    `);
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    await provision(client);

    const accounts = await client.query(`
      SELECT id, account_email, connection_name, status, labels_to_sync,
             auto_tag_leads, auto_tag_orders, emails_synced, last_sync_at, created_at,
             array_length(labels_to_sync, 1) AS labels_count
      FROM gmail_connections
      ORDER BY created_at DESC
    `);

    return Response.json({ accounts: accounts.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    accountEmail?: string;
    connectionName?: string;
    labelsToSync?: string[];
    autoTagLeads?: boolean;
    autoTagOrders?: boolean;
  } | null;

  if (!body?.accountEmail) {
    return Response.json({ error: 'accountEmail is required.' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await provision(client);

    const result = await client.query(`
      INSERT INTO gmail_connections
        (account_email, connection_name, labels_to_sync, auto_tag_leads, auto_tag_orders)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, account_email, connection_name, status, labels_to_sync, auto_tag_leads, auto_tag_orders, emails_synced, created_at
    `, [
      body.accountEmail,
      body.connectionName ?? null,
      body.labelsToSync ?? ['INBOX', 'SENT', 'IMPORTANT'],
      body.autoTagLeads ?? true,
      body.autoTagOrders ?? true,
    ]);

    return Response.json({ account: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
