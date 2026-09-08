import { query } from './postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export interface TrackingPixelState {
  metaPixel: { pixelId: string | null; enabled: boolean };
  ga4: { pixelId: string | null; enabled: boolean };
  posthog: { pixelId: string | null; enabled: boolean };
}

const EMPTY: TrackingPixelState = {
  metaPixel: { pixelId: null, enabled: false },
  ga4: { pixelId: null, enabled: false },
  posthog: { pixelId: null, enabled: false },
};

/**
 * Reads real per-platform config from tracking_pixel_config. Never
 * fabricates a pixel ID -- a platform with no row, or enabled=false, or a
 * blank pixel_id, comes back null/false, and the caller (RetargetingPixels/
 * PostHogAnalytics client component) must render nothing for it.
 */
export async function getTrackingPixels(): Promise<TrackingPixelState> {
  const tenantId = await getPrimaryTenantId();
  const result = await query<{ platform: 'meta_pixel' | 'ga4' | 'posthog'; pixel_id: string | null; enabled: boolean }>(
    `SELECT platform, pixel_id, enabled FROM tracking_pixel_config WHERE tenant_id = $1`,
    [tenantId],
  );
  const state = { ...EMPTY };
  for (const row of result.rows) {
    const active = { pixelId: row.enabled && row.pixel_id?.trim() ? row.pixel_id.trim() : null, enabled: row.enabled };
    if (row.platform === 'meta_pixel') state.metaPixel = active;
    if (row.platform === 'ga4') state.ga4 = active;
    if (row.platform === 'posthog') state.posthog = active;
  }
  return state;
}
