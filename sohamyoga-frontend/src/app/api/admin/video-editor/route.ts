import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS video_projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      project_type TEXT DEFAULT 'reel',
      platform TEXT[] DEFAULT ARRAY['instagram'],
      status TEXT DEFAULT 'draft',
      source_video_url TEXT,
      output_video_url TEXT,
      thumbnail_url TEXT,
      duration_seconds INT,
      aspect_ratio TEXT DEFAULT '9:16',
      resolution TEXT DEFAULT '1080x1920',
      transcript_text TEXT,
      script_text TEXT,
      ai_script TEXT,
      music_track TEXT,
      voice_over_url TEXT,
      tags TEXT[],
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS video_clips (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID REFERENCES video_projects(id) ON DELETE CASCADE,
      clip_url TEXT,
      clip_name TEXT,
      start_time NUMERIC(10,3) DEFAULT 0,
      end_time NUMERIC(10,3),
      duration NUMERIC(10,3),
      order_index INT DEFAULT 0,
      text_overlay TEXT,
      text_position TEXT DEFAULT 'bottom',
      text_style TEXT DEFAULT 'white_shadow',
      filter_name TEXT,
      volume NUMERIC(4,2) DEFAULT 1.0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS video_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      category TEXT,
      platform TEXT,
      aspect_ratio TEXT,
      duration_seconds INT,
      description TEXT,
      thumbnail_url TEXT,
      use_count INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function seedData(): Promise<void> {
  const pool = getPool();
  const { rows: existing } = await pool.query(`SELECT COUNT(*)::int AS c FROM video_projects`);
  if (existing[0].c > 0) return;

  await pool.query(`
    INSERT INTO video_projects (title, description, project_type, platform, status, duration_seconds, aspect_ratio, resolution, music_track, tags) VALUES
    ('Yoga Morning Flow Reel', 'Sun salutation sequence for IG reels', 'reel', ARRAY['instagram','tiktok'], 'ready', 30, '9:16', '1080x1920', 'Energetic Pop', ARRAY['yoga','morning','wellness']),
    ('Meditation Guide Short', '5-min guided meditation for YouTube', 'short', ARRAY['youtube'], 'editing', 60, '9:16', '1080x1920', 'Calm Acoustic', ARRAY['meditation','mindfulness','calm']),
    ('Studio Behind the Scenes', 'BTS at Soham Yoga studio', 'story', ARRAY['instagram','facebook'], 'draft', 15, '9:16', '1080x1920', NULL, ARRAY['bts','studio','community']),
    ('Promo - Monthly Membership', 'Promotional ad for memberships', 'ad', ARRAY['instagram','facebook','linkedin'], 'posted', 30, '1:1', '1080x1080', 'Corporate', ARRAY['promo','membership','offer']),
    ('Breathwork Tutorial', 'Pranayama breathing techniques course clip', 'course', ARRAY['youtube','linkedin'], 'rendering', 90, '16:9', '1920x1080', 'Cinematic', ARRAY['breathwork','pranayama','tutorial'])
    ON CONFLICT DO NOTHING;
  `);

  const { rows: proj } = await pool.query(`SELECT id FROM video_projects LIMIT 1`);
  if (proj.length > 0) {
    const pid = proj[0].id;
    await pool.query(`
      INSERT INTO video_clips (project_id, clip_name, start_time, end_time, duration, order_index, text_overlay, text_position, filter_name, volume) VALUES
      ($1, 'Opening Hook', 0, 3, 3, 0, 'Start Your Day Right', 'top', 'warm', 1.0),
      ($1, 'Main Sequence', 3, 25, 22, 1, 'Follow Along', 'bottom', 'none', 0.8),
      ($1, 'CTA Outro', 25, 30, 5, 2, 'Follow for daily yoga!', 'bottom', 'bright', 1.0)
      ON CONFLICT DO NOTHING;
    `, [pid]);
  }

  await pool.query(`
    INSERT INTO video_templates (name, category, platform, aspect_ratio, duration_seconds, description, use_count) VALUES
    ('Quick Product Showcase', 'product_showcase', 'instagram', '9:16', 30, 'Hook → product demo → CTA in 30s', 47),
    ('Client Testimonial', 'testimonial', 'instagram', '9:16', 60, 'Story arc: problem → solution → result', 32),
    ('Step-by-Step How-To', 'how_to', 'youtube', '9:16', 90, 'Numbered steps with text overlays', 89),
    ('Event Announcement', 'announcement', 'instagram', '9:16', 15, 'Bold text reveal with countdown', 21),
    ('BTS Day in My Life', 'behind_scenes', 'tiktok', '9:16', 60, 'Casual clips with trending audio', 64),
    ('Trending Hook Template', 'how_to', 'tiktok', '9:16', 15, 'Pattern interrupt open + fast pacing', 112),
    ('Educational Carousel', 'how_to', 'linkedin', '1:1', 60, '5-point lesson with clean typography', 38),
    ('Flash Sale Promo', 'announcement', 'instagram', '9:16', 30, 'Urgency-driven promo with timer visual', 55)
    ON CONFLICT DO NOTHING;
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    await seedData();
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const resource = searchParams.get('resource') || 'projects';
    const status = searchParams.get('status') || '';
    const type = searchParams.get('type') || '';
    const platform = searchParams.get('platform') || '';

    if (resource === 'templates') {
      const { rows } = await pool.query(`SELECT * FROM video_templates ORDER BY use_count DESC`);
      return Response.json({ templates: rows });
    }

    if (resource === 'clips') {
      const projectId = searchParams.get('project_id') || '';
      if (!projectId) return Response.json({ clips: [] });
      const { rows } = await pool.query(
        `SELECT * FROM video_clips WHERE project_id=$1 ORDER BY order_index ASC`,
        [projectId]
      );
      return Response.json({ clips: rows });
    }

    let q2 = `SELECT * FROM video_projects WHERE 1=1`;
    const p2: string[] = [];
    if (status) { p2.push(status); q2 += ` AND status=$${p2.length}`; }
    if (type) { p2.push(type); q2 += ` AND project_type=$${p2.length}`; }
    if (platform) { p2.push(platform); q2 += ` AND $${p2.length}=ANY(platform)`; }
    q2 += ` ORDER BY updated_at DESC`;

    const { rows: projects } = await pool.query(q2, p2);
    const { rows: stats } = await pool.query(`
      SELECT status, COUNT(*)::int AS count FROM video_projects GROUP BY status
    `);
    return Response.json({ projects, stats });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const pool = getPool();
    const body = await req.json() as {
      resource?: string;
      title?: string;
      description?: string;
      project_type?: string;
      platform?: string[];
      aspect_ratio?: string;
      resolution?: string;
      tags?: string[];
      // template fields
      name?: string;
      category?: string;
      duration_seconds?: number;
      // clip fields
      project_id?: string;
      clip_name?: string;
      order_index?: number;
    };

    if (body.resource === 'template') {
      const { rows } = await pool.query(`
        INSERT INTO video_templates (name, category, platform, aspect_ratio, duration_seconds, description)
        VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
      `, [body.name || 'Untitled Template', body.category || 'how_to', body.platform || 'instagram',
          body.aspect_ratio || '9:16', body.duration_seconds || 30, body.description || '']);
      return Response.json({ template: rows[0] }, { status: 201 });
    }

    if (body.resource === 'clip') {
      const { rows } = await pool.query(`
        INSERT INTO video_clips (project_id, clip_name, order_index)
        VALUES ($1,$2,$3) RETURNING *
      `, [body.project_id, body.clip_name || 'New Clip', body.order_index ?? 0]);
      return Response.json({ clip: rows[0] }, { status: 201 });
    }

    const { rows } = await pool.query(`
      INSERT INTO video_projects (title, description, project_type, platform, aspect_ratio, resolution, tags)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [
      body.title || 'Untitled Project',
      body.description || '',
      body.project_type || 'reel',
      body.platform || ['instagram'],
      body.aspect_ratio || '9:16',
      body.resolution || '1080x1920',
      body.tags || [],
    ]);
    return Response.json({ project: rows[0] }, { status: 201 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
