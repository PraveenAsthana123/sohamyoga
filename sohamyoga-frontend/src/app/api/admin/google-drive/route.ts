import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';
import { NextRequest } from 'next/server';
import type { PoolClient } from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function provision(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS google_drive_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_email TEXT NOT NULL,
      connection_name TEXT,
      status TEXT DEFAULT 'connected',
      access_token TEXT,
      refresh_token TEXT,
      scopes TEXT[] DEFAULT ARRAY['drive.readonly','drive.file'],
      last_sync_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS google_drive_files (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      connection_id UUID REFERENCES google_drive_connections(id),
      drive_file_id TEXT,
      name TEXT,
      mime_type TEXT,
      web_view_link TEXT,
      web_content_link TEXT,
      size_bytes BIGINT,
      folder_path TEXT,
      category TEXT DEFAULT 'uncategorized',
      synced_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Seed one connection if none exist
  const existing = await client.query(`SELECT id FROM google_drive_connections LIMIT 1`);
  if (existing.rowCount === 0) {
    const connRes = await client.query(`
      INSERT INTO google_drive_connections
        (account_email, connection_name, status, access_token, refresh_token, scopes, last_sync_at)
      VALUES
        ('marketing@sohamyoga.com', 'Marketing Drive', 'connected', '***masked***', '***masked***',
         ARRAY['drive.readonly','drive.file','drive.appdata'], NOW() - INTERVAL '2 hours')
      RETURNING id
    `);
    const connId = connRes.rows[0].id;

    const files = [
      { drive_file_id: 'gdrive-1', name: 'Q3 Marketing Report.pdf', mime_type: 'application/pdf', size_bytes: 2457600, folder_path: '/Reports', category: 'report' },
      { drive_file_id: 'gdrive-2', name: 'Brand Guidelines 2026.pdf', mime_type: 'application/pdf', size_bytes: 5242880, folder_path: '/Brand', category: 'brochure' },
      { drive_file_id: 'gdrive-3', name: 'Client Contract Template.docx', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size_bytes: 102400, folder_path: '/Contracts', category: 'contract' },
      { drive_file_id: 'gdrive-4', name: 'Studio Hero Image.jpg', mime_type: 'image/jpeg', size_bytes: 3145728, folder_path: '/Assets/Images', category: 'asset' },
      { drive_file_id: 'gdrive-5', name: 'Campaign Budget Tracker.xlsx', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size_bytes: 204800, folder_path: '/Reports', category: 'report' },
      { drive_file_id: 'gdrive-6', name: 'Yoga Class Schedule.pdf', mime_type: 'application/pdf', size_bytes: 512000, folder_path: '/Operations', category: 'brochure' },
    ];

    for (const f of files) {
      await client.query(`
        INSERT INTO google_drive_files
          (connection_id, drive_file_id, name, mime_type, web_view_link, web_content_link, size_bytes, folder_path, category)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [connId, f.drive_file_id, f.name, f.mime_type,
          `https://drive.google.com/file/d/${f.drive_file_id}/view`,
          `https://drive.google.com/uc?id=${f.drive_file_id}`,
          f.size_bytes, f.folder_path, f.category]);
    }
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

    const connections = await client.query(`
      SELECT id, account_email, connection_name, status, scopes, last_sync_at, created_at,
             LEFT(COALESCE(access_token,''), 6) || '***' AS access_token_masked
      FROM google_drive_connections
      ORDER BY created_at DESC
    `);

    const files = await client.query(`
      SELECT f.id, f.connection_id, f.drive_file_id, f.name, f.mime_type, f.web_view_link,
             f.web_content_link, f.size_bytes, f.folder_path, f.category, f.synced_at,
             c.account_email
      FROM google_drive_files f
      JOIN google_drive_connections c ON c.id = f.connection_id
      ORDER BY f.synced_at DESC
    `);

    return Response.json({
      connections: connections.rows,
      files: files.rows,
    });
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
    scopes?: string[];
  } | null;

  if (!body?.accountEmail) {
    return Response.json({ error: 'accountEmail is required.' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await provision(client);

    const result = await client.query(`
      INSERT INTO google_drive_connections (account_email, connection_name, scopes)
      VALUES ($1, $2, $3)
      RETURNING id, account_email, connection_name, status, scopes, created_at
    `, [body.accountEmail, body.connectionName ?? null, body.scopes ?? ['drive.readonly', 'drive.file']]);

    return Response.json({ connection: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
