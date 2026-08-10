'use client';
import { useAnalyticsContext } from '@/components/analytics/AnalyticsProvider';

/**
 * Portal analytics hook.
 *
 * Usage:
 *   const { track, trackConversion, identify, consentLevel } = useAnalytics();
 *   track({ name: 'booking_started', eventType: 'booking_started', properties: { serviceId } });
 *   trackConversion('booking_completed', { serviceId, amount });
 *   identify(userId);
 *
 * All properties are masked for SENSITIVE_KEY_FRAGMENTS before transmission.
 * Events are silently dropped when consentLevel < 'analytics'.
 */
export function useAnalytics() {
  return useAnalyticsContext();
}
