export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

async function ensureTables() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS integrations_catalog (
        integration_id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        category VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'not_configured',
        description TEXT,
        docs_url VARCHAR(256),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS integrations_api_keys (
        id SERIAL PRIMARY KEY,
        integration_id VARCHAR(64) NOT NULL,
        key_preview VARCHAR(16) NOT NULL,
        last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
        status VARCHAR(32) NOT NULL DEFAULT 'active'
      );
      CREATE TABLE IF NOT EXISTS integrations_webhooks (
        id SERIAL PRIMARY KEY,
        integration_id VARCHAR(64) NOT NULL,
        url_masked VARCHAR(128) NOT NULL,
        events TEXT[] NOT NULL DEFAULT '{}',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        last_triggered TIMESTAMP,
        success_rate NUMERIC(5,2) NOT NULL DEFAULT 100.00
      );
      CREATE TABLE IF NOT EXISTS integrations_health (
        integration_id VARCHAR(64) PRIMARY KEY,
        last_checked TIMESTAMP NOT NULL DEFAULT NOW(),
        response_ms INT NOT NULL DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'ok',
        uptime_pct NUMERIC(5,2) NOT NULL DEFAULT 100.00
      );
    `);

    // Pre-seed catalog
    const catalogSeeds = [
      // AI/ML
      ['huggingface','HuggingFace','AI/ML','connected','Open-source ML models and datasets','https://huggingface.co/docs'],
      ['replicate','Replicate','AI/ML','not_configured','Run ML models via API','https://replicate.com/docs'],
      ['together_ai','Together.ai','AI/ML','not_configured','Fast inference for open models','https://docs.together.ai'],
      ['groq','Groq','AI/ML','connected','Ultra-fast LLM inference','https://console.groq.com/docs'],
      ['mistral','Mistral','AI/ML','not_configured','Mistral language models','https://docs.mistral.ai'],
      // Video
      ['youtube_data','YouTube Data API','Video','connected','YouTube channel and video management','https://developers.google.com/youtube/v3'],
      ['vimeo','Vimeo','Video','not_configured','Professional video hosting','https://developer.vimeo.com'],
      ['mux','Mux','Video','not_configured','Video streaming infrastructure','https://docs.mux.com'],
      ['cloudflare_stream','Cloudflare Stream','Video','not_configured','Video delivery at scale','https://developers.cloudflare.com/stream'],
      // Email
      ['sendgrid','SendGrid','Email','connected','Transactional email API','https://docs.sendgrid.com'],
      ['resend','Resend','Email','not_configured','Modern email API','https://resend.com/docs'],
      ['mailchimp','Mailchimp','Email','not_configured','Email marketing platform','https://mailchimp.com/developer'],
      ['postmark','Postmark','Email','not_configured','Transactional email delivery','https://postmarkapp.com/developer'],
      // CRM
      ['hubspot','HubSpot','CRM','not_configured','Inbound marketing CRM','https://developers.hubspot.com'],
      ['salesforce','Salesforce','CRM','not_configured','Enterprise CRM platform','https://developer.salesforce.com'],
      ['pipedrive','Pipedrive','CRM','not_configured','Sales pipeline CRM','https://developers.pipedrive.com'],
      // Payment
      ['stripe','Stripe','Payment','connected','Online payments infrastructure','https://stripe.com/docs'],
      ['razorpay','Razorpay','Payment','not_configured','India payments platform','https://razorpay.com/docs'],
      ['paypal','PayPal','Payment','not_configured','Global payment network','https://developer.paypal.com'],
      // Social
      ['twitter_x','Twitter/X','Social','not_configured','X (Twitter) API v2','https://developer.twitter.com/en/docs'],
      ['linkedin_api','LinkedIn','Social','connected','LinkedIn marketing API','https://learn.microsoft.com/linkedin'],
      ['instagram_api','Instagram','Social','connected','Instagram Graph API','https://developers.facebook.com/docs/instagram'],
      ['facebook_api','Facebook','Social','connected','Meta Graph API','https://developers.facebook.com/docs'],
      ['tiktok_api','TikTok','Social','not_configured','TikTok for Developers','https://developers.tiktok.com'],
      // Analytics
      ['google_analytics','Google Analytics','Analytics','connected','Web analytics','https://developers.google.com/analytics'],
      ['mixpanel','Mixpanel','Analytics','not_configured','Product analytics','https://developer.mixpanel.com'],
      ['amplitude','Amplitude','Analytics','not_configured','Digital analytics','https://www.docs.developers.amplitude.com'],
      ['posthog','PostHog','Analytics','not_configured','Open-source product analytics','https://posthog.com/docs'],
      // Storage
      ['aws_s3','AWS S3','Storage','connected','Object storage','https://docs.aws.amazon.com/s3'],
      ['cloudflare_r2','Cloudflare R2','Storage','not_configured','Zero-egress object storage','https://developers.cloudflare.com/r2'],
    ];

    for (const [id, name, cat, status, desc, docs] of catalogSeeds) {
      await client.query(
        `INSERT INTO integrations_catalog (integration_id,name,category,status,description,docs_url)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (integration_id) DO NOTHING`,
        [id, name, cat, status, desc, docs]
      );
    }

    // Pre-seed api_keys (10)
    const keySeeds = [
      ['huggingface','hf_****5fGa'],['groq','gsk_****mX9a'],['sendgrid','SG.****Qpzt'],
      ['stripe','sk_****live'],['youtube_data','AIza****GkXw'],
      ['linkedin_api','AQV****3TyP'],['instagram_api','EAAl****2Yqz'],
      ['facebook_api','EAAl****9Kmr'],['google_analytics','ya29****token'],
      ['aws_s3','AKIA****MXYZ'],
    ];
    for (const [iid, kp] of keySeeds) {
      await client.query(
        `INSERT INTO integrations_api_keys (integration_id,key_preview,status)
         VALUES ($1,$2,'active') ON CONFLICT DO NOTHING`,
        [iid, kp]
      );
    }

    // Pre-seed webhooks (5)
    const whSeeds = [
      ['stripe','https://app.*****/webhooks/stripe','{"payment.succeeded","payment.failed"}',true,98.5],
      ['sendgrid','https://app.*****/webhooks/sendgrid','{"email.delivered","email.bounced"}',true,99.2],
      ['hubspot','https://app.*****/webhooks/hubspot','{"contact.created"}',false,0],
      ['instagram_api','https://app.*****/webhooks/instagram','{"messages","comments"}',true,97.1],
      ['facebook_api','https://app.*****/webhooks/facebook','{"messages","leads"}',true,96.8],
    ];
    for (const [iid, url, evts, active, rate] of whSeeds) {
      await client.query(
        `INSERT INTO integrations_webhooks (integration_id,url_masked,events,is_active,success_rate)
         VALUES ($1,$2,$3::text[],$4,$5) ON CONFLICT DO NOTHING`,
        [iid, url, evts, active, rate]
      );
    }

    // Pre-seed health (all 30 catalog rows)
    const healthStatuses = ['ok','ok','ok','ok','degraded','ok','ok','down','ok','ok',
      'ok','ok','ok','ok','ok','ok','ok','ok','ok','ok',
      'ok','ok','ok','ok','ok','ok','ok','degraded','ok','ok'];
    const ids = catalogSeeds.map(r => r[0]);
    for (let i = 0; i < ids.length; i++) {
      const ms = 50 + Math.floor(i * 7.3);
      const s = healthStatuses[i] || 'ok';
      const up = s === 'down' ? 87.5 : s === 'degraded' ? 95.2 : 99.8;
      await client.query(
        `INSERT INTO integrations_health (integration_id,response_ms,status,uptime_pct)
         VALUES ($1,$2,$3,$4) ON CONFLICT (integration_id) DO NOTHING`,
        [ids[i], ms, s, up]
      );
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;
  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [catalog, keys, webhooks, health] = await Promise.all([
      client.query('SELECT * FROM integrations_catalog ORDER BY category, name'),
      client.query('SELECT * FROM integrations_api_keys ORDER BY id'),
      client.query('SELECT * FROM integrations_webhooks ORDER BY id'),
      client.query('SELECT * FROM integrations_health ORDER BY integration_id'),
    ]);
    const total = catalog.rows.length;
    const connected = catalog.rows.filter(r => r.status === 'connected').length;
    const pending = catalog.rows.filter(r => r.status === 'not_configured').length;
    const failed = catalog.rows.filter(r => r.status === 'error' || r.status === 'deprecated').length;
    return NextResponse.json({
      catalog: catalog.rows,
      api_keys: keys.rows,
      webhooks: webhooks.rows,
      health: health.rows,
      summary: { total, connected, pending, failed },
    });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;
  await ensureTables();
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (body.action === 'add_key') {
      const r = await client.query(
        `INSERT INTO integrations_api_keys (integration_id,key_preview,status) VALUES ($1,$2,'active') RETURNING *`,
        [body.integration_id, body.key_preview]
      );
      return NextResponse.json(r.rows[0]);
    }
    if (body.action === 'add_webhook') {
      const r = await client.query(
        `INSERT INTO integrations_webhooks (integration_id,url_masked,events,is_active) VALUES ($1,$2,$3,$4) RETURNING *`,
        [body.integration_id, body.url_masked, body.events || [], body.is_active ?? true]
      );
      return NextResponse.json(r.rows[0]);
    }
    if (body.action === 'update_status') {
      const r = await client.query(
        `UPDATE integrations_catalog SET status=$1 WHERE integration_id=$2 RETURNING *`,
        [body.status, body.integration_id]
      );
      return NextResponse.json(r.rows[0]);
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;
  await ensureTables();
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (body.type === 'integration') {
      const r = await client.query(
        `UPDATE integrations_catalog SET status=$1 WHERE integration_id=$2 RETURNING *`,
        [body.status, body.integration_id]
      );
      return NextResponse.json(r.rows[0]);
    }
    if (body.type === 'webhook') {
      const r = await client.query(
        `UPDATE integrations_webhooks SET is_active=$1 WHERE id=$2 RETURNING *`,
        [body.is_active, body.id]
      );
      return NextResponse.json(r.rows[0]);
    }
    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } finally {
    client.release();
  }
}
