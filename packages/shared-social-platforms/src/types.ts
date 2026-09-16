// All shared TypeScript types for the social platforms package.
// No React, no Next.js, no database code — pure TypeScript only.

// Platform identity
export type PlatformKey =
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'x_twitter'
  | 'threads'
  | 'tiktok'
  | 'youtube'
  | 'reddit'
  | 'pinterest'
  | 'bluesky'
  | 'whatsapp_business'
  | 'telegram'
  | 'discord'
  | 'mastodon'
  | 'snapchat'
  | 'twitch'
  | 'medium'
  | 'substack'
  | 'tumblr'
  | 'github'
  | 'gitlab'
  | 'google_business'
  | 'trustpilot'
  | 'vimeo'
  | 'soundcloud'
  | 'dailymotion'
  | 'spotify'
  | 'apple_podcasts'
  | 'patreon'
  | 'quora_manual'
  | 'stack_overflow'
  | 'yelp'
  | 'tripadvisor'
  | 'slack'
  | 'dribbble'
  | 'kijiji';

export type ConnectorType = 'postiz' | 'custom_connector' | 'manual_only';
export type Priority = 'high' | 'medium' | 'low';
export type AutomationPotential = 'very_high' | 'high' | 'medium' | 'low' | 'none';

export type ContentType =
  | 'text_post'
  | 'image_post'
  | 'video_post'
  | 'carousel'
  | 'story'
  | 'reel'
  | 'short'
  | 'live'
  | 'poll'
  | 'thread'
  | 'article'
  | 'document_post'
  | 'newsletter'
  | 'podcast_episode'
  | 'pin'
  | 'idea_pin'
  | 'message'
  | 'template_message'
  | 'broadcast'
  | 'release'
  | 'discussion'
  | 'gist'
  | 'review_response'
  | 'review_invitation'
  | 'video_upload'
  | 'track_upload'
  | 'creator_post'
  | 'community_post';

export type FeatureType =
  | 'text_post'
  | 'image_post'
  | 'video_post'
  | 'campaign'
  | 'review'
  | 'feedback'
  | 'insight'
  | 'story'
  | 'reel'
  | 'live'
  | 'poll'
  | 'dm'
  | 'thread'
  | 'article'
  | 'newsletter'
  | 'pin'
  | 'broadcast'
  | 'release'
  | 'podcast_episode';

export type ImplementationStatus =
  | 'not_built'
  | 'stub'
  | 'partial'
  | 'built'
  | 'verified'
  | 'deprecated';

export type AuthType =
  | 'oauth2'
  | 'api_key'
  | 'bearer_token'
  | 'basic'
  | 'webhook'
  | 'none';

// Tab definition
export interface PlatformTab {
  id: string;
  label: string;
  description: string;
  category?: 'content' | 'analytics' | 'review' | 'messaging' | 'settings';
  dataSource?: string;
}

// Platform metadata (canonical registry shape)
export interface PlatformMeta {
  key: PlatformKey;
  displayName: string;
  emoji: string;
  connector: ConnectorType;
  priority: Priority;
  automationPotential: AutomationPotential;
  businessUse: string;
  contentStrength: string;
  manualPrerequisite: string;
  supportedContentTypes: ContentType[];
  maxChars?: number;
  supportsScheduling: boolean;
  developerPortalUrl?: string;
  apiDocsUrl?: string;
}

// Lightweight metadata used by the hub page (subset of PlatformMeta for UI lists)
export interface PlatformHubMeta {
  key: string;
  displayName: string;
  emoji: string;
  priority: 'high' | 'medium' | 'low';
  connector: 'Postiz' | 'Custom' | 'Manual';
  contentTypes: string[];
}

// API offering
export interface PlatformApiOffering {
  platform: PlatformKey;
  apiName: string;
  apiVersion?: string;
  endpointPath: string;
  httpMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  capability: string;
  category:
    | 'publish'
    | 'read'
    | 'analytics'
    | 'auth'
    | 'media'
    | 'messaging'
    | 'review'
    | 'insight'
    | 'campaign'
    | 'webhook';
  authType: AuthType;
  requiredScopes?: string[];
  requiredEnvVars: string[];
  rateLimitCalls?: number;
  rateLimitWindow?: string;
  implementationStatus: ImplementationStatus;
  requiresReview?: boolean;
  notes?: string;
}

// Platform scenario
export interface PlatformScenario {
  platform: PlatformKey;
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

export interface ScenarioStep {
  step: number;
  action: string;
  uiElement?: string;
  apiCall?: string;
  expected?: string;
}

export interface ScenarioInputField {
  name: string;
  label: string;
  type:
    | 'text'
    | 'textarea'
    | 'url'
    | 'number'
    | 'date'
    | 'datetime'
    | 'select'
    | 'tags'
    | 'file';
  required: boolean;
  placeholder?: string;
  help?: string;
  options?: string[];
  platformSpecific?: boolean;
}

// Feature permission
export interface PlatformFeaturePermission {
  platform: PlatformKey;
  featureType: FeatureType;
  featureLabel: string;
  adminEnabled: boolean;
  customerEnabled: boolean;
  requiresApproval: boolean;
  approvalMode: 'none' | 'auto' | 'manual';
  customerDailyLimit?: number;
}

// Publish types (for adapters — no fetch logic here, just data shapes)
export interface PublishInput {
  text: string;
  title?: string;
  mediaUrls?: string[];
  linkUrl?: string;
  tags?: string[];
  externalAccountId: string;
  idempotencyKey: string;
  platformSpecific?: Record<string, unknown>;
}

export interface PublishResult {
  externalId?: string;
  externalUrl?: string;
  status: 'published' | 'queued' | 'manual_required';
  message?: string;
}

export type RuntimeSecret = Record<string, string>;

export interface AdapterReadiness {
  ready: boolean;
  missing: string[];
  platform: PlatformKey;
}
