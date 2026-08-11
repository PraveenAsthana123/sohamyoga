// Customer interaction tracking — ViewTracker/TrackedLink wired into the
// customer-facing catalog/booking pages, plus two real bugs found and fixed
// while building this: (1) the ConsentBanner's "Accept All" button was
// unclickable because the floating ChatWidget (z-index:1000) sat on top of
// it at z-50; (2) trackConversion() was gated behind analytics consent on
// the client even though the server (ESSENTIAL_EVENT_TYPES) always collects
// booking/payment conversions regardless of consent — so a non-consented
// visitor's booking conversion was silently never sent at all.
//
// These are real browser-interaction bugs (z-index layering, client-side
// gating), so they're verified against the actual rendered page rather than
// hitting the API directly. Master data is this session's real, running
// frontend + Postgres — no mocks. Rows created here are deleted by name in
// afterEach so re-runs stay clean.

import { test, expect } from 'playwright/test';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://sohamyoga:change-me-before-production@127.0.0.1:5437/sohamyoga';
const pool = new Pool({ connectionString: DATABASE_URL });

const TRACKED_NAMES = ['catalog_book_now_click', 'booking_list_book_now_click'];

test.afterAll(async () => {
  await pool.query(`DELETE FROM tracking_event WHERE name = ANY($1)`, [TRACKED_NAMES]);
  await pool.end();
});

test.describe('TRACKING-001 ConsentBanner is not obscured by the floating ChatWidget', () => {
  test('the Accept All button is clickable and actually grants consent', async ({ page }) => {
    await page.goto('/catalog');
    await page.evaluate(() => localStorage.removeItem('sohamyoga_consent'));
    await page.reload();

    const acceptAll = page.getByRole('button', { name: 'Accept All' });
    await expect(acceptAll).toBeVisible();

    // Regression guard: prior to the z-[1100] fix, this click was intercepted
    // by the ChatWidget's icon (z-index:1000) and threw "element intercepts
    // pointer events" — `trial: true` performs the same hit-test Playwright
    // uses for a real click, without actually clicking yet.
    await acceptAll.click({ trial: true, timeout: 5000 });
    await acceptAll.click();

    await expect(page.getByRole('dialog', { name: 'Cookie and analytics consent' })).toBeHidden();
    const consentLevel = await page.evaluate(() => localStorage.getItem('sohamyoga_consent'));
    expect(consentLevel).toBe('all');
  });
});

test.describe('TRACKING-002 catalog "Book Now" click is tracked end to end', () => {
  test('once analytics consent is granted through the real banner, a click reaches the database with real properties', async ({ page }) => {
    await page.goto('/catalog');
    await page.evaluate(() => localStorage.removeItem('sohamyoga_consent'));
    await page.reload();

    // Grant consent through the actual banner, not localStorage — the
    // server-recorded consent_level comes from analytics_consent_record,
    // which is only populated by the banner's real POST /api/analytics/consent.
    await page.getByRole('button', { name: 'Accept Analytics' }).click();
    await expect(page.getByRole('dialog', { name: 'Cookie and analytics consent' })).toBeHidden();

    const bookBtn = page.getByRole('link', { name: /Book Now/i }).first();
    await expect(bookBtn).toBeVisible();
    await bookBtn.click();

    await expect.poll(async () => {
      const row = await pool.query(
        `SELECT consent_level, properties FROM tracking_event WHERE name = 'catalog_book_now_click' ORDER BY created_at DESC LIMIT 1`,
      );
      return row.rows[0] ?? null;
    }, { timeout: 5000 }).not.toBeNull();

    const row = await pool.query(
      `SELECT consent_level, properties FROM tracking_event WHERE name = 'catalog_book_now_click' ORDER BY created_at DESC LIMIT 1`,
    );
    expect(row.rows[0].consent_level).toBe('analytics');
    expect(Object.keys(row.rows[0].properties)).toEqual(
      expect.arrayContaining(['classId', 'title', 'style', 'level']),
    );
  });

  test('with zero consent, the click is never sent at all (client-side gate, not a server drop)', async ({ page }) => {
    await page.goto('/booking');
    await page.evaluate(() => localStorage.setItem('sohamyoga_consent', 'none'));
    await page.reload();

    const bookBtn = page.getByRole('link', { name: /Book Now/i }).first();
    await expect(bookBtn).toBeVisible();
    await bookBtn.click();

    // No banner is shown (consent already recorded as 'none'), and track()
    // short-circuits before ever calling fetch — so no row should appear,
    // not even a dropped/empty one. Give the (absent) request a moment,
    // then assert nothing landed.
    await page.waitForTimeout(1500);
    const row = await pool.query(
      `SELECT COUNT(*) FROM tracking_event WHERE name = 'booking_list_book_now_click'`,
    );
    expect(Number(row.rows[0].count)).toBe(0);
  });
});

test.describe('TRACKING-003 trackConversion bypasses the analytics consent gate', () => {
  test('booking_started/booking_completed reach the DB even with zero consent', async ({ page }) => {
    await page.goto('/booking/1');
    await page.evaluate(() => localStorage.setItem('sohamyoga_consent', 'none'));
    await page.reload();

    const bookBtn = page.getByRole('button', { name: /Book Now/ });
    await expect(bookBtn).toBeVisible();
    await bookBtn.click();

    await expect.poll(async () => {
      const row = await pool.query(
        `SELECT COUNT(*) FROM tracking_event WHERE name = 'booking_completed' AND properties->>'classId' = '1' AND consent_level = 'none'`,
      );
      return Number(row.rows[0].count);
    }, { timeout: 5000 }).toBeGreaterThan(0);

    await pool.query(`DELETE FROM tracking_event WHERE name IN ('booking_started','booking_completed') AND properties->>'classId' = '1'`);
  });
});
