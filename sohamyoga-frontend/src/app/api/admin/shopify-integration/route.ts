export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

async function ensureTables() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS shopify_connections (
        id SERIAL PRIMARY KEY,
        store_domain TEXT UNIQUE NOT NULL,
        access_token TEXT,
        shop_name TEXT,
        plan TEXT DEFAULT 'basic',
        status TEXT DEFAULT 'connected',
        products_synced INTEGER DEFAULT 0,
        orders_synced INTEGER DEFAULT 0,
        last_sync TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS shopify_products (
        id SERIAL PRIMARY KEY,
        shopify_id TEXT,
        store_domain TEXT,
        title TEXT,
        handle TEXT,
        status TEXT DEFAULT 'active',
        price NUMERIC DEFAULT 0,
        inventory INTEGER DEFAULT 0,
        tags TEXT[],
        image_url TEXT,
        ai_description TEXT,
        synced_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS shopify_orders (
        id SERIAL PRIMARY KEY,
        shopify_id TEXT,
        store_domain TEXT,
        order_number TEXT,
        customer_email TEXT,
        total_price NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'pending',
        line_items JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS shopify_abandoned_carts (
        id SERIAL PRIMARY KEY,
        store_domain TEXT,
        cart_token TEXT,
        customer_email TEXT,
        customer_name TEXT,
        total_price NUMERIC DEFAULT 0,
        items JSONB,
        recovery_email_sent BOOLEAN DEFAULT FALSE,
        recovered BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS shopify_webhooks (
        id SERIAL PRIMARY KEY,
        store_domain TEXT,
        topic TEXT,
        endpoint TEXT,
        status TEXT DEFAULT 'active',
        last_triggered TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Seed demo connection
    const existing = await client.query(`SELECT id FROM shopify_connections WHERE store_domain='yoga-studio.myshopify.com'`);
    if (existing.rowCount === 0) {
      await client.query(`
        INSERT INTO shopify_connections(store_domain,access_token,shop_name,plan,status,products_synced,orders_synced,last_sync)
        VALUES('yoga-studio.myshopify.com','shpat_demo_token_abc123','Soham Yoga Studio','standard','connected',12,8,NOW()-INTERVAL '2 hours')
      `);
      // Seed products
      const products = [
        ['gid://shopify/Product/1001','yoga-studio.myshopify.com','Premium Cork Yoga Mat','premium-cork-yoga-mat','active',89.99,45,'{yoga,mat,cork,eco-friendly}',null,null],
        ['gid://shopify/Product/1002','yoga-studio.myshopify.com','Bamboo Yoga Block Set','bamboo-yoga-block-set','active',34.99,120,'{yoga,block,bamboo,prop}',null,null],
        ['gid://shopify/Product/1003','yoga-studio.myshopify.com','Organic Cotton Yoga Strap','organic-cotton-yoga-strap','active',18.99,200,'{yoga,strap,cotton,beginner}',null,null],
        ['gid://shopify/Product/1004','yoga-studio.myshopify.com','30-Day Online Yoga Course','30-day-online-yoga-course','active',149.00,999,'{course,online,beginner,30-day}',null,null],
        ['gid://shopify/Product/1005','yoga-studio.myshopify.com','Annual Studio Membership','annual-studio-membership','active',599.00,50,'{membership,annual,unlimited}',null,null],
        ['gid://shopify/Product/1006','yoga-studio.myshopify.com','Meditation Cushion - Zafu','meditation-cushion-zafu','active',59.99,85,'{meditation,cushion,zafu,zen}',null,null],
        ['gid://shopify/Product/1007','yoga-studio.myshopify.com','Ayurvedic Wellness Kit','ayurvedic-wellness-kit','active',79.99,35,'{ayurveda,wellness,kit,herbs}',null,null],
        ['gid://shopify/Product/1008','yoga-studio.myshopify.com','Resistance Band Set','resistance-band-set','active',29.99,160,'{fitness,resistance,band,exercise}',null,null],
        ['gid://shopify/Product/1009','yoga-studio.myshopify.com','Hot Yoga Towel','hot-yoga-towel','active',24.99,220,'{towel,hot-yoga,microfiber,sweat}',null,null],
        ['gid://shopify/Product/1010','yoga-studio.myshopify.com','Prenatal Yoga Video Pack','prenatal-yoga-video-pack','active',49.99,999,'{prenatal,yoga,video,pregnancy}',null,null],
        ['gid://shopify/Product/1011','yoga-studio.myshopify.com','Monthly Class Pack (10 classes)','monthly-class-pack-10','active',199.00,100,'{classes,pack,studio,monthly}',null,null],
        ['gid://shopify/Product/1012','yoga-studio.myshopify.com','Yoga Philosophy Book','yoga-philosophy-book','active',22.99,75,'{book,philosophy,yoga,patanjali}',null,null],
      ];
      for (const p of products) {
        await client.query(`
          INSERT INTO shopify_products(shopify_id,store_domain,title,handle,status,price,inventory,tags,image_url,ai_description)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        `, p);
      }
      // Seed orders
      const orders = [
        ['order_001','yoga-studio.myshopify.com','#1001','customer1@example.com',149.00,'fulfilled','[{"title":"30-Day Online Yoga Course","qty":1,"price":149.00}]'],
        ['order_002','yoga-studio.myshopify.com','#1002','customer2@example.com',89.99,'pending','[{"title":"Premium Cork Yoga Mat","qty":1,"price":89.99}]'],
        ['order_003','yoga-studio.myshopify.com','#1003','customer3@example.com',53.98,'fulfilled','[{"title":"Bamboo Yoga Block Set","qty":1,"price":34.99},{"title":"Organic Cotton Yoga Strap","qty":1,"price":18.99}]'],
        ['order_004','yoga-studio.myshopify.com','#1004','customer4@example.com',599.00,'pending','[{"title":"Annual Studio Membership","qty":1,"price":599.00}]'],
        ['order_005','yoga-studio.myshopify.com','#1005','customer5@example.com',24.99,'cancelled','[{"title":"Hot Yoga Towel","qty":1,"price":24.99}]'],
        ['order_006','yoga-studio.myshopify.com','#1006','customer6@example.com',79.99,'refunded','[{"title":"Ayurvedic Wellness Kit","qty":1,"price":79.99}]'],
        ['order_007','yoga-studio.myshopify.com','#1007','customer7@example.com',229.98,'fulfilled','[{"title":"Monthly Class Pack (10 classes)","qty":1,"price":199.00},{"title":"Organic Cotton Yoga Strap","qty":1,"price":18.99},{"title":"Hot Yoga Towel","qty":1,"price":24.99}]'],
        ['order_008','yoga-studio.myshopify.com','#1008','customer8@example.com',49.99,'pending','[{"title":"Prenatal Yoga Video Pack","qty":1,"price":49.99}]'],
      ];
      for (const o of orders) {
        await client.query(`
          INSERT INTO shopify_orders(shopify_id,store_domain,order_number,customer_email,total_price,status,line_items)
          VALUES($1,$2,$3,$4,$5,$6,$7)
        `, o);
      }
      // Seed abandoned carts
      const carts = [
        ['yoga-studio.myshopify.com','cart_a1','abandoned1@example.com','Sarah Johnson',149.00,'[{"title":"30-Day Online Yoga Course","qty":1,"price":149.00}]'],
        ['yoga-studio.myshopify.com','cart_a2','abandoned2@example.com','Mike Chen',124.98,'[{"title":"Premium Cork Yoga Mat","qty":1,"price":89.99},{"title":"Bamboo Yoga Block Set","qty":1,"price":34.99}]'],
        ['yoga-studio.myshopify.com','cart_a3','abandoned3@example.com','Emma Wilson',199.00,'[{"title":"Monthly Class Pack (10 classes)","qty":1,"price":199.00}]'],
        ['yoga-studio.myshopify.com','cart_a4','abandoned4@example.com','David Kumar',79.99,'[{"title":"Ayurvedic Wellness Kit","qty":1,"price":79.99}]'],
      ];
      for (const c of carts) {
        await client.query(`
          INSERT INTO shopify_abandoned_carts(store_domain,cart_token,customer_email,customer_name,total_price,items)
          VALUES($1,$2,$3,$4,$5,$6)
        `, c);
      }
      // Seed webhooks
      const webhooks = [
        ['yoga-studio.myshopify.com','orders/create','/api/webhooks/shopify/orders-create','active'],
        ['yoga-studio.myshopify.com','products/update','/api/webhooks/shopify/products-update','active'],
        ['yoga-studio.myshopify.com','carts/update','/api/webhooks/shopify/carts-update','active'],
        ['yoga-studio.myshopify.com','checkouts/create','/api/webhooks/shopify/checkouts-create','inactive'],
      ];
      for (const w of webhooks) {
        await client.query(`
          INSERT INTO shopify_webhooks(store_domain,topic,endpoint,status)
          VALUES($1,$2,$3,$4)
        `, w);
      }
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const connections = await client.query(`SELECT * FROM shopify_connections ORDER BY created_at DESC`);
    const stats = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM shopify_orders WHERE status='pending') AS pending_orders,
        (SELECT COALESCE(SUM(total_price),0) FROM shopify_orders WHERE created_at >= NOW()-INTERVAL '30 days') AS revenue_30d,
        (SELECT COUNT(*) FROM shopify_abandoned_carts WHERE recovered=FALSE) AS open_carts,
        (SELECT COUNT(*) FROM shopify_abandoned_carts WHERE recovered=TRUE) AS recovered_carts
    `);
    return Response.json({ connections: connections.rows, stats: stats.rows[0] });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  await ensureTables();
  const body = await req.json().catch(() => null);
  if (!body || typeof body.store_domain !== 'string' || !body.store_domain.trim()) {
    return Response.json({ error: 'store_domain is required.' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO shopify_connections(store_domain, access_token, shop_name, plan, status)
      VALUES($1,$2,$3,$4,'connected')
      ON CONFLICT(store_domain) DO UPDATE SET access_token=$2, shop_name=$3, plan=$4, status='connected'
      RETURNING *
    `, [body.store_domain.trim(), body.access_token || '', body.shop_name || body.store_domain.trim(), body.plan || 'basic']);
    return Response.json({ connection: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
