import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALL_PLATFORMS = [
  'rentals_ca','rentfaster','padmapper','zumper','liv_rent',
  'kijiji','facebook','apartments_ca','forrent_ca','airbnb',
];

async function ensureSchema(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS rental_listing (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        rental_type TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT DEFAULT 'Calgary',
        province TEXT DEFAULT 'AB',
        postal_code TEXT,
        neighbourhood TEXT,
        unit_number TEXT,
        floor_number INT,
        monthly_rent NUMERIC(10,2),
        deposit_amount NUMERIC(10,2),
        min_lease_months INT DEFAULT 12,
        available_date DATE,
        bedrooms NUMERIC(3,1) DEFAULT 0,
        bathrooms NUMERIC(3,1),
        sq_ft INT,
        furnished TEXT DEFAULT 'unfurnished',
        parking TEXT DEFAULT 'none',
        pets_allowed TEXT DEFAULT 'no',
        smoking_allowed BOOLEAN DEFAULT false,
        utilities_included TEXT[],
        amenities TEXT[],
        laundry TEXT DEFAULT 'shared',
        description TEXT,
        images TEXT[],
        virtual_tour_url TEXT,
        contact_name TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        screening_requirements TEXT[],
        status TEXT DEFAULT 'draft',
        airbnb_enabled BOOLEAN DEFAULT false,
        airbnb_nightly_rate NUMERIC(8,2),
        airbnb_cleaning_fee NUMERIC(8,2),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS rental_platform (
        id SERIAL PRIMARY KEY,
        listing_id INT REFERENCES rental_listing(id) ON DELETE CASCADE,
        platform TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        platform_url TEXT,
        platform_listing_id TEXT,
        posted_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        views_count INT DEFAULT 0,
        inquiries_count INT DEFAULT 0,
        monthly_cost NUMERIC(8,2) DEFAULT 0,
        notes TEXT,
        UNIQUE(listing_id, platform)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS rental_application (
        id SERIAL PRIMARY KEY,
        listing_id INT REFERENCES rental_listing(id),
        platform TEXT,
        applicant_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        move_in_date DATE,
        monthly_income NUMERIC(10,2),
        employment_status TEXT,
        num_occupants INT DEFAULT 1,
        has_pets BOOLEAN DEFAULT false,
        pet_details TEXT,
        message TEXT,
        screening_status TEXT DEFAULT 'pending',
        credit_score INT,
        references_provided BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS rental_tenant (
        id SERIAL PRIMARY KEY,
        listing_id INT REFERENCES rental_listing(id),
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        lease_start DATE,
        lease_end DATE,
        monthly_rent NUMERIC(10,2),
        deposit_paid NUMERIC(10,2),
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureSchema();

  const { searchParams } = new URL(req.url);
  const rental_type  = searchParams.get('rental_type');
  const status       = searchParams.get('status');
  const neighbourhood= searchParams.get('neighbourhood');
  const min_rent     = searchParams.get('min_rent');
  const max_rent     = searchParams.get('max_rent');
  const bedrooms     = searchParams.get('bedrooms');
  const pets_allowed = searchParams.get('pets_allowed');
  const furnished    = searchParams.get('furnished');

  const pool = getPool();
  const client = await pool.connect();
  try {
    const conditions: string[] = [];
    const params: unknown[]    = [];
    let p = 1;

    if (rental_type)   { conditions.push(`l.rental_type = $${p++}`);   params.push(rental_type); }
    if (status)        { conditions.push(`l.status = $${p++}`);         params.push(status); }
    if (neighbourhood) { conditions.push(`l.neighbourhood ILIKE $${p++}`); params.push(`%${neighbourhood}%`); }
    if (min_rent)      { conditions.push(`l.monthly_rent >= $${p++}`);  params.push(Number(min_rent)); }
    if (max_rent)      { conditions.push(`l.monthly_rent <= $${p++}`);  params.push(Number(max_rent)); }
    if (bedrooms)      { conditions.push(`l.bedrooms = $${p++}`);       params.push(Number(bedrooms)); }
    if (pets_allowed)  { conditions.push(`l.pets_allowed = $${p++}`);   params.push(pets_allowed); }
    if (furnished)     { conditions.push(`l.furnished = $${p++}`);      params.push(furnished); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const listingsRes = await client.query(
      `SELECT l.*,
         (SELECT COUNT(*) FROM rental_application a WHERE a.listing_id = l.id) AS application_count
       FROM rental_listing l
       ${where}
       ORDER BY l.created_at DESC`,
      params,
    );

    const ids = listingsRes.rows.map((r) => r.id as number);
    let platformMap: Record<number, unknown[]> = {};
    if (ids.length) {
      const platRes = await client.query(
        `SELECT * FROM rental_platform WHERE listing_id = ANY($1)`,
        [ids],
      );
      for (const row of platRes.rows) {
        if (!platformMap[row.listing_id]) platformMap[row.listing_id] = [];
        platformMap[row.listing_id].push(row);
      }
    }

    const listings = listingsRes.rows.map((r) => ({
      ...r,
      platform_statuses: platformMap[r.id] ?? [],
    }));

    // Stats
    const statsRes = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE TRUE)                      AS total,
        COUNT(*) FILTER (WHERE status = 'active')         AS active,
        COUNT(*) FILTER (WHERE status = 'rented')         AS rented,
        COALESCE(SUM(monthly_rent) FILTER (WHERE status = 'rented'), 0) AS total_monthly_revenue,
        COALESCE(AVG(monthly_rent) FILTER (WHERE status IN ('active','rented')), 0) AS avg_rent,
        (SELECT COUNT(*) FROM rental_application WHERE screening_status = 'pending') AS applications_pending
      FROM rental_listing
    `);
    const s = statsRes.rows[0];
    const total = Number(s.total);
    const rented = Number(s.rented);
    const vacancy_rate = total > 0 ? Math.round(((total - rented) / total) * 100) : 0;

    return Response.json({
      listings,
      stats: {
        total,
        active: Number(s.active),
        rented,
        vacancy_rate,
        total_monthly_revenue: Number(s.total_monthly_revenue),
        avg_rent: Number(Number(s.avg_rent).toFixed(2)),
        applications_pending: Number(s.applications_pending),
      },
    });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureSchema();

  const body = await req.json() as Record<string, unknown>;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO rental_listing (
        title, rental_type, address, city, province, postal_code, neighbourhood,
        unit_number, floor_number, monthly_rent, deposit_amount, min_lease_months,
        available_date, bedrooms, bathrooms, sq_ft, furnished, parking,
        pets_allowed, smoking_allowed, utilities_included, amenities, laundry,
        description, images, virtual_tour_url, contact_name, contact_email, contact_phone,
        screening_requirements, status, airbnb_enabled, airbnb_nightly_rate, airbnb_cleaning_fee
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
        $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34
      ) RETURNING *`,
      [
        body.title, body.rental_type, body.address,
        body.city ?? 'Calgary', body.province ?? 'AB',
        body.postal_code ?? null, body.neighbourhood ?? null,
        body.unit_number ?? null, body.floor_number ?? null,
        body.monthly_rent ?? null, body.deposit_amount ?? null,
        body.min_lease_months ?? 12, body.available_date ?? null,
        body.bedrooms ?? 0, body.bathrooms ?? null,
        body.sq_ft ?? null, body.furnished ?? 'unfurnished',
        body.parking ?? 'none', body.pets_allowed ?? 'no',
        body.smoking_allowed ?? false,
        body.utilities_included ?? [],
        body.amenities ?? [],
        body.laundry ?? 'shared',
        body.description ?? null, body.images ?? [],
        body.virtual_tour_url ?? null,
        body.contact_name ?? null, body.contact_email ?? null, body.contact_phone ?? null,
        body.screening_requirements ?? [],
        body.status ?? 'draft',
        body.airbnb_enabled ?? false,
        body.airbnb_nightly_rate ?? null, body.airbnb_cleaning_fee ?? null,
      ],
    );

    const listing = res.rows[0];
    const selectedPlatforms = (body.platforms as string[] | undefined) ?? ALL_PLATFORMS;
    for (const platform of selectedPlatforms) {
      await client.query(
        `INSERT INTO rental_platform (listing_id, platform, status)
         VALUES ($1, $2, 'pending')
         ON CONFLICT (listing_id, platform) DO NOTHING`,
        [listing.id, platform],
      );
    }

    return Response.json({ listing }, { status: 201 });
  } finally {
    client.release();
  }
}
