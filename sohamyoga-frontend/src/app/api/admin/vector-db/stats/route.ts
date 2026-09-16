import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const [totals, collections] = await Promise.all([
    pool.query(`SELECT embedding_status, COUNT(*) as count FROM vector_document GROUP BY embedding_status`).catch(() => ({ rows: [] as Array<{embedding_status: string; count: string}> })),
    pool.query(`SELECT DISTINCT vector_collection FROM vector_document ORDER BY vector_collection`).catch(() => ({ rows: [] as Array<{vector_collection: string}> })),
  ]);

  const statusMap: Record<string, number> = {};
  let total = 0;
  for (const row of totals.rows) {
    statusMap[row.embedding_status] = parseInt(row.count);
    total += parseInt(row.count);
  }

  let ollama_embed_available = false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch('http://localhost:11434/api/tags', { signal: ctrl.signal });
    clearTimeout(timer);
    ollama_embed_available = res.ok;
  } catch {
    ollama_embed_available = false;
  }

  return Response.json({
    total_docs: total,
    completed: statusMap['completed'] || 0,
    pending: statusMap['pending'] || 0,
    failed: statusMap['failed'] || 0,
    processing: statusMap['processing'] || 0,
    collections: collections.rows.map((r) => r.vector_collection),
    ollama_embed_available,
  });
}
