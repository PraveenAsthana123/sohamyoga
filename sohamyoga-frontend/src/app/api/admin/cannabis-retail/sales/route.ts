import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT s.*, json_agg(json_build_object('product_id',si.product_id,'quantity',si.quantity,'unit_price',si.unit_price,'thc_grams_this_item',si.thc_grams_this_item,'line_total',si.line_total) ORDER BY si.id) AS items
      FROM cr_sale s
      LEFT JOIN cr_sale_item si ON si.sale_id=s.id
      WHERE ($1::text IS NULL OR DATE(s.sale_date)=$1::date)
      GROUP BY s.id ORDER BY s.sale_date DESC LIMIT 200
    `, [date||null]);
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { staff_id, customer_age_verified, customer_dob_confirmed, payment_method, items, pos_reference, notes } = body;

  if (!staff_id || !payment_method || !items?.length) return Response.json({ error: 'staff_id, payment_method, items required' }, { status: 400 });
  if (!customer_age_verified) return Response.json({ error: 'COMPLIANCE: customer_age_verified must be true. Age verification is mandatory under AGLC regulations.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Load products and validate
    const productIds = (items as {product_id:number;quantity:number}[]).map(i => i.product_id);
    const { rows: products } = await client.query(`SELECT * FROM cr_product WHERE id=ANY($1)`, [productIds]);
    const productMap: Record<number, {id:number;retail_price:number;thc_pct:number;weight_grams:number;compliance_status:string;stock_quantity:number;brand:string;product_name:string}> = {};
    products.forEach((p: {id:number;retail_price:number;thc_pct:number;weight_grams:number;compliance_status:string;stock_quantity:number;brand:string;product_name:string}) => { productMap[p.id] = p; });

    // Validate no recalled products
    for (const item of items as {product_id:number;quantity:number}[]) {
      const prod = productMap[item.product_id];
      if (!prod) { await client.query('ROLLBACK'); return Response.json({ error: `Product ${item.product_id} not found` }, { status: 400 }); }
      if (prod.compliance_status === 'recalled') { await client.query('ROLLBACK'); return Response.json({ error: `COMPLIANCE: Product "${prod.brand} ${prod.product_name}" is RECALLED and cannot be sold. Remove it from the transaction.` }, { status: 400 }); }
      if (prod.stock_quantity < item.quantity) { await client.query('ROLLBACK'); return Response.json({ error: `Insufficient stock for ${prod.brand} ${prod.product_name}` }, { status: 400 }); }
    }

    // Calculate totals and THC grams
    let subtotal = 0;
    let totalThcGrams = 0;
    const lineItems: {product_id:number;quantity:number;unit_price:number;thc_grams:number;line_total:number}[] = [];

    for (const item of items as {product_id:number;quantity:number;unit_price?:number}[]) {
      const prod = productMap[item.product_id];
      const unit_price = item.unit_price ?? prod.retail_price;
      const line_total = unit_price * item.quantity;
      // THC grams per unit: thc_pct/100 * weight_grams
      const thc_per_unit = prod.thc_pct && prod.weight_grams ? (prod.thc_pct / 100) * prod.weight_grams : 0;
      const thc_grams = thc_per_unit * item.quantity;
      subtotal += line_total;
      totalThcGrams += thc_grams;
      lineItems.push({ product_id: item.product_id, quantity: item.quantity, unit_price, thc_grams, line_total });
    }

    const gst = Math.round(subtotal * 0.05 * 100) / 100;
    const total = subtotal + gst;

    // Create sale
    const { rows: saleRows } = await client.query(`
      INSERT INTO cr_sale (staff_id, customer_age_verified, customer_dob_confirmed, subtotal, gst_amount, total_amount, payment_method, total_thc_grams, pos_reference, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [staff_id, true, customer_dob_confirmed||null, subtotal, gst, total, payment_method, totalThcGrams, pos_reference||null, notes||null]);
    const saleId = saleRows[0].id;

    // Insert line items and deduct stock
    for (const li of lineItems) {
      await client.query(`INSERT INTO cr_sale_item (sale_id, product_id, quantity, unit_price, thc_grams_this_item, line_total) VALUES ($1,$2,$3,$4,$5,$6)`, [saleId, li.product_id, li.quantity, li.unit_price, li.thc_grams, li.line_total]);
      await client.query(`UPDATE cr_product SET stock_quantity=stock_quantity-$1 WHERE id=$2`, [li.quantity, li.product_id]);
    }

    await client.query('COMMIT');
    return Response.json(saleRows[0], { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    return Response.json({ error: String(err) }, { status: 500 });
  } finally { client.release(); }
}
