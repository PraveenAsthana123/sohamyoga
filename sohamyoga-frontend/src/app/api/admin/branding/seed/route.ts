import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  // Ensure tables exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS brand_asset (
      id SERIAL PRIMARY KEY, asset_type VARCHAR(30), name VARCHAR(200), file_url VARCHAR(500),
      hex_color VARCHAR(10), font_family VARCHAR(100), usage_notes TEXT, is_primary BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS brand_guideline (
      id SERIAL PRIMARY KEY, section VARCHAR(50), title VARCHAR(200), content TEXT,
      do_examples TEXT, dont_examples TEXT, version INT DEFAULT 1, updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS brand_mention (
      id SERIAL PRIMARY KEY, platform VARCHAR(50), mention_url VARCHAR(500), mention_text TEXT,
      sentiment VARCHAR(20), reach_estimate INT, author VARCHAR(200), mentioned_at TIMESTAMPTZ,
      reviewed BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS brand_score_history (
      id SERIAL PRIMARY KEY, consistency INT DEFAULT 0, clarity INT DEFAULT 0,
      differentiation INT DEFAULT 0, emotional_appeal INT DEFAULT 0, market_fit INT DEFAULT 0,
      digital_presence INT DEFAULT 0, notes TEXT, recorded_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS brand_competitor (
      id SERIAL PRIMARY KEY, name VARCHAR(200), brand_colors VARCHAR(200), tone VARCHAR(100),
      positioning TEXT, target_audience VARCHAR(200), differentiator TEXT, threat_level VARCHAR(20),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS brand_voice_sample (
      id SERIAL PRIMARY KEY, category VARCHAR(50), label VARCHAR(200), content TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Brand assets
  await pool.query(`
    INSERT INTO brand_asset (asset_type, name, hex_color, is_primary, usage_notes) VALUES
    ('color', 'Primary Indigo', '#4F46E5', true, 'Main brand color — use on CTAs and headings'),
    ('color', 'Warm Saffron', '#F59E0B', true, 'Accent color for highlights and wellness elements'),
    ('color', 'Sage Green', '#10B981', false, 'Supporting color for nature/balance themes'),
    ('color', 'Deep Slate', '#1E293B', false, 'Dark text and footer backgrounds'),
    ('color', 'Cream White', '#FEFCE8', false, 'Background for wellness content sections'),
    ('font', 'Playfair Display', null, true, 'Primary serif font — headings and hero text'),
    ('font', 'Inter', null, true, 'Body font — clean, readable, modern'),
    ('font', 'Cormorant Garamond', null, false, 'Accent font — quotes and pull-out text'),
    ('logo', 'Primary Logo (Color)', null, true, 'Full color logo for light backgrounds'),
    ('logo', 'Monochrome Logo', null, false, 'Single-color version for dark backgrounds')
    ON CONFLICT DO NOTHING;
  `);

  // Brand guidelines
  await pool.query(`
    INSERT INTO brand_guideline (section, title, content, do_examples, dont_examples) VALUES
    ('voice', 'Brand Voice', 'Our voice is warm, knowledgeable, and empowering. We speak as a trusted guide who understands the journey to wellness. We balance professional expertise with approachable warmth.',
     'Use first-person inclusive language (we, us, your journey). Speak with confidence and compassion. Use active voice and present tense.',
     'Avoid clinical or overly technical jargon. Do not use aggressive sales language. Never sound preachy or judgmental.'),
    ('tone', 'Brand Tone', 'Our tone adapts to context: inspirational for marketing content, clear and precise for instructional content, empathetic and supportive for customer communications.',
     'Match tone to audience emotional state. Be uplifting without being unrealistic. Use gentle encouragement.',
     'Do not use fear-based messaging. Avoid hollow affirmations with no substance. Never be condescending about fitness levels.'),
    ('visual', 'Visual Identity', 'Our visual identity centers on harmony, movement, and natural wellness. Clean layouts with intentional white space. Photography shows real people in authentic wellness moments.',
     'Use consistent color palette across all touchpoints. High-quality, authentic photography. Generous white space.',
     'Avoid stock photos that look staged. Do not mix more than 3 fonts. Never use harsh, cold color palettes.'),
    ('messaging', 'Messaging Framework', 'Core message: Transform your wellbeing through the ancient wisdom of yoga, made accessible for modern life. We bridge tradition and contemporary practice.',
     'Lead with transformation and outcomes. Connect physical practice to mental wellness. Ground claims in real practice.',
     'Do not make medical claims. Avoid vague wellness buzzwords without substance. Never overpromise outcomes.'),
    ('values', 'Core Values', 'Authenticity: We teach real yoga, not just exercise. Community: Practice together creates deeper transformation. Growth: Every student has unlimited potential. Accessibility: Yoga is for every body.',
     'Demonstrate values through actions and content. Let values guide content decisions. Celebrate student milestones.',
     'Never list values without living them. Avoid using values as marketing jargon. Do not exclude any demographic.')
    ON CONFLICT DO NOTHING;
  `);

  // Brand mentions
  const platforms = ['facebook', 'instagram', 'google', 'twitter', 'yelp'];
  const sentiments = ['positive', 'neutral', 'negative'];
  const mentionData = platforms.flatMap(platform =>
    Array.from({ length: 5 }, (_, i) => ({
      platform,
      sentiment: sentiments[i % 3],
      text: `Great ${platform === 'google' ? 'studio' : 'page'}! The ${['classes', 'instructors', 'atmosphere', 'schedule', 'pricing'][i]} are ${['amazing', 'good', 'okay', 'excellent', 'fair'][i % 5]}.`,
      author: `user_${platform}_${i + 1}`,
      reach: Math.floor(Math.random() * 5000) + 100,
    }))
  );

  for (const m of mentionData) {
    await pool.query(
      `INSERT INTO brand_mention (platform, mention_text, sentiment, reach_estimate, author, mentioned_at)
       VALUES ($1,$2,$3,$4,$5,NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days') ON CONFLICT DO NOTHING`,
      [m.platform, m.text, m.sentiment, m.reach, m.author],
    );
  }

  // Brand score history
  await pool.query(`
    INSERT INTO brand_score_history (consistency, clarity, differentiation, emotional_appeal, market_fit, digital_presence, notes, recorded_at)
    VALUES
    (6, 7, 5, 8, 6, 5, 'Initial baseline assessment', NOW() - INTERVAL '5 months'),
    (7, 7, 6, 8, 7, 6, 'After brand refresh', NOW() - INTERVAL '4 months'),
    (7, 8, 6, 8, 7, 7, 'Post website launch', NOW() - INTERVAL '3 months'),
    (8, 8, 7, 9, 7, 7, 'After social campaign', NOW() - INTERVAL '2 months'),
    (8, 8, 7, 9, 8, 8, 'Quarterly review', NOW() - INTERVAL '1 month'),
    (8, 9, 8, 9, 8, 8, 'Current state', NOW())
    ON CONFLICT DO NOTHING;
  `);

  // Competitors
  await pool.query(`
    INSERT INTO brand_competitor (name, brand_colors, tone, positioning, target_audience, differentiator, threat_level)
    VALUES
    ('YogaWorks', 'Blue, White', 'Professional, structured', 'Premium studio experience', 'Affluent professionals 30-50', 'Large studio network', 'high'),
    ('CorePower Yoga', 'Red, Black', 'Energetic, motivational', 'Fitness-forward yoga', 'Gym-goers 25-40', 'Hot yoga specialization', 'medium'),
    ('Mindbody Studios', 'Purple, White', 'Holistic, spiritual', 'Mind-body-spirit wellness', 'Wellness enthusiasts', 'App-based booking', 'medium')
    ON CONFLICT DO NOTHING;
  `);

  // Voice samples
  await pool.query(`
    INSERT INTO brand_voice_sample (category, label, content) VALUES
    ('tagline', 'Primary Tagline', 'Find Your Balance. Live Your Practice.'),
    ('tagline', 'Alternative Tagline', 'Ancient Wisdom. Modern Wellness.'),
    ('elevator-pitch', 'Studio Pitch', 'We help busy professionals reconnect with their bodies through yoga that meets you where you are — whether that''s your first sun salutation or your thousandth.'),
    ('value-prop', 'Core Value Prop', 'Unlike crowded gyms and one-size-fits-all apps, we offer expert-led yoga that adapts to your body, schedule, and goals — in a community that genuinely cares about your progress.')
    ON CONFLICT DO NOTHING;
  `);

  return NextResponse.json({ seeded: true });
}
