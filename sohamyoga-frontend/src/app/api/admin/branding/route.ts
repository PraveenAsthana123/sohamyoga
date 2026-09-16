import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

import { requireAdmin } from '@/lib/admin-auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS brand_asset (
      id SERIAL PRIMARY KEY,
      asset_type VARCHAR(30),
      name VARCHAR(200),
      file_url VARCHAR(500),
      hex_color VARCHAR(10),
      font_family VARCHAR(100),
      usage_notes TEXT,
      is_primary BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS brand_guideline (
      id SERIAL PRIMARY KEY,
      section VARCHAR(50),
      title VARCHAR(200),
      content TEXT,
      do_examples TEXT,
      dont_examples TEXT,
      version INT DEFAULT 1,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS brand_mention (
      id SERIAL PRIMARY KEY,
      platform VARCHAR(50),
      mention_url VARCHAR(500),
      mention_text TEXT,
      sentiment VARCHAR(20),
      reach_estimate INT,
      author VARCHAR(200),
      mentioned_at TIMESTAMPTZ,
      reviewed BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS brand_score_history (
      id SERIAL PRIMARY KEY,
      consistency INT DEFAULT 0,
      clarity INT DEFAULT 0,
      differentiation INT DEFAULT 0,
      emotional_appeal INT DEFAULT 0,
      market_fit INT DEFAULT 0,
      digital_presence INT DEFAULT 0,
      notes TEXT,
      recorded_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS brand_competitor (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200),
      brand_colors VARCHAR(200),
      tone VARCHAR(100),
      positioning TEXT,
      target_audience VARCHAR(200),
      differentiator TEXT,
      threat_level VARCHAR(20),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS brand_voice_sample (
      id SERIAL PRIMARY KEY,
      category VARCHAR(50),
      label VARCHAR(200),
      content TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTables();
  const { searchParams } = new URL(req.url);
  const section = searchParams.get('section');

  if (section === 'assets') {
    const type = searchParams.get('type') || '';
    const q = type
      ? `SELECT * FROM brand_asset WHERE asset_type=$1 ORDER BY is_primary DESC, created_at DESC`
      : `SELECT * FROM brand_asset ORDER BY is_primary DESC, created_at DESC`;
    const result = type ? await pool.query(q, [type]) : await pool.query(q);
    return Response.json({ assets: result.rows });
  }

  if (section === 'guidelines') {
    const result = await pool.query(`SELECT * FROM brand_guideline ORDER BY section, id`);
    return Response.json({ guidelines: result.rows });
  }

  if (section === 'mentions') {
    const result = await pool.query(`SELECT * FROM brand_mention ORDER BY mentioned_at DESC LIMIT 100`);
    return Response.json({ mentions: result.rows });
  }

  if (section === 'scores') {
    const result = await pool.query(`SELECT * FROM brand_score_history ORDER BY recorded_at DESC LIMIT 6`);
    return Response.json({ scores: result.rows });
  }

  if (section === 'competitors') {
    const result = await pool.query(`SELECT * FROM brand_competitor ORDER BY created_at DESC`);
    return Response.json({ competitors: result.rows });
  }

  if (section === 'voice-samples') {
    const result = await pool.query(`SELECT * FROM brand_voice_sample ORDER BY category, id`);
    return Response.json({ samples: result.rows });
  }

  // Default: return all summary
  const [assets, guidelines, mentions, scores, competitors] = await Promise.all([
    pool.query(`SELECT * FROM brand_asset ORDER BY is_primary DESC, created_at DESC`),
    pool.query(`SELECT * FROM brand_guideline ORDER BY section`),
    pool.query(`SELECT * FROM brand_mention ORDER BY mentioned_at DESC LIMIT 20`),
    pool.query(`SELECT * FROM brand_score_history ORDER BY recorded_at DESC LIMIT 6`),
    pool.query(`SELECT * FROM brand_competitor ORDER BY created_at DESC`),
  ]);

  return Response.json({
    assets: assets.rows,
    guidelines: guidelines.rows,
    mentions: mentions.rows,
    scores: scores.rows,
    competitors: competitors.rows,
  });
}

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTables();
  const body = await req.json() as Record<string, unknown>;
  const { type } = body as { type?: string };

  if (type === 'asset') {
    const { asset_type, name, file_url, hex_color, font_family, usage_notes, is_primary } =
      body as {
        asset_type?: string; name?: string; file_url?: string; hex_color?: string;
        font_family?: string; usage_notes?: string; is_primary?: boolean;
      };
    const result = await pool.query(
      `INSERT INTO brand_asset (asset_type, name, file_url, hex_color, font_family, usage_notes, is_primary)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [asset_type, name, file_url, hex_color, font_family, usage_notes, is_primary ?? false],
    );
    return Response.json({ asset: result.rows[0] });
  }

  if (type === 'guideline') {
    const { section, title, content, do_examples, dont_examples } = body as {
      section?: string; title?: string; content?: string; do_examples?: string; dont_examples?: string;
    };
    const result = await pool.query(
      `INSERT INTO brand_guideline (section, title, content, do_examples, dont_examples)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [section, title, content, do_examples, dont_examples],
    );
    return Response.json({ guideline: result.rows[0] });
  }

  if (type === 'mention') {
    const { platform, mention_url, mention_text, sentiment, reach_estimate, author, mentioned_at } = body as {
      platform?: string; mention_url?: string; mention_text?: string; sentiment?: string;
      reach_estimate?: number; author?: string; mentioned_at?: string;
    };
    const result = await pool.query(
      `INSERT INTO brand_mention (platform, mention_url, mention_text, sentiment, reach_estimate, author, mentioned_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [platform, mention_url, mention_text, sentiment, reach_estimate, author, mentioned_at || new Date().toISOString()],
    );
    return Response.json({ mention: result.rows[0] });
  }

  if (type === 'score') {
    const { consistency, clarity, differentiation, emotional_appeal, market_fit, digital_presence, notes } = body as {
      consistency?: number; clarity?: number; differentiation?: number;
      emotional_appeal?: number; market_fit?: number; digital_presence?: number; notes?: string;
    };
    const result = await pool.query(
      `INSERT INTO brand_score_history (consistency, clarity, differentiation, emotional_appeal, market_fit, digital_presence, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [consistency ?? 5, clarity ?? 5, differentiation ?? 5, emotional_appeal ?? 5, market_fit ?? 5, digital_presence ?? 5, notes],
    );
    return Response.json({ score: result.rows[0] });
  }

  if (type === 'competitor') {
    const { name, brand_colors, tone, positioning, target_audience, differentiator, threat_level } = body as {
      name?: string; brand_colors?: string; tone?: string; positioning?: string;
      target_audience?: string; differentiator?: string; threat_level?: string;
    };
    const result = await pool.query(
      `INSERT INTO brand_competitor (name, brand_colors, tone, positioning, target_audience, differentiator, threat_level)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, brand_colors, tone, positioning, target_audience, differentiator, threat_level],
    );
    return Response.json({ competitor: result.rows[0] });
  }

  if (type === 'guideline-update') {
    const { id, content, do_examples, dont_examples, title } = body as {
      id?: number; content?: string; do_examples?: string; dont_examples?: string; title?: string;
    };
    const result = await pool.query(
      `UPDATE brand_guideline SET content=$1, do_examples=$2, dont_examples=$3, title=$4, version=version+1, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [content, do_examples, dont_examples, title, id],
    );
    return Response.json({ guideline: result.rows[0] });
  }

  return Response.json({ error: 'Unknown type' }, { status: 400 });
}
