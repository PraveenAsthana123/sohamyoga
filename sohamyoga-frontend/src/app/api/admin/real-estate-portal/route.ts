import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALL_PLATFORMS = [
  'realtor_ca', 'zolo', 'housesigma', 'zoocasa', 'point2homes',
  'remax', 'royal_lepage', 'property_guys', 'zillow_ca', 'condos_ca',
];

async function ensureTables() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS real_estate_listing (
        id SERIAL PRIMARY KEY,
        mls_number TEXT,
        listing_type TEXT NOT NULL,
        property_type TEXT NOT NULL,
        title TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT DEFAULT 'Calgary',
        province TEXT DEFAULT 'AB',
        postal_code TEXT,
        neighbourhood TEXT,
        price NUMERIC(12,2),
        bedrooms NUMERIC(3,1),
        bathrooms NUMERIC(3,1),
        sq_ft INT,
        lot_size TEXT,
        year_built INT,
        garage TEXT,
        basement TEXT,
        description TEXT,
        features TEXT[],
        images TEXT[],
        virtual_tour_url TEXT,
        open_house_dates JSONB DEFAULT '[]',
        listing_agent TEXT,
        brokerage TEXT,
        commission_pct NUMERIC(4,2),
        status TEXT DEFAULT 'draft',
        listed_at TIMESTAMPTZ,
        sold_at TIMESTAMPTZ,
        sold_price NUMERIC(12,2),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS real_estate_platform (
        id SERIAL PRIMARY KEY,
        listing_id INT REFERENCES real_estate_listing(id) ON DELETE CASCADE,
        platform TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        platform_url TEXT,
        platform_listing_id TEXT,
        submitted_at TIMESTAMPTZ,
        goes_live_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        views_count INT DEFAULT 0,
        saves_count INT DEFAULT 0,
        inquiries_count INT DEFAULT 0,
        notes TEXT,
        UNIQUE(listing_id, platform)
      );

      CREATE TABLE IF NOT EXISTS real_estate_lead (
        id SERIAL PRIMARY KEY,
        listing_id INT REFERENCES real_estate_listing(id),
        platform TEXT,
        name TEXT,
        email TEXT,
        phone TEXT,
        message TEXT,
        lead_type TEXT DEFAULT 'inquiry',
        status TEXT DEFAULT 'new',
        budget NUMERIC(12,2),
        pre_approved BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  await ensureTables();

  const url = new URL(req.url);
  const listing_type = url.searchParams.get('listing_type');
  const property_type = url.searchParams.get('property_type');
  const status = url.searchParams.get('status');
  const neighbourhood = url.searchParams.get('neighbourhood');
  const min_price = url.searchParams.get('min_price');
  const max_price = url.searchParams.get('max_price');
  const min_beds = url.searchParams.get('min_beds');
  const max_beds = url.searchParams.get('max_beds');

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (listing_type) { conditions.push(`l.listing_type = $${idx++}`); values.push(listing_type); }
  if (property_type) { conditions.push(`l.property_type = $${idx++}`); values.push(property_type); }
  if (status) { conditions.push(`l.status = $${idx++}`); values.push(status); }
  if (neighbourhood) { conditions.push(`l.neighbourhood ILIKE $${idx++}`); values.push(`%${neighbourhood}%`); }
  if (min_price) { conditions.push(`l.price >= $${idx++}`); values.push(Number(min_price)); }
  if (max_price) { conditions.push(`l.price <= $${idx++}`); values.push(Number(max_price)); }
  if (min_beds) { conditions.push(`l.bedrooms >= $${idx++}`); values.push(Number(min_beds)); }
  if (max_beds) { conditions.push(`l.bedrooms <= $${idx++}`); values.push(Number(max_beds)); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const [listingsRes, statsRes] = await Promise.all([
      client.query(
        `SELECT l.*,
          EXTRACT(DAY FROM NOW() - l.listed_at)::INT AS days_on_market,
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'platform', p.platform, 'status', p.status, 'platform_url', p.platform_url,
                'views_count', p.views_count, 'saves_count', p.saves_count, 'inquiries_count', p.inquiries_count
              )
            ) FILTER (WHERE p.id IS NOT NULL), '[]'
          ) AS platform_statuses,
          COUNT(DISTINCT rl.id)::INT AS lead_count
        FROM real_estate_listing l
        LEFT JOIN real_estate_platform p ON p.listing_id = l.id
        LEFT JOIN real_estate_lead rl ON rl.listing_id = l.id
        ${where}
        GROUP BY l.id
        ORDER BY l.created_at DESC`,
        values
      ),
      client.query(
        `SELECT
          COUNT(*)::INT AS total,
          COUNT(*) FILTER (WHERE status = 'active')::INT AS active,
          COUNT(*) FILTER (WHERE status = 'pending')::INT AS pending,
          COUNT(*) FILTER (WHERE status = 'sold')::INT AS sold,
          COUNT(*) FILTER (WHERE status = 'draft')::INT AS draft,
          COALESCE(SUM(price) FILTER (WHERE status = 'active'), 0) AS total_value,
          COALESCE(AVG(price) FILTER (WHERE status = 'active'), 0) AS avg_price,
          COALESCE(AVG(EXTRACT(DAY FROM NOW() - listed_at)) FILTER (WHERE status = 'active' AND listed_at IS NOT NULL), 0)::NUMERIC(6,1) AS avg_dom
        FROM real_estate_listing`
      ),
    ]);

    return Response.json({
      listings: listingsRes.rows,
      stats: statsRes.rows[0],
    });
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
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body.' }, { status: 400 });

  const {
    mls_number, listing_type, property_type, title, address, city, province,
    postal_code, neighbourhood, price, bedrooms, bathrooms, sq_ft, lot_size,
    year_built, garage, basement, description, features, images,
    virtual_tour_url, open_house_dates, listing_agent, brokerage,
    commission_pct, status, listed_at, target_platforms,
  } = body;

  if (!listing_type || !property_type || !title || !address) {
    return Response.json({ error: 'listing_type, property_type, title, and address are required.' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const listingRes = await client.query(
      `INSERT INTO real_estate_listing
        (mls_number, listing_type, property_type, title, address, city, province, postal_code,
         neighbourhood, price, bedrooms, bathrooms, sq_ft, lot_size, year_built, garage, basement,
         description, features, images, virtual_tour_url, open_house_dates, listing_agent,
         brokerage, commission_pct, status, listed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
       RETURNING *`,
      [
        mls_number || null, listing_type, property_type, title, address,
        city || 'Calgary', province || 'AB', postal_code || null, neighbourhood || null,
        price || null, bedrooms || null, bathrooms || null, sq_ft || null,
        lot_size || null, year_built || null, garage || null, basement || null,
        description || null,
        features ? `{${(features as string[]).map(f => `"${f.replace(/"/g, '\\"')}"`).join(',')}}` : null,
        images ? `{${(images as string[]).map(i => `"${i.replace(/"/g, '\\"')}"`).join(',')}}` : null,
        virtual_tour_url || null,
        JSON.stringify(open_house_dates || []),
        listing_agent || null, brokerage || null, commission_pct || null,
        status || 'draft', listed_at || null,
      ]
    );

    const newListing = listingRes.rows[0];
    const platforms = Array.isArray(target_platforms) && target_platforms.length > 0
      ? target_platforms
      : ALL_PLATFORMS;

    for (const platform of platforms) {
      await client.query(
        `INSERT INTO real_estate_platform (listing_id, platform, status) VALUES ($1, $2, 'pending')
         ON CONFLICT (listing_id, platform) DO NOTHING`,
        [newListing.id, platform]
      );
    }

    await client.query('COMMIT');
    return Response.json({ listing: newListing }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('real-estate POST error:', err);
    return Response.json({ error: 'Failed to create listing.' }, { status: 500 });
  } finally {
    client.release();
  }
}
