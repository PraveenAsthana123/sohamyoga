import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const condition = searchParams.get('condition');
  const make = searchParams.get('make');
  const year = searchParams.get('year');
  const fuel_type = searchParams.get('fuel_type');
  const status = searchParams.get('status') || 'available';
  const min_price = searchParams.get('min_price');
  const max_price = searchParams.get('max_price');
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (condition) { conditions.push(`condition = $${i++}`); params.push(condition); }
      if (make) { conditions.push(`LOWER(make) LIKE $${i++}`); params.push(`%${make.toLowerCase()}%`); }
      if (year) { conditions.push(`year = $${i++}`); params.push(parseInt(year)); }
      if (fuel_type) { conditions.push(`fuel_type = $${i++}`); params.push(fuel_type); }
      if (status) { conditions.push(`status = $${i++}`); params.push(status); }
      if (min_price) { conditions.push(`asking_price >= $${i++}`); params.push(parseFloat(min_price)); }
      if (max_price) { conditions.push(`asking_price <= $${i++}`); params.push(parseFloat(max_price)); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await client.query(
        `SELECT *, (CURRENT_DATE - date_added)::INT AS days_in_inventory FROM auto_vehicle_inventory ${where} ORDER BY date_added ASC`,
        params
      );
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO auto_vehicle_inventory
          (stock_number, condition, year, make, model, trim, body_style, vin, color_exterior, color_interior,
           mileage_km, engine, transmission, drivetrain, fuel_type, doors, msrp, asking_price, cost,
           features, location, lot_position, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
         RETURNING *`,
        [body.stock_number, body.condition ?? 'used', body.year, body.make, body.model, body.trim,
         body.body_style, body.vin, body.color_exterior, body.color_interior, body.mileage_km ?? 0,
         body.engine, body.transmission ?? 'automatic', body.drivetrain ?? 'fwd', body.fuel_type ?? 'gasoline',
         body.doors ?? 4, body.msrp, body.asking_price, body.cost,
         body.features ?? [], body.location ?? 'Calgary', body.lot_position, body.status ?? 'available', body.notes]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
