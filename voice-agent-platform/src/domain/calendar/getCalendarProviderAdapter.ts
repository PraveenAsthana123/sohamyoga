import { CalendarProviderAdapter } from './CalendarProviderAdapter';
import { CalComAdapter } from './CalComAdapter';
import { NotConfiguredCalendarProvider } from './NotConfiguredCalendarProvider';

/** Resolves the active adapter -- CalComAdapter if configured, else the
 * fail-closed default. Update this the day another provider is added. */
export function getCalendarProviderAdapter(): CalendarProviderAdapter {
  const calcom = new CalComAdapter();
  return calcom.isConfigured() ? calcom : new NotConfiguredCalendarProvider();
}
