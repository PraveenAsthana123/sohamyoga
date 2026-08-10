import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ColumnRow = { schema_name: string; table_name: string; column_name: string; data_type: string; is_nullable: string; column_default: string | null; is_primary: boolean; foreign_target: string | null };

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [columns, views] = await Promise.all([
    query<ColumnRow>(`
      SELECT c.table_schema AS schema_name, c.table_name, c.column_name, c.data_type,
             c.is_nullable, c.column_default,
             EXISTS (
               SELECT 1 FROM information_schema.table_constraints tc
               JOIN information_schema.key_column_usage kcu
                 ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
               WHERE tc.constraint_type='PRIMARY KEY' AND tc.table_schema=c.table_schema
                 AND tc.table_name=c.table_name AND kcu.column_name=c.column_name
             ) AS is_primary,
             (SELECT ccu.table_schema || '.' || ccu.table_name || '.' || ccu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
                JOIN information_schema.constraint_column_usage ccu
                  ON ccu.constraint_name=tc.constraint_name AND ccu.constraint_schema=tc.table_schema
               WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema=c.table_schema
                 AND tc.table_name=c.table_name AND kcu.column_name=c.column_name LIMIT 1) AS foreign_target
        FROM information_schema.columns c
       JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name
       WHERE c.table_schema NOT IN ('pg_catalog','information_schema') AND t.table_type='BASE TABLE'
       ORDER BY c.table_schema, c.table_name, c.ordinal_position`),
    query<{ schema_name: string; view_name: string }>(`
      SELECT table_schema AS schema_name, table_name AS view_name
      FROM information_schema.views WHERE table_schema NOT IN ('pg_catalog','information_schema')
      ORDER BY table_schema, table_name`),
  ]);

  const tables = new Map<string, { schema: string; name: string; columns: ColumnRow[] }>();
  for (const column of columns.rows) {
    const key = `${column.schema_name}.${column.table_name}`;
    if (!tables.has(key)) tables.set(key, { schema: column.schema_name, name: column.table_name, columns: [] });
    tables.get(key)!.columns.push(column);
  }
  const tableList = Array.from(tables.values());
  return Response.json({
    summary: {
      schemas: new Set(tableList.map(t => t.schema)).size,
      tables: tableList.length,
      columns: columns.rowCount,
      primaryKeys: columns.rows.filter(c => c.is_primary).length,
      foreignKeys: columns.rows.filter(c => c.foreign_target).length,
      views: views.rowCount,
    },
    tables: tableList,
    views: views.rows,
  });
}
