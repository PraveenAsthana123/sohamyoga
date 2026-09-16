import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        namespace,
        COUNT(*) AS total_docs,
        COUNT(*) FILTER (WHERE embedding IS NOT NULL) AS with_embeddings
      FROM vector_store
      GROUP BY namespace
      ORDER BY namespace
    `);

    const totalDocs = result.rows.reduce((acc: number, r: { total_docs: string }) => acc + Number(r.total_docs), 0);
    const withEmbeddings = result.rows.reduce((acc: number, r: { with_embeddings: string }) => acc + Number(r.with_embeddings), 0);

    return NextResponse.json({
      namespaces: result.rows.map((r: { namespace: string; total_docs: string; with_embeddings: string }) => ({
        namespace: r.namespace,
        total_docs: Number(r.total_docs),
        with_embeddings: Number(r.with_embeddings),
        coverage_pct: Number(r.total_docs) > 0
          ? Math.round((Number(r.with_embeddings) / Number(r.total_docs)) * 100)
          : 0,
      })),
      totals: {
        total_docs: totalDocs,
        with_embeddings: withEmbeddings,
        namespace_count: result.rows.length,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
