// Universal scenario definitions for all social/content platforms.
// Pure data — no React, no Next.js, no database code.
// Each app imports these and can filter/extend as needed.

import type {
  PlatformScenario,
  PlatformKey,
  FeatureType,
  ScenarioStep,
  ScenarioInputField,
} from './types';

// Base scenario shape (without the platform field — applied per-platform via getScenariosForPlatform)
export interface UniversalScenarioBase {
  featureType: FeatureType;
  scenarioName: string;
  scenarioDescription: string;
  actor: 'admin' | 'customer' | 'both' | 'system';
  triggerType: 'manual' | 'scheduled' | 'event' | 'agentic';
  steps: ScenarioStep[];
  inputFields: ScenarioInputField[];
  outputType?: string;
  apiEndpoints?: string[];
  hasAnalytics?: boolean;
  hasCustomerFeedback?: boolean;
  hasReviewCapability?: boolean;
  requiresApproval?: boolean;
}

export const UNIVERSAL_SCENARIOS: UniversalScenarioBase[] = [
  // ---- TEXT POST ----
  {
    featureType: 'text_post',
    scenarioName: 'Create and publish text post',
    scenarioDescription: 'Write text content, set schedule, preview, and publish to platform',
    actor: 'admin',
    triggerType: 'manual',
    steps: [
      { step: 1, action: 'Navigate to content composer', uiElement: 'Compose button' },
      { step: 2, action: 'Select platform and content type', uiElement: 'Platform selector' },
      { step: 3, action: 'Write caption/text', uiElement: 'Caption textarea', expected: 'Char counter updates' },
      { step: 4, action: 'Set schedule time', uiElement: 'DateTime picker' },
      { step: 5, action: 'Preview post', uiElement: 'Preview panel' },
      { step: 6, action: 'Click Publish/Schedule', apiCall: 'POST /api/social/publish', expected: 'Post created in unified_content_item' },
    ],
    inputFields: [
      { name: 'caption', label: 'Caption / Text', type: 'textarea', required: true, placeholder: 'Write your post...' },
      { name: 'schedule_at', label: 'Schedule Time', type: 'datetime', required: false },
      { name: 'hashtags', label: 'Hashtags', type: 'tags', required: false, placeholder: '#marketing' },
    ],
    outputType: 'post_id',
    apiEndpoints: ['POST /api/admin/social-intelligence/variants', 'POST /api/admin/command-center/items'],
    hasAnalytics: true,
  },
  {
    featureType: 'text_post',
    scenarioName: 'Customer submits text post for approval',
    scenarioDescription: 'Customer drafts a post — goes to admin approval queue before publishing',
    actor: 'customer',
    triggerType: 'manual',
    requiresApproval: true,
    steps: [
      { step: 1, action: 'Customer navigates to /customer/social', uiElement: 'Schedule tab' },
      { step: 2, action: 'Writes caption and selects platform', uiElement: 'Post form' },
      { step: 3, action: 'Submits post', apiCall: 'POST /api/customer/social/post' },
      { step: 4, action: 'System checks platform_feature_permission', expected: 'requires_approval=true → status=pending_approval' },
      { step: 5, action: 'Admin sees pending post in approvals queue', uiElement: '/admin/platform-scenarios?tab=run-history' },
      { step: 6, action: 'Admin approves → post is scheduled', expected: 'Status changes to scheduled' },
    ],
    inputFields: [
      { name: 'caption', label: 'Caption', type: 'textarea', required: true },
      { name: 'platform', label: 'Platform', type: 'select', required: true, options: ['facebook', 'instagram', 'linkedin', 'x_twitter', 'youtube', 'tiktok'] },
      { name: 'schedule_at', label: 'Preferred Time', type: 'datetime', required: false },
    ],
    outputType: 'approval_request',
    apiEndpoints: ['POST /api/customer/social/post', 'GET /api/admin/platform-scenarios/runs/pending-approvals'],
    hasAnalytics: false,
  },
  {
    featureType: 'text_post',
    scenarioName: 'AI-generated text post with variants',
    scenarioDescription: 'Admin provides a topic, AI generates 3 variant posts, admin selects and schedules',
    actor: 'admin',
    triggerType: 'agentic',
    steps: [
      { step: 1, action: 'Navigate to AI composer', uiElement: 'AI Generate tab' },
      { step: 2, action: 'Enter topic/brief', uiElement: 'Topic textarea' },
      { step: 3, action: 'Select tone and platform', uiElement: 'Tone selector, Platform selector' },
      { step: 4, action: 'AI generates 3 variants', apiCall: 'POST /api/admin/social-intelligence/variants', expected: '3 caption variants returned' },
      { step: 5, action: 'Admin selects preferred variant', uiElement: 'Variant cards' },
      { step: 6, action: 'Schedule or publish selected variant', apiCall: 'POST /api/admin/command-center/items', expected: 'Post scheduled' },
    ],
    inputFields: [
      { name: 'topic', label: 'Post Topic', type: 'textarea', required: true, placeholder: 'What should the post be about?' },
      { name: 'tone', label: 'Tone', type: 'select', required: false, options: ['professional', 'casual', 'inspirational', 'educational', 'promotional'] },
      { name: 'platform', label: 'Target Platform', type: 'select', required: true },
      { name: 'schedule_at', label: 'Schedule Time', type: 'datetime', required: false },
    ],
    outputType: 'variant_set',
    apiEndpoints: ['POST /api/admin/social-intelligence/variants', 'POST /api/admin/command-center/items'],
    hasAnalytics: true,
  },
  // ---- IMAGE POST ----
  {
    featureType: 'image_post',
    scenarioName: 'Upload image and create post',
    scenarioDescription: 'Upload image(s), add caption/alt text, set platform-specific options, publish',
    actor: 'admin',
    triggerType: 'manual',
    steps: [
      { step: 1, action: 'Open composer', uiElement: 'Compose button' },
      { step: 2, action: 'Select image content type', uiElement: 'Content type selector' },
      { step: 3, action: 'Upload image(s)', uiElement: 'Image upload dropzone', expected: 'Preview shows image(s)' },
      { step: 4, action: 'Write caption and alt text', uiElement: 'Caption textarea, Alt text field' },
      { step: 5, action: 'Configure platform-specific settings (carousel, tags)', uiElement: 'Platform options panel' },
      { step: 6, action: 'Publish or schedule', apiCall: 'POST /api/social/publish', expected: 'Image post created' },
    ],
    inputFields: [
      { name: 'images', label: 'Images', type: 'file', required: true, help: 'Upload 1-10 images (JPEG, PNG, GIF)' },
      { name: 'caption', label: 'Caption', type: 'textarea', required: false },
      { name: 'alt_text', label: 'Alt Text', type: 'text', required: false, help: 'Accessibility description for the image' },
      { name: 'schedule_at', label: 'Schedule Time', type: 'datetime', required: false },
    ],
    outputType: 'post_id',
    apiEndpoints: ['POST /api/admin/command-center/items'],
    hasAnalytics: true,
    requiresApproval: false,
  },
  {
    featureType: 'image_post',
    scenarioName: 'Customer submits image post for approval',
    scenarioDescription: 'Customer uploads image and caption — pending admin approval before publishing',
    actor: 'customer',
    triggerType: 'manual',
    requiresApproval: true,
    steps: [
      { step: 1, action: 'Customer opens content form', uiElement: '/customer/social → Image tab' },
      { step: 2, action: 'Uploads image(s)', uiElement: 'Image upload' },
      { step: 3, action: 'Writes caption', uiElement: 'Caption field' },
      { step: 4, action: 'Submits for approval', apiCall: 'POST /api/customer/social/post' },
      { step: 5, action: 'Admin reviews and approves/rejects', uiElement: 'Admin approvals queue' },
    ],
    inputFields: [
      { name: 'images', label: 'Images', type: 'file', required: true },
      { name: 'caption', label: 'Caption', type: 'textarea', required: false },
      { name: 'platform', label: 'Platform', type: 'select', required: true },
    ],
    outputType: 'approval_request',
    apiEndpoints: ['POST /api/customer/social/post'],
    hasAnalytics: false,
  },
  // ---- VIDEO POST ----
  {
    featureType: 'video_post',
    scenarioName: 'Upload and publish video',
    scenarioDescription: 'Upload video file, add title/description, thumbnail, captions, and publish',
    actor: 'admin',
    triggerType: 'manual',
    steps: [
      { step: 1, action: 'Open video composer', uiElement: 'Video tab in composer' },
      { step: 2, action: 'Upload video file', uiElement: 'Video upload dropzone', expected: 'Upload progress shown' },
      { step: 3, action: 'Add title and description', uiElement: 'Title field, Description textarea' },
      { step: 4, action: 'Set custom thumbnail', uiElement: 'Thumbnail selector' },
      { step: 5, action: 'Add captions/subtitles', uiElement: 'Captions upload' },
      { step: 6, action: 'Publish or schedule', apiCall: 'POST /api/social/publish', expected: 'Video post created' },
    ],
    inputFields: [
      { name: 'video', label: 'Video File', type: 'file', required: true, help: 'MP4, MOV, AVI — max 2GB' },
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea', required: false },
      { name: 'thumbnail', label: 'Thumbnail', type: 'file', required: false },
      { name: 'schedule_at', label: 'Schedule Time', type: 'datetime', required: false },
    ],
    outputType: 'video_id',
    apiEndpoints: ['POST /api/admin/command-center/items'],
    hasAnalytics: true,
  },
  // ---- CAMPAIGN ----
  {
    featureType: 'campaign',
    scenarioName: 'Create multi-platform campaign',
    scenarioDescription: 'Define a campaign with goal, budget, targeting, and publish across multiple platforms',
    actor: 'admin',
    triggerType: 'manual',
    steps: [
      { step: 1, action: 'Navigate to campaign planner', uiElement: '/admin/ads' },
      { step: 2, action: 'Create new campaign — set name, goal, dates', uiElement: 'Campaign form' },
      { step: 3, action: 'Define targeting (audience, location, age)', uiElement: 'Targeting panel' },
      { step: 4, action: 'Set budget and bid strategy', uiElement: 'Budget fields' },
      { step: 5, action: 'Create ad groups and ads', uiElement: 'Ad group builder' },
      { step: 6, action: 'Review and submit', apiCall: 'POST /api/ads/campaigns', expected: 'Campaign created in platform' },
    ],
    inputFields: [
      { name: 'name', label: 'Campaign Name', type: 'text', required: true },
      { name: 'goal', label: 'Campaign Goal', type: 'select', required: true, options: ['awareness', 'traffic', 'engagement', 'leads', 'sales', 'app_installs'] },
      { name: 'start_date', label: 'Start Date', type: 'date', required: true },
      { name: 'end_date', label: 'End Date', type: 'date', required: false },
      { name: 'budget', label: 'Daily Budget', type: 'number', required: true },
    ],
    outputType: 'campaign_id',
    apiEndpoints: ['POST /api/ads/campaigns', 'POST /api/ads/adgroups'],
    hasAnalytics: true,
  },
  // ---- REVIEW ----
  {
    featureType: 'review',
    scenarioName: 'Read and respond to customer reviews',
    scenarioDescription: 'Admin reads incoming reviews and sends public/private responses',
    actor: 'admin',
    triggerType: 'manual',
    hasReviewCapability: true,
    steps: [
      { step: 1, action: 'Navigate to reviews dashboard', uiElement: '/admin/social/[platform] → reviews tab' },
      { step: 2, action: 'Filter by rating, date, status', uiElement: 'Filter panel' },
      { step: 3, action: 'Click on a review to read', uiElement: 'Review card' },
      { step: 4, action: 'Write response', uiElement: 'Response textarea' },
      { step: 5, action: 'Submit response', apiCall: 'POST /api/admin/social/[platform]/review-respond', expected: 'Response published on platform' },
    ],
    inputFields: [
      { name: 'review_id', label: 'Review ID', type: 'text', required: true, platformSpecific: true },
      { name: 'response', label: 'Your Response', type: 'textarea', required: true, placeholder: 'Thank you for your review...' },
    ],
    outputType: 'response_id',
    apiEndpoints: ['POST /api/admin/social/review-respond', 'GET /api/admin/social/reviews'],
    hasAnalytics: true,
    hasCustomerFeedback: true,
  },
  // ---- FEEDBACK ----
  {
    featureType: 'feedback',
    scenarioName: 'Customer submits feedback via social',
    scenarioDescription: 'Customer submits structured feedback through a social-linked form or portal',
    actor: 'customer',
    triggerType: 'manual',
    steps: [
      { step: 1, action: 'Customer lands on feedback page/form', uiElement: 'Feedback form' },
      { step: 2, action: 'Selects category and rates experience', uiElement: 'Star rating, Category selector' },
      { step: 3, action: 'Writes free-text feedback', uiElement: 'Feedback textarea' },
      { step: 4, action: 'Submits', apiCall: 'POST /api/customer/feedback', expected: 'Feedback saved in DB' },
      { step: 5, action: 'Admin views in feedback dashboard', uiElement: '/admin/feedback' },
    ],
    inputFields: [
      { name: 'rating', label: 'Rating', type: 'number', required: true, help: '1-5 stars' },
      { name: 'category', label: 'Category', type: 'select', required: false, options: ['service', 'product', 'delivery', 'support', 'other'] },
      { name: 'comment', label: 'Your Feedback', type: 'textarea', required: false },
    ],
    outputType: 'feedback_id',
    apiEndpoints: ['POST /api/customer/feedback'],
    hasAnalytics: true,
    hasCustomerFeedback: true,
  },
  // ---- INSIGHT ----
  {
    featureType: 'insight',
    scenarioName: 'View platform analytics insights',
    scenarioDescription: 'Admin views AI-generated insights on platform performance, top content, best times to post',
    actor: 'admin',
    triggerType: 'scheduled',
    steps: [
      { step: 1, action: 'Navigate to insights dashboard', uiElement: '/admin/social/[platform] → analytics tab' },
      { step: 2, action: 'Select date range', uiElement: 'Date range picker' },
      { step: 3, action: 'View metric cards (reach, engagement, follower growth)', uiElement: 'KPI cards' },
      { step: 4, action: 'View top-performing posts', uiElement: 'Top posts table' },
      { step: 5, action: 'AI summary generated', expected: 'Weekly insight summary available' },
    ],
    inputFields: [
      { name: 'date_from', label: 'From Date', type: 'date', required: false },
      { name: 'date_to', label: 'To Date', type: 'date', required: false },
      { name: 'metric', label: 'Primary Metric', type: 'select', required: false, options: ['reach', 'impressions', 'engagement', 'followers', 'clicks'] },
    ],
    outputType: 'insight_report',
    apiEndpoints: ['GET /api/admin/social/analytics', 'GET /api/admin/social-intelligence/insights'],
    hasAnalytics: true,
  },
];

/**
 * Get all universal scenarios bound to a specific platform.
 * The platform field is injected at call time so the base array stays DRY.
 */
export function getScenariosForPlatform(platform: PlatformKey): PlatformScenario[] {
  return UNIVERSAL_SCENARIOS.map(s => ({ ...s, platform }));
}

/**
 * Get scenarios for a specific feature type across all platforms.
 */
export function getScenariosByFeature(featureType: FeatureType): UniversalScenarioBase[] {
  return UNIVERSAL_SCENARIOS.filter(s => s.featureType === featureType);
}

/**
 * Get all admin-facing scenarios.
 */
export function getAdminScenarios(): UniversalScenarioBase[] {
  return UNIVERSAL_SCENARIOS.filter(s => s.actor === 'admin' || s.actor === 'both');
}

/**
 * Get all customer-facing scenarios.
 */
export function getCustomerScenarios(): UniversalScenarioBase[] {
  return UNIVERSAL_SCENARIOS.filter(s => s.actor === 'customer' || s.actor === 'both');
}

/**
 * Get all scenarios that require approval.
 */
export function getApprovalScenarios(): UniversalScenarioBase[] {
  return UNIVERSAL_SCENARIOS.filter(s => s.requiresApproval === true);
}
