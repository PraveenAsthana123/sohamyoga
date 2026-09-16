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
      CREATE TABLE IF NOT EXISTS marketplace_listings (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        price NUMERIC DEFAULT 0,
        category TEXT,
        images TEXT[],
        master_listing BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS marketplace_channels (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'marketplace',
        status TEXT DEFAULT 'connected',
        listing_count INTEGER DEFAULT 0,
        last_sync TIMESTAMPTZ,
        credentials_configured BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS marketplace_variants (
        id SERIAL PRIMARY KEY,
        listing_id INTEGER REFERENCES marketplace_listings(id),
        channel_id INTEGER REFERENCES marketplace_channels(id),
        channel_listing_id TEXT,
        channel_price NUMERIC DEFAULT 0,
        channel_status TEXT DEFAULT 'active',
        field_mapping JSONB,
        unsupported_fields TEXT[],
        last_pushed TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS marketplace_orders (
        id SERIAL PRIMARY KEY,
        channel_id INTEGER,
        channel_order_id TEXT,
        customer TEXT,
        items JSONB,
        total NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'new',
        channel_status TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Seed channels
    const chanExist = await client.query(`SELECT COUNT(*) as cnt FROM marketplace_channels`);
    if (Number(chanExist.rows[0].cnt) === 0) {
      const channels = [
        ['Shopify', 'marketplace', 'connected', true],
        ['Etsy', 'marketplace', 'connected', true],
        ['Amazon', 'marketplace', 'configured', true],
        ['WooCommerce', 'marketplace', 'connected', true],
        ['Facebook Shop', 'social_commerce', 'disconnected', false],
      ];
      for (const ch of channels) {
        await client.query(
          `INSERT INTO marketplace_channels(name,type,status,credentials_configured) VALUES($1,$2,$3,$4)`,
          ch
        );
      }
    }

    // Seed listings
    const listExist = await client.query(`SELECT COUNT(*) as cnt FROM marketplace_listings`);
    if (Number(listExist.rows[0].cnt) === 0) {
      const listings = [
        ['Premium Cork Yoga Mat', 'High-quality eco-friendly cork yoga mat with natural rubber base. Superior grip and cushioning for all yoga styles.', 89.99, 'Equipment'],
        ['30-Day Beginner Yoga Course', 'Complete online yoga course for beginners. 30 video lessons covering foundations, alignment and breathwork.', 149.00, 'Digital Course'],
        ['Annual Studio Membership', 'Unlimited access to all in-studio and online classes for one full year. Includes workshops and retreats.', 599.00, 'Membership'],
        ['Bamboo Yoga Block Set (2)', 'Sustainable bamboo yoga blocks for deeper stretches and better alignment. Set of 2.', 34.99, 'Equipment'],
        ['Ayurvedic Wellness Kit', 'Curated collection of ayurvedic herbs, oils and tools for daily wellness rituals.', 79.99, 'Wellness'],
        ['Monthly Online Class Pack', 'Access to 10 online yoga classes per month. Flexible, beginner-friendly scheduling.', 49.00, 'Subscription'],
      ];
      for (const l of listings) {
        await client.query(
          `INSERT INTO marketplace_listings(title,description,price,category) VALUES($1,$2,$3,$4)`,
          l
        );
      }

      // Seed orders
      const [ch1, ch2] = await Promise.all([
        client.query(`SELECT id FROM marketplace_channels WHERE name='Shopify'`),
        client.query(`SELECT id FROM marketplace_channels WHERE name='Etsy'`),
      ]);
      const chId1 = ch1.rows[0]?.id;
      const chId2 = ch2.rows[0]?.id;
      const orders = [
        [chId1, 'SHOP-001', 'Emma Johnson', '[{"title":"Premium Cork Yoga Mat","qty":1,"price":89.99}]', 89.99, 'fulfilled', 'complete'],
        [chId2, 'ETSY-001', 'Mark Williams', '[{"title":"Bamboo Yoga Block Set","qty":1,"price":34.99}]', 34.99, 'new', 'payment_complete'],
        [chId1, 'SHOP-002', 'Priya Sharma', '[{"title":"30-Day Beginner Yoga Course","qty":1,"price":149.00}]', 149.00, 'processing', 'paid'],
        [chId2, 'ETSY-002', 'Lisa Chen', '[{"title":"Ayurvedic Wellness Kit","qty":1,"price":79.99}]', 79.99, 'new', 'payment_complete'],
        [chId1, 'SHOP-003', 'James Davis', '[{"title":"Annual Studio Membership","qty":1,"price":599.00}]', 599.00, 'new', 'pending'],
        [chId1, 'SHOP-004', 'Sofia Martinez', '[{"title":"Monthly Online Class Pack","qty":1,"price":49.00}]', 49.00, 'fulfilled', 'complete'],
        [chId2, 'ETSY-003', 'Alex Turner', '[{"title":"Bamboo Yoga Block Set","qty":2,"price":69.98}]', 69.98, 'processing', 'paid'],
        [chId1, 'SHOP-005', 'Rachel Green', '[{"title":"30-Day Beginner Yoga Course","qty":1,"price":149.00},{"title":"Bamboo Yoga Block Set","qty":1,"price":34.99}]', 183.99, 'fulfilled', 'complete'],
      ];
      for (const o of orders) {
        if (o[0]) {
          await client.query(
            `INSERT INTO marketplace_orders(channel_id,channel_order_id,customer,items,total,status,channel_status) VALUES($1,$2,$3,$4,$5,$6,$7)`,
            o
          );
        }
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
    const [listings, channels, stats] = await Promise.all([
      client.query(`SELECT * FROM marketplace_listings ORDER BY created_at DESC`),
      client.query(`SELECT * FROM marketplace_channels ORDER BY created_at`),
      client.query(`
        SELECT
          (SELECT COUNT(*) FROM marketplace_channels WHERE status='connected') AS channels_connected,
          (SELECT COUNT(*) FROM marketplace_listings) AS listings_total,
          (SELECT COUNT(*) FROM marketplace_orders WHERE created_at >= NOW()-INTERVAL '1 day') AS orders_today
      `),
    ]);
    return Response.json({ listings: listings.rows, channels: channels.rows, stats: stats.rows[0] });
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
  if (!body || typeof body.title !== 'string' || !body.title.trim()) {
    return Response.json({ error: 'title is required.' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO marketplace_listings(title,description,price,category)
      VALUES($1,$2,$3,$4)
      RETURNING *
    `, [body.title.trim(), body.description || '', Number(body.price) || 0, body.category || 'General']);
    return Response.json({ listing: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
