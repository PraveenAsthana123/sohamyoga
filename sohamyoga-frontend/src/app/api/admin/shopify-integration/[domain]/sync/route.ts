export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: { domain: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const conn = await client.query(`SELECT * FROM shopify_connections WHERE store_domain=$1`, [params.domain]);
    if (conn.rowCount === 0) return Response.json({ error: 'Store connection not found.' }, { status: 404 });

    // Simulate generating 10 demo products + 5 demo orders for this sync
    const demoProducts = [
      ['sync_p1', params.domain, 'Yoga Mat Premium Sync', 'yoga-mat-premium-sync', 'active', 94.99, 60],
      ['sync_p2', params.domain, 'Yoga Block Foam Set', 'yoga-block-foam-set', 'active', 29.99, 130],
      ['sync_p3', params.domain, 'Elastic Resistance Band', 'elastic-resistance-band', 'active', 19.99, 180],
      ['sync_p4', params.domain, 'Beginner Online Yoga Course', 'beginner-online-yoga-course', 'active', 129.00, 999],
      ['sync_p5', params.domain, 'Monthly Membership', 'monthly-membership', 'active', 79.00, 200],
      ['sync_p6', params.domain, 'Zafu Meditation Cushion', 'zafu-meditation-cushion', 'active', 64.99, 70],
      ['sync_p7', params.domain, 'Ayurveda Herb Pack', 'ayurveda-herb-pack', 'active', 44.99, 55],
      ['sync_p8', params.domain, 'Yoga Wheel', 'yoga-wheel', 'active', 49.99, 90],
      ['sync_p9', params.domain, 'Yin Yoga Video Series', 'yin-yoga-video-series', 'active', 69.99, 999],
      ['sync_p10', params.domain, 'Yoga Teacher Training Info Pack', 'yoga-teacher-training-info', 'active', 0.00, 999],
    ];
    for (const p of demoProducts) {
      await client.query(`
        INSERT INTO shopify_products(shopify_id,store_domain,title,handle,status,price,inventory)
        VALUES($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT DO NOTHING
      `, p);
    }

    const demoOrders = [
      ['sync_o1', params.domain, '#2001', 'sync_customer1@example.com', 94.99, 'fulfilled', '[{"title":"Yoga Mat Premium Sync","qty":1}]'],
      ['sync_o2', params.domain, '#2002', 'sync_customer2@example.com', 129.00, 'pending', '[{"title":"Beginner Online Yoga Course","qty":1}]'],
      ['sync_o3', params.domain, '#2003', 'sync_customer3@example.com', 79.00, 'fulfilled', '[{"title":"Monthly Membership","qty":1}]'],
      ['sync_o4', params.domain, '#2004', 'sync_customer4@example.com', 59.98, 'pending', '[{"title":"Elastic Resistance Band","qty":1},{"title":"Zafu Meditation Cushion","qty":1}]'],
      ['sync_o5', params.domain, '#2005', 'sync_customer5@example.com', 44.99, 'cancelled', '[{"title":"Ayurveda Herb Pack","qty":1}]'],
    ];
    for (const o of demoOrders) {
      await client.query(`
        INSERT INTO shopify_orders(shopify_id,store_domain,order_number,customer_email,total_price,status,line_items)
        VALUES($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT DO NOTHING
      `, o);
    }

    const productCount = await client.query(`SELECT COUNT(*) as cnt FROM shopify_products WHERE store_domain=$1`, [params.domain]);
    const orderCount = await client.query(`SELECT COUNT(*) as cnt FROM shopify_orders WHERE store_domain=$1`, [params.domain]);

    await client.query(`
      UPDATE shopify_connections
      SET products_synced=$1, orders_synced=$2, last_sync=NOW()
      WHERE store_domain=$3
    `, [Number(productCount.rows[0].cnt), Number(orderCount.rows[0].cnt), params.domain]);

    return Response.json({
      ok: true,
      products_synced: Number(productCount.rows[0].cnt),
      orders_synced: Number(orderCount.rows[0].cnt),
      synced_at: new Date().toISOString(),
    });
  } finally {
    client.release();
  }
}
