import {
  AvailabilitySlot, BookAppointmentRequest, BookAppointmentResult, CalendarProviderAdapter,
  CalendarProviderNotConfiguredError, CheckAvailabilityRequest,
} from './CalendarProviderAdapter';

// Real Cal.com (https://cal.com, open-source) adapter. UNVERIFIED against a
// live account -- no CALCOM_API_KEY exists on this machine. Request/response
// shapes are built from Cal.com's documented API v2 as of this app's
// knowledge cutoff; confirm against Cal.com's current docs before the first
// real booking, the same way VapiAssistantSync.ts was confirmed against a
// live Vapi account before being trusted.

const BASE_URL = 'https://api.cal.com/v2';

export class CalComAdapter implements CalendarProviderAdapter {
  readonly providerKey = 'calcom';

  isConfigured(): boolean {
    return Boolean(process.env.CALCOM_API_KEY?.trim() && process.env.CALCOM_EVENT_TYPE_ID?.trim());
  }

  private requireConfig(): { apiKey: string; eventTypeId: string } {
    const apiKey = process.env.CALCOM_API_KEY?.trim();
    const eventTypeId = process.env.CALCOM_EVENT_TYPE_ID?.trim();
    if (!apiKey || !eventTypeId) {
      throw new CalendarProviderNotConfiguredError(
        'CALCOM_API_KEY / CALCOM_EVENT_TYPE_ID are not set. Real Cal.com calendar sync is not wired up yet.',
      );
    }
    return { apiKey, eventTypeId };
  }

  async checkAvailability(request: CheckAvailabilityRequest): Promise<AvailabilitySlot[]> {
    const { apiKey, eventTypeId } = this.requireConfig();
    const url = `${BASE_URL}/slots/available?eventTypeId=${eventTypeId}&startTime=${encodeURIComponent(request.fromISO)}&endTime=${encodeURIComponent(request.toISO)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Cal.com GET /slots/available failed: ${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`);
    const data = await res.json() as { slots?: Record<string, { time: string }[]> };
    const slots: AvailabilitySlot[] = [];
    for (const day of Object.values(data.slots ?? {})) {
      for (const s of day) slots.push({ start: s.time, end: s.time });
    }
    return slots;
  }

  async bookAppointment(request: BookAppointmentRequest): Promise<BookAppointmentResult> {
    const { apiKey, eventTypeId } = this.requireConfig();
    const res = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventTypeId: Number(eventTypeId),
        start: request.startISO,
        attendee: { name: request.contactName, email: request.contactEmail, timeZone: request.timeZone },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Cal.com POST /bookings failed: ${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`);
    const data = await res.json() as { id: string | number; start: string; end: string };
    return { externalBookingId: String(data.id), startISO: data.start, endISO: data.end };
  }

  async rescheduleAppointment(externalBookingId: string, newStartISO: string): Promise<BookAppointmentResult> {
    const { apiKey } = this.requireConfig();
    const res = await fetch(`${BASE_URL}/bookings/${externalBookingId}/reschedule`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ start: newStartISO }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Cal.com reschedule failed: ${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`);
    const data = await res.json() as { id: string | number; start: string; end: string };
    return { externalBookingId: String(data.id), startISO: data.start, endISO: data.end };
  }

  async cancelAppointment(externalBookingId: string): Promise<void> {
    const { apiKey } = this.requireConfig();
    const res = await fetch(`${BASE_URL}/bookings/${externalBookingId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Cancelled via voice agent' }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Cal.com cancel failed: ${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`);
  }
}

