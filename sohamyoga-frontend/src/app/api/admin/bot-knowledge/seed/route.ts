import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_session (
        id SERIAL PRIMARY KEY,
        session_token VARCHAR(100) UNIQUE NOT NULL,
        user_type VARCHAR(20),
        user_id INT,
        user_email VARCHAR(200),
        context_type VARCHAR(30),
        started_at TIMESTAMPTZ DEFAULT NOW(),
        last_message_at TIMESTAMPTZ,
        message_count INT DEFAULT 0,
        resolved BOOLEAN DEFAULT false,
        escalated_to_human BOOLEAN DEFAULT false,
        satisfaction_score INT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_message (
        id SERIAL PRIMARY KEY,
        session_id INT REFERENCES bot_session(id) ON DELETE CASCADE,
        role VARCHAR(10) NOT NULL,
        content TEXT NOT NULL,
        intent_detected VARCHAR(50),
        response_time_ms INT,
        tokens_used INT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_knowledge_base (
        id SERIAL PRIMARY KEY,
        category VARCHAR(50),
        question VARCHAR(500),
        answer TEXT,
        keywords TEXT,
        is_active BOOLEAN DEFAULT true,
        usage_count INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS service_ticket (
        id SERIAL PRIMARY KEY,
        session_id INT,
        customer_email VARCHAR(200),
        customer_name VARCHAR(200),
        subject VARCHAR(300),
        description TEXT,
        category VARCHAR(30),
        priority VARCHAR(20) DEFAULT 'medium',
        status VARCHAR(20) DEFAULT 'open',
        assigned_agent VARCHAR(100),
        resolution_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      )
    `);

    const kbEntries = [
      // billing
      { cat: 'billing', q: 'How much does the platform cost?', a: 'Plans start at $49/mo (Starter), $149/mo (Growth), or $499/mo (Enterprise). Annual billing saves 20%.' },
      { cat: 'billing', q: 'Do you offer a money-back guarantee?', a: 'Yes, 30-day money-back guarantee, no questions asked.' },
      { cat: 'billing', q: 'Can I upgrade or downgrade my plan?', a: 'Yes, upgrades are immediate with prorated billing. Downgrades take effect at next billing cycle.' },
      { cat: 'billing', q: 'What payment methods do you accept?', a: 'We accept all major credit cards and bank transfers.' },
      { cat: 'billing', q: 'Is there an annual discount?', a: 'Yes, annual billing gives you 20% off compared to monthly billing.' },
      { cat: 'billing', q: 'How do I cancel my subscription?', a: 'You can cancel anytime from Settings > Subscription. Access continues until end of billing period.' },
      { cat: 'billing', q: 'Do you charge per user?', a: 'No, all plans are flat-rate. You can add unlimited team members.' },
      { cat: 'billing', q: 'Can I get an invoice?', a: 'Yes, invoices are auto-generated and emailed after each billing cycle. Download from Settings > Billing.' },
      { cat: 'billing', q: 'Do you offer nonprofit discounts?', a: 'Yes, contact our sales team for nonprofit and educational pricing.' },
      { cat: 'billing', q: 'What happens if my payment fails?', a: 'We retry payment 3 times over 7 days. Your account stays active during this period.' },
      // features
      { cat: 'features', q: 'How many social platforms do you support?', a: '36 social platforms including Instagram, Facebook, LinkedIn, Twitter/X, TikTok, YouTube and more.' },
      { cat: 'features', q: 'Can I schedule posts in advance?', a: 'Yes, schedule posts up to 6 months in advance. Our AI can suggest optimal posting times.' },
      { cat: 'features', q: 'Do you have AI content generation?', a: 'Yes, powered by local Ollama (llama3.2). Generate captions, blog posts, ad copy and more.' },
      { cat: 'features', q: 'Can I manage affiliates?', a: 'Yes, the Affiliate module handles partner signup, commission tracking, payout processing and fraud detection.' },
      { cat: 'features', q: 'Do you have analytics?', a: 'Yes, 360-degree analytics including social, email, SEO, affiliate, and customer analytics.' },
      { cat: 'features', q: 'Is there an ecommerce feature?', a: 'Yes, full ecommerce with product catalog, cart, checkout, orders, and vendor management.' },
      { cat: 'features', q: 'Can I run email campaigns?', a: 'Yes, with drip sequences, broadcast emails, A/B testing, and open/click tracking.' },
      { cat: 'features', q: 'Do you support multi-language content?', a: 'Yes, AI can generate and translate content into 25+ languages.' },
      { cat: 'features', q: 'Is there a mobile app?', a: 'Progressive Web App (PWA) — works on all devices, installable from browser.' },
      { cat: 'features', q: 'Can I white-label the platform?', a: 'Yes, Enterprise plan includes full white-labeling with custom domain and branding.' },
      // operations
      { cat: 'operations', q: 'Is my data secure?', a: 'Yes, all data is encrypted at rest and in transit. We are GDPR and PIPEDA compliant.' },
      { cat: 'operations', q: 'What is the uptime SLA?', a: '99.9% uptime SLA for Growth and Enterprise plans.' },
      { cat: 'operations', q: 'How often are automated jobs run?', a: 'We run 104+ background jobs from every 5 minutes to weekly. You can see the schedule in the admin area.' },
      { cat: 'operations', q: 'Is the AI local or cloud?', a: 'AI is powered by local Ollama — your data never leaves your server.' },
      { cat: 'operations', q: 'Can I export my data?', a: 'Yes, full data export available as CSV and JSON from Settings > Data Export.' },
      { cat: 'operations', q: 'What databases do you use?', a: 'PostgreSQL for structured data, with full backup and point-in-time recovery.' },
      { cat: 'operations', q: 'Do you have a status page?', a: 'Yes, check /admin/health for real-time platform health metrics.' },
      { cat: 'operations', q: 'Can I integrate with Zapier?', a: 'Webhook support is available on all plans. Native Zapier app coming Q1 2027.' },
      { cat: 'operations', q: 'How do I set up platform credentials?', a: 'Go to Admin > Platform Credentials and add API keys for each social platform.' },
      { cat: 'operations', q: 'What happens during maintenance?', a: 'Scheduled maintenance windows are announced 48h in advance via email and in-app notification.' },
      // faq
      { cat: 'faq', q: 'How do I get started?', a: 'Sign up, connect at least one social platform, and publish your first piece of content. Our onboarding wizard guides you.' },
      { cat: 'faq', q: 'Is there a free trial?', a: 'Yes, 14-day free trial, no credit card required.' },
      { cat: 'faq', q: 'Do I need technical knowledge?', a: 'No, our platform is designed for marketers. No coding required.' },
      { cat: 'faq', q: 'Can I invite team members?', a: 'Yes, invite unlimited team members with role-based access control.' },
      { cat: 'faq', q: 'How do I reset my password?', a: 'Click "Forgot Password" on the login page. Reset link is sent to your email within 2 minutes.' },
      { cat: 'faq', q: 'Is there customer support?', a: 'Yes, chat support (this bot) 24/7, plus email support and video calls for Enterprise.' },
      { cat: 'faq', q: 'How long does setup take?', a: 'Basic setup takes 15 minutes. Full onboarding with all platforms: 1-2 hours.' },
      { cat: 'faq', q: 'Do you have documentation?', a: 'Yes, full documentation at docs.sohamyoga.com (coming soon). In-app help available.' },
      { cat: 'faq', q: 'Can I use my own domain?', a: 'Yes, custom domain is available on Growth and Enterprise plans.' },
      { cat: 'faq', q: 'Is there an API?', a: 'Yes, REST API available for all plans. API keys managed in Settings > API.' },
      // pricing
      { cat: 'pricing', q: 'What is the Starter plan?', a: 'Starter: $49/mo — 5 social platforms, 1 user, basic analytics, email support.' },
      { cat: 'pricing', q: 'What is the Growth plan?', a: 'Growth: $149/mo — 20 platforms, 5 users, advanced analytics, affiliate management, priority support.' },
      { cat: 'pricing', q: 'What is the Enterprise plan?', a: 'Enterprise: $499/mo — all 36 platforms, unlimited users, white-label, dedicated account manager, SLA.' },
      { cat: 'pricing', q: 'Is there a custom plan?', a: 'Yes, contact sales for custom pricing based on your specific needs.' },
      { cat: 'pricing', q: 'Do prices include tax?', a: 'Prices are exclusive of applicable taxes. Tax is calculated at checkout based on your location.' },
      { cat: 'pricing', q: 'Can I pay in my local currency?', a: 'We accept USD, EUR, GBP, and CAD. Other currencies via bank transfer.' },
      { cat: 'pricing', q: 'Are there setup fees?', a: 'No setup fees on any plan.' },
      { cat: 'pricing', q: 'How does the affiliate program work?', a: 'Affiliates earn 20% recurring commission on all referred customers.' },
      { cat: 'pricing', q: 'Can I negotiate pricing?', a: 'Annual contracts of $10k+ are eligible for volume discounts. Contact sales.' },
      { cat: 'pricing', q: 'What is included in the free trial?', a: 'Free trial includes all Growth plan features for 14 days, no credit card required.' },
      // troubleshooting
      { cat: 'troubleshooting', q: 'My posts are not publishing', a: 'Check Admin > Platform Credentials — your social platform token may have expired. Re-authenticate and retry.' },
      { cat: 'troubleshooting', q: 'Analytics not updating', a: 'Analytics sync runs every 6 hours. If still stale after 12h, check the Cron Jobs health in Admin > Health.' },
      { cat: 'troubleshooting', q: 'I cannot log in', a: 'Try password reset first. If that fails, clear browser cookies and try incognito mode.' },
      { cat: 'troubleshooting', q: 'AI content is not generating', a: 'Ensure Ollama is running on localhost:11434 with llama3.2 installed. Check Admin > Health for AI status.' },
      { cat: 'troubleshooting', q: 'Emails not sending', a: 'Check Admin > Platform Credentials for SMTP settings. Verify your email provider is configured.' },
      { cat: 'troubleshooting', q: 'Affiliate commissions not calculating', a: 'Commission calculation runs daily at midnight. Check Admin > Cron Jobs for the affiliate-commission-settle job.' },
      { cat: 'troubleshooting', q: 'Slow performance', a: 'Check Admin > Health for database and server metrics. High queue depth may indicate a cron job backlog.' },
      { cat: 'troubleshooting', q: 'Images not uploading', a: 'Check file size (max 10MB) and format (JPG, PNG, WebP). Check disk space in Admin > Health.' },
      { cat: 'troubleshooting', q: 'Workflow not triggering', a: 'Go to Admin > Workflows and check trigger conditions. Ensure the workflow is set to Active status.' },
      { cat: 'troubleshooting', q: 'Cart checkout failing', a: 'Check Stripe/payment credentials in Admin > Platform Credentials. Test mode vs live mode mismatch is common.' },
    ];

    for (const entry of kbEntries) {
      await pool.query(
        `INSERT INTO bot_knowledge_base (category, question, answer, keywords)
         VALUES ($1,$2,$3,$4)`,
        [entry.cat, entry.q, entry.a, entry.cat]
      );
    }

    return NextResponse.json({ ok: true, message: 'Tables created, 60 KB entries seeded (10 per category)' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
