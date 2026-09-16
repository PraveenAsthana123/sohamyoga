// Platform Scenario Registry — shared schema + seed helpers (server-only)
import { query } from './postgres';

export async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS platform_scenario (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      platform TEXT NOT NULL,
      feature_type TEXT NOT NULL,
      scenario_name TEXT NOT NULL,
      scenario_description TEXT,
      actor TEXT NOT NULL DEFAULT 'admin',
      trigger_type TEXT DEFAULT 'manual',
      steps JSONB DEFAULT '[]',
      input_fields JSONB DEFAULT '[]',
      output_type TEXT,
      api_endpoints TEXT[] DEFAULT '{}',
      has_analytics BOOLEAN DEFAULT false,
      has_customer_feedback BOOLEAN DEFAULT false,
      has_review_capability BOOLEAN DEFAULT false,
      estimated_duration_seconds INTEGER DEFAULT 60,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(platform, feature_type, scenario_name)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS platform_feature_permission (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      platform TEXT NOT NULL,
      feature_type TEXT NOT NULL,
      feature_label TEXT NOT NULL,
      admin_enabled BOOLEAN DEFAULT true,
      customer_enabled BOOLEAN DEFAULT false,
      requires_approval BOOLEAN DEFAULT false,
      approval_mode TEXT DEFAULT 'none',
      customer_daily_limit INTEGER,
      customer_monthly_limit INTEGER,
      is_configured BOOLEAN DEFAULT false,
      notes TEXT,
      updated_by TEXT DEFAULT 'system',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(platform, feature_type)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS platform_scenario_run (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      scenario_id UUID REFERENCES platform_scenario(id),
      platform TEXT NOT NULL,
      feature_type TEXT NOT NULL,
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      status TEXT DEFAULT 'started',
      input_data JSONB DEFAULT '{}',
      output_data JSONB DEFAULT '{}',
      error_message TEXT,
      duration_ms INTEGER,
      requires_approval BOOLEAN DEFAULT false,
      approved_by TEXT,
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS platform_review (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      platform TEXT NOT NULL,
      external_review_id TEXT,
      reviewer_name TEXT,
      reviewer_avatar_url TEXT,
      rating NUMERIC(3,1),
      title TEXT,
      body TEXT NOT NULL,
      sentiment TEXT,
      sentiment_score NUMERIC(4,3),
      likes_count INTEGER DEFAULT 0,
      helpful_count INTEGER DEFAULT 0,
      response_text TEXT,
      responded_at TIMESTAMPTZ,
      responded_by TEXT,
      is_flagged BOOLEAN DEFAULT false,
      flag_reason TEXT,
      tags TEXT[] DEFAULT '{}',
      source_url TEXT,
      published_at TIMESTAMPTZ,
      fetched_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(platform, external_review_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS platform_insight (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      platform TEXT NOT NULL,
      insight_type TEXT NOT NULL,
      period TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      data JSONB DEFAULT '{}',
      recommendations JSONB DEFAULT '[]',
      generated_by TEXT DEFAULT 'ollama',
      model_used TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS platform_content_feedback (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      unified_item_id UUID,
      platform TEXT NOT NULL,
      external_post_id TEXT,
      feedback_type TEXT NOT NULL,
      feedback_count INTEGER DEFAULT 0,
      top_comments JSONB DEFAULT '[]',
      sentiment_breakdown JSONB DEFAULT '{}',
      fetched_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(platform, external_post_id, feedback_type)
    )
  `);
}

// ── Scenario definitions ──────────────────────────────────────────────────────

type Step = { step: number; action: string; ui_element?: string; api_call?: string; expected?: string };
type Field = { name: string; label: string; type: string; required?: boolean; platform_specific?: boolean; options?: string[] };

interface ScenarioDef {
  feature_type: string;
  scenario_name: string;
  scenario_description?: string;
  actor: string;
  trigger_type: string;
  steps: Step[];
  input_fields: Field[];
  output_type?: string;
  api_endpoints?: string[];
  has_analytics?: boolean;
  has_customer_feedback?: boolean;
  has_review_capability?: boolean;
  estimated_duration_seconds?: number;
  requires_approval?: boolean;
}

const TEXT_POST_FIELDS: Field[] = [
  { name: 'caption', label: 'Caption', type: 'text', required: true },
  { name: 'schedule_at', label: 'Schedule At', type: 'datetime' },
  { name: 'hashtags', label: 'Hashtags', type: 'tags' },
];

const IMAGE_POST_FIELDS: Field[] = [
  { name: 'image_url', label: 'Image URL', type: 'url', required: true },
  { name: 'caption', label: 'Caption', type: 'text' },
  { name: 'alt_text', label: 'Alt Text', type: 'text' },
  { name: 'schedule_at', label: 'Schedule At', type: 'datetime' },
];

const VIDEO_POST_FIELDS: Field[] = [
  { name: 'video_url', label: 'Video URL', type: 'url', required: true },
  { name: 'title', label: 'Title', type: 'text' },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'thumbnail_url', label: 'Thumbnail URL', type: 'url' },
];

const CAMPAIGN_FIELDS: Field[] = [
  { name: 'campaign_name', label: 'Campaign Name', type: 'text', required: true },
  { name: 'objective', label: 'Objective', type: 'select', options: ['awareness', 'traffic', 'leads', 'sales'] },
  { name: 'budget_daily', label: 'Daily Budget ($)', type: 'number' },
  { name: 'start_date', label: 'Start Date', type: 'date' },
  { name: 'end_date', label: 'End Date', type: 'date' },
  { name: 'target_audience', label: 'Target Audience', type: 'textarea' },
];

export const UNIVERSAL_SCENARIOS: ScenarioDef[] = [
  // text_post
  {
    feature_type: 'text_post', scenario_name: 'Create and publish text post',
    scenario_description: 'Admin writes, previews, and publishes a text post to the platform.',
    actor: 'admin', trigger_type: 'manual',
    steps: [
      { step: 1, action: 'Write post text', ui_element: 'caption textarea', api_call: '' },
      { step: 2, action: 'Set schedule (optional)', ui_element: 'datetime picker' },
      { step: 3, action: 'Preview post', ui_element: 'Preview button' },
      { step: 4, action: 'Publish post', api_call: 'POST /api/social/publish', expected: 'post_id returned' },
    ],
    input_fields: TEXT_POST_FIELDS,
    output_type: 'post_id',
    api_endpoints: ['/api/social/publish'],
  },
  {
    feature_type: 'text_post', scenario_name: 'Customer submits text post for approval',
    scenario_description: 'Customer drafts a text post; admin must approve before publishing.',
    actor: 'customer', trigger_type: 'manual', requires_approval: true,
    steps: [
      { step: 1, action: 'Customer writes post', ui_element: 'caption textarea' },
      { step: 2, action: 'Submit for approval', api_call: 'POST /api/customer/social/post', expected: 'pending_approval' },
      { step: 3, action: 'Admin reviews in pending queue', ui_element: 'Pending Approvals tab' },
      { step: 4, action: 'Admin approves/rejects', api_call: 'POST /api/admin/platform-scenarios/runs/:id/approve' },
    ],
    input_fields: TEXT_POST_FIELDS,
    output_type: 'post_id',
    api_endpoints: ['/api/customer/social/post', '/api/admin/platform-scenarios/runs/:id/approve'],
  },
  {
    feature_type: 'text_post', scenario_name: 'AI-generate text post via Ollama',
    scenario_description: 'Admin enters topic and tone; Ollama generates post text for review.',
    actor: 'admin', trigger_type: 'agentic',
    steps: [
      { step: 1, action: 'Enter topic and tone', ui_element: 'topic/tone inputs' },
      { step: 2, action: 'Ollama generates caption', api_call: 'POST /api/ai/generate-caption' },
      { step: 3, action: 'Review and edit generated text' },
      { step: 4, action: 'Publish or schedule', api_call: 'POST /api/social/publish' },
    ],
    input_fields: [
      { name: 'topic', label: 'Topic', type: 'text', required: true },
      { name: 'tone', label: 'Tone', type: 'select', options: ['professional', 'casual', 'inspirational', 'humorous'] },
      { name: 'platform', label: 'Platform', type: 'text', platform_specific: true },
    ],
    output_type: 'post_id',
    api_endpoints: ['/api/ai/generate-caption', '/api/social/publish'],
    estimated_duration_seconds: 120,
  },
  {
    feature_type: 'text_post', scenario_name: 'Schedule recurring text posts',
    scenario_description: 'Admin sets up a recurring schedule for text posts.',
    actor: 'admin', trigger_type: 'scheduled',
    steps: [
      { step: 1, action: 'Configure cron schedule', ui_element: 'schedule builder' },
      { step: 2, action: 'Set post templates or pool', ui_element: 'template picker' },
      { step: 3, action: 'Activate recurring job', api_call: 'POST /api/social/schedule-recurring' },
    ],
    input_fields: [
      { name: 'cron_expression', label: 'Schedule (cron)', type: 'text', required: true },
      { name: 'template_ids', label: 'Post Templates', type: 'tags' },
    ],
    output_type: 'job_id',
    api_endpoints: ['/api/social/schedule-recurring'],
  },

  // image_post
  {
    feature_type: 'image_post', scenario_name: 'Upload and publish image post',
    scenario_description: 'Admin uploads an image and publishes to the platform.',
    actor: 'admin', trigger_type: 'manual',
    steps: [
      { step: 1, action: 'Upload image', ui_element: 'file upload / URL input' },
      { step: 2, action: 'Write caption and alt text' },
      { step: 3, action: 'Preview post' },
      { step: 4, action: 'Publish', api_call: 'POST /api/social/publish' },
    ],
    input_fields: IMAGE_POST_FIELDS,
    output_type: 'post_id',
    api_endpoints: ['/api/social/publish'],
  },
  {
    feature_type: 'image_post', scenario_name: 'Customer image post with approval',
    scenario_description: 'Customer submits image post; requires admin approval.',
    actor: 'customer', trigger_type: 'manual', requires_approval: true,
    steps: [
      { step: 1, action: 'Customer uploads image and caption' },
      { step: 2, action: 'Submit for approval', api_call: 'POST /api/customer/social/post' },
      { step: 3, action: 'Admin approves', api_call: 'POST /api/admin/platform-scenarios/runs/:id/approve' },
    ],
    input_fields: IMAGE_POST_FIELDS,
    output_type: 'post_id',
    api_endpoints: ['/api/customer/social/post'],
  },
  {
    feature_type: 'image_post', scenario_name: 'AI-generate image caption',
    scenario_description: 'Ollama generates an engaging caption for the uploaded image.',
    actor: 'admin', trigger_type: 'agentic',
    steps: [
      { step: 1, action: 'Upload image' },
      { step: 2, action: 'Ollama analyzes and generates caption', api_call: 'POST /api/ai/generate-caption' },
      { step: 3, action: 'Edit and publish' },
    ],
    input_fields: [
      { name: 'image_url', label: 'Image URL', type: 'url', required: true },
      { name: 'style', label: 'Caption Style', type: 'select', options: ['engaging', 'descriptive', 'promotional'] },
    ],
    output_type: 'post_id',
    api_endpoints: ['/api/ai/generate-caption', '/api/social/publish'],
  },
  {
    feature_type: 'image_post', scenario_name: 'Batch schedule image gallery',
    scenario_description: 'Schedule multiple images across time slots.',
    actor: 'admin', trigger_type: 'scheduled',
    steps: [
      { step: 1, action: 'Upload multiple images' },
      { step: 2, action: 'Set distribution schedule' },
      { step: 3, action: 'Submit batch job', api_call: 'POST /api/social/batch-schedule' },
    ],
    input_fields: [
      { name: 'image_urls', label: 'Image URLs (comma separated)', type: 'textarea', required: true },
      { name: 'start_date', label: 'Start Date', type: 'date' },
      { name: 'interval_hours', label: 'Interval (hours)', type: 'number' },
    ],
    output_type: 'job_id',
    api_endpoints: ['/api/social/batch-schedule'],
  },

  // video_post
  {
    feature_type: 'video_post', scenario_name: 'Upload and publish video',
    scenario_description: 'Admin uploads a video file and publishes it.',
    actor: 'admin', trigger_type: 'manual',
    steps: [
      { step: 1, action: 'Upload video file or provide URL' },
      { step: 2, action: 'Add title, description, thumbnail' },
      { step: 3, action: 'Publish', api_call: 'POST /api/social/publish' },
    ],
    input_fields: VIDEO_POST_FIELDS,
    output_type: 'post_id',
    api_endpoints: ['/api/social/publish'],
    estimated_duration_seconds: 180,
  },
  {
    feature_type: 'video_post', scenario_name: 'Schedule video with optimal timing',
    scenario_description: 'Platform analytics determine the best time to publish; video is queued accordingly.',
    actor: 'admin', trigger_type: 'scheduled',
    steps: [
      { step: 1, action: 'Upload video' },
      { step: 2, action: 'System calculates best time', api_call: 'GET /api/social/best-time' },
      { step: 3, action: 'Confirm schedule', api_call: 'POST /api/social/schedule' },
    ],
    input_fields: VIDEO_POST_FIELDS,
    output_type: 'post_id',
    api_endpoints: ['/api/social/best-time', '/api/social/schedule'],
  },
  {
    feature_type: 'video_post', scenario_name: 'AI-generate video description',
    scenario_description: 'Ollama generates SEO-optimized description and tags for the video.',
    actor: 'admin', trigger_type: 'agentic',
    steps: [
      { step: 1, action: 'Enter video title and key points' },
      { step: 2, action: 'Ollama generates description + hashtags', api_call: 'POST /api/ai/generate-caption' },
      { step: 3, action: 'Review and publish' },
    ],
    input_fields: [
      { name: 'video_url', label: 'Video URL', type: 'url', required: true },
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'key_points', label: 'Key Points', type: 'textarea' },
    ],
    output_type: 'post_id',
    api_endpoints: ['/api/ai/generate-caption', '/api/social/publish'],
  },

  // campaign
  {
    feature_type: 'campaign', scenario_name: 'Create paid campaign',
    scenario_description: 'Admin creates a paid advertising campaign on the platform.',
    actor: 'admin', trigger_type: 'manual',
    steps: [
      { step: 1, action: 'Enter campaign details' },
      { step: 2, action: 'Set budget and targeting' },
      { step: 3, action: 'Launch campaign', api_call: 'POST /api/ads/campaigns' },
    ],
    input_fields: CAMPAIGN_FIELDS,
    output_type: 'campaign_id',
    api_endpoints: ['/api/ads/campaigns'],
    has_analytics: true,
  },
  {
    feature_type: 'campaign', scenario_name: 'Pause/resume campaign',
    scenario_description: 'Admin pauses or resumes an active paid campaign.',
    actor: 'admin', trigger_type: 'manual',
    steps: [
      { step: 1, action: 'Select campaign from list' },
      { step: 2, action: 'Change status (pause/resume)', api_call: 'PATCH /api/ads/campaigns/:id' },
      { step: 3, action: 'Confirm status change' },
    ],
    input_fields: [
      { name: 'campaign_id', label: 'Campaign ID', type: 'text', required: true },
      { name: 'action', label: 'Action', type: 'select', options: ['pause', 'resume'] },
    ],
    output_type: 'campaign_id',
    api_endpoints: ['/api/ads/campaigns/:id'],
  },
  {
    feature_type: 'campaign', scenario_name: 'Campaign performance report',
    scenario_description: 'Generate a performance summary report for a campaign.',
    actor: 'admin', trigger_type: 'manual',
    steps: [
      { step: 1, action: 'Select campaign and date range' },
      { step: 2, action: 'Fetch metrics', api_call: 'GET /api/ads/campaigns/:id/report' },
      { step: 3, action: 'Export or display report' },
    ],
    input_fields: [
      { name: 'campaign_id', label: 'Campaign ID', type: 'text', required: true },
      { name: 'date_from', label: 'From', type: 'date' },
      { name: 'date_to', label: 'To', type: 'date' },
    ],
    output_type: 'report',
    api_endpoints: ['/api/ads/campaigns/:id/report'],
    has_analytics: true,
  },

  // review
  {
    feature_type: 'review', scenario_name: 'Read and respond to reviews',
    scenario_description: 'Admin reads platform reviews and publishes responses.',
    actor: 'admin', trigger_type: 'manual',
    steps: [
      { step: 1, action: 'Fetch reviews', api_call: 'GET /api/admin/platform-scenarios/reviews' },
      { step: 2, action: 'Filter by rating/sentiment' },
      { step: 3, action: 'Select review and write response' },
      { step: 4, action: 'Publish response', api_call: 'POST /api/admin/platform-scenarios/review-response' },
    ],
    input_fields: [
      { name: 'review_id', label: 'Review ID', type: 'text', required: true },
      { name: 'response_text', label: 'Response Text', type: 'textarea', required: true },
    ],
    output_type: 'review_response',
    api_endpoints: ['/api/admin/platform-scenarios/reviews', '/api/admin/platform-scenarios/review-response'],
    has_review_capability: true,
  },
  {
    feature_type: 'review', scenario_name: 'Flag inappropriate review',
    scenario_description: 'Admin flags a review for removal due to policy violation.',
    actor: 'admin', trigger_type: 'manual',
    steps: [
      { step: 1, action: 'Select review' },
      { step: 2, action: 'Enter flag reason' },
      { step: 3, action: 'Submit flag to platform', api_call: 'POST /api/admin/platform-scenarios/reviews/flag' },
    ],
    input_fields: [
      { name: 'review_id', label: 'Review ID', type: 'text', required: true },
      { name: 'flag_reason', label: 'Reason', type: 'select', options: ['spam', 'fake', 'offensive', 'off_topic'] },
    ],
    output_type: 'flag_id',
    api_endpoints: ['/api/admin/platform-scenarios/reviews/flag'],
    has_review_capability: true,
  },
  {
    feature_type: 'review', scenario_name: 'Export reviews to CSV',
    scenario_description: 'Download all reviews as a CSV report.',
    actor: 'admin', trigger_type: 'manual',
    steps: [
      { step: 1, action: 'Select date range and platform' },
      { step: 2, action: 'Generate CSV', api_call: 'GET /api/admin/platform-scenarios/reviews?format=csv' },
    ],
    input_fields: [
      { name: 'platform', label: 'Platform', type: 'text' },
      { name: 'date_from', label: 'From', type: 'date' },
      { name: 'date_to', label: 'To', type: 'date' },
    ],
    output_type: 'report',
    api_endpoints: ['/api/admin/platform-scenarios/reviews'],
  },
  {
    feature_type: 'review', scenario_name: 'AI-generate review response',
    scenario_description: 'Ollama drafts a professional response to a review.',
    actor: 'admin', trigger_type: 'agentic',
    steps: [
      { step: 1, action: 'Select review' },
      { step: 2, action: 'Ollama generates response draft', api_call: 'POST /api/admin/platform-scenarios/generate-insight' },
      { step: 3, action: 'Edit and publish response' },
    ],
    input_fields: [
      { name: 'review_id', label: 'Review ID', type: 'text', required: true },
      { name: 'tone', label: 'Response Tone', type: 'select', options: ['professional', 'empathetic', 'apologetic', 'thankful'] },
    ],
    output_type: 'review_response',
    api_endpoints: ['/api/admin/platform-scenarios/review-response'],
    has_review_capability: true,
    estimated_duration_seconds: 90,
  },

  // feedback
  {
    feature_type: 'feedback', scenario_name: 'Track post engagement (likes/dislikes/comments)',
    scenario_description: 'Monitor engagement metrics on published posts.',
    actor: 'both', trigger_type: 'manual',
    steps: [
      { step: 1, action: 'Select post or date range' },
      { step: 2, action: 'Fetch engagement data', api_call: 'GET /api/admin/platform-scenarios/feedback' },
      { step: 3, action: 'View breakdown by type' },
    ],
    input_fields: [
      { name: 'platform', label: 'Platform', type: 'text' },
      { name: 'post_id', label: 'Post ID', type: 'text' },
    ],
    output_type: 'insight',
    api_endpoints: ['/api/admin/platform-scenarios/feedback'],
    has_customer_feedback: true,
    has_analytics: true,
  },
  {
    feature_type: 'feedback', scenario_name: 'Sentiment analysis on comments',
    scenario_description: 'Ollama classifies comment sentiment (positive/neutral/negative).',
    actor: 'admin', trigger_type: 'agentic',
    steps: [
      { step: 1, action: 'Select post with comments' },
      { step: 2, action: 'Send top_comments to Ollama', api_call: 'POST /api/admin/platform-scenarios/analyze-feedback' },
      { step: 3, action: 'View sentiment breakdown and summary' },
    ],
    input_fields: [
      { name: 'platform', label: 'Platform', type: 'text', required: true },
      { name: 'external_post_id', label: 'Post ID', type: 'text', required: true },
    ],
    output_type: 'insight',
    api_endpoints: ['/api/admin/platform-scenarios/analyze-feedback'],
    has_analytics: true,
    estimated_duration_seconds: 90,
  },
  {
    feature_type: 'feedback', scenario_name: 'Negative comment alert',
    scenario_description: 'Trigger alert when negative comment ratio exceeds threshold.',
    actor: 'system', trigger_type: 'event',
    steps: [
      { step: 1, action: 'System monitors comment sentiment in real time' },
      { step: 2, action: 'If negative% > threshold → send alert', api_call: 'POST /api/alerts/trigger' },
      { step: 3, action: 'Admin receives notification and reviews' },
    ],
    input_fields: [
      { name: 'threshold_pct', label: 'Negative Threshold %', type: 'number', required: true },
    ],
    output_type: 'alert',
    api_endpoints: ['/api/alerts/trigger'],
  },
  {
    feature_type: 'feedback', scenario_name: 'Export feedback report',
    scenario_description: 'Export all engagement feedback data as CSV.',
    actor: 'admin', trigger_type: 'manual',
    steps: [
      { step: 1, action: 'Select platform and date range' },
      { step: 2, action: 'Generate export', api_call: 'GET /api/admin/platform-scenarios/feedback?format=csv' },
    ],
    input_fields: [
      { name: 'platform', label: 'Platform', type: 'text' },
      { name: 'date_from', label: 'From', type: 'date' },
      { name: 'date_to', label: 'To', type: 'date' },
    ],
    output_type: 'report',
    api_endpoints: ['/api/admin/platform-scenarios/feedback'],
  },

  // insight
  {
    feature_type: 'insight', scenario_name: 'Generate content performance insight',
    scenario_description: 'Ollama analyzes post metrics and provides actionable recommendations.',
    actor: 'admin', trigger_type: 'agentic',
    steps: [
      { step: 1, action: 'Select platform and period' },
      { step: 2, action: 'Ollama analyzes metrics and generates insight', api_call: 'POST /api/admin/platform-scenarios/generate-insight' },
      { step: 3, action: 'View summary and recommendations' },
    ],
    input_fields: [
      { name: 'platform', label: 'Platform', type: 'text', required: true },
      { name: 'period', label: 'Period', type: 'select', options: ['this_month', 'last_month', 'quarter'] },
      { name: 'insight_type', label: 'Insight Type', type: 'select', options: ['content_performance', 'audience_growth', 'best_time', 'competitor', 'hashtag', 'sentiment', 'roi'] },
    ],
    output_type: 'insight',
    api_endpoints: ['/api/admin/platform-scenarios/generate-insight'],
    has_analytics: true,
    estimated_duration_seconds: 120,
  },
  {
    feature_type: 'insight', scenario_name: 'Best posting time analysis',
    scenario_description: 'Analyze when audience is most active to optimize posting schedule.',
    actor: 'admin', trigger_type: 'manual',
    steps: [
      { step: 1, action: 'Select platform' },
      { step: 2, action: 'Fetch time-based engagement data', api_call: 'GET /api/social/analytics' },
      { step: 3, action: 'Display heatmap of best times' },
    ],
    input_fields: [{ name: 'platform', label: 'Platform', type: 'text', required: true }],
    output_type: 'insight',
    api_endpoints: ['/api/social/analytics'],
    has_analytics: true,
  },
  {
    feature_type: 'insight', scenario_name: 'Audience growth insight',
    scenario_description: 'Track follower/subscriber growth trends over time.',
    actor: 'both', trigger_type: 'manual',
    steps: [
      { step: 1, action: 'Select platform and date range' },
      { step: 2, action: 'Fetch follower count history', api_call: 'GET /api/social/analytics' },
      { step: 3, action: 'Display growth chart and Ollama analysis' },
    ],
    input_fields: [
      { name: 'platform', label: 'Platform', type: 'text', required: true },
      { name: 'period', label: 'Period', type: 'select', options: ['this_month', 'last_month', 'quarter'] },
    ],
    output_type: 'insight',
    api_endpoints: ['/api/social/analytics'],
    has_analytics: true,
  },
  {
    feature_type: 'insight', scenario_name: 'Competitor benchmarking',
    scenario_description: 'Compare our metrics against industry competitors.',
    actor: 'admin', trigger_type: 'manual',
    steps: [
      { step: 1, action: 'Enter competitor handles or URLs' },
      { step: 2, action: 'Fetch public metrics' },
      { step: 3, action: 'Ollama generates comparison insight', api_call: 'POST /api/admin/platform-scenarios/generate-insight' },
    ],
    input_fields: [
      { name: 'platform', label: 'Platform', type: 'text', required: true },
      { name: 'competitor_handles', label: 'Competitor Handles', type: 'tags' },
    ],
    output_type: 'insight',
    api_endpoints: ['/api/admin/platform-scenarios/generate-insight'],
    has_analytics: true,
    estimated_duration_seconds: 180,
  },
];

// Platform-specific extra scenarios
export const PLATFORM_EXTRA_SCENARIOS: Record<string, ScenarioDef[]> = {
  youtube: [
    { feature_type: 'live', scenario_name: 'Go live setup', scenario_description: 'Configure and start a YouTube Live broadcast.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Set stream title and description' }, { step: 2, action: 'Get stream key', api_call: 'GET /api/social/stream-key' }, { step: 3, action: 'Start broadcast', api_call: 'POST /api/social/go-live' }], input_fields: [{ name: 'title', label: 'Title', type: 'text', required: true }, { name: 'description', label: 'Description', type: 'textarea' }, { name: 'scheduled_at', label: 'Schedule', type: 'datetime' }], output_type: 'broadcast_id', api_endpoints: ['/api/social/go-live'] },
    { feature_type: 'live', scenario_name: 'Schedule live stream', scenario_description: 'Pre-schedule a future YouTube Live event.', actor: 'admin', trigger_type: 'scheduled', steps: [{ step: 1, action: 'Enter stream details' }, { step: 2, action: 'Schedule broadcast', api_call: 'POST /api/social/schedule-live' }], input_fields: [{ name: 'title', label: 'Title', type: 'text', required: true }, { name: 'scheduled_at', label: 'Schedule At', type: 'datetime', required: true }], output_type: 'broadcast_id', api_endpoints: ['/api/social/schedule-live'] },
    { feature_type: 'playlist', scenario_name: 'Add video to playlist', scenario_description: 'Add a published video to a YouTube playlist.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Select video' }, { step: 2, action: 'Select playlist' }, { step: 3, action: 'Add to playlist', api_call: 'POST /api/social/playlist/add' }], input_fields: [{ name: 'video_id', label: 'Video ID', type: 'text', required: true }, { name: 'playlist_id', label: 'Playlist ID', type: 'text', required: true }], output_type: 'playlist_id', api_endpoints: ['/api/social/playlist/add'] },
    { feature_type: 'community_post', scenario_name: 'Create community post with poll', scenario_description: 'Post a community update or poll to YouTube subscribers.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Write community post text' }, { step: 2, action: 'Add poll options (optional)' }, { step: 3, action: 'Publish', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'text', label: 'Text', type: 'textarea', required: true }, { name: 'poll_options', label: 'Poll Options', type: 'tags' }], output_type: 'post_id', api_endpoints: ['/api/social/publish'] },
  ],
  facebook: [
    { feature_type: 'story', scenario_name: 'Publish 24h story', scenario_description: 'Post a 24-hour ephemeral story to Facebook.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Upload image or video' }, { step: 2, action: 'Add sticker or text overlay' }, { step: 3, action: 'Publish story', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'media_url', label: 'Media URL', type: 'url', required: true }, { name: 'overlay_text', label: 'Overlay Text', type: 'text' }], output_type: 'story_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'reel', scenario_name: 'Publish Facebook Reel', scenario_description: 'Upload a short-form video as a Facebook Reel.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Upload short video' }, { step: 2, action: 'Add caption and audio credits' }, { step: 3, action: 'Publish Reel', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'video_url', label: 'Video URL', type: 'url', required: true }, { name: 'caption', label: 'Caption', type: 'text' }], output_type: 'post_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'event', scenario_name: 'Create Facebook Event', scenario_description: 'Create a public or private event on the Facebook Page.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Enter event details' }, { step: 2, action: 'Set cover image' }, { step: 3, action: 'Publish event', api_call: 'POST /api/social/events' }], input_fields: [{ name: 'name', label: 'Event Name', type: 'text', required: true }, { name: 'start_time', label: 'Start Time', type: 'datetime', required: true }, { name: 'end_time', label: 'End Time', type: 'datetime' }, { name: 'description', label: 'Description', type: 'textarea' }, { name: 'location', label: 'Location', type: 'text' }], output_type: 'event_id', api_endpoints: ['/api/social/events'] },
    { feature_type: 'group_post', scenario_name: 'Post to Facebook Group', scenario_description: 'Publish content to a managed Facebook Group.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Select group' }, { step: 2, action: 'Write post' }, { step: 3, action: 'Publish to group', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'group_id', label: 'Group ID', type: 'text', required: true }, { name: 'message', label: 'Message', type: 'textarea', required: true }], output_type: 'post_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'inbox', scenario_name: 'Reply to Facebook message', scenario_description: 'Reply to a customer message in Facebook Inbox.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'View inbox messages' }, { step: 2, action: 'Select conversation' }, { step: 3, action: 'Write and send reply', api_call: 'POST /api/social/dm/reply' }], input_fields: [{ name: 'thread_id', label: 'Thread ID', type: 'text', required: true }, { name: 'reply_text', label: 'Reply Text', type: 'textarea', required: true }], output_type: 'message_id', api_endpoints: ['/api/social/dm/reply'] },
  ],
  instagram: [
    { feature_type: 'reel', scenario_name: 'Publish Instagram Reel with audio', scenario_description: 'Upload a short-form video Reel with trending audio.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Upload video (max 90s)' }, { step: 2, action: 'Select audio track' }, { step: 3, action: 'Add caption and hashtags' }, { step: 4, action: 'Publish Reel', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'video_url', label: 'Video URL', type: 'url', required: true }, { name: 'audio_track', label: 'Audio Track', type: 'text' }, { name: 'caption', label: 'Caption', type: 'text' }], output_type: 'post_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'story', scenario_name: 'Instagram Story with sticker', scenario_description: 'Publish a story with poll, question, or countdown sticker.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Upload image or video' }, { step: 2, action: 'Add interactive sticker' }, { step: 3, action: 'Publish', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'media_url', label: 'Media URL', type: 'url', required: true }, { name: 'sticker_type', label: 'Sticker', type: 'select', options: ['poll', 'question', 'countdown', 'quiz'] }], output_type: 'story_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'shopping_post', scenario_name: 'Tag products in post', scenario_description: 'Create a shoppable Instagram post with product tags.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Upload image' }, { step: 2, action: 'Tag products from catalog' }, { step: 3, action: 'Publish shopping post', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'image_url', label: 'Image URL', type: 'url', required: true }, { name: 'product_ids', label: 'Product IDs', type: 'tags' }, { name: 'caption', label: 'Caption', type: 'text' }], output_type: 'post_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'carousel', scenario_name: 'Multi-image carousel post', scenario_description: 'Publish a carousel with up to 10 images or videos.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Upload multiple media items' }, { step: 2, action: 'Order and caption items' }, { step: 3, action: 'Publish carousel', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'media_urls', label: 'Media URLs', type: 'textarea', required: true }, { name: 'caption', label: 'Caption', type: 'text' }], output_type: 'post_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'collab', scenario_name: 'Send collab post request', scenario_description: 'Invite another account to co-author an Instagram post.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Create post' }, { step: 2, action: 'Invite collaborator', api_call: 'POST /api/social/collab-invite' }, { step: 3, action: 'Collaborator accepts → post goes live' }], input_fields: [{ name: 'image_url', label: 'Image URL', type: 'url', required: true }, { name: 'collaborator_username', label: 'Collaborator Username', type: 'text', required: true }, { name: 'caption', label: 'Caption', type: 'text' }], output_type: 'post_id', api_endpoints: ['/api/social/collab-invite'] },
  ],
  x_twitter: [
    { feature_type: 'thread', scenario_name: 'Publish multi-tweet thread', scenario_description: 'Create a connected thread of tweets.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Write each tweet (max 280 chars each)' }, { step: 2, action: 'Preview thread order' }, { step: 3, action: 'Publish thread', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'tweets', label: 'Tweets (one per line)', type: 'textarea', required: true }, { name: 'schedule_at', label: 'Schedule', type: 'datetime' }], output_type: 'thread_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'poll', scenario_name: 'Create Twitter poll', scenario_description: 'Publish a poll tweet with 2-4 options.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Write poll question' }, { step: 2, action: 'Enter poll options (2-4)' }, { step: 3, action: 'Set duration' }, { step: 4, action: 'Publish', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'question', label: 'Poll Question', type: 'text', required: true }, { name: 'options', label: 'Options (comma separated)', type: 'text', required: true }, { name: 'duration_hours', label: 'Duration (hours)', type: 'number' }], output_type: 'post_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'space', scenario_name: 'Schedule Twitter Space', scenario_description: 'Schedule a live audio conversation on Twitter Spaces.', actor: 'admin', trigger_type: 'scheduled', steps: [{ step: 1, action: 'Enter space title' }, { step: 2, action: 'Schedule space time', api_call: 'POST /api/social/spaces' }, { step: 3, action: 'Invite co-hosts' }], input_fields: [{ name: 'title', label: 'Space Title', type: 'text', required: true }, { name: 'scheduled_at', label: 'Scheduled At', type: 'datetime', required: true }, { name: 'co_hosts', label: 'Co-Host Handles', type: 'tags' }], output_type: 'space_id', api_endpoints: ['/api/social/spaces'] },
  ],
  linkedin: [
    { feature_type: 'article', scenario_name: 'Publish LinkedIn article', scenario_description: 'Write and publish a long-form thought leadership article.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Write article with rich formatting' }, { step: 2, action: 'Add cover image' }, { step: 3, action: 'Publish article', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'title', label: 'Title', type: 'text', required: true }, { name: 'body', label: 'Article Body (HTML)', type: 'textarea', required: true }, { name: 'cover_image_url', label: 'Cover Image', type: 'url' }], output_type: 'post_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'document', scenario_name: 'Publish PDF carousel document', scenario_description: 'Upload a PDF as an interactive LinkedIn document post.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Upload PDF file' }, { step: 2, action: 'Add caption' }, { step: 3, action: 'Publish', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'document_url', label: 'Document URL', type: 'url', required: true }, { name: 'title', label: 'Document Title', type: 'text' }, { name: 'caption', label: 'Caption', type: 'text' }], output_type: 'post_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'event', scenario_name: 'Create LinkedIn Event', scenario_description: 'Create a professional event on LinkedIn.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Enter event name, date, description' }, { step: 2, action: 'Set attendance type (online/in-person)' }, { step: 3, action: 'Create event', api_call: 'POST /api/social/events' }], input_fields: [{ name: 'name', label: 'Event Name', type: 'text', required: true }, { name: 'start_time', label: 'Start Time', type: 'datetime', required: true }, { name: 'event_type', label: 'Type', type: 'select', options: ['online', 'in_person', 'hybrid'] }, { name: 'description', label: 'Description', type: 'textarea' }], output_type: 'event_id', api_endpoints: ['/api/social/events'] },
    { feature_type: 'newsletter', scenario_name: 'Publish LinkedIn Newsletter issue', scenario_description: 'Publish a new issue to LinkedIn Newsletter subscribers.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Write newsletter content' }, { step: 2, action: 'Set issue title and cover' }, { step: 3, action: 'Publish issue', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'newsletter_id', label: 'Newsletter ID', type: 'text', required: true }, { name: 'title', label: 'Issue Title', type: 'text', required: true }, { name: 'body', label: 'Body', type: 'textarea', required: true }], output_type: 'post_id', api_endpoints: ['/api/social/publish'] },
  ],
  tiktok: [
    { feature_type: 'duet', scenario_name: 'Create Duet with trending video', scenario_description: 'Record and publish a TikTok Duet alongside a trending video.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Select target video for duet' }, { step: 2, action: 'Upload duet video' }, { step: 3, action: 'Publish duet', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'target_video_id', label: 'Target Video ID', type: 'text', required: true }, { name: 'duet_video_url', label: 'Duet Video URL', type: 'url', required: true }, { name: 'caption', label: 'Caption', type: 'text' }], output_type: 'post_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'stitch', scenario_name: 'Create Stitch from trending video', scenario_description: 'Clip and respond to a trending TikTok video.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Select source video and clip segment (1-5s)' }, { step: 2, action: 'Record response video' }, { step: 3, action: 'Publish stitch', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'source_video_id', label: 'Source Video ID', type: 'text', required: true }, { name: 'response_video_url', label: 'Response Video URL', type: 'url', required: true }], output_type: 'post_id', api_endpoints: ['/api/social/publish'] },
  ],
  whatsapp_business: [
    { feature_type: 'template_message', scenario_name: 'Send approved template message', scenario_description: 'Send a pre-approved WhatsApp Business template to customers.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Select approved template' }, { step: 2, action: 'Fill template variables' }, { step: 3, action: 'Select recipient(s)' }, { step: 4, action: 'Send', api_call: 'POST /api/social/dm/send' }], input_fields: [{ name: 'template_name', label: 'Template Name', type: 'text', required: true }, { name: 'recipient_phone', label: 'Recipient Phone', type: 'text', required: true }, { name: 'template_vars', label: 'Template Variables (JSON)', type: 'textarea' }], output_type: 'message_id', api_endpoints: ['/api/social/dm/send'] },
    { feature_type: 'broadcast', scenario_name: 'Send broadcast list message', scenario_description: 'Send a message to a WhatsApp broadcast list.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Select broadcast list' }, { step: 2, action: 'Write message' }, { step: 3, action: 'Send broadcast', api_call: 'POST /api/social/dm/broadcast' }], input_fields: [{ name: 'list_id', label: 'Broadcast List ID', type: 'text', required: true }, { name: 'message', label: 'Message', type: 'textarea', required: true }], output_type: 'message_id', api_endpoints: ['/api/social/dm/broadcast'] },
    { feature_type: 'catalog', scenario_name: 'Share product catalog', scenario_description: 'Send a product catalog to a customer via WhatsApp.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Select product(s) from catalog' }, { step: 2, action: 'Select recipient' }, { step: 3, action: 'Send catalog link', api_call: 'POST /api/social/dm/send' }], input_fields: [{ name: 'recipient_phone', label: 'Recipient Phone', type: 'text', required: true }, { name: 'product_ids', label: 'Product IDs', type: 'tags' }], output_type: 'message_id', api_endpoints: ['/api/social/dm/send'] },
  ],
  pinterest: [
    { feature_type: 'pin', scenario_name: 'Create Pin with board', scenario_description: 'Create a Pinterest Pin and assign it to a board.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Upload image' }, { step: 2, action: 'Enter title, description, link' }, { step: 3, action: 'Select board' }, { step: 4, action: 'Publish pin', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'image_url', label: 'Image URL', type: 'url', required: true }, { name: 'title', label: 'Title', type: 'text' }, { name: 'description', label: 'Description', type: 'textarea' }, { name: 'link', label: 'Destination Link', type: 'url' }, { name: 'board_id', label: 'Board ID', type: 'text', required: true }], output_type: 'pin_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'idea_pin', scenario_name: 'Create multi-page Idea Pin', scenario_description: 'Create a multi-slide Idea Pin for tutorials or inspiration.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Upload multiple slides (images/video)' }, { step: 2, action: 'Add text overlay to each slide' }, { step: 3, action: 'Add title and tags' }, { step: 4, action: 'Publish Idea Pin', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'slides', label: 'Slide URLs (JSON array)', type: 'textarea', required: true }, { name: 'title', label: 'Title', type: 'text', required: true }, { name: 'tags', label: 'Tags', type: 'tags' }], output_type: 'pin_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'rich_pin', scenario_name: 'Create Rich Pin (article/product)', scenario_description: 'Create a Rich Pin with automatically synced metadata.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Provide source URL with rich metadata' }, { step: 2, action: 'System validates Rich Pin metadata' }, { step: 3, action: 'Publish Rich Pin', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'source_url', label: 'Source URL', type: 'url', required: true }, { name: 'pin_type', label: 'Pin Type', type: 'select', options: ['article', 'product'] }, { name: 'board_id', label: 'Board ID', type: 'text', required: true }], output_type: 'pin_id', api_endpoints: ['/api/social/publish'] },
  ],
  reddit: [
    { feature_type: 'thread_post', scenario_name: 'Submit to subreddit', scenario_description: 'Post a link or text thread to a subreddit.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Select subreddit' }, { step: 2, action: 'Enter title and content or link' }, { step: 3, action: 'Submit post', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'subreddit', label: 'Subreddit', type: 'text', required: true }, { name: 'title', label: 'Title', type: 'text', required: true }, { name: 'body', label: 'Body / Link', type: 'textarea' }, { name: 'post_type', label: 'Type', type: 'select', options: ['text', 'link', 'image'] }], output_type: 'post_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'poll', scenario_name: 'Create Reddit poll', scenario_description: 'Submit a poll post to a subreddit.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Enter poll question' }, { step: 2, action: 'Add options (2-6)' }, { step: 3, action: 'Submit poll', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'subreddit', label: 'Subreddit', type: 'text', required: true }, { name: 'title', label: 'Question', type: 'text', required: true }, { name: 'options', label: 'Options (comma separated)', type: 'text', required: true }], output_type: 'post_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'award', scenario_name: 'Give Reddit award', scenario_description: 'Give a Reddit Award to a post or comment.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Identify target post/comment' }, { step: 2, action: 'Select award type' }, { step: 3, action: 'Give award', api_call: 'POST /api/social/award' }], input_fields: [{ name: 'target_id', label: 'Post/Comment ID', type: 'text', required: true }, { name: 'award_type', label: 'Award Type', type: 'text' }], output_type: 'award_id', api_endpoints: ['/api/social/award'] },
  ],
  github: [
    { feature_type: 'release', scenario_name: 'Create GitHub release', scenario_description: 'Tag a version and publish release notes.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Select tag/version' }, { step: 2, action: 'Write release notes' }, { step: 3, action: 'Publish release', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'tag_name', label: 'Tag Name', type: 'text', required: true }, { name: 'name', label: 'Release Name', type: 'text' }, { name: 'body', label: 'Release Notes (Markdown)', type: 'textarea' }, { name: 'draft', label: 'Draft?', type: 'select', options: ['false', 'true'] }], output_type: 'release_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'discussion', scenario_name: 'Open GitHub discussion', scenario_description: 'Start a new discussion in the repository.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Select category' }, { step: 2, action: 'Write title and body' }, { step: 3, action: 'Post discussion', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'category', label: 'Category', type: 'text', required: true }, { name: 'title', label: 'Title', type: 'text', required: true }, { name: 'body', label: 'Body (Markdown)', type: 'textarea', required: true }], output_type: 'discussion_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'gist', scenario_name: 'Create GitHub Gist', scenario_description: 'Publish a public or secret Gist with code snippets.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Enter gist description' }, { step: 2, action: 'Add file(s) with content' }, { step: 3, action: 'Publish gist', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'description', label: 'Description', type: 'text' }, { name: 'files', label: 'Files (JSON: {filename: content})', type: 'textarea', required: true }, { name: 'public', label: 'Public?', type: 'select', options: ['true', 'false'] }], output_type: 'gist_id', api_endpoints: ['/api/social/publish'] },
  ],
  google_business: [
    { feature_type: 'gbp_post', scenario_name: 'Create business update post', scenario_description: 'Publish a general update to Google Business Profile.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Write update text' }, { step: 2, action: 'Add optional image' }, { step: 3, action: 'Publish post', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'summary', label: 'Summary', type: 'textarea', required: true }, { name: 'media_url', label: 'Image URL', type: 'url' }, { name: 'action_type', label: 'CTA Type', type: 'select', options: ['LEARN_MORE', 'SIGN_UP', 'SHOP', 'ORDER', 'BOOK', 'CALL'] }, { name: 'action_url', label: 'CTA URL', type: 'url' }], output_type: 'post_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'gbp_event', scenario_name: 'Create GBP event post', scenario_description: 'Post an event to Google Business Profile.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Enter event details' }, { step: 2, action: 'Publish event post', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'title', label: 'Event Title', type: 'text', required: true }, { name: 'start_date', label: 'Start Date', type: 'date', required: true }, { name: 'end_date', label: 'End Date', type: 'date' }, { name: 'summary', label: 'Summary', type: 'textarea' }], output_type: 'post_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'gbp_offer', scenario_name: 'Create GBP offer post', scenario_description: 'Publish a special offer or discount on Google Business Profile.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Enter offer details and coupon code' }, { step: 2, action: 'Set validity dates' }, { step: 3, action: 'Publish offer', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'title', label: 'Offer Title', type: 'text', required: true }, { name: 'coupon_code', label: 'Coupon Code', type: 'text' }, { name: 'start_date', label: 'Start Date', type: 'date' }, { name: 'end_date', label: 'End Date', type: 'date' }, { name: 'terms', label: 'Terms & Conditions', type: 'textarea' }], output_type: 'post_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'photo_upload', scenario_name: 'Add business photo', scenario_description: 'Upload a photo to the Google Business Profile listing.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Upload photo' }, { step: 2, action: 'Select category (interior/exterior/product/team)' }, { step: 3, action: 'Publish', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'photo_url', label: 'Photo URL', type: 'url', required: true }, { name: 'category', label: 'Category', type: 'select', options: ['INTERIOR', 'EXTERIOR', 'PRODUCT', 'AT_WORK', 'FOOD_AND_DRINK', 'MENU', 'COMMON_AREA', 'ROOMS', 'TEAMS', 'ADDITIONAL'] }], output_type: 'photo_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'qa_answer', scenario_name: 'Answer customer Q&A', scenario_description: 'Respond to a customer question on Google Business Profile.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Fetch open questions', api_call: 'GET /api/reviews/gbp-qa' }, { step: 2, action: 'Write answer' }, { step: 3, action: 'Publish answer', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'question_id', label: 'Question ID', type: 'text', required: true }, { name: 'answer_text', label: 'Answer', type: 'textarea', required: true }], output_type: 'answer_id', api_endpoints: ['/api/reviews/gbp-qa', '/api/social/publish'], has_review_capability: true },
  ],
  trustpilot: [
    { feature_type: 'review_invitation', scenario_name: 'Send Trustpilot review invitation', scenario_description: 'Send a review invite email to a customer via Trustpilot.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Enter customer email and name' }, { step: 2, action: 'Select service/product' }, { step: 3, action: 'Send invitation', api_call: 'POST /api/reviews/invite' }], input_fields: [{ name: 'customer_email', label: 'Customer Email', type: 'text', required: true }, { name: 'customer_name', label: 'Customer Name', type: 'text' }, { name: 'reference_id', label: 'Order/Reference ID', type: 'text' }], output_type: 'invitation_id', api_endpoints: ['/api/reviews/invite'], has_review_capability: true },
    { feature_type: 'review_response', scenario_name: 'Respond to Trustpilot review', scenario_description: 'Write and publish a response to a Trustpilot review.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Fetch reviews from Trustpilot', api_call: 'GET /api/admin/platform-scenarios/reviews' }, { step: 2, action: 'Write response' }, { step: 3, action: 'Publish response', api_call: 'POST /api/admin/platform-scenarios/review-response' }], input_fields: [{ name: 'review_id', label: 'Review ID', type: 'text', required: true }, { name: 'response_text', label: 'Response', type: 'textarea', required: true }], output_type: 'review_response', api_endpoints: ['/api/admin/platform-scenarios/review-response'], has_review_capability: true },
  ],
  vimeo: [
    { feature_type: 'video_upload', scenario_name: 'Upload video with chapters', scenario_description: 'Upload a Vimeo video and add chapter markers.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Upload video file' }, { step: 2, action: 'Add chapter markers (timecode + title)' }, { step: 3, action: 'Set privacy and publish', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'video_url', label: 'Video URL', type: 'url', required: true }, { name: 'title', label: 'Title', type: 'text', required: true }, { name: 'chapters', label: 'Chapters (JSON: [{timecode, title}])', type: 'textarea' }, { name: 'privacy', label: 'Privacy', type: 'select', options: ['public', 'private', 'unlisted', 'password'] }], output_type: 'video_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'showcase', scenario_name: 'Add video to Vimeo showcase', scenario_description: 'Add a published Vimeo video to a showcase collection.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Select video' }, { step: 2, action: 'Select showcase' }, { step: 3, action: 'Add to showcase', api_call: 'POST /api/social/showcase/add' }], input_fields: [{ name: 'video_id', label: 'Video ID', type: 'text', required: true }, { name: 'showcase_id', label: 'Showcase ID', type: 'text', required: true }], output_type: 'showcase_id', api_endpoints: ['/api/social/showcase/add'] },
    { feature_type: 'review_link', scenario_name: 'Create Vimeo review link for client', scenario_description: 'Generate a password-protected review link for a client to approve a video.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Select video' }, { step: 2, action: 'Generate review link with optional password', api_call: 'POST /api/social/review-link' }, { step: 3, action: 'Share link with client' }], input_fields: [{ name: 'video_id', label: 'Video ID', type: 'text', required: true }, { name: 'password', label: 'Password (optional)', type: 'text' }], output_type: 'review_link', api_endpoints: ['/api/social/review-link'] },
  ],
  twitch: [
    { feature_type: 'title_update', scenario_name: 'Update stream title and game', scenario_description: 'Update the live stream title, category, and game before/during broadcast.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Enter new title and category' }, { step: 2, action: 'Update channel info', api_call: 'PATCH /api/social/stream-info' }], input_fields: [{ name: 'title', label: 'Stream Title', type: 'text', required: true }, { name: 'game_name', label: 'Game/Category', type: 'text' }, { name: 'tags', label: 'Stream Tags', type: 'tags' }], output_type: 'channel_id', api_endpoints: ['/api/social/stream-info'] },
    { feature_type: 'clip_share', scenario_name: 'Share Twitch clip to social', scenario_description: 'Create a clip from recent broadcast and share to other platforms.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Create clip from broadcast', api_call: 'POST /api/social/clips' }, { step: 2, action: 'Download or get clip URL' }, { step: 3, action: 'Cross-post to other platforms' }], input_fields: [{ name: 'broadcaster_id', label: 'Broadcaster ID', type: 'text', required: true }, { name: 'has_delay', label: 'Add delay?', type: 'select', options: ['false', 'true'] }], output_type: 'clip_id', api_endpoints: ['/api/social/clips'] },
  ],
  discord: [
    { feature_type: 'embed_message', scenario_name: 'Send rich embed message', scenario_description: 'Send a rich embed with thumbnail, fields, and footer to a Discord channel.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Select server and channel' }, { step: 2, action: 'Configure embed (title, description, fields, thumbnail)' }, { step: 3, action: 'Send embed', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'channel_id', label: 'Channel ID', type: 'text', required: true }, { name: 'title', label: 'Embed Title', type: 'text', required: true }, { name: 'description', label: 'Description', type: 'textarea' }, { name: 'thumbnail_url', label: 'Thumbnail URL', type: 'url' }, { name: 'color', label: 'Color (hex)', type: 'text' }], output_type: 'message_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'thread', scenario_name: 'Create Discord thread', scenario_description: 'Start a new thread in a Discord channel for focused discussion.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Select channel' }, { step: 2, action: 'Enter thread name and opening message' }, { step: 3, action: 'Create thread', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'channel_id', label: 'Channel ID', type: 'text', required: true }, { name: 'thread_name', label: 'Thread Name', type: 'text', required: true }, { name: 'message', label: 'Opening Message', type: 'textarea' }], output_type: 'thread_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'event', scenario_name: 'Create Discord server event', scenario_description: 'Schedule a server event (voice/stage/external) for community members.', actor: 'admin', trigger_type: 'scheduled', steps: [{ step: 1, action: 'Enter event details' }, { step: 2, action: 'Set location (voice channel or external URL)' }, { step: 3, action: 'Create event', api_call: 'POST /api/social/events' }], input_fields: [{ name: 'guild_id', label: 'Server ID', type: 'text', required: true }, { name: 'name', label: 'Event Name', type: 'text', required: true }, { name: 'scheduled_start', label: 'Start Time', type: 'datetime', required: true }, { name: 'description', label: 'Description', type: 'textarea' }, { name: 'location', label: 'Location/Channel ID', type: 'text' }], output_type: 'event_id', api_endpoints: ['/api/social/events'] },
    { feature_type: 'announcement', scenario_name: 'Post to announcement channel', scenario_description: 'Publish an announcement that followers of the channel can receive cross-server.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Select announcement channel' }, { step: 2, action: 'Write announcement' }, { step: 3, action: 'Publish (and crosspost)', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'channel_id', label: 'Announcement Channel ID', type: 'text', required: true }, { name: 'content', label: 'Announcement Text', type: 'textarea', required: true }], output_type: 'message_id', api_endpoints: ['/api/social/publish'] },
  ],
  medium: [
    { feature_type: 'article', scenario_name: 'Publish Medium article', scenario_description: 'Write and publish a full article to Medium.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Write article in Markdown' }, { step: 2, action: 'Set title, tags, publish status' }, { step: 3, action: 'Publish', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'title', label: 'Title', type: 'text', required: true }, { name: 'content', label: 'Content (Markdown)', type: 'textarea', required: true }, { name: 'tags', label: 'Tags', type: 'tags' }, { name: 'publish_status', label: 'Status', type: 'select', options: ['public', 'draft', 'unlisted'] }], output_type: 'post_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'response', scenario_name: 'Respond to Medium story', scenario_description: 'Write a response (comment) to another Medium story.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Enter target post ID' }, { step: 2, action: 'Write response content' }, { step: 3, action: 'Submit response', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'post_id', label: 'Target Post ID', type: 'text', required: true }, { name: 'content', label: 'Response (Markdown)', type: 'textarea', required: true }], output_type: 'post_id', api_endpoints: ['/api/social/publish'] },
  ],
  substack: [
    { feature_type: 'newsletter', scenario_name: 'Send Substack newsletter issue', scenario_description: 'Publish and optionally email a newsletter issue to subscribers.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Write newsletter content' }, { step: 2, action: 'Set subject line and subtitle' }, { step: 3, action: 'Publish and email', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'subject', label: 'Subject Line', type: 'text', required: true }, { name: 'subtitle', label: 'Subtitle', type: 'text' }, { name: 'body', label: 'Body (Markdown)', type: 'textarea', required: true }, { name: 'paid_only', label: 'Paid subscribers only?', type: 'select', options: ['false', 'true'] }], output_type: 'post_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'note', scenario_name: 'Publish Substack Note', scenario_description: 'Publish a short-form Note to Substack feed.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Write short note text' }, { step: 2, action: 'Optionally add image or link' }, { step: 3, action: 'Publish Note', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'text', label: 'Note Text', type: 'textarea', required: true }, { name: 'image_url', label: 'Image URL', type: 'url' }], output_type: 'post_id', api_endpoints: ['/api/social/publish'] },
  ],
  patreon: [
    { feature_type: 'patron_post', scenario_name: 'Create patron-only post', scenario_description: 'Publish an exclusive post visible only to Patreon supporters.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Write post content' }, { step: 2, action: 'Set minimum tier access' }, { step: 3, action: 'Publish patron post', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'title', label: 'Title', type: 'text', required: true }, { name: 'content', label: 'Content', type: 'textarea', required: true }, { name: 'min_tier_id', label: 'Minimum Tier ID', type: 'text' }, { name: 'is_public', label: 'Public?', type: 'select', options: ['false', 'true'] }], output_type: 'post_id', api_endpoints: ['/api/social/publish'] },
    { feature_type: 'tier_management', scenario_name: 'Update tier benefits', scenario_description: 'Edit the description or price of a Patreon membership tier.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Select tier to edit' }, { step: 2, action: 'Update title, amount, benefits' }, { step: 3, action: 'Save changes', api_call: 'PATCH /api/social/tiers/:id' }], input_fields: [{ name: 'tier_id', label: 'Tier ID', type: 'text', required: true }, { name: 'title', label: 'Tier Title', type: 'text' }, { name: 'amount_cents', label: 'Monthly Amount (cents)', type: 'number' }, { name: 'description', label: 'Benefits Description', type: 'textarea' }], output_type: 'tier_id', api_endpoints: ['/api/social/tiers/:id'] },
    { feature_type: 'poll', scenario_name: 'Create patron poll', scenario_description: 'Create a poll for Patreon supporters to vote on.', actor: 'admin', trigger_type: 'manual', steps: [{ step: 1, action: 'Write poll question and options' }, { step: 2, action: 'Set duration and tier eligibility' }, { step: 3, action: 'Publish poll', api_call: 'POST /api/social/publish' }], input_fields: [{ name: 'question', label: 'Poll Question', type: 'text', required: true }, { name: 'options', label: 'Options (comma separated)', type: 'text', required: true }, { name: 'duration_days', label: 'Duration (days)', type: 'number' }], output_type: 'post_id', api_endpoints: ['/api/social/publish'] },
  ],
};

// Platforms with no platform-specific extras get only universal scenarios
export const ALL_PLATFORMS = [
  'apple_podcasts','bluesky','dailymotion','discord','dribbble','facebook','github','gitlab',
  'google_business','instagram','kijiji','linkedin','mastodon','medium','patreon','pinterest',
  'quora_manual','reddit','slack','snapchat','soundcloud','spotify','stack_overflow','substack',
  'telegram','threads','tiktok','tripadvisor','trustpilot','tumblr','twitch','vimeo',
  'whatsapp_business','x_twitter','yelp','youtube',
];

// Feature types where customer access is ON by default
const CUSTOMER_ON_FEATURES = new Set(['text_post', 'image_post', 'feedback', 'insight', 'review']);
// Feature types that require approval when customer access is on
const REQUIRES_APPROVAL_FEATURES = new Set(['text_post', 'image_post']);
// Admin-only feature types (never customer-facing by default)
const ADMIN_ONLY_FEATURES = new Set(['campaign', 'video_post', 'live', 'template_message', 'broadcast']);

export function defaultPermissionForFeature(featureType: string) {
  const customerEnabled = CUSTOMER_ON_FEATURES.has(featureType) && !ADMIN_ONLY_FEATURES.has(featureType);
  const requiresApproval = customerEnabled && REQUIRES_APPROVAL_FEATURES.has(featureType);
  return {
    admin_enabled: true,
    customer_enabled: customerEnabled,
    requires_approval: requiresApproval,
    approval_mode: requiresApproval ? 'manual' : 'none',
  };
}

export function featureLabel(featureType: string): string {
  const labels: Record<string, string> = {
    text_post: 'Text Post', image_post: 'Image Post', video_post: 'Video Post',
    campaign: 'Paid Campaign', review: 'Reviews', feedback: 'Engagement Feedback',
    insight: 'Analytics Insights', story: 'Story', reel: 'Reel / Short Video',
    live: 'Live Broadcast', poll: 'Poll', dm: 'Direct Message / Inbox',
    thread: 'Thread', article: 'Article / Long-form', event: 'Event',
    newsletter: 'Newsletter', playlist: 'Playlist', community_post: 'Community Post',
    group_post: 'Group Post', inbox: 'Inbox / Messaging', shopping_post: 'Shopping Post',
    carousel: 'Carousel / Gallery', collab: 'Collab / Co-author',
    space: 'Audio Space', document: 'Document / PDF Post',
    duet: 'Duet', stitch: 'Stitch',
    template_message: 'Template Message', broadcast: 'Broadcast List', catalog: 'Product Catalog',
    pin: 'Pin', idea_pin: 'Idea Pin', rich_pin: 'Rich Pin',
    thread_post: 'Thread / Subreddit Post', award: 'Award',
    release: 'Release', discussion: 'Discussion', gist: 'Gist',
    gbp_post: 'GBP Update Post', gbp_event: 'GBP Event', gbp_offer: 'GBP Offer',
    photo_upload: 'Photo Upload', qa_answer: 'Q&A Answer',
    review_invitation: 'Review Invitation', review_response: 'Review Response',
    video_upload: 'Video Upload', showcase: 'Showcase', review_link: 'Review Link',
    title_update: 'Stream Title Update', clip_share: 'Clip Share',
    embed_message: 'Rich Embed Message', announcement: 'Announcement',
    response: 'Story Response', note: 'Note',
    patron_post: 'Patron-only Post', tier_management: 'Tier Management',
  };
  return labels[featureType] ?? featureType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
