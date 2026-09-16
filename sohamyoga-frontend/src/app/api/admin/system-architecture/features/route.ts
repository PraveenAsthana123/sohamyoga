import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const module = searchParams.get('module');
  const type = searchParams.get('type');
  const status = searchParams.get('status');
  const adminOnly = searchParams.get('admin_only');
  const customerAccessible = searchParams.get('customer_accessible');

  const conditions: string[] = [];
  const params: (string | boolean)[] = [];
  let idx = 1;

  if (module) { conditions.push(`module_name ILIKE $${idx++}`); params.push(`%${module}%`); }
  if (type) { conditions.push(`feature_type = $${idx++}`); params.push(type); }
  if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
  if (adminOnly !== null) { conditions.push(`admin_only = $${idx++}`); params.push(adminOnly === 'true'); }
  if (customerAccessible !== null) { conditions.push(`customer_accessible = $${idx++}`); params.push(customerAccessible === 'true'); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await pool.query(
      `SELECT * FROM feature_registry ${where} ORDER BY module_name, feature_name`,
      params
    );
    return NextResponse.json({ features: result.rows, total: result.rowCount });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
