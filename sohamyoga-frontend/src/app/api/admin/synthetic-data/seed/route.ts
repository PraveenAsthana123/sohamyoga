import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const SEED_DATASETS = [
  {
    module_name: 'Market Research',
    dataset_name: 'Yoga Market Competitor Analysis 2026',
    dataset_type: 'market_research',
    record_count: 25,
    generation_prompt: 'Generate 25 synthetic yoga studio competitor records with: name, location, price_per_class, monthly_membership, class_types, instagram_followers, google_rating, unique_differentiator.',
    status: 'pending',
    source_tag: 'synthetic',
  },
  {
    module_name: 'CRM',
    dataset_name: 'Prospect Lead Database Q4 2026',
    dataset_type: 'leads',
    record_count: 50,
    generation_prompt: 'Generate 50 synthetic prospect leads for a yoga studio: name, email, phone, city, interest_level (hot/warm/cold), source (instagram/referral/google/walk-in), notes.',
    status: 'pending',
    source_tag: 'synthetic',
  },
  {
    module_name: 'Blog',
    dataset_name: 'Blog Post Ideas Backlog',
    dataset_type: 'blog',
    record_count: 30,
    generation_prompt: 'Generate 30 synthetic yoga blog post ideas with: title, category, target_keyword, estimated_word_count, pillar_topic, call_to_action.',
    status: 'pending',
    source_tag: 'synthetic',
  },
  {
    module_name: 'NPS/CSAT',
    dataset_name: 'Student Survey Responses Oct 2026',
    dataset_type: 'surveys',
    record_count: 40,
    generation_prompt: 'Generate 40 synthetic yoga studio survey responses with: respondent_id, class_attended, instructor_name, nps_score (1-10), csat_score (1-5), open_feedback, would_recommend.',
    status: 'pending',
    source_tag: 'synthetic',
  },
  {
    module_name: 'Social',
    dataset_name: 'Social Content Calendar Q4 2026',
    dataset_type: 'social_content',
    record_count: 60,
    generation_prompt: 'Generate 60 synthetic social media post ideas for a yoga studio: platform (instagram/facebook/twitter/linkedin), post_type (image/reel/story/text), caption, hashtags, best_time_to_post, goal (awareness/engagement/conversion).',
    status: 'pending',
    source_tag: 'synthetic',
  },
  {
    module_name: 'Competitors',
    dataset_name: 'Digital Competitor Content Audit',
    dataset_type: 'competitor',
    record_count: 20,
    generation_prompt: 'Generate 20 synthetic competitor content audit records for yoga studios: competitor_name, platform, content_type, posting_frequency, avg_engagement_rate, top_hashtags, content_themes, gap_opportunities.',
    status: 'pending',
    source_tag: 'synthetic',
  },
];

export async function POST() {
  try {
    let seeded = 0;
    for (const ds of SEED_DATASETS) {
      await pool.query(
        `INSERT INTO synthetic_data_set (module_name, dataset_name, dataset_type, record_count, generation_prompt, status, source_tag)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [ds.module_name, ds.dataset_name, ds.dataset_type, ds.record_count, ds.generation_prompt, ds.status, ds.source_tag]
      );
      seeded++;
    }
    const count = await pool.query('SELECT COUNT(*) AS cnt FROM synthetic_data_set');
    return NextResponse.json({ ok: true, seeded, total: Number(count.rows[0].cnt) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
