import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS course_productions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      subtitle TEXT,
      description TEXT,
      target_audience TEXT,
      learning_objectives TEXT[],
      prerequisites TEXT[],
      category TEXT,
      level TEXT DEFAULT 'beginner',
      language TEXT DEFAULT 'en',
      status TEXT DEFAULT 'planning',
      thumbnail_url TEXT,
      promo_video_url TEXT,
      total_duration_minutes INT DEFAULT 0,
      total_lessons INT DEFAULT 0,
      price_cad NUMERIC(10,2),
      is_free BOOLEAN DEFAULT false,
      tags TEXT[],
      seo_title TEXT,
      seo_description TEXT,
      enrollment_count INT DEFAULT 0,
      rating NUMERIC(3,2),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS course_sections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id UUID REFERENCES course_productions(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      order_index INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS course_lessons (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      section_id UUID REFERENCES course_sections(id) ON DELETE CASCADE,
      course_id UUID REFERENCES course_productions(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      lesson_type TEXT DEFAULT 'video',
      duration_minutes INT,
      video_url TEXT,
      video_type TEXT DEFAULT 'short',
      script_text TEXT,
      ai_script TEXT,
      hook_text TEXT,
      key_points TEXT[],
      summary_text TEXT,
      captions_srt TEXT,
      thumbnail_url TEXT,
      tags TEXT[],
      labels TEXT[],
      sound_track TEXT,
      status TEXT DEFAULT 'planned',
      order_index INT DEFAULT 0,
      is_free_preview BOOLEAN DEFAULT false,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS course_assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id UUID REFERENCES course_productions(id),
      lesson_id UUID REFERENCES course_lessons(id),
      asset_type TEXT,
      asset_name TEXT,
      asset_url TEXT,
      file_size_bytes BIGINT,
      duration_seconds INT,
      status TEXT DEFAULT 'raw',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS course_quizzes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lesson_id UUID REFERENCES course_lessons(id),
      question TEXT NOT NULL,
      options TEXT[] NOT NULL,
      correct_index INT NOT NULL,
      explanation TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function seedData(): Promise<void> {
  const pool = getPool();
  const { rows: existing } = await pool.query(`SELECT COUNT(*)::int AS c FROM course_productions`);
  if (existing[0].c > 0) return;

  // Insert 3 courses
  const { rows: courses } = await pool.query(`
    INSERT INTO course_productions
      (title, subtitle, description, target_audience, learning_objectives, prerequisites,
       category, level, language, status, price_cad, is_free, tags, seo_title, seo_description,
       enrollment_count, rating, total_duration_minutes, total_lessons)
    VALUES
      (
        'Yoga for Beginners: Foundation & Flow',
        'Build strength, flexibility, and mindfulness from day one',
        'A complete beginner-friendly yoga program covering fundamental poses, breathing techniques, and mindfulness practices. 30 structured lessons take you from zero experience to confident practitioner.',
        'Absolute beginners, office workers, anyone seeking stress relief',
        ARRAY['Master 20+ foundational yoga poses', 'Build a daily 20-minute practice', 'Learn pranayama breathing basics', 'Reduce stress and improve flexibility'],
        ARRAY['No prior experience needed', 'A yoga mat', 'Comfortable clothing'],
        'yoga', 'beginner', 'en', 'published', 39.99, false,
        ARRAY['yoga','beginners','wellness','mindfulness','flexibility'],
        'Yoga for Beginners – Online Course | SohamYoga',
        'Start your yoga journey with this structured 30-lesson beginner course. Build strength, flexibility & mindfulness from day one.',
        247, 4.72, 285, 9
      ),
      (
        'Digital Marketing Masterclass',
        'From strategy to execution — dominate every channel',
        'A comprehensive digital marketing course covering SEO, paid ads, social media, email marketing, and analytics. Built for entrepreneurs and marketing professionals who want measurable results.',
        'Entrepreneurs, small business owners, marketing managers, freelancers',
        ARRAY['Build a complete digital marketing strategy', 'Run profitable Google and Meta ad campaigns', 'Master SEO and content marketing', 'Automate email funnels that convert', 'Measure ROI with GA4 and dashboards'],
        ARRAY['Basic computer skills', 'A business or project to market', 'Google Analytics account (free)'],
        'digital_marketing', 'intermediate', 'en', 'recording', 129.00, false,
        ARRAY['digital-marketing','seo','ads','email','social-media','analytics'],
        'Digital Marketing Masterclass – Complete Course | SohamYoga',
        'Master SEO, paid ads, social media & email marketing in one comprehensive course. 40+ lessons with real campaign examples.',
        89, 4.85, 420, 12
      ),
      (
        'Business Growth Strategies for Wellness Studios',
        'Scale your studio from survival to thriving enterprise',
        'A practical business course tailored for yoga studios, fitness centers, and wellness businesses. Covers pricing, marketing, staff management, retention, and scaling strategies used by top studios.',
        'Yoga studio owners, wellness entrepreneurs, fitness coaches',
        ARRAY['Price your services for profitability', 'Build a retention system that keeps members for 12+ months', 'Hire and train great instructors', 'Create passive income streams', 'Use data to make growth decisions'],
        ARRAY['Running or planning a wellness business', 'Basic marketing understanding'],
        'business', 'advanced', 'en', 'scripting', 89.00, false,
        ARRAY['business','studio-growth','wellness','entrepreneurship','retention'],
        'Business Growth Strategies for Wellness Studios | SohamYoga',
        'Scale your yoga studio with proven business strategies. Pricing, retention, staffing, and growth systems in one advanced course.',
        34, 4.91, 360, 9
      )
    RETURNING id, title;
  `);

  const [yogaCourse, dmCourse, bizCourse] = courses;

  // Sections for Yoga course
  const { rows: yogaSections } = await pool.query(`
    INSERT INTO course_sections (course_id, title, description, order_index) VALUES
      ($1, 'Getting Started', 'Setting up your practice space and mindset', 0),
      ($1, 'Foundation Poses', 'Core postures every yogi must know', 1),
      ($1, 'Breathing & Mindfulness', 'Pranayama and meditation fundamentals', 2)
    RETURNING id;
  `, [yogaCourse.id]);

  // Sections for DM course
  const { rows: dmSections } = await pool.query(`
    INSERT INTO course_sections (course_id, title, description, order_index) VALUES
      ($1, 'Strategy & Research', 'Building your digital marketing foundation', 0),
      ($1, 'Paid Advertising', 'Google Ads, Meta Ads, and beyond', 1),
      ($1, 'SEO & Content', 'Organic growth through search and content', 2)
    RETURNING id;
  `, [dmCourse.id]);

  // Sections for Business course
  const { rows: bizSections } = await pool.query(`
    INSERT INTO course_sections (course_id, title, description, order_index) VALUES
      ($1, 'Business Fundamentals', 'Pricing, positioning, and financial basics', 0),
      ($1, 'Member Retention System', 'Keeping students engaged and renewing', 1),
      ($1, 'Scaling Operations', 'Hiring, systems, and multiple revenue streams', 2)
    RETURNING id;
  `, [bizCourse.id]);

  // Lessons for Yoga sections
  await pool.query(`
    INSERT INTO course_lessons
      (section_id, course_id, title, lesson_type, duration_minutes, video_type, status,
       labels, tags, order_index, is_free_preview, hook_text, key_points, sound_track)
    VALUES
      ($1, $4, 'Welcome to Your Yoga Journey', 'video', 1, 'short', 'published',
       ARRAY['intro'], ARRAY['welcome','intro','yoga'], 0, true,
       'What if 10 minutes a day could completely change your relationship with your body? Today, we start that journey.',
       ARRAY['What to expect from this course', 'Setting intentions', 'Creating your space'],
       'Calm'),
      ($1, $4, 'Setting Up Your Practice Space', 'video', 5, 'short', 'scripted',
       ARRAY['theory','demo'], ARRAY['setup','equipment','mat'], 1, false,
       'Your environment shapes your practice — let me show you the perfect setup in under 5 minutes.',
       ARRAY['Mat placement and grip', 'Props you actually need', 'Lighting and temperature tips'],
       'Nature'),
      ($1, $4, 'Understanding Your Body', 'text', 2, 'short', 'published',
       ARRAY['theory'], ARRAY['anatomy','awareness','safety'], 2, false,
       NULL, ARRAY['Listening to your body signals', 'Avoiding common injuries', 'Modifications overview'],
       'Silent'),
      ($2, $4, 'Mountain Pose & Standing Foundations', 'video', 20, 'long', 'recorded',
       ARRAY['theory','demo','exercise'], ARRAY['tadasana','standing','alignment'], 0, false,
       'Every yoga pose begins here — in Mountain Pose, you learn what it means to be truly grounded.',
       ARRAY['Foot placement and weight distribution', 'Spinal alignment cues', 'Breath integration', 'Common corrections'],
       'Nature'),
      ($2, $4, 'Sun Salutation A — Step by Step', 'video', 20, 'long', 'scripted',
       ARRAY['demo','exercise'], ARRAY['surya-namaskar','flow','sequence'], 1, false,
       'The Sun Salutation is the heartbeat of yoga — 12 poses, infinite benefits, and we break it all down today.',
       ARRAY['Each of the 12 positions', 'Breath-movement synchronization', 'Modifications for beginners'],
       'Upbeat'),
      ($2, $4, 'Warrior Series', 'video', 20, 'long', 'planned',
       ARRAY['demo','exercise'], ARRAY['warrior','strength','balance'], 2, false,
       NULL, ARRAY['Warrior I alignment', 'Warrior II transition', 'Building heat safely'],
       'Energetic'),
      ($3, $4, 'Pranayama: The Art of Breath', 'video', 10, 'medium', 'published',
       ARRAY['theory','demo'], ARRAY['pranayama','breathing','energy'], 0, false,
       'You have been breathing your whole life — but have you ever breathed with intention?',
       ARRAY['Three-part breath', 'Box breathing for focus', 'Alternate nostril breathing'],
       'Calm'),
      ($3, $4, 'Guided Body Scan Meditation', 'audio', 20, 'long', 'published',
       ARRAY['exercise'], ARRAY['meditation','relaxation','body-scan'], 1, false,
       NULL, ARRAY['Progressive relaxation', 'Mind-body connection', 'Sleep preparation technique'],
       'Nature'),
      ($3, $4, 'Building Your Daily Practice', 'video', 5, 'short', 'scripted',
       ARRAY['summary'], ARRAY['routine','habit','consistency'], 2, false,
       'Consistency beats perfection every time — here is your 20-minute daily blueprint.',
       ARRAY['Morning vs evening practice', 'Creating accountability', 'Tracking your progress'],
       'Upbeat')
  `, [yogaSections[0].id, yogaSections[1].id, yogaSections[2].id, yogaCourse.id]);

  // Lessons for DM sections
  await pool.query(`
    INSERT INTO course_lessons
      (section_id, course_id, title, lesson_type, duration_minutes, video_type, status,
       labels, tags, order_index, is_free_preview, hook_text, key_points, sound_track)
    VALUES
      ($1, $4, 'The Digital Marketing Landscape 2026', 'video', 20, 'long', 'scripted',
       ARRAY['intro','theory'], ARRAY['overview','trends','channels'], 0, true,
       'The brands winning in 2026 are not spending more — they are spending smarter. Here is the full map.',
       ARRAY['Platform overview and market share', 'Where your customers actually are', 'Budget allocation frameworks'],
       'Professional'),
      ($1, $4, 'Building Your Customer Avatar', 'video', 10, 'medium', 'planned',
       ARRAY['theory','demo'], ARRAY['persona','targeting','research'], 1, false,
       NULL, ARRAY['Demographics vs psychographics', 'Jobs-to-be-done framework', 'Competitive research shortcuts'],
       'Professional'),
      ($1, $4, 'Competitor Analysis Workshop', 'assignment', 1, 'short', 'planned',
       ARRAY['exercise'], ARRAY['research','competitors','strategy'], 2, false,
       NULL, ARRAY['SWOT analysis template', 'Finding competitor keywords', 'Content gap analysis'],
       'Silent'),
      ($2, $4, 'Google Ads: Campaign Architecture', 'video', 20, 'long', 'planned',
       ARRAY['theory','demo'], ARRAY['google-ads','ppc','campaigns'], 0, false,
       NULL, ARRAY['Campaign vs ad group vs ad hierarchy', 'Match types explained', 'Quality Score optimization'],
       'Professional'),
      ($2, $4, 'Meta Ads: Creative That Converts', 'video', 20, 'long', 'planned',
       ARRAY['demo','exercise'], ARRAY['meta-ads','facebook','instagram','creative'], 1, false,
       NULL, ARRAY['Hook formula for paid social', 'A/B testing creative', 'Retargeting strategy'],
       'Upbeat'),
      ($2, $4, 'Building Your First Campaign', 'video', 5, 'short', 'planned',
       ARRAY['demo'], ARRAY['hands-on','setup','launch'], 2, false,
       NULL, ARRAY['Account structure setup', 'Conversion tracking', 'Budget and bidding'],
       'Professional'),
      ($3, $4, 'SEO Fundamentals: How Google Ranks Pages', 'video', 20, 'long', 'planned',
       ARRAY['theory'], ARRAY['seo','ranking','algorithm'], 0, false,
       NULL, ARRAY['On-page vs off-page SEO', 'Core Web Vitals', 'E-E-A-T signals'],
       'Calm'),
      ($3, $4, 'Content Marketing That Ranks', 'video', 20, 'long', 'planned',
       ARRAY['demo','exercise'], ARRAY['content','blogging','seo'], 1, false,
       NULL, ARRAY['Keyword research workflow', 'Content brief template', 'Pillar and cluster strategy'],
       'Professional'),
      ($3, $4, 'Email Marketing Automation Funnels', 'video', 20, 'long', 'planned',
       ARRAY['demo'], ARRAY['email','automation','funnels','nurture'], 2, false,
       NULL, ARRAY['Welcome sequence (5 emails)', 'Segmentation strategy', 'Open rate optimization'],
       'Professional'),
      ($3, $4, 'Analytics & Reporting Dashboard', 'video', 10, 'medium', 'planned',
       ARRAY['demo','summary'], ARRAY['analytics','ga4','reporting','roi'], 3, false,
       NULL, ARRAY['GA4 setup and key reports', 'UTM parameters mastery', 'ROI calculation template'],
       'Professional'),
      ($3, $4, 'Module Quiz: SEO & Content', 'quiz', 1, 'short', 'planned',
       ARRAY['quiz'], ARRAY['quiz','assessment','seo'], 4, false,
       NULL, ARRAY[], 'Silent'),
      ($3, $4, 'Final Project: Full Marketing Plan', 'assignment', 2, 'short', 'planned',
       ARRAY['summary'], ARRAY['project','capstone','strategy'], 5, false,
       NULL, ARRAY['Deliverable: 5-page marketing plan', 'Peer review rubric'], 'Silent')
  `, [dmSections[0].id, dmSections[1].id, dmSections[2].id, dmCourse.id]);

  // Lessons for Business sections
  await pool.query(`
    INSERT INTO course_lessons
      (section_id, course_id, title, lesson_type, duration_minutes, video_type, status,
       labels, tags, order_index, is_free_preview, hook_text, key_points, sound_track)
    VALUES
      ($1, $4, 'The Studio Profitability Formula', 'video', 20, 'long', 'scripted',
       ARRAY['intro','theory'], ARRAY['pricing','revenue','profitability'], 0, true,
       'Most yoga studios fail in year three — not because of passion, but because of math. Let us fix that right now.',
       ARRAY['Break-even analysis', 'Price anchoring strategy', 'Revenue per square foot benchmark'],
       'Professional'),
      ($1, $4, 'Membership Pricing Psychology', 'video', 20, 'long', 'scripted',
       ARRAY['theory','demo'], ARRAY['pricing','psychology','membership'], 1, false,
       'The difference between a $89/month and $149/month membership is not $60 — it is positioning.',
       ARRAY['Value ladder construction', 'Tiered pricing models', 'Introductory offer design'],
       'Professional'),
      ($1, $4, 'Financial Dashboard Setup', 'video', 5, 'short', 'planned',
       ARRAY['demo'], ARRAY['finance','dashboard','metrics'], 2, false,
       NULL, ARRAY['Key metrics to track', 'Monthly review ritual', 'Cash flow forecasting'],
       'Professional'),
      ($2, $4, 'Why Students Leave (And How to Stop It)', 'video', 20, 'long', 'scripted',
       ARRAY['theory'], ARRAY['retention','churn','member-experience'], 0, false,
       'The most expensive thing in your studio is not your rent — it is the member you just lost.',
       ARRAY['The retention triangle: Results, Relationships, Routine', 'Exit interview template', 'Early warning signals'],
       'Professional'),
      ($2, $4, '12-Month Retention Program Blueprint', 'video', 20, 'long', 'planned',
       ARRAY['demo','exercise'], ARRAY['retention','program','loyalty'], 1, false,
       NULL, ARRAY['Monthly touchpoint calendar', 'Milestone recognition program', 'Community event planning'],
       'Professional'),
      ($2, $4, 'Automating Your Retention System', 'video', 10, 'medium', 'planned',
       ARRAY['demo'], ARRAY['automation','crm','retention'], 2, false,
       NULL, ARRAY['CRM setup for studios', 'Automated win-back sequences', 'NPS survey implementation'],
       'Professional'),
      ($3, $4, 'Hiring Your First Instructor', 'video', 20, 'long', 'planned',
       ARRAY['theory','demo'], ARRAY['hiring','staffing','team'], 0, false,
       NULL, ARRAY['Job description template', 'Interview questions that reveal culture fit', 'Trial class evaluation rubric'],
       'Professional'),
      ($3, $4, 'Creating Passive Income Streams', 'video', 20, 'long', 'scripted',
       ARRAY['theory','demo'], ARRAY['passive-income','online','digital-products'], 1, false,
       'Your studio has physical walls — your income does not have to.',
       ARRAY['Online course creation', 'Digital product ideas for studios', 'Affiliate partnerships'],
       'Upbeat'),
      ($3, $4, 'Scaling to Multiple Locations', 'video', 20, 'long', 'planned',
       ARRAY['theory'], ARRAY['scaling','expansion','franchise'], 2, false,
       NULL, ARRAY['Franchise vs corporate model', 'Systemizing your operations', 'Capital requirements planning'],
       'Professional')
  `, [bizSections[0].id, bizSections[1].id, bizSections[2].id, bizCourse.id]);

  // Update total_lessons and total_duration for each course
  await pool.query(`
    UPDATE course_productions SET
      total_lessons = (SELECT COUNT(*) FROM course_lessons WHERE course_id = course_productions.id),
      total_duration_minutes = (SELECT COALESCE(SUM(duration_minutes), 0) FROM course_lessons WHERE course_id = course_productions.id)
    WHERE id IN ($1, $2, $3)
  `, [yogaCourse.id, dmCourse.id, bizCourse.id]);

  // Quizzes for yoga course
  const { rows: yogaLessons } = await pool.query(
    `SELECT id FROM course_lessons WHERE course_id = $1 AND lesson_type != 'quiz' LIMIT 1`,
    [yogaCourse.id]
  );
  if (yogaLessons.length) {
    await pool.query(`
      INSERT INTO course_quizzes (lesson_id, question, options, correct_index, explanation) VALUES
        ($1, 'What is the primary benefit of Mountain Pose (Tadasana)?',
         ARRAY['Flexibility', 'Grounding and alignment awareness', 'Cardiovascular fitness', 'Core strength'],
         1, 'Mountain Pose establishes the alignment template for all standing postures — grounding through the feet while lengthening the spine.'),
        ($1, 'How often should beginners practice yoga?',
         ARRAY['Only on weekends', 'Once a month', '3–5 times per week for 20–45 minutes', 'Every day for 2+ hours'],
         2, 'Consistency at a moderate frequency builds neurological patterns and avoids injury; 3–5 sessions weekly is the evidence-backed sweet spot for beginners.')
    `, [yogaLessons[0].id]);
  }

  // Quizzes for DM course
  const { rows: dmLessons } = await pool.query(
    `SELECT id FROM course_lessons WHERE course_id = $1 AND lesson_type != 'quiz' LIMIT 1`,
    [dmCourse.id]
  );
  if (dmLessons.length) {
    await pool.query(`
      INSERT INTO course_quizzes (lesson_id, question, options, correct_index, explanation) VALUES
        ($1, 'What does a Quality Score in Google Ads measure?',
         ARRAY['The number of clicks your ad received', 'The relevance of your ad to user search intent', 'Your total ad spend', 'The age of your Google Ads account'],
         1, 'Quality Score (1–10) measures ad relevance, expected CTR, and landing page experience. Higher scores lower your CPC.'),
        ($1, 'Which metric best indicates SEO content effectiveness?',
         ARRAY['Bounce rate alone', 'Organic traffic growth and keyword ranking movement', 'Total page views', 'Social shares'],
         1, 'Organic traffic growth combined with keyword ranking movement shows real search visibility improvement — other metrics are context-dependent.')
    `, [dmLessons[0].id]);
  }

  // Quizzes for Business course
  const { rows: bizLessons } = await pool.query(
    `SELECT id FROM course_lessons WHERE course_id = $1 LIMIT 1`,
    [bizCourse.id]
  );
  if (bizLessons.length) {
    await pool.query(`
      INSERT INTO course_quizzes (lesson_id, question, options, correct_index, explanation) VALUES
        ($1, 'What is the primary driver of member churn in wellness studios?',
         ARRAY['Price increases', 'Lack of results, relationships, or routine', 'Facility quality', 'Instructor turnover'],
         1, 'Research consistently shows the retention triangle — Results, Relationships, Routine — accounts for 80%+ of retention outcomes. Price is rarely the #1 reason members leave.'),
        ($1, 'Which pricing model typically yields the highest studio revenue per member?',
         ARRAY['Drop-in class packs', 'Monthly unlimited membership', 'Annual membership with upfront payment', 'Free trial then cancel'],
         2, 'Annual memberships with upfront payment maximize LTV, improve cash flow predictability, and reduce churn probability by 60–70% compared to month-to-month.')
    `, [bizLessons[0].id]);
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    await seedData();
    const pool = getPool();
    const { rows } = await pool.query(`
      SELECT
        cp.*,
        COALESCE(sec.section_count, 0)::int AS section_count,
        COALESCE(les.lesson_count, 0)::int AS lesson_count,
        COALESCE(les.published_lessons, 0)::int AS published_lessons,
        COALESCE(les.total_duration, 0)::int AS computed_duration
      FROM course_productions cp
      LEFT JOIN (
        SELECT course_id, COUNT(*)::int AS section_count
        FROM course_sections GROUP BY course_id
      ) sec ON sec.course_id = cp.id
      LEFT JOIN (
        SELECT course_id,
          COUNT(*)::int AS lesson_count,
          COUNT(*) FILTER (WHERE status = 'published')::int AS published_lessons,
          COALESCE(SUM(duration_minutes), 0)::int AS total_duration
        FROM course_lessons GROUP BY course_id
      ) les ON les.course_id = cp.id
      ORDER BY cp.created_at DESC
    `);
    return Response.json({ courses: rows });
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
    const body = await req.json() as Record<string, unknown>;
    const {
      title, subtitle, description, target_audience, learning_objectives,
      prerequisites, category, level, language, price_cad, is_free, tags,
    } = body as {
      title: string; subtitle?: string; description?: string; target_audience?: string;
      learning_objectives?: string[]; prerequisites?: string[]; category?: string;
      level?: string; language?: string; price_cad?: number; is_free?: boolean; tags?: string[];
    };
    if (!title?.trim()) return Response.json({ error: 'Title is required' }, { status: 400 });
    const { rows } = await pool.query(`
      INSERT INTO course_productions
        (title, subtitle, description, target_audience, learning_objectives, prerequisites,
         category, level, language, price_cad, is_free, tags)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `, [title, subtitle ?? null, description ?? null, target_audience ?? null,
        learning_objectives ?? [], prerequisites ?? [], category ?? null,
        level ?? 'beginner', language ?? 'en', price_cad ?? null, is_free ?? false, tags ?? []]);
    return Response.json({ course: rows[0] }, { status: 201 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
