import { NextRequest} from 'next/server';
import { pool } from '@/lib/db';

import { requireAdmin } from '@/lib/admin-auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blog_post (
      id SERIAL PRIMARY KEY, title VARCHAR(500) NOT NULL, slug VARCHAR(500) UNIQUE,
      excerpt TEXT, content TEXT, author VARCHAR(200), category VARCHAR(100), tags TEXT,
      status VARCHAR(20) DEFAULT 'draft', featured_image_url VARCHAR(500),
      seo_title VARCHAR(200), seo_description VARCHAR(300), seo_keywords TEXT,
      reading_time_minutes INT, word_count INT, views INT DEFAULT 0, shares INT DEFAULT 0,
      ai_generated BOOLEAN DEFAULT false, scheduled_at TIMESTAMPTZ, published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS blog_category (
      id SERIAL PRIMARY KEY, name VARCHAR(100) UNIQUE, slug VARCHAR(100) UNIQUE,
      description TEXT, post_count INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Categories
  await pool.query(`
    INSERT INTO blog_category (name, slug, description) VALUES
    ('Yoga Poses', 'yoga-poses', 'Guides to individual asanas and pose sequences'),
    ('Mindfulness', 'mindfulness', 'Meditation, breathwork, and mental wellness'),
    ('Nutrition', 'nutrition', 'Healthy eating for an active yoga lifestyle')
    ON CONFLICT (name) DO NOTHING;
  `);

  // Blog posts
  await pool.query(`
    INSERT INTO blog_post (title, slug, excerpt, content, author, category, tags, status, views, shares, word_count, reading_time_minutes, published_at, seo_title, seo_description) VALUES
    (
      '10 Morning Yoga Poses to Start Your Day Right',
      '10-morning-yoga-poses-start-day-right',
      'Discover how a simple 20-minute morning yoga routine can transform your energy levels and mental clarity throughout the day.',
      '## Introduction\n\nStarting your day with yoga can be life-changing...\n\n## 1. Sun Salutation (Surya Namaskar)\n\nThe classic sequence to awaken the body...\n\n## 2. Cat-Cow Stretch\n\nPerfect for spinal flexibility...',
      'Sarah Chen', 'Yoga Poses', 'morning yoga,beginners,poses,wellness', 'published',
      1247, 89, 850, 5, NOW() - INTERVAL '7 days',
      '10 Morning Yoga Poses for Energy & Clarity',
      'Start your morning right with these 10 yoga poses. Build energy, improve flexibility, and set a positive tone for the day ahead.'
    ),
    (
      'The Science Behind Mindful Breathing: How Pranayama Rewires Your Brain',
      'science-mindful-breathing-pranayama-rewires-brain',
      'New neuroscience research reveals why conscious breathing techniques can reduce anxiety and improve cognitive function within minutes.',
      '## What is Pranayama?\n\nPranayama, the ancient yogic practice of breath control...\n\n## The Neuroscience\n\nStudies from Harvard Medical School show...',
      'Dr. Arjun Mehta', 'Mindfulness', 'pranayama,breathing,mindfulness,neuroscience', 'published',
      2891, 203, 1200, 6, NOW() - INTERVAL '14 days',
      'Pranayama & Brain Science: How Breathing Changes Your Mind',
      'Discover the neuroscience behind mindful breathing and how pranayama can reduce anxiety, improve focus, and rewire your brain.'
    ),
    (
      'Plant-Based Nutrition for Yoga Practitioners: A Complete Guide',
      'plant-based-nutrition-yoga-practitioners-complete-guide',
      'Fuel your practice with the right foods. This comprehensive guide covers macro and micronutrient needs for active yogis.',
      '## Why Plant-Based?\n\nMany experienced yogis gravitate toward plant-based diets for both ethical and performance reasons...',
      'Priya Sharma', 'Nutrition', 'nutrition,plant-based,vegan,yoga diet', 'draft',
      0, 0, 980, 5, null,
      'Plant-Based Nutrition Guide for Yogis',
      'Complete nutrition guide for yoga practitioners. Learn which plant-based foods fuel your practice and support recovery.'
    ),
    (
      'Yoga for Desk Workers: Relieving Tech Neck and Back Pain',
      'yoga-desk-workers-relieving-tech-neck-back-pain',
      'Targeted yoga sequences specifically designed for people who spend 8+ hours at a computer each day.',
      '## The Desk Worker Problem\n\nWith remote work becoming permanent for millions...',
      'Mark Johnson', 'Yoga Poses', 'office yoga,back pain,tech neck,desk worker', 'draft',
      0, 0, 750, 4, null,
      'Yoga for Desk Workers: Fix Tech Neck & Back Pain',
      'Targeted yoga stretches and poses designed for desk workers. Relieve tech neck, back pain, and tension after long work days.'
    ),
    (
      'New Year Yoga Challenge: 30 Days to Transform Your Practice',
      '30-day-yoga-challenge-transform-practice',
      'Join our community 30-day yoga challenge and build consistency, strength, and mindfulness into your daily life.',
      '## Why 30 Days?\n\nResearch shows it takes approximately 21-30 days to form a new habit...',
      'Sarah Chen', 'Yoga Poses', '30-day challenge,yoga challenge,consistency,goals', 'scheduled',
      0, 0, 650, 4, null,
      '30-Day Yoga Challenge: Build Your Practice',
      'Transform your yoga practice in 30 days. Daily poses, mindfulness exercises, and community support included.'
    )
    ON CONFLICT (slug) DO NOTHING;
  `);

  return Response.json({ seeded: true });
}
