import { databaseConfigured } from '@/lib/postgres';
import { getTrackingPixels } from '@/lib/tracking-pixels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public, unauthenticated -- pixel IDs are not secrets (a fired Meta
// Pixel/GA4 tag is always visible in the page's own network requests), and
// this is exactly what RetargetingPixels.tsx (consent-gated) needs to know
// which scripts to load. Only pixelId + enabled are ever exposed; nothing
// from tracking_pixel_config's tenant_id/updated_by leaves this route.
export async function GET() {
  if (!databaseConfigured()) return Response.json({ metaPixel: { pixelId: null, enabled: false }, ga4: { pixelId: null, enabled: false } });
  const pixels = await getTrackingPixels();
  return Response.json(pixels);
}
