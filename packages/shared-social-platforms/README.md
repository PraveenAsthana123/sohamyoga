# @sohamyoga/shared-social-platforms

Platform configs, API specs, scenarios, and adapter utilities shared between:
- `sohamyoga-frontend` — yoga/wellness digital marketing portal
- `talentshill` — main digital marketing agency portal

Pure TypeScript. No React, no Next.js, no database code.

## What's included

| Module | Exports | Count |
|--------|---------|-------|
| `platform-registry.ts` | `PLATFORM_REGISTRY`, `getPlatformsByPriority()`, `getPlatformsByConnector()`, `getPlatformsWithAutomation()` | 36 platforms |
| `platform-tab-config.ts` | `PLATFORM_SPECIFIC_TABS`, `ALL_PLATFORM_KEYS`, `PLATFORM_META`, `platformDisplayName()` | 36 platforms × 8 tabs each |
| `platform-api-catalog.ts` | `PLATFORM_API_CATALOG`, `getApiCatalogForPlatform()`, `getApiCatalogByStatus()`, `getApiCatalogByCategory()` | 35+ API entries |
| `platform-scenarios.ts` | `UNIVERSAL_SCENARIOS`, `getScenariosForPlatform()`, `getScenariosByFeature()`, `getAdminScenarios()`, `getCustomerScenarios()` | 9 universal scenarios |
| `platform-permissions.ts` | `DEFAULT_FEATURE_PERMISSIONS`, `getDefaultPermissions()`, `getAllDefaultPermissions()`, `CUSTOMER_ENABLED_FEATURES`, `APPROVAL_REQUIRED_FEATURES` | Permission matrix |
| `platform-adapters.ts` | `PLATFORM_REQUIRED_CREDENTIALS`, `checkAdapterReadiness()`, `checkAllAdaptersReadiness()`, `getPostizPlatforms()`, `getPublishPath()` | Credential checker |
| `types.ts` | `PlatformKey`, `PlatformMeta`, `PlatformTab`, `ContentType`, `FeatureType`, `PlatformScenario`, `PlatformApiOffering`, `PublishInput`, `PublishResult`, and more | All shared types |
| `utils.ts` | `platformEmoji()`, `formatRateLimit()`, `getContentTypeLabel()`, `priorityColor()`, `implementationStatusColor()`, `sortPlatformsByPriority()` | Pure utility fns |

## Covered platforms

36 total: Facebook, Instagram, LinkedIn, X/Twitter, YouTube, TikTok, WhatsApp Business, Google Business, Pinterest, Reddit, Telegram, Threads, Snapchat, Discord, Twitch, Medium, Substack, Tumblr, GitHub, GitLab, Trustpilot, Vimeo, SoundCloud, Dailymotion, Spotify, Apple Podcasts, Patreon, Quora, Stack Overflow, Bluesky, Mastodon, Yelp, TripAdvisor, Slack, Dribbble, Kijiji.

## Usage in sohamyoga-frontend

```typescript
import { PLATFORM_REGISTRY, PLATFORM_SPECIFIC_TABS } from '@sohamyoga/shared-social-platforms';
// or via the re-export shim:
import { PLATFORM_SPECIFIC_TABS, platformDisplayName } from '@/lib/platform-tab-config';
```

## Usage in talentshill

```typescript
import { PLATFORM_REGISTRY } from '@sohamyoga/shared-social-platforms';
// or via the re-export:
import { PLATFORM_REGISTRY } from '@/lib/social-platforms';
```

## Adding a new platform

1. Add the new key to `PlatformKey` union in `src/types.ts`
2. Add the full entry to `PLATFORM_REGISTRY` in `src/platform-registry.ts`
3. Add tabs array to `PLATFORM_SPECIFIC_TABS` in `src/platform-tab-config.ts`
4. Add credentials to `PLATFORM_REQUIRED_CREDENTIALS` in `src/platform-adapters.ts`
5. Add API entries to `PLATFORM_API_CATALOG` in `src/platform-api-catalog.ts`
6. Bump `version` in `package.json`
7. Run `npx tsc --noEmit` to verify no type errors

## Installed in

```json
// sohamyoga-frontend/package.json
"@sohamyoga/shared-social-platforms": "file:../packages/shared-social-platforms"

// talentshill/package.json
"@sohamyoga/shared-social-platforms": "file:../sohamyoga/packages/shared-social-platforms"
```
