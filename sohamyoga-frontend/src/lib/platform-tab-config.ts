// sohamyoga-frontend platform-tab-config
// All data now lives in the shared package — this file re-exports everything
// so existing sohamyoga imports like `import { PLATFORM_SPECIFIC_TABS } from '@/lib/platform-tab-config'`
// continue to work without changes.

export {
  PLATFORM_SPECIFIC_TABS,
  ALL_PLATFORM_KEYS,
  platformDisplayName,
  PLATFORM_META,
} from '@sohamyoga/shared-social-platforms';

// Re-export types too
export type {
  PlatformTab,
  PlatformHubMeta as PlatformMeta,
} from '@sohamyoga/shared-social-platforms';
