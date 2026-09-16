import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS design_briefs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        project_type TEXT DEFAULT 'social_post',
        brand_name TEXT,
        target_audience TEXT,
        key_message TEXT,
        mood_tone TEXT,
        color_palette TEXT[],
        fonts_preferred TEXT,
        dimensions TEXT,
        platform TEXT,
        examples_urls TEXT[],
        deliverables TEXT,
        deadline DATE,
        budget_cad NUMERIC(10,2),
        status TEXT DEFAULT 'draft',
        assigned_to TEXT,
        ai_brief TEXT,
        canva_template_url TEXT,
        output_url TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS brand_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        asset_type TEXT NOT NULL,
        file_url TEXT,
        thumbnail_url TEXT,
        format TEXT,
        dimensions TEXT,
        file_size_bytes BIGINT,
        tags TEXT[],
        usage_guidelines TEXT,
        version TEXT DEFAULT '1.0',
        is_primary BOOLEAN DEFAULT false,
        download_count INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS design_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        category TEXT,
        platform TEXT,
        dimensions TEXT,
        thumbnail_url TEXT,
        canva_url TEXT,
        figma_url TEXT,
        description TEXT,
        use_count INT DEFAULT 0,
        tags TEXT[],
        is_approved BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS employee_advocacy_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        platform TEXT DEFAULT 'linkedin',
        image_url TEXT,
        suggested_caption TEXT,
        hashtags TEXT[],
        status TEXT DEFAULT 'draft',
        shared_count INT DEFAULT 0,
        reach INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Seed design_briefs
    const briefCount = await client.query(`SELECT COUNT(*) FROM design_briefs`);
    if (parseInt(briefCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO design_briefs (title, project_type, brand_name, target_audience, key_message, mood_tone, color_palette, fonts_preferred, dimensions, platform, deliverables, deadline, budget_cad, status, assigned_to)
        VALUES
          ('Q4 Instagram Campaign Graphics', 'social_post', 'SohamYoga', 'Women 25-45, urban professionals', 'Find your inner calm with yoga', 'minimal', ARRAY['#4A90D9','#F5A623','#FFFFFF'], 'Montserrat, Open Sans', '1080x1080', 'instagram', 'PNG, 3 variations', '2026-10-15', 800.00, 'in_design', 'Sarah K.'),
          ('Brand Logo Refresh', 'logo', 'SohamYoga', 'All audiences', 'Timeless, trustworthy yoga brand', 'professional', ARRAY['#2C3E50','#27AE60','#FFFFFF'], 'Futura, Helvetica', '500x500', 'web', 'SVG, PNG, AI source', '2026-10-30', 2500.00, 'review', 'Mike T.'),
          ('Holiday Promotion Banner', 'banner', 'SohamYoga', 'Existing members and leads', '20% off holiday yoga packages', 'playful', ARRAY['#E74C3C','#27AE60','#F39C12'], 'Poppins Bold, Lato', '1200x628', 'facebook', 'PNG, JPG', '2026-11-01', 600.00, 'draft', null),
          ('Teacher Bio Infographic', 'infographic', 'SohamYoga', 'Prospective students', 'Meet our expert instructors', 'friendly', ARRAY['#9B59B6','#3498DB','#ECF0F1'], 'Nunito, Source Sans Pro', '1080x1350', 'instagram', 'PDF, PNG', '2026-10-20', 450.00, 'briefed', 'Sarah K.'),
          ('Class Schedule Email Header', 'email_header', 'SohamYoga', 'Newsletter subscribers', 'September class schedule inside', 'professional', ARRAY['#1ABC9C','#2C3E50','#FFFFFF'], 'Roboto, Open Sans', '600x200', 'web', 'PNG, JPG', '2026-09-25', 300.00, 'approved', 'Mike T.'),
          ('Wellness Brochure', 'brochure', 'SohamYoga', 'Community events visitors', 'Your journey to wellness starts here', 'luxury', ARRAY['#C0392B','#8E44AD','#FDEBD0'], 'Garamond, Baskerville', 'A4 210x297mm', 'print', 'PDF print-ready 300dpi', '2026-11-15', 1200.00, 'delivered', 'Sarah K.')
        ON CONFLICT DO NOTHING;
      `);
    }

    // Seed brand_assets
    const assetCount = await client.query(`SELECT COUNT(*) FROM brand_assets`);
    if (parseInt(assetCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO brand_assets (name, asset_type, file_url, thumbnail_url, format, dimensions, file_size_bytes, tags, usage_guidelines, version, is_primary, download_count)
        VALUES
          ('SohamYoga Primary Logo', 'logo', '/assets/brand/logo-primary.svg', '/assets/brand/logo-primary-thumb.png', 'SVG', '500x150', 42000, ARRAY['logo','primary','horizontal'], 'Use on white or light backgrounds only. Minimum size 120px wide.', '2.1', true, 87),
          ('SohamYoga Icon Mark', 'logo', '/assets/brand/icon-mark.svg', '/assets/brand/icon-mark-thumb.png', 'SVG', '200x200', 18000, ARRAY['logo','icon','square'], 'For favicon, app icons, and small placements.', '2.1', false, 43),
          ('Primary Blue', 'color', null, null, 'HEX', null, null, ARRAY['primary','blue','corporate'], 'Primary brand color. Use for headlines, CTAs, and key UI elements. Hex: #4A90D9', '1.0', true, 0),
          ('Accent Orange', 'color', null, null, 'HEX', null, null, ARRAY['accent','orange','highlight'], 'Accent color for highlights and calls to action. Hex: #F5A623', '1.0', false, 0),
          ('Deep Teal', 'color', null, null, 'HEX', null, null, ARRAY['secondary','teal','calm'], 'Secondary brand color for backgrounds and gradients. Hex: #1ABC9C', '1.0', false, 0),
          ('Charcoal Dark', 'color', null, null, 'HEX', null, null, ARRAY['text','dark','neutral'], 'Primary text color. Hex: #2C3E50', '1.0', true, 0),
          ('Poppins Bold', 'font', '/assets/fonts/Poppins-Bold.ttf', null, 'TTF', null, 180000, ARRAY['heading','bold','modern'], 'Use for headings, banners, and display text. Do not use below 14px.', '1.0', true, 34),
          ('Open Sans Regular', 'font', '/assets/fonts/OpenSans-Regular.ttf', null, 'TTF', null, 210000, ARRAY['body','regular','readable'], 'Primary body font. Use for all body copy, captions, and UI text.', '1.0', true, 29),
          ('Instagram Post Template', 'template', '/assets/templates/instagram-post-v3.canva', '/assets/templates/instagram-post-thumb.png', 'Canva', '1080x1080', null, ARRAY['instagram','social','post'], 'Approved template. Replace placeholder text and images only.', '3.0', false, 156),
          ('Hero Photo — Yoga Studio', 'photo', '/assets/photos/studio-hero.jpg', '/assets/photos/studio-hero-thumb.jpg', 'JPG', '3840x2160', 8500000, ARRAY['studio','hero','lifestyle'], 'Licensed for all digital and print use. Do not crop faces.', '1.0', false, 72),
          ('Meditation Illustration Set', 'illustration', '/assets/illustrations/meditation-set.zip', '/assets/illustrations/meditation-thumb.png', 'PNG', '2000x2000', 4200000, ARRAY['illustration','meditation','wellness'], 'Vector illustrations. Can be recolored to brand palette.', '1.0', false, 48),
          ('Podcast/YouTube Intro Jingle', 'audio', '/assets/audio/brand-jingle.mp3', null, 'MP3', null, 3100000, ARRAY['audio','jingle','brand'], '8-second brand jingle. Use at start of all video/audio content.', '1.0', false, 19)
        ON CONFLICT DO NOTHING;
      `);
    }

    // Seed design_templates
    const tplCount = await client.query(`SELECT COUNT(*) FROM design_templates`);
    if (parseInt(tplCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO design_templates (name, category, platform, dimensions, canva_url, figma_url, description, tags, use_count)
        VALUES
          ('Instagram Square Post', 'social', 'instagram', '1080x1080', 'https://www.canva.com/design/template/instagram-square', null, 'Clean minimal Instagram post template with brand colors', ARRAY['instagram','square','minimal'], 45),
          ('Instagram Story Reel', 'social', 'instagram', '1080x1920', 'https://www.canva.com/design/template/instagram-story', null, 'Vertical story/reel with animated text overlay', ARRAY['instagram','story','reel','vertical'], 38),
          ('Facebook Ad Banner', 'ads', 'facebook', '1200x628', 'https://www.canva.com/design/template/facebook-ad', null, 'High-converting Facebook/Instagram feed ad template', ARRAY['facebook','ad','banner'], 29),
          ('LinkedIn Company Post', 'social', 'linkedin', '1200x627', 'https://www.canva.com/design/template/linkedin-post', 'https://figma.com/template/linkedin-post', 'Professional LinkedIn post for thought leadership', ARRAY['linkedin','professional','thought-leadership'], 22),
          ('Email Newsletter Header', 'email', 'web', '600x200', 'https://www.canva.com/design/template/email-header', null, 'Branded email header for campaigns and newsletters', ARRAY['email','newsletter','header'], 61),
          ('Tri-fold Brochure', 'print', 'print', 'A4 Trifold', 'https://www.canva.com/design/template/trifold-brochure', null, 'Professional tri-fold brochure for studio marketing', ARRAY['print','brochure','trifold'], 14),
          ('Business Presentation Deck', 'presentation', 'web', '1920x1080', 'https://www.canva.com/design/template/presentation', 'https://figma.com/template/presentation', '20-slide presentation template for client pitches', ARRAY['presentation','pitch','slides'], 18),
          ('Google Display 300x250', 'ads', 'web', '300x250', 'https://www.canva.com/design/template/google-display-300', null, 'Medium rectangle banner for Google Display Network', ARRAY['google','display','banner','300x250'], 33),
          ('YouTube Channel Art', 'social', 'youtube', '2560x1440', 'https://www.canva.com/design/template/youtube-art', null, 'YouTube channel banner with brand elements', ARRAY['youtube','channel','banner'], 11),
          ('Business Card Standard', 'print', 'print', '1050x600', 'https://www.canva.com/design/template/business-card', 'https://figma.com/template/business-card', 'Standard business card 3.5x2 at 300dpi', ARRAY['print','business-card','professional'], 27)
        ON CONFLICT DO NOTHING;
      `);
    }

    // Seed employee_advocacy_posts
    const advocacyCount = await client.query(`SELECT COUNT(*) FROM employee_advocacy_posts`);
    if (parseInt(advocacyCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO employee_advocacy_posts (title, content, platform, suggested_caption, hashtags, status, shared_count, reach)
        VALUES
          ('Why I Practice Yoga Daily', 'Three years ago I was burning out from back-to-back meetings and deadlines. Yoga gave me back my focus and energy. At SohamYoga, we build tools that help wellness businesses grow — and remind ourselves daily why that work matters.', 'linkedin', 'Burnout is real. Yoga helped me. Here is what I learned. 🧘', ARRAY['#YogaLife','#MindfulBusiness','#WellnessAtWork','#SohamYoga'], 'approved', 12, 1840),
          ('5 Yoga Poses for Remote Workers', 'If you spend 8+ hours at a desk, your body is paying a price. Here are 5 yoga poses that have genuinely changed my posture and energy levels. No mat required, just 10 minutes.', 'linkedin', '5 poses that changed my work-from-home life. No studio needed.', ARRAY['#RemoteWork','#YogaForDesk','#WorkWellness','#SohamYoga'], 'approved', 8, 1120),
          ('The Business Case for Mindfulness', 'Companies investing in employee wellness see 25% lower absenteeism and 20% higher productivity. At SohamYoga we are on a mission to make these results accessible for every team, not just Fortune 500s.', 'linkedin', 'Mindfulness is not soft — it is strategy. The numbers prove it.', ARRAY['#Mindfulness','#BusinessStrategy','#EmployeeWellness','#HRLeaders'], 'draft', 0, 0),
          ('Behind the Scenes: How We Build Our Platform', 'Building a marketing platform for yoga studios is not what I imagined doing in tech — but it is the most purpose-driven work of my career. Here is a quick look at what goes into every feature we ship.', 'linkedin', 'Purpose-driven product development. A behind-the-scenes look.', ARRAY['#ProductDevelopment','#StartupLife','#MarTech','#SohamYoga'], 'approved', 5, 670),
          ('Celebrating Our Community Partners', 'This month we partnered with 3 new yoga studios in Toronto, Vancouver, and Calgary. Every partnership is a reminder that real community is built one relationship at a time. Grateful for the journey.', 'linkedin', 'Growing community, one studio at a time. Grateful. 🙏', ARRAY['#CommunityFirst','#YogaStudios','#Canada','#SohamYoga','#PartnerSpotlight'], 'draft', 0, 0)
        ON CONFLICT DO NOTHING;
      `);
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

  const [briefs, assets, templates, advocacy] = await Promise.all([
    pool.query(`SELECT * FROM design_briefs ORDER BY created_at DESC`),
    pool.query(`SELECT * FROM brand_assets ORDER BY is_primary DESC, created_at DESC`),
    pool.query(`SELECT * FROM design_templates ORDER BY use_count DESC`),
    pool.query(`SELECT * FROM employee_advocacy_posts ORDER BY created_at DESC`),
  ]);

  const statusCounts = await pool.query(
    `SELECT status, COUNT(*) FROM design_briefs GROUP BY status`
  );
  const statusMap: Record<string, number> = {};
  for (const r of statusCounts.rows) statusMap[r.status] = parseInt(r.count);

  const today = new Date().toISOString().split('T')[0];
  const overdueBriefs = briefs.rows.filter(
    b => b.deadline && b.deadline < today && b.status !== 'delivered'
  );

  return Response.json({
    briefs: briefs.rows,
    assets: assets.rows,
    templates: templates.rows,
    advocacy: advocacy.rows,
    stats: {
      activeBriefs: (statusMap['in_design'] || 0) + (statusMap['briefed'] || 0),
      awaitingReview: statusMap['review'] || 0,
      brandAssets: assets.rowCount,
      templates: templates.rowCount,
      advocacyPosts: advocacy.rowCount,
      thisMonthDesigns: statusMap['delivered'] || 0,
      statusCounts: statusMap,
      overdueBriefs: overdueBriefs.length,
    },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  await ensureTables();
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.title !== 'string' || !body.title.trim()) {
    return Response.json({ error: 'title is required.' }, { status: 400 });
  }

  const result = await getPool().query(
    `INSERT INTO design_briefs
      (title, project_type, brand_name, target_audience, key_message, mood_tone,
       color_palette, fonts_preferred, dimensions, platform, examples_urls,
       deliverables, deadline, budget_cad, status, assigned_to, canva_template_url, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING *`,
    [
      body.title, body.project_type || 'social_post', body.brand_name || null,
      body.target_audience || null, body.key_message || null, body.mood_tone || null,
      body.color_palette || null, body.fonts_preferred || null, body.dimensions || null,
      body.platform || null, body.examples_urls || null, body.deliverables || null,
      body.deadline || null, body.budget_cad || null, body.status || 'draft',
      body.assigned_to || null, body.canva_template_url || null, body.notes || null,
    ]
  );

  return Response.json({ ok: true, brief: result.rows[0] }, { status: 201 });
}
