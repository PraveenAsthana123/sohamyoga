import {
  AvailabilitySlot, BookAppointmentRequest, BookAppointmentResult, CalendarProviderAdapter,
  CalendarProviderNotConfiguredError, CheckAvailabilityRequest,
} from './CalendarProviderAdapter';

/**
 * The only CalendarProviderAdapter implementation that exists today. Fails
 * closed on every call -- there is no Cal.com/CalDAV credential configured
 * on this machine yet. Better to loudly refuse than to silently fabricate
 * "available" slots or a "confirmed" booking that was never actually made.
 */
export class NotConfiguredCalendarProvider implements CalendarProviderAdapter {
  readonly providerKey = 'not_configured';

  isConfigured(): boolean {
    return false;
  }

  async checkAvailability(_request: CheckAvailabilityRequest): Promise<AvailabilitySlot[]> {
    throw new CalendarProviderNotConfiguredError(
      'No calendar provider is configured. Real availability checking via Cal.com (or another ' +
        'CalDAV-compatible provider) is not wired up yet -- set CALCOM_API_KEY and ' +
        'CALCOM_EVENT_TYPE_ID and swap in a real CalendarProviderAdapter implementation.',
    );
  }

  async bookAppointment(_request: BookAppointmentRequest): Promise<BookAppointmentResult> {
    throw new CalendarProviderNotConfiguredError(
      'No calendar provider is configured. Real appointment booking is not wired up yet -- ' +
        'set CALCOM_API_KEY and CALCOM_EVENT_TYPE_ID before appointments can be booked for real.',
    );
  }

  async rescheduleAppointment(_externalBookingId: string, _newStartISO: string): Promise<BookAppointmentResult> {
    throw new CalendarProviderNotConfiguredError(
      'No calendar provider is configured. Real appointment rescheduling is not wired up yet.',
    );
  }

  async cancelAppointment(_externalBookingId: string): Promise<void> {
    throw new CalendarProviderNotConfiguredError(
      'No calendar provider is configured. Real appointment cancellation is not wired up yet.',
    );
  }
}

