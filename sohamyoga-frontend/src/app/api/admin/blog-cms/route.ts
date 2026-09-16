import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blog_post (
      id SERIAL PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      slug VARCHAR(500) UNIQUE,
      excerpt TEXT,
      content TEXT,
      author VARCHAR(200),
      category VARCHAR(100),
      tags TEXT,
      status VARCHAR(20) DEFAULT 'draft',
      featured_image_url VARCHAR(500),
      seo_title VARCHAR(200),
      seo_description VARCHAR(300),
      seo_keywords TEXT,
      reading_time_minutes INT,
      word_count INT,
      views INT DEFAULT 0,
      shares INT DEFAULT 0,
      ai_generated BOOLEAN DEFAULT false,
      scheduled_at TIMESTAMPTZ,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS blog_category (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE,
      slug VARCHAR(100) UNIQUE,
      description TEXT,
      post_count INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function GET(req: NextRequest) {
  await ensureTables();
  const { searchParams } = new URL(req.url);
  const resource = searchParams.get('resource') || 'posts';
  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';
  const sortBy = searchParams.get('sortBy') || 'created_at';
  const limit = parseInt(searchParams.get('limit') || '100');

  if (resource === 'categories') {
    const result = await pool.query(`
      SELECT c.*, COUNT(p.id)::int AS post_count
      FROM blog_category c
      LEFT JOIN blog_post p ON p.category = c.name
      GROUP BY c.id ORDER BY c.name
    `);
    return NextResponse.json({ categories: result.rows });
  }

  if (resource === 'analytics') {
    const [topPosts, byCategory, weekly] = await Promise.all([
      pool.query(`SELECT id, title, slug, views, shares, status FROM blog_post ORDER BY views DESC LIMIT 10`),
      pool.query(`SELECT category, COUNT(*)::int AS count FROM blog_post GROUP BY category ORDER BY count DESC`),
      pool.query(`
        SELECT DATE_TRUNC('week', created_at)::date AS week, COUNT(*)::int AS posts
        FROM blog_post
        WHERE created_at >= NOW() - INTERVAL '8 weeks'
        GROUP BY week ORDER BY week
      `),
    ]);
    return NextResponse.json({ topPosts: topPosts.rows, byCategory: byCategory.rows, weekly: weekly.rows });
  }

  if (resource === 'seo') {
    const result = await pool.query(`SELECT id, title, slug, seo_title, seo_description, seo_keywords, status FROM blog_post ORDER BY created_at DESC`);
    return NextResponse.json({ posts: result.rows });
  }

  // Posts list
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
  if (search) { conditions.push(`(title ILIKE $${idx} OR excerpt ILIKE $${idx})`); params.push(`%${search}%`); idx++; }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const validSort = ['created_at', 'views', 'title', 'updated_at'].includes(sortBy) ? sortBy : 'created_at';
  const result = await pool.query(
    `SELECT * FROM blog_post ${where} ORDER BY ${validSort} DESC LIMIT $${idx}`,
    [...params, limit],
  );

  // KPIs
  const kpi = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status='published')::int AS published,
      COUNT(*) FILTER (WHERE status='draft')::int AS draft,
      COUNT(*) FILTER (WHERE status='scheduled')::int AS scheduled,
      COALESCE(SUM(views),0)::int AS total_views
    FROM blog_post
  `);

  return NextResponse.json({ posts: result.rows, kpi: kpi.rows[0] });
}

export async function POST(req: NextRequest) {
  await ensureTables();
  const body = await req.json() as Record<string, unknown>;
  const { action } = body as { action?: string };

  if (action === 'create-category') {
    const { name, slug, description } = body as { name?: string; slug?: string; description?: string };
    const result = await pool.query(
      `INSERT INTO blog_category (name, slug, description) VALUES ($1,$2,$3) ON CONFLICT (name) DO UPDATE SET description=$3 RETURNING *`,
      [name, slug || name?.toLowerCase().replace(/\s+/g, '-'), description],
    );
    return NextResponse.json({ category: result.rows[0] });
  }

  if (action === 'delete-category') {
    const { id } = body as { id?: number };
    await pool.query(`DELETE FROM blog_category WHERE id=$1`, [id]);
    return NextResponse.json({ deleted: true });
  }

  // Create/update post
  const {
    id, title, slug, excerpt, content, author, category, tags, status,
    featured_image_url, seo_title, seo_description, seo_keywords,
    scheduled_at, ai_generated,
  } = body as {
    id?: number; title?: string; slug?: string; excerpt?: string; content?: string;
    author?: string; category?: string; tags?: string; status?: string;
    featured_image_url?: string; seo_title?: string; seo_description?: string;
    seo_keywords?: string; scheduled_at?: string; ai_generated?: boolean;
  };

  const wordCount = content ? content.trim().split(/\s+/).length : 0;
  const readingTime = Math.max(1, Math.round(wordCount / 200));
  const autoSlug = slug || title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || '';
  const publishedAt = status === 'published' ? new Date().toISOString() : null;

  if (id) {
    const result = await pool.query(
      `UPDATE blog_post SET title=$1, slug=$2, excerpt=$3, content=$4, author=$5, category=$6, tags=$7,
       status=$8, featured_image_url=$9, seo_title=$10, seo_description=$11, seo_keywords=$12,
       reading_time_minutes=$13, word_count=$14, ai_generated=$15, scheduled_at=$16,
       published_at=COALESCE($17, published_at), updated_at=NOW()
       WHERE id=$18 RETURNING *`,
      [title, autoSlug, excerpt, content, author, category, tags, status, featured_image_url,
       seo_title, seo_description, seo_keywords, readingTime, wordCount, ai_generated ?? false,
       scheduled_at || null, publishedAt, id],
    );
    return NextResponse.json({ post: result.rows[0] });
  }

  const result = await pool.query(
    `INSERT INTO blog_post (title, slug, excerpt, content, author, category, tags, status,
     featured_image_url, seo_title, seo_description, seo_keywords, reading_time_minutes, word_count,
     ai_generated, scheduled_at, published_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
    [title, autoSlug, excerpt, content, author, category, tags, status || 'draft', featured_image_url,
     seo_title, seo_description, seo_keywords, readingTime, wordCount, ai_generated ?? false,
     scheduled_at || null, publishedAt],
  );
  return NextResponse.json({ post: result.rows[0] });
}

export async function DELETE(req: NextRequest) {
  await ensureTables();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await pool.query(`DELETE FROM blog_post WHERE id=$1`, [parseInt(id)]);
  return NextResponse.json({ deleted: true });
}
