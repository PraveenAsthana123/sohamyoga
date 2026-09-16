import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureSchema(pool: ReturnType<typeof getPool>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS digital_cards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug TEXT UNIQUE NOT NULL,
      card_type TEXT DEFAULT 'personal',
      owner_name TEXT NOT NULL,
      job_title TEXT,
      company_name TEXT,
      tagline TEXT,
      bio TEXT,
      profile_photo_url TEXT,
      cover_photo_url TEXT,
      email TEXT,
      phone TEXT,
      whatsapp_number TEXT,
      website_url TEXT,
      city TEXT,
      country TEXT,
      linkedin_url TEXT,
      twitter_url TEXT,
      instagram_url TEXT,
      facebook_url TEXT,
      youtube_url TEXT,
      tiktok_url TEXT,
      github_url TEXT,
      pinterest_url TEXT,
      snapchat_url TEXT,
      threads_url TEXT,
      calendly_url TEXT,
      zoom_link TEXT,
      google_meet_url TEXT,
      shopify_url TEXT,
      etsy_url TEXT,
      amazon_store_url TEXT,
      theme TEXT DEFAULT 'modern',
      primary_color TEXT DEFAULT '#3B82F6',
      secondary_color TEXT DEFAULT '#1E40AF',
      background_color TEXT DEFAULT '#FFFFFF',
      text_color TEXT DEFAULT '#1F2937',
      font_family TEXT DEFAULT 'Inter',
      layout TEXT DEFAULT 'standard',
      view_count INT DEFAULT 0,
      click_count INT DEFAULT 0,
      share_count INT DEFAULT 0,
      save_count INT DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      show_qr_on_card BOOLEAN DEFAULT true,
      allow_contact_form BOOLEAN DEFAULT true,
      nfc_enabled BOOLEAN DEFAULT false,
      password_protected BOOLEAN DEFAULT false,
      card_password TEXT,
      meta_title TEXT,
      meta_description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS digital_card_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      card_id UUID REFERENCES digital_cards(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      url TEXT NOT NULL,
      icon TEXT DEFAULT 'link',
      order_index INT DEFAULT 0,
      click_count INT DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS digital_card_views (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      card_id UUID REFERENCES digital_cards(id) ON DELETE CASCADE,
      viewer_ip_hash TEXT,
      referrer TEXT,
      device_type TEXT,
      country TEXT,
      action TEXT DEFAULT 'view',
      element_clicked TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Seed data if empty
  const { rows } = await pool.query('SELECT COUNT(*) AS cnt FROM digital_cards');
  if (parseInt(rows[0].cnt) === 0) {
    await pool.query(`
      INSERT INTO digital_cards (slug, card_type, owner_name, job_title, company_name, tagline, bio,
        email, phone, whatsapp_number, website_url, city, country,
        linkedin_url, twitter_url, instagram_url, facebook_url, youtube_url, github_url,
        calendly_url, theme, primary_color, secondary_color, background_color, text_color)
      VALUES
        ('arjun-sharma-ceo', 'business', 'Arjun Sharma', 'Chief Executive Officer', 'SohamYoga Inc.',
         'Transforming wellness through technology', 'Entrepreneur and wellness advocate with 15+ years building yoga-tech ventures.',
         'arjun@sohamyoga.com', '+1-647-555-0101', '+16475550101', 'https://sohamyoga.com',
         'Toronto', 'Canada',
         'https://linkedin.com/in/arjun-sharma', 'https://twitter.com/arjunsharma', 'https://instagram.com/arjunsharma',
         'https://facebook.com/arjunsharma', 'https://youtube.com/@arjunsharma', null,
         'https://calendly.com/arjun-sharma', 'corporate', '#1E3A5F', '#2D6A4F', '#F8FAFC', '#1E293B'),
        ('priya-mehta-marketing', 'personal', 'Priya Mehta', 'Head of Marketing', 'SohamYoga Inc.',
         'Growth hacker | Yoga enthusiast', 'Digital marketing leader specializing in wellness brands and community growth.',
         'priya@sohamyoga.com', '+1-647-555-0202', '+16475550202', 'https://sohamyoga.com/team/priya',
         'Vancouver', 'Canada',
         'https://linkedin.com/in/priya-mehta', 'https://twitter.com/priyamehta', 'https://instagram.com/priyamehta_yoga',
         'https://facebook.com/priyamehta', 'https://youtube.com/@priyamehta', null,
         'https://calendly.com/priya-mehta', 'gradient', '#8B5CF6', '#6D28D9', '#FAFAFA', '#1F2937'),
        ('kavita-nair-yoga', 'personal', 'Kavita Nair', 'Senior Yoga Instructor', 'SohamYoga Studio',
         'Certified 500hr RYT | Breathwork specialist', 'Passionate about making yoga accessible to everyone. 8 years teaching experience.',
         'kavita@sohamyoga.com', '+1-416-555-0303', '+14165550303', 'https://sohamyoga.com/instructors/kavita',
         'Toronto', 'Canada',
         'https://linkedin.com/in/kavita-nair', 'https://twitter.com/kavitayoga', 'https://instagram.com/kavita_yoga',
         null, 'https://youtube.com/@kavitanair', 'https://tiktok.com/@kavitayoga',
         'https://calendly.com/kavita-nair', 'modern', '#10B981', '#059669', '#FFFFFF', '#1F2937'),
        ('raj-patel-sales', 'business', 'Raj Patel', 'Sales Director', 'SohamYoga Inc.',
         'Connecting studios with the future of wellness tech', 'B2B sales leader helping yoga studios scale with our platform.',
         'raj@sohamyoga.com', '+1-905-555-0404', '+19055550404', 'https://sohamyoga.com',
         'Mississauga', 'Canada',
         'https://linkedin.com/in/raj-patel-sales', 'https://twitter.com/rajpatel', 'https://instagram.com/rajpatel',
         'https://facebook.com/rajpatel', null, null,
         'https://calendly.com/raj-patel', 'bold', '#F97316', '#EA580C', '#0F172A', '#F8FAFC')
    `);

    // Seed custom links
    const cardRows = await pool.query('SELECT id, slug FROM digital_cards ORDER BY created_at');
    for (const card of cardRows.rows) {
      if (card.slug === 'arjun-sharma-ceo') {
        await pool.query(`INSERT INTO digital_card_links (card_id, label, url, icon, order_index) VALUES
          ($1, 'Book a Strategy Call', 'https://calendly.com/arjun-sharma/strategy', 'calendar', 0),
          ($1, 'Company Pitch Deck', 'https://sohamyoga.com/pitch', 'pdf', 1),
          ($1, 'Watch Our Story', 'https://youtube.com/watch?v=demo', 'video', 2)`, [card.id]);
      } else if (card.slug === 'priya-mehta-marketing') {
        await pool.query(`INSERT INTO digital_card_links (card_id, label, url, icon, order_index) VALUES
          ($1, 'Marketing Portfolio', 'https://priyamehta.com/portfolio', 'link', 0),
          ($1, 'Download Media Kit', 'https://sohamyoga.com/media-kit.pdf', 'pdf', 1),
          ($1, 'Collaboration Enquiry', 'https://forms.sohamyoga.com/collab', 'email', 2)`, [card.id]);
      } else if (card.slug === 'kavita-nair-yoga') {
        await pool.query(`INSERT INTO digital_card_links (card_id, label, url, icon, order_index) VALUES
          ($1, 'Book a Class', 'https://sohamyoga.com/book/kavita', 'calendar', 0),
          ($1, 'Free Yoga Guide PDF', 'https://sohamyoga.com/kavita-guide.pdf', 'pdf', 1),
          ($1, 'Join WhatsApp Group', 'https://chat.whatsapp.com/demo', 'phone', 2)`, [card.id]);
      } else if (card.slug === 'raj-patel-sales') {
        await pool.query(`INSERT INTO digital_card_links (card_id, label, url, icon, order_index) VALUES
          ($1, 'Schedule a Demo', 'https://calendly.com/raj-patel/demo', 'calendar', 0),
          ($1, 'Product Brochure', 'https://sohamyoga.com/brochure.pdf', 'pdf', 1),
          ($1, 'Studio Partnership Info', 'https://sohamyoga.com/partners', 'link', 2)`, [card.id]);
      }
    }

    // Seed view records
    const actions = ['view', 'contact_click', 'social_click', 'save_contact', 'share', 'qr_scan'];
    const devices = ['mobile', 'desktop', 'mobile', 'mobile', 'desktop'];
    const countries = ['Canada', 'USA', 'India', 'UK', 'Canada'];
    const referrers = ['instagram', 'linkedin', 'direct', 'email', 'qr'];
    for (const card of cardRows.rows) {
      for (let i = 0; i < 10; i++) {
        const action = actions[i % actions.length];
        const device = devices[i % devices.length];
        const country = countries[i % countries.length];
        const referrer = referrers[i % referrers.length];
        await pool.query(`INSERT INTO digital_card_views (card_id, viewer_ip_hash, referrer, device_type, country, action, element_clicked, created_at)
          VALUES ($1, md5(random()::text), $2, $3, $4, $5, $6, NOW() - ($7 || ' days')::interval)`,
          [card.id, referrer, device, country, action, action === 'social_click' ? 'linkedin' : null, Math.floor(Math.random() * 30)]);
      }
    }
  }
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const pool = getPool();
  try {
    await ensureSchema(pool);
    const { rows } = await pool.query(`
      SELECT dc.*,
        COUNT(DISTINCT dcv.id) FILTER (WHERE dcv.action = 'view') AS total_views_30d,
        COUNT(DISTINCT dcv.id) FILTER (WHERE dcv.action = 'save_contact') AS total_saves_30d,
        COUNT(DISTINCT dcv.id) FILTER (WHERE dcv.action = 'share') AS total_shares_30d,
        COUNT(DISTINCT dcl.id) AS custom_link_count
      FROM digital_cards dc
      LEFT JOIN digital_card_views dcv ON dcv.card_id = dc.id AND dcv.created_at >= NOW() - INTERVAL '30 days'
      LEFT JOIN digital_card_links dcl ON dcl.card_id = dc.id AND dcl.is_active = true
      GROUP BY dc.id
      ORDER BY dc.created_at DESC
    `);
    return Response.json({ cards: rows });
  } catch (err) {
    console.error('[digital-cards GET]', err);
    return Response.json({ error: 'Failed to load cards.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const pool = getPool();
  try {
    await ensureSchema(pool);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    if (!body.owner_name?.trim()) return Response.json({ error: 'owner_name is required.' }, { status: 400 });

    let slug = slugify(body.slug?.trim() || body.owner_name.trim());
    // Ensure unique slug
    const existing = await pool.query('SELECT id FROM digital_cards WHERE slug = $1', [slug]);
    if (existing.rowCount && existing.rowCount > 0) slug = `${slug}-${Date.now()}`;

    const fields = [
      'slug', 'card_type', 'owner_name', 'job_title', 'company_name', 'tagline', 'bio',
      'profile_photo_url', 'cover_photo_url', 'email', 'phone', 'whatsapp_number', 'website_url',
      'city', 'country', 'linkedin_url', 'twitter_url', 'instagram_url', 'facebook_url',
      'youtube_url', 'tiktok_url', 'github_url', 'pinterest_url', 'snapchat_url', 'threads_url',
      'calendly_url', 'zoom_link', 'google_meet_url', 'shopify_url', 'etsy_url', 'amazon_store_url',
      'theme', 'primary_color', 'secondary_color', 'background_color', 'text_color', 'font_family',
      'layout', 'is_active', 'show_qr_on_card', 'allow_contact_form', 'nfc_enabled',
      'password_protected', 'card_password', 'meta_title', 'meta_description'
    ];

    const values: unknown[] = [slug];
    const setCols: string[] = ['slug'];
    let idx = 2;
    for (const f of fields.slice(1)) {
      if (body[f] !== undefined) {
        setCols.push(f);
        values.push(body[f]);
        idx++;
      }
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `INSERT INTO digital_cards (${setCols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    return Response.json({ card: rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[digital-cards POST]', err);
    return Response.json({ error: 'Failed to create card.' }, { status: 500 });
  }
}
