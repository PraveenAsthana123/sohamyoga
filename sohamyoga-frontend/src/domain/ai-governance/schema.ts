// AI Governance Framework -- real Drizzle ORM adoption, scoped to genuinely
// new code (2026-09-08). This does NOT touch any of the 144 existing
// db-schema*.sql files or the raw-pg data-access pattern used everywhere
// else in this app (see docs/architecture/ADR/0001-no-orm.md for why that
// choice was made originally) -- it's an additive, isolated proof that
// Drizzle works in this codebase, not a migration of anything existing.
//
// The 35 real category rows are ported from a sibling reference project
// (TalentsHill, /mnt/deepa/talentshill) -- see
// docs/evidence/TALENTSHILL_COMPARISON.md for the audit that found this
// framework real and populated there, and recommended porting the concept
// (not the code) here since sohamyoga has zero AI governance tracking today.
import { pgTable, text, integer, timestamp, uuid } from 'drizzle-orm/pg-core';

export const aiGovernanceFramework = pgTable('ai_governance_framework', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryKey: text('category_key').notNull().unique(),
  categoryName: text('category_name').notNull(),
  description: text('description'),
  totalItems: integer('total_items').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const aiGovernanceAssessment = pgTable('ai_governance_assessment', {
  id: uuid('id').primaryKey().defaultRandom(),
  frameworkId: uuid('framework_id').notNull().references(() => aiGovernanceFramework.id),
  // What real thing is being assessed -- a module_key from module_registry
  // (kept as free text, not an FK, so this stays fully decoupled from that
  // table's schema) or any other named subject (e.g. a specific AI feature).
  subject: text('subject').notNull(),
  score: integer('score'), // 0-100, nullable until an assessor actually scores it
  assessorName: text('assessor_name'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
