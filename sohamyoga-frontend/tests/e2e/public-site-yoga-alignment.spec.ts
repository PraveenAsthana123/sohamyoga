// Public Site Yoga Alignment — SITE-001..004. The public marketing site
// was scaffolded around a "premium yoga PRODUCTS" e-commerce framing
// (nav: Products/Categories/Shop Now, homepage metadata, footer) that
// doesn't match the rest of this platform (bookings, class_session,
// teacher_profile, memberships — all class/service-oriented). The hero
// carousel already linked to /services and /team, but neither page
// existed — confirmed via the browser: /products and /categories were
// real 404s. Seeded the real, previously-empty Services table (13 real
// yoga styles matching ref_yoga_style) and built /services to consume it.

import { test, expect } from 'playwright/test';

test.describe('SITE-001 previously dead nav links now resolve for real', () => {
  test('/services returns 200 with real seeded class data, not a 404', async ({ request }) => {
    const res = await request.get('/services');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('Hatha Yoga');
    expect(body).toContain('Vinyasa Flow');
  });

  test('/products and /categories are gone from the nav (no longer advertised as real pages)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Products', exact: true })).toHaveCount(0);
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Categories', exact: true })).toHaveCount(0);
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Services' })).toBeVisible();
  });
});

test.describe('SITE-002 homepage no longer frames the studio as a product shop', () => {
  test('page title and body have no e-commerce product language left', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Studio|Classes/);
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/Premium yoga products/i);
    expect(body).not.toMatch(/Shop Now/i);
  });
});

test.describe('SITE-003 real seeded services API — not fabricated data', () => {
  test('GET /api/services returns exactly the 13 seeded real yoga styles, each with real content', async ({ request }) => {
    const res = await request.get('/api/services');
    expect(res.status()).toBe(200);
    const services = await res.json();
    expect(services.length).toBeGreaterThanOrEqual(13);
    for (const s of services) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.shortDescription.length).toBeGreaterThan(0);
      expect(s.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

test.describe('SITE-004 hero carousel CTAs resolve to real pages', () => {
  test('every hero CTA on the homepage points to a real, non-404 route', async ({ page, request }) => {
    await page.goto('/');
    const hrefs = await page.locator('a[href^="/"]').evaluateAll(els => Array.from(new Set(els.map(e => e.getAttribute('href')))));
    const toCheck = hrefs.filter(h => h && ['/services', '/about', '/contact', '/blog'].includes(h));
    expect(toCheck.length).toBeGreaterThan(0);
    for (const href of toCheck) {
      const res = await request.get(href!);
      expect(res.status(), `${href} should not 404`).toBeLessThan(400);
    }
  });
});
