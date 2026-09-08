// CalendarProviderAdapter -- the contract a real open-source-friendly
// calendar/scheduling provider (Cal.com self-hosted or cloud, CalDAV, etc.)
// must implement so a voice agent can check availability and book/cancel a
// real appointment. As of this build, no CALCOM_API_KEY (or equivalent)
// exists on this machine, so only the fail-closed
// NotConfiguredCalendarProvider below exists -- checking availability or
// booking always fails with a clear, honest error rather than fabricating
// open slots or a fake confirmed booking.
//
// ---------------------------------------------------------------------------
// Reference (not built): Cal.com (https://cal.com, open-source, self-hostable
// or cloud) API v2 -- chosen over raw CalDAV because it's purpose-built for
// exactly this "check availability, then book" flow and has a clean REST API:
//   - CALCOM_API_KEY (server-side secret, from a Cal.com account or
//     self-hosted instance)
//   - CALCOM_EVENT_TYPE_ID (which bookable event type new appointments go
//     against -- configured once per clinic service type)
//   - GET https://api.cal.com/v2/slots/available?eventTypeId=...&startTime=...&endTime=...
//   - POST https://api.cal.com/v2/bookings { eventTypeId, start, attendee: { name, email, timeZone } }
//   - DELETE/POST cancel endpoint to cancel an existing booking
// The exact request/response shape above has NOT been exercised against a
// live Cal.com account -- verify against Cal.com's current API docs before
// the first real booking.
// ---------------------------------------------------------------------------

export interface AvailabilitySlot {
  start: string; // ISO 8601
  end: string;
}

export interface CheckAvailabilityRequest {
  fromISO: string;
  toISO: string;
}

export interface BookAppointmentRequest {
  contactName: string;
  contactEmail: string;
  startISO: string;
  timeZone: string;
}

export interface BookAppointmentResult {
  externalBookingId: string;
  startISO: string;
  endISO: string;
}

/** Thrown by any adapter that cannot actually reach a real calendar right now. */
export class CalendarProviderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalendarProviderNotConfiguredError';
  }
}

export interface CalendarProviderAdapter {
  readonly providerKey: string;
  isConfigured(): boolean;
  /** Must throw CalendarProviderNotConfiguredError, never fabricate open slots, when isConfigured() is false. */
  checkAvailability(request: CheckAvailabilityRequest): Promise<AvailabilitySlot[]>;
  /** Must throw CalendarProviderNotConfiguredError, never fabricate a fake booking id, when isConfigured() is false. */
  bookAppointment(request: BookAppointmentRequest): Promise<BookAppointmentResult>;
  /** Must throw CalendarProviderNotConfiguredError, never fabricate success, when isConfigured() is false. */
  rescheduleAppointment(externalBookingId: string, newStartISO: string): Promise<BookAppointmentResult>;
  cancelAppointment(externalBookingId: string): Promise<void>;
}
