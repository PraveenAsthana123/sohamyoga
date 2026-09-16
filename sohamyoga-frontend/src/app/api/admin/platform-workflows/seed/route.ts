import { NextRequest} from 'next/server';
import { query } from '@/lib/postgres';

import { requireAdmin } from '@/lib/admin-auth';
const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS platform_workflow (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(50) NOT NULL,
  trigger_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  run_count INT DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  last_run_status VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_workflow_step (
  id SERIAL PRIMARY KEY,
  workflow_id INT REFERENCES platform_workflow(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  action_config JSONB DEFAULT '{}',
  condition_field VARCHAR(100),
  condition_operator VARCHAR(20),
  condition_value TEXT,
  on_failure VARCHAR(20) DEFAULT 'continue',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_workflow_run (
  id SERIAL PRIMARY KEY,
  workflow_id INT REFERENCES platform_workflow(id),
  trigger_event VARCHAR(100),
  trigger_data JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'running',
  steps_total INT DEFAULT 0,
  steps_completed INT DEFAULT 0,
  steps_failed INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS platform_workflow_step_run (
  id SERIAL PRIMARY KEY,
  run_id INT REFERENCES platform_workflow_run(id) ON DELETE CASCADE,
  step_id INT REFERENCES platform_workflow_step(id),
  step_order INT,
  action_type VARCHAR(50),
  status VARCHAR(20),
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  error_message TEXT,
  duration_ms INT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS platform_ai_content_job (
  id SERIAL PRIMARY KEY,
  source_content TEXT NOT NULL,
  source_platform VARCHAR(50),
  target_platforms TEXT NOT NULL,
  job_type VARCHAR(30) DEFAULT 'adapt',
  status VARCHAR(20) DEFAULT 'pending',
  ai_prompt TEXT,
  ai_result JSONB DEFAULT '{}',
  tokens_used INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
`;

interface SeedWorkflow {
  name: string;
  description: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  steps: Array<{
    step_order: number;
    action_type: string;
    action_config: Record<string, unknown>;
    on_failure: string;
    condition_field?: string;
    condition_operator?: string;
    condition_value?: string;
  }>;
}

const SEED_WORKFLOWS: SeedWorkflow[] = [
  {
    name: 'New Order → WhatsApp Notification',
    description: 'When a new order is placed, send a WhatsApp notification and post an Instagram story',
    trigger_type: 'new_order',
    trigger_config: {},
    steps: [
      {
        step_order: 1,
        action_type: 'send_whatsapp',
        action_config: { phone: '{{customer.phone}}', message: 'Thank you for your order #{{order.id}}! We will process it shortly.' },
        on_failure: 'continue',
      },
      {
        step_order: 2,
        action_type: 'post_to_platform',
        action_config: { platform: 'instagram', content: '🎉 New order! We love our customers. Thank you for choosing us! #yoga #wellness' },
        on_failure: 'continue',
      },
    ],
  },
  {
    name: 'Daily Content Recycler',
    description: 'Every day at 9am, pick a top post from the last 30 days, AI-adapt it for 5 platforms, and post all',
    trigger_type: 'schedule',
    trigger_config: { cron: '0 9 * * *', description: 'Daily at 9am' },
    steps: [
      {
        step_order: 1,
        action_type: 'ai_adapt_content',
        action_config: { source_platform: 'instagram', target_platforms: ['twitter', 'linkedin', 'facebook', 'tiktok', 'pinterest'], job_type: 'repurpose' },
        on_failure: 'stop',
      },
      {
        step_order: 2,
        action_type: 'post_to_platform',
        action_config: { platform: 'twitter', content: '{{ai_adapted.twitter}}' },
        on_failure: 'continue',
      },
      {
        step_order: 3,
        action_type: 'post_to_platform',
        action_config: { platform: 'linkedin', content: '{{ai_adapted.linkedin}}' },
        on_failure: 'continue',
      },
      {
        step_order: 4,
        action_type: 'post_to_platform',
        action_config: { platform: 'facebook', content: '{{ai_adapted.facebook}}' },
        on_failure: 'continue',
      },
      {
        step_order: 5,
        action_type: 'wait',
        action_config: { delay_seconds: 300 },
        on_failure: 'continue',
      },
      {
        step_order: 6,
        action_type: 'post_to_platform',
        action_config: { platform: 'pinterest', content: '{{ai_adapted.pinterest}}' },
        on_failure: 'continue',
      },
    ],
  },
  {
    name: 'Review Response Bot',
    description: 'When a new review is received, check rating and respond appropriately',
    trigger_type: 'new_review',
    trigger_config: {},
    steps: [
      {
        step_order: 1,
        action_type: 'condition',
        action_config: { on_true_step: 2, on_false_step: 3 },
        condition_field: 'review.rating',
        condition_operator: 'gte',
        condition_value: '4',
        on_failure: 'continue',
      },
      {
        step_order: 2,
        action_type: 'post_to_platform',
        action_config: { platform: 'instagram', content: 'Thank you for your wonderful review! We love hearing from our community. 🙏 #yoga #gratitude' },
        on_failure: 'continue',
      },
      {
        step_order: 3,
        action_type: 'tag_customer',
        action_config: { tag: 'negative_review_flagged', note: 'Review rating <= 2, requires manual follow-up' },
        on_failure: 'continue',
      },
    ],
  },
  {
    name: 'Campaign Launch Blast',
    description: 'When a campaign is launched, post to all major platforms in sequence with 5-minute delays',
    trigger_type: 'campaign_launch',
    trigger_config: {},
    steps: [
      {
        step_order: 1,
        action_type: 'post_to_platform',
        action_config: { platform: 'instagram', content: '{{campaign.content}}' },
        on_failure: 'continue',
      },
      {
        step_order: 2,
        action_type: 'wait',
        action_config: { delay_seconds: 300 },
        on_failure: 'continue',
      },
      {
        step_order: 3,
        action_type: 'post_to_platform',
        action_config: { platform: 'facebook', content: '{{campaign.content}}' },
        on_failure: 'continue',
      },
      {
        step_order: 4,
        action_type: 'wait',
        action_config: { delay_seconds: 300 },
        on_failure: 'continue',
      },
      {
        step_order: 5,
        action_type: 'post_to_platform',
        action_config: { platform: 'twitter', content: '{{campaign.content}}' },
        on_failure: 'continue',
      },
      {
        step_order: 6,
        action_type: 'wait',
        action_config: { delay_seconds: 300 },
        on_failure: 'continue',
      },
      {
        step_order: 7,
        action_type: 'post_to_platform',
        action_config: { platform: 'linkedin', content: '{{campaign.content}}' },
        on_failure: 'continue',
      },
    ],
  },
  {
    name: 'New Follower Welcome',
    description: 'When someone follows, send a WhatsApp DM welcome and tag them',
    trigger_type: 'new_follower',
    trigger_config: {},
    steps: [
      {
        step_order: 1,
        action_type: 'send_whatsapp',
        action_config: { phone: '{{follower.phone}}', message: 'Welcome to our community! 🙏 We are so glad you are here. Explore our yoga journey at sohamyoga.com' },
        on_failure: 'continue',
      },
      {
        step_order: 2,
        action_type: 'tag_customer',
        action_config: { tag: 'new_follower', note: 'Tagged as new follower for nurture sequence' },
        on_failure: 'continue',
      },
    ],
  },
  {
    name: 'Weekly Analytics Report',
    description: 'Every Monday at 8am, pull analytics, AI summarize, and email to admin',
    trigger_type: 'schedule',
    trigger_config: { cron: '0 8 * * 1', description: 'Every Monday at 8am' },
    steps: [
      {
        step_order: 1,
        action_type: 'ai_adapt_content',
        action_config: { job_type: 'generate', source_platform: 'analytics', target_platforms: ['email'], prompt_template: 'Summarize this week analytics data into an executive email report' },
        on_failure: 'stop',
      },
      {
        step_order: 2,
        action_type: 'send_email',
        action_config: { to: 'admin@sohamyoga.com', subject: 'Weekly Analytics Report — {{date}}', body: '{{ai_adapted.email}}' },
        on_failure: 'continue',
      },
    ],
  },
  {
    name: 'Low Inventory Alert',
    description: 'When inventory is low, pause ad campaigns and alert manager via WhatsApp',
    trigger_type: 'low_inventory',
    trigger_config: { threshold: 5 },
    steps: [
      {
        step_order: 1,
        action_type: 'webhook_call',
        action_config: { url: '/api/admin/ads/pause', method: 'POST', body: { reason: 'low_inventory', product_id: '{{product.id}}' } },
        on_failure: 'continue',
      },
      {
        step_order: 2,
        action_type: 'send_whatsapp',
        action_config: { phone: '{{manager.phone}}', message: '⚠️ Low inventory alert: {{product.name}} has only {{product.stock}} units left. Ad campaigns paused.' },
        on_failure: 'continue',
      },
    ],
  },
  {
    name: 'Lead Capture → Nurture',
    description: 'When a new lead is captured, send email and WhatsApp welcome, then tag for nurture',
    trigger_type: 'new_lead',
    trigger_config: {},
    steps: [
      {
        step_order: 1,
        action_type: 'send_email',
        action_config: { to: '{{lead.email}}', subject: 'Welcome to Soham Yoga!', body: 'Thank you for your interest in our yoga programs. We will be in touch shortly with personalized recommendations.' },
        on_failure: 'continue',
      },
      {
        step_order: 2,
        action_type: 'wait',
        action_config: { delay_seconds: 60 },
        on_failure: 'continue',
      },
      {
        step_order: 3,
        action_type: 'send_whatsapp',
        action_config: { phone: '{{lead.phone}}', message: 'Hi {{lead.name}}! Thanks for your interest in Soham Yoga. Reply YES to learn more about our programs. 🧘' },
        on_failure: 'continue',
      },
      {
        step_order: 4,
        action_type: 'tag_customer',
        action_config: { tag: 'new_lead', note: 'Lead captured, nurture sequence started' },
        on_failure: 'continue',
      },
    ],
  },
];

export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    // Create tables
    await query(CREATE_TABLES);

    let workflowsCreated = 0;
    let stepsCreated = 0;

    // Insert seed workflows
    for (const wf of SEED_WORKFLOWS) {
      const existing = await query<{ id: number }>(
        'SELECT id FROM platform_workflow WHERE name = $1',
        [wf.name]
      );

      let workflowId: number;
      if (existing.rows.length > 0) {
        workflowId = existing.rows[0].id;
      } else {
        const ins = await query<{ id: number }>(
          `INSERT INTO platform_workflow (name, description, trigger_type, trigger_config)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [wf.name, wf.description, wf.trigger_type, JSON.stringify(wf.trigger_config)]
        );
        workflowId = ins.rows[0].id;
        workflowsCreated++;
      }

      // Seed steps only if workflow had no steps
      const stepCheck = await query<{ count: string }>(
        'SELECT COUNT(*) as count FROM platform_workflow_step WHERE workflow_id = $1',
        [workflowId]
      );
      if (parseInt(stepCheck.rows[0].count) === 0) {
        for (const step of wf.steps) {
          await query(
            `INSERT INTO platform_workflow_step
               (workflow_id, step_order, action_type, action_config, condition_field, condition_operator, condition_value, on_failure)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              workflowId,
              step.step_order,
              step.action_type,
              JSON.stringify(step.action_config),
              step.condition_field ?? null,
              step.condition_operator ?? null,
              step.condition_value ?? null,
              step.on_failure,
            ]
          );
          stepsCreated++;
        }
      }
    }

    return Response.json({
      message: 'Tables created and seed data inserted',
      workflows_created: workflowsCreated,
      steps_created: stepsCreated,
    });
  } catch (err) {
    console.error('Seed error:', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
