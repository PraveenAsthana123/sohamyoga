import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    // Query information_schema for all user tables + their row counts
    const tablesRes = await pool.query(`
      SELECT
        t.table_name,
        c.reltuples::BIGINT AS approx_row_count
      FROM information_schema.tables t
      JOIN pg_class c ON c.relname = t.table_name
      WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `);

    // Also pull catalog entries for richer metadata
    const catalogRes = await pool.query(
      'SELECT * FROM reference_table_catalog ORDER BY table_name'
    ).catch(() => ({ rows: [] }));

    const catalogMap: Record<string, { purpose: string; key_columns: string; is_editable: boolean }> = {};
    for (const row of catalogRes.rows as Array<{ table_name: string; purpose: string; key_columns: string; is_editable: boolean }>) {
      catalogMap[row.table_name] = { purpose: row.purpose, key_columns: row.key_columns, is_editable: row.is_editable };
    }

    const tables = tablesRes.rows.map((row: { table_name: string; approx_row_count: string }) => ({
      table_name: row.table_name,
      row_count: Number(row.approx_row_count),
      purpose: catalogMap[row.table_name]?.purpose ?? null,
      key_columns: catalogMap[row.table_name]?.key_columns ?? null,
      is_editable: catalogMap[row.table_name]?.is_editable ?? false,
    }));

    return NextResponse.json({ tables, total: tables.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
