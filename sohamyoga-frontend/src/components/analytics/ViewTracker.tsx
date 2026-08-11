'use client';
import { useEffect } from 'react';
import { useAnalyticsContext } from './AnalyticsProvider';

// Fires one structured "viewed X" event on mount, in addition to the generic
// URL-only page_view AnalyticsProvider already sends on every route change.
// Needed because server-component detail pages (services/[slug],
// industries/[slug]) can't call the tracking hook directly — this is the
// client-island that lets them attach real structured properties (which
// service/industry, not just the URL) to what's viewed. Consent-gated same
// as every other track() call — AnalyticsProvider's track() already no-ops
// below 'analytics' consent level.
export default function ViewTracker({
  name, properties,
}: { name: string; properties: Record<string, unknown> }) {
  const { track } = useAnalyticsContext();
  const propsKey = JSON.stringify(properties);
  useEffect(() => { track({ name, eventType: 'custom', properties: JSON.parse(propsKey) }); }, [name, propsKey, track]);
  return null;
}
