// Seeds the 35 real AI governance categories, sourced directly from
// /mnt/deepa/talentshill's live database (not retyped from memory or a
// README) -- see docs/evidence/TALENTSHILL_COMPARISON.md. Idempotent:
// safe to re-run, uses category_key's unique constraint to upsert.
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { aiGovernanceFramework } from './schema';
import categories from './seed-categories.json';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  let inserted = 0;
  for (const c of categories as Array<{
    category_key: string; category_name: string; description: string;
    total_items: number; sort_order: number;
  }>) {
    await db.insert(aiGovernanceFramework).values({
      categoryKey: c.category_key,
      categoryName: c.category_name,
      description: c.description,
      totalItems: c.total_items,
      sortOrder: c.sort_order,
    }).onConflictDoUpdate({
      target: aiGovernanceFramework.categoryKey,
      set: {
        categoryName: c.category_name,
        description: c.description,
        totalItems: c.total_items,
        sortOrder: c.sort_order,
      },
    });
    inserted++;
  }

  console.log(`Seeded ${inserted} AI governance categories.`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
