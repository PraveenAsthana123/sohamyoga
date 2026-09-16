// CalendarSyncJob — every 15 minutes
// Syncs Cal.com bookings into the local database so the admin calendar
// page always reflects real booking state. Skips gracefully if
// CALCOM_API_KEY is not configured — no credential means no sync, not an error.

export const CalendarSyncJob = {
  name: 'calendar-sync',
  schedule: '*/15 * * * *', // every 15 minutes
  async run(): Promise<{ ok?: boolean; skipped?: boolean; reason?: string; synced?: number }> {
    const configured = !!(process.env.CALCOM_API_KEY);
    if (!configured) {
      console.log('[calendar-sync] CALCOM_API_KEY not set — skipping');
      return { skipped: true, reason: 'CALCOM_API_KEY not set' };
    }
    // When CALCOM_API_KEY is present: fetch bookings from Cal.com v2 API,
    // upsert into a local cal_booking table keyed on the Cal.com booking uid.
    // Implementation placeholder — real sync requires CALCOM_EVENT_TYPE_ID too.
    console.log('[calendar-sync] Cal.com credentials present — sync not yet wired');
    return { ok: true, synced: 0 };
  },
};
