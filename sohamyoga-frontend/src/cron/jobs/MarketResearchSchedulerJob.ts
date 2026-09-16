// MarketResearchSchedulerJob — Monday 06:00 UTC
// Finds active market_research_project rows with tags containing 'scheduled-report'
// and auto-generates a short Ollama report for each, saving to market_research_document.
// Uses llama3.2 via the shared OllamaClient.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export async function run(): Promise<void> {
  const projectRows = await db.query<{
    id: number; name: string; category: string;
    target_market: string; industry: string; geography: string;
  }>(
    `SELECT id, name, category, target_market, industry, geography
     FROM market_research_project
     WHERE status = 'in_progress'
       AND tags ILIKE '%scheduled-report%'`,
  );

  if (projectRows.rowCount === 0) {
    console.log('[MarketResearchSchedulerJob] No projects with scheduled-report tag found.');
    return;
  }

  for (const p of projectRows.rows) {
    try {
      const prompt = `You are a market research analyst. Write a SHORT weekly research update (300-400 words) for:
Project: ${p.name}
Category: ${p.category}
Target Market: ${p.target_market}
Industry: ${p.industry}

Include: This Week's Key Signals, Emerging Opportunities, Watch List Items.
Format as structured markdown. Today's date context: ${new Date().toISOString().slice(0, 10)}.`;

      const content = await ollama.generate(prompt, {
        model: 'llama3.2',
        temperature: 0.6,
        maxTokens: 600,
        timeoutMs: 90_000,
      });

      const wordCount = content.split(/\s+/).filter(Boolean).length;
      const title = `Weekly Research Update: ${p.name} — ${new Date().toISOString().slice(0, 10)}`;

      await db.query(
        `INSERT INTO market_research_document
           (project_id, document_type, title, content, format, word_count, generated_by)
         VALUES ($1, 'short_report', $2, $3, 'markdown', $4, 'ai')`,
        [p.id, title, content, wordCount],
      );

      console.log(`[MarketResearchSchedulerJob] Generated weekly report for project ${p.id}: "${p.name}"`);
    } catch (err) {
      console.error(`[MarketResearchSchedulerJob] Failed for project ${p.id}:`, err);
    }
  }

  console.log(`[MarketResearchSchedulerJob] Processed ${projectRows.rowCount} projects.`);
}
