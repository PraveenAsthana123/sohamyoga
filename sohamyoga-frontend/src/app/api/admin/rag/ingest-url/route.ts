export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured } from '@/lib/postgres';
import { ensureRagSchema, ingestDocument } from '@/lib/rag';

// ---------------------------------------------------------------------------
// POST /api/admin/rag/ingest-url — fetch URL, strip HTML, ingest as document
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ error: 'Database not configured.' }, { status: 503 });
  }

  try {
    await ensureRagSchema();

    const body = await req.json() as { url?: string; title?: string };
    const { url, title } = body;

    if (!url || url.trim().length === 0) {
      return Response.json({ error: 'url is required.' }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return Response.json({ error: 'Invalid URL format.' }, { status: 400 });
    }

    // Fetch page content with 10s timeout
    let rawHtml: string;
    try {
      const fetchRes = await fetch(parsedUrl.toString(), {
        signal: AbortSignal.timeout(10_000),
        headers: { 'User-Agent': 'Sohamyoga-RAG-Bot/1.0' },
      });
      if (!fetchRes.ok) {
        return Response.json(
          { error: `URL fetch failed with status ${fetchRes.status}.` },
          { status: 422 },
        );
      }
      rawHtml = await fetchRes.text();
    } catch (err) {
      console.error('[RAG ingest-url] fetch error:', err);
      return Response.json({ error: 'Failed to fetch URL content.' }, { status: 422 });
    }

    // Strip HTML tags, collapse whitespace, truncate to 5000 chars
    const text = rawHtml
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000);

    if (text.length < 50) {
      return Response.json({ error: 'Extracted text is too short to index.' }, { status: 422 });
    }

    const docTitle = title ?? parsedUrl.hostname + parsedUrl.pathname;
    const sourceId = `url-${Buffer.from(parsedUrl.toString()).toString('base64').slice(0, 40)}`;

    const { chunks_stored } = await ingestDocument({
      source_id: sourceId,
      source_type: 'url',
      title: docTitle,
      content: text,
    });

    return Response.json({ chunks_stored, title: docTitle, url: parsedUrl.toString() }, { status: 201 });
  } catch (err) {
    console.error('[RAG ingest-url] error:', err);
    return Response.json({ error: 'URL ingestion failed.' }, { status: 500 });
  }
}
