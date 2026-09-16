/**
 * RAG utility library — real embeddings via Ollama nomic-embed-text + pgvector similarity search.
 * All operations use the shared getPool() connection pool.
 */
import { getPool } from '@/lib/postgres';

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const EMBED_MODEL = 'nomic-embed-text';
const GEN_MODEL = 'llama3.2';

// ---------------------------------------------------------------------------
// Schema bootstrap (called once per cold-start; idempotent)
// ---------------------------------------------------------------------------
let schemaBootstrapped = false;

export async function ensureRagSchema(): Promise<void> {
  if (schemaBootstrapped) return;
  const client = await getPool().connect();
  try {
    // pgvector extension — non-fatal if not installed (Superuser may be required)
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    } catch (err) {
      console.warn('[RAG] pgvector extension not available — vector similarity search will fail:', err);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS rag_documents (
        id SERIAL PRIMARY KEY,
        source_id TEXT UNIQUE,
        source_type TEXT NOT NULL,
        title TEXT NOT NULL,
        content_length INTEGER DEFAULT 0,
        chunk_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'indexed',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS rag_chunks (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES rag_documents(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        embedding vector(768),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS rag_chunks_embedding_idx
          ON rag_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
      `);
    } catch {
      // Index creation may fail if table is empty — not fatal
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS rag_queries (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        sources_used INTEGER DEFAULT 0,
        avg_similarity NUMERIC DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    schemaBootstrapped = true;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Embedding via Ollama nomic-embed-text (768 dimensions)
// ---------------------------------------------------------------------------
export async function embedText(text: string): Promise<number[]> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.error('[RAG] embedText HTTP error', res.status, await res.text());
      return [];
    }
    const data = await res.json() as { embedding?: number[] };
    return data.embedding ?? [];
  } catch (err) {
    console.error('[RAG] embedText error:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Text chunking helpers
// ---------------------------------------------------------------------------
function chunkText(text: string, size: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push(text.slice(start, end).trim());
    if (end === text.length) break;
    start = end - overlap;
  }
  return chunks.filter((c) => c.length > 0);
}

// ---------------------------------------------------------------------------
// Document ingestion — chunks + embeds + stores
// ---------------------------------------------------------------------------
export async function ingestDocument(params: {
  source_id: string;
  source_type: string;
  title: string;
  content: string;
  chunk_size?: number;
  chunk_overlap?: number;
}): Promise<{ chunks_stored: number }> {
  await ensureRagSchema();

  const { source_id, source_type, title, content } = params;
  const chunkSize = params.chunk_size ?? 500;
  const chunkOverlap = params.chunk_overlap ?? 50;

  const client = await getPool().connect();
  try {
    // Upsert document record
    const docRes = await client.query<{ id: number }>(
      `INSERT INTO rag_documents (source_id, source_type, title, content_length, chunk_count, status)
         VALUES ($1, $2, $3, $4, 0, 'indexing')
       ON CONFLICT (source_id) DO UPDATE
         SET title = EXCLUDED.title,
             source_type = EXCLUDED.source_type,
             content_length = EXCLUDED.content_length,
             status = 'indexing'
       RETURNING id`,
      [source_id, source_type, title, content.length],
    );
    const docId = docRes.rows[0].id;

    // Delete old chunks for re-ingestion
    await client.query(`DELETE FROM rag_chunks WHERE document_id = $1`, [docId]);

    const chunks = chunkText(content, chunkSize, chunkOverlap);
    let stored = 0;

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await embedText(chunks[i]);
      if (embedding.length === 0) {
        console.warn(`[RAG] Chunk ${i} embedding failed — skipping`);
        continue;
      }
      // pg driver requires the vector as a string like '[0.1,0.2,...]'
      const vectorStr = `[${embedding.join(',')}]`;
      await client.query(
        `INSERT INTO rag_chunks (document_id, chunk_index, chunk_text, embedding)
           VALUES ($1, $2, $3, $4::vector)`,
        [docId, i, chunks[i], vectorStr],
      );
      stored++;
    }

    // Update doc status + chunk_count
    await client.query(
      `UPDATE rag_documents SET chunk_count = $1, status = 'indexed' WHERE id = $2`,
      [stored, docId],
    );

    return { chunks_stored: stored };
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Retrieval — cosine similarity search via pgvector
// ---------------------------------------------------------------------------
export interface RetrievedChunk {
  chunk_text: string;
  title: string;
  source_type: string;
  similarity: number;
}

export async function retrieveRelevant(params: {
  query: string;
  limit?: number;
  source_types?: string[];
  similarity_threshold?: number;
}): Promise<RetrievedChunk[]> {
  await ensureRagSchema();

  const { query, limit = 5, source_types, similarity_threshold = 0.6 } = params;

  const queryEmbedding = await embedText(query);
  if (queryEmbedding.length === 0) {
    console.warn('[RAG] retrieveRelevant: embedding failed — returning empty results');
    return [];
  }

  const vectorStr = `[${queryEmbedding.join(',')}]`;

  const client = await getPool().connect();
  try {
    let typeFilter = '';
    const sqlParams: unknown[] = [vectorStr, 1 - similarity_threshold, limit];

    if (source_types && source_types.length > 0) {
      typeFilter = `AND d.source_type = ANY($4::text[])`;
      sqlParams.push(source_types);
    }

    const res = await client.query<{
      chunk_text: string;
      title: string;
      source_type: string;
      similarity: string;
    }>(
      `SELECT
         c.chunk_text,
         d.title,
         d.source_type,
         (1 - (c.embedding <=> $1::vector)) AS similarity
       FROM rag_chunks c
       JOIN rag_documents d ON d.id = c.document_id
       WHERE (1 - (c.embedding <=> $1::vector)) >= $2
       ${typeFilter}
       ORDER BY c.embedding <=> $1::vector
       LIMIT $3`,
      sqlParams,
    );

    return res.rows.map((r) => ({
      chunk_text: r.chunk_text,
      title: r.title,
      source_type: r.source_type,
      similarity: parseFloat(r.similarity),
    }));
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// RAG generation — context + question → Ollama llama3.2
// ---------------------------------------------------------------------------
export async function ragGenerate(params: {
  question: string;
  context_chunks: Array<{ chunk_text: string; title: string }>;
  system_prompt?: string;
}): Promise<string> {
  const { question, context_chunks, system_prompt } = params;

  const contextBlock = context_chunks
    .map((c, i) => `[Source ${i + 1}: ${c.title}]\n${c.chunk_text}`)
    .join('\n\n');

  const systemText =
    system_prompt ??
    'You are a helpful AI assistant for an enterprise yoga wellness platform. Answer questions accurately using only the provided context. If the context does not contain enough information to answer, say so honestly.';

  const prompt = `${systemText}

## Relevant Context
${contextBlock}

## Question
${question}

## Answer`;

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: GEN_MODEL, prompt, stream: false }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      console.error('[RAG] ragGenerate HTTP error', res.status);
      return 'Generation service unavailable. Please try again.';
    }
    const data = await res.json() as { response?: string };
    return data.response ?? 'No response generated.';
  } catch (err) {
    console.error('[RAG] ragGenerate error:', err);
    return 'Generation timed out or failed. Please check that Ollama is running.';
  }
}

// ---------------------------------------------------------------------------
// Seed demo documents (idempotent — checks source_id before inserting)
// ---------------------------------------------------------------------------
const DEMO_DOCS = [
  {
    source_id: 'demo-welcome',
    source_type: 'text',
    title: 'Sohamyoga Studio Welcome',
    content:
      'Welcome to Sohamyoga, an enterprise wellness platform bringing world-class yoga instruction to individuals and organizations. Our studio offers Hatha, Vinyasa, Yin, and Restorative yoga sessions taught by certified instructors. We offer in-person classes at our downtown studio, live-streamed virtual sessions, and an extensive video library for on-demand practice. New students receive a complimentary orientation session. Monthly membership options start at $49 for digital access and $99 for unlimited studio visits. Corporate wellness packages are available for teams of 10 or more.',
  },
  {
    source_id: 'demo-services',
    source_type: 'text',
    title: 'Services and Class Descriptions',
    content:
      'Hatha Yoga (60 min) — foundational postures and breathwork for all levels. Vinyasa Flow (45 min) — dynamic sequences linking breath to movement, intermediate level. Yin Yoga (75 min) — slow-paced deep tissue stretches held for 3-5 minutes, suitable for stress relief. Restorative Yoga (60 min) — fully supported passive poses for deep relaxation and recovery. Prenatal Yoga — specially designed for expectant mothers from first trimester onwards. Kids Yoga (45 min, ages 5-12) — fun and engaging postures for flexibility and focus. Corporate Mindfulness Sessions — 30-minute guided breathwork and meditation for remote or in-office teams.',
  },
  {
    source_id: 'demo-faq',
    source_type: 'text',
    title: 'Frequently Asked Questions',
    content:
      'Q: Do I need experience to join? A: No, we offer beginner-friendly classes every day. Q: What should I bring? A: A yoga mat, water bottle, and comfortable clothing. Mats are available to rent for $3. Q: Can I cancel a class? A: Yes, cancel up to 4 hours before the class start time for a full refund. Q: Are gift cards available? A: Yes, digital and physical gift cards in any denomination. Q: How do I book a class? A: Log in to the member portal, select a class, and click Reserve. Q: Is there parking? A: Free parking available in the rear lot. Q: Do you offer trials? A: Yes, first-time visitors can try any single class for free.',
  },
];

export async function seedDemoDocuments(): Promise<void> {
  const client = await getPool().connect();
  try {
    const res = await client.query<{ source_id: string }>(
      `SELECT source_id FROM rag_documents WHERE source_id = ANY($1::text[])`,
      [DEMO_DOCS.map((d) => d.source_id)],
    );
    const existing = new Set(res.rows.map((r) => r.source_id));
    for (const doc of DEMO_DOCS) {
      if (!existing.has(doc.source_id)) {
        await ingestDocument(doc);
      }
    }
  } finally {
    client.release();
  }
}
