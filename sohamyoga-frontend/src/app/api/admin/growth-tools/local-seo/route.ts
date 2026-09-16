import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureSchema(pool: ReturnType<typeof getPool>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS local_seo_locations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      business_name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      province TEXT,
      postal_code TEXT,
      country TEXT DEFAULT 'Canada',
      phone TEXT,
      website_url TEXT,
      google_business_url TEXT,
      yelp_url TEXT,
      facebook_url TEXT,
      apple_maps_url TEXT,
      bing_places_url TEXT,
      tripadvisor_url TEXT,
      nap_consistent BOOLEAN DEFAULT true,
      google_rating NUMERIC(3,2),
      google_review_count INT DEFAULT 0,
      yelp_rating NUMERIC(3,2),
      primary_category TEXT,
      secondary_categories TEXT[],
      business_hours JSONB DEFAULT '{}',
      photos_count INT DEFAULT 0,
      posts_count INT DEFAULT 0,
      citation_score INT DEFAULT 0,
      last_audit_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS local_seo_citations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      location_id UUID REFERENCES local_seo_locations(id) ON DELETE CASCADE,
      directory_name TEXT NOT NULL,
      directory_url TEXT,
      listing_url TEXT,
      status TEXT DEFAULT 'not_listed',
      nap_correct BOOLEAN,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  const { rowCount } = await pool.query(`SELECT 1 FROM local_seo_locations LIMIT 1`);
  if (!rowCount) {
    const loc1 = await pool.query(`
      INSERT INTO local_seo_locations
        (business_name, address, city, province, postal_code, phone, website_url,
         google_business_url, yelp_url, facebook_url,
         nap_consistent, google_rating, google_review_count, yelp_rating,
         primary_category, secondary_categories,
         business_hours, photos_count, posts_count, citation_score)
      VALUES
        ('Soham Yoga Studio – Downtown', '220 Bay St', 'Toronto', 'ON', 'M5J 2W4',
         '(416) 555-0192', 'https://sohamyoga.ca',
         'https://business.google.com/sohamyoga-downtown', 'https://yelp.com/sohamyoga-downtown',
         'https://facebook.com/sohamyogastudio',
         true, 4.8, 312, 4.6,
         'Yoga Studio', ARRAY['Fitness Center','Meditation Center','Wellness'],
         '{"mon":"6am-9pm","tue":"6am-9pm","wed":"6am-9pm","thu":"6am-9pm","fri":"6am-8pm","sat":"8am-7pm","sun":"9am-5pm"}',
         48, 24, 72)
      RETURNING id`);
    const loc2 = await pool.query(`
      INSERT INTO local_seo_locations
        (business_name, address, city, province, postal_code, phone, website_url,
         google_business_url, yelp_url, apple_maps_url,
         nap_consistent, google_rating, google_review_count, yelp_rating,
         primary_category, secondary_categories,
         business_hours, photos_count, posts_count, citation_score)
      VALUES
        ('Soham Yoga – North York', '4789 Yonge St', 'Toronto', 'ON', 'M2N 5M9',
         '(416) 555-0284', 'https://sohamyoga.ca/north-york',
         'https://business.google.com/sohamyoga-northyork', 'https://yelp.com/sohamyoga-northyork',
         'https://maps.apple.com/?q=soham+yoga+north+york',
         false, 4.5, 87, 4.3,
         'Yoga Studio', ARRAY['Fitness Center','Wellness'],
         '{"mon":"7am-8pm","tue":"7am-8pm","wed":"7am-8pm","thu":"7am-8pm","fri":"7am-7pm","sat":"9am-6pm","sun":"10am-4pm"}',
         22, 8, 45)
      RETURNING id`);
    const id1 = loc1.rows[0].id;
    const id2 = loc2.rows[0].id;
    const dirs = [
      ['Google Business Profile', 'https://business.google.com', 'listed', true],
      ['Yelp', 'https://yelp.com', 'listed', true],
      ['Bing Places', 'https://bingplaces.com', 'needs_update', false],
      ['Apple Maps', 'https://mapsconnect.apple.com', 'not_listed', null],
      ['Facebook', 'https://facebook.com', 'listed', true],
      ['Yellow Pages Canada', 'https://yellowpages.ca', 'listed', false],
      ['Foursquare', 'https://foursquare.com', 'not_listed', null],
      ['Better Business Bureau', 'https://bbb.org', 'listed', true],
    ];
    const dirs2 = [
      ['Google Business Profile', 'https://business.google.com', 'listed', true],
      ['Yelp', 'https://yelp.com', 'listed', false],
      ['Bing Places', 'https://bingplaces.com', 'not_listed', null],
      ['Apple Maps', 'https://mapsconnect.apple.com', 'listed', true],
      ['Facebook', 'https://facebook.com', 'not_listed', null],
      ['Yellow Pages Canada', 'https://yellowpages.ca', 'not_listed', null],
      ['Foursquare', 'https://foursquare.com', 'not_listed', null],
      ['Better Business Bureau', 'https://bbb.org', 'needs_update', false],
    ];
    for (const [dn, du, st, nap] of dirs) {
      await pool.query(
        `INSERT INTO local_seo_citations (location_id, directory_name, directory_url, status, nap_correct) VALUES ($1,$2,$3,$4,$5)`,
        [id1, dn, du, st, nap],
      );
    }
    for (const [dn, du, st, nap] of dirs2) {
      await pool.query(
        `INSERT INTO local_seo_citations (location_id, directory_name, directory_url, status, nap_correct) VALUES ($1,$2,$3,$4,$5)`,
        [id2, dn, du, st, nap],
      );
    }
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  await ensureSchema(pool);
  const [locs, cits] = await Promise.all([
    pool.query(`SELECT * FROM local_seo_locations ORDER BY created_at`),
    pool.query(`SELECT * FROM local_seo_citations ORDER BY location_id, directory_name`),
  ]);
  const napIssues = locs.rows.filter((r: { nap_consistent: boolean }) => !r.nap_consistent).length;
  const avgCitation = locs.rows.length
    ? Math.round(locs.rows.reduce((s: number, r: { citation_score: number }) => s + (r.citation_score || 0), 0) / locs.rows.length)
    : 0;
  const totalListed = cits.rows.filter((r: { status: string }) => r.status === 'listed').length;
  const unverified = cits.rows.filter((r: { status: string }) => r.status === 'needs_update').length;
  const avgRating = locs.rows.length
    ? (locs.rows.reduce((s: number, r: { google_rating: number }) => s + (parseFloat(String(r.google_rating)) || 0), 0) / locs.rows.length).toFixed(1)
    : '0.0';
  return Response.json({
    locations: locs.rows,
    citations: cits.rows,
    summary: { napIssues, avgCitation, totalListed, unverified, avgRating, totalLocations: locs.rows.length },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!body || !body.business_name) return Response.json({ error: 'business_name required' }, { status: 400 });
  const pool = getPool();
  await ensureSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO local_seo_locations
      (business_name, address, city, province, postal_code, country, phone, website_url,
       google_business_url, yelp_url, facebook_url, primary_category)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      body.business_name, body.address || null, body.city || null,
      body.province || null, body.postal_code || null, body.country || 'Canada',
      body.phone || null, body.website_url || null,
      body.google_business_url || null, body.yelp_url || null,
      body.facebook_url || null, body.primary_category || null,
    ],
  );
  return Response.json({ location: rows[0] }, { status: 201 });
}
