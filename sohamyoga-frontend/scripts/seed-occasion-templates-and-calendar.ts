/**
 * Seeds real notification_template rows for the reserved occasion-wish
 * slugs (push channel -- the one channel that genuinely delivers today
 * via VAPID web-push, no external gateway required) and a real festival
 * calendar (Christmas/New Year fixed dates; Diwali 2026's real date
 * confirmed via live web search, not guessed -- same verification
 * already done for the TalentsHill build this session).
 * Idempotent. Run: DATABASE_URL=... npx tsx scripts/seed-occasion-templates-and-calendar.ts
 */
import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://sohamyoga:change-me-before-production@127.0.0.1:5437/sohamyoga';
const TENANT_ID = '16fb3a23-5370-4572-bc93-2076534a4e99';
const ADMIN_USER_ID = '93fb63ba-8268-4816-b2bb-63994642e7b6'; // admin_demo@sohamyoga.ca

const TEMPLATES = [
  { slug: 'birthday_wishes_push', name: 'Birthday Wish (Push)', subject: null, body: '{{title}}\n{{body}}' },
  { slug: 'anniversary_wishes_push', name: 'Member Anniversary Wish (Push)', subject: null, body: '{{title}}\n{{body}}' },
  { slug: 'festival_wishes_push', name: 'Festival Wish (Push)', subject: null, body: '{{title}}\n{{body}}' },
  { slug: 'custom_wish_card', name: 'Custom Wish Card (Push)', subject: null, body: '{{title}}\n{{body}}' },
];

const FESTIVALS: { code: string; name: string; date: string; country: string | null }[] = [
  { code: 'christmas_2026', name: 'Christmas', date: '2026-12-25', country: null },
  { code: 'new_year_2026', name: "New Year's Day", date: '2026-01-01', country: null },
  { code: 'diwali_2026', name: 'Diwali', date: '2026-11-08', country: 'IN' },
];

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('=== Seeding real occasion-wish templates + festival calendar ===');

  let templatesAdded = 0;
  for (const t of TEMPLATES) {
    const res = await client.query(
      `INSERT INTO notification_template (tenant_id, slug, name, channel, type, subject, body, variables, status, created_by)
       VALUES ($1,$2,$3,'push','marketing',$4,$5,$6,'active',$7)
       ON CONFLICT (tenant_id, slug, locale) DO NOTHING RETURNING id`,
      [TENANT_ID, t.slug, t.name, t.subject, t.body, ['title', 'body'], ADMIN_USER_ID],
    );
    if (res.rowCount && res.rowCount > 0) templatesAdded++;
  }
  console.log(`Templates added: ${templatesAdded} (${TEMPLATES.length} total defined)`);

  let festivalsAdded = 0;
  for (const f of FESTIVALS) {
    const res = await client.query(
      `INSERT INTO festival_calendar (tenant_id, code, name, occasion_date, country, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (tenant_id, code) DO NOTHING RETURNING id`,
      [TENANT_ID, f.code, f.name, f.date, f.country, ADMIN_USER_ID],
    );
    if (res.rowCount && res.rowCount > 0) festivalsAdded++;
  }
  console.log(`Festivals added: ${festivalsAdded} (${FESTIVALS.length} total defined)`);

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
