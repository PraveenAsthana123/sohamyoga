// Default feature permission matrix for all platforms.
// Defines which features are available to admin vs customer,
// and which require approval. No DB — pure data/functions.

import type { PlatformFeaturePermission, PlatformKey, FeatureType } from './types';
import { PLATFORM_REGISTRY } from './platform-registry';

// Features that customers are allowed to access (with approval)
export const CUSTOMER_ENABLED_FEATURES: FeatureType[] = [
  'text_post',
  'image_post',
  'feedback',
  'insight',
  'review',
];

// Features that always require admin approval when submitted by a customer
export const APPROVAL_REQUIRED_FEATURES: FeatureType[] = [
  'text_post',
  'image_post',
  'video_post',
];

// Features only admins can use — never exposed to customers
export const ADMIN_ONLY_FEATURES: FeatureType[] = [
  'campaign',
  'live',
  'broadcast',
  'release',
  'newsletter',
  'reel',
  'story',
  'poll',
  'dm',
  'thread',
  'article',
  'pin',
  'podcast_episode',
];

/**
 * Generate the default permission matrix for a given platform.
 * Based on what content types the platform supports (from PLATFORM_REGISTRY).
 */
export function getDefaultPermissions(platform: PlatformKey): PlatformFeaturePermission[] {
  const meta = PLATFORM_REGISTRY[platform];
  if (!meta) return [];

  return meta.supportedContentTypes.map(ct => {
    const featureType = ct as FeatureType;
    const customerEnabled = CUSTOMER_ENABLED_FEATURES.includes(featureType);
    const requiresApproval = APPROVAL_REQUIRED_FEATURES.includes(featureType);

    return {
      platform,
      featureType,
      featureLabel: ct.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      adminEnabled: true,
      customerEnabled,
      requiresApproval,
      approvalMode: requiresApproval ? 'manual' : 'none',
    } satisfies PlatformFeaturePermission;
  });
}

/**
 * Generate the full default permission matrix across ALL platforms.
 */
export function getAllDefaultPermissions(): PlatformFeaturePermission[] {
  return Object.keys(PLATFORM_REGISTRY).flatMap(key =>
    getDefaultPermissions(key as PlatformKey)
  );
}

/**
 * Check if a feature is customer-accessible on a given platform.
 */
export function isCustomerAccessible(platform: PlatformKey, featureType: FeatureType): boolean {
  const meta = PLATFORM_REGISTRY[platform];
  if (!meta) return false;
  const contentTypes = meta.supportedContentTypes as string[];
  return contentTypes.includes(featureType) && CUSTOMER_ENABLED_FEATURES.includes(featureType);
}

/**
 * Check if a feature requires approval on a given platform.
 */
export function requiresApproval(featureType: FeatureType): boolean {
  return APPROVAL_REQUIRED_FEATURES.includes(featureType);
}

// The full default permission list (all platforms × their supported features)
export const DEFAULT_FEATURE_PERMISSIONS: PlatformFeaturePermission[] = getAllDefaultPermissions();
