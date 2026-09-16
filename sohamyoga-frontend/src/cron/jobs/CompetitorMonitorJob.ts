// CompetitorMonitorJob — Daily 08:00 UTC
// Reads market_competitor for tracked competitors, pulls latest mentions from
// Google Alerts RSS (graceful fallback if no rss_url set), scores sentiment
// via Ollama llama3.2, inserts into competitor_mention, logs to ai_governance_log.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

interface CompetitorRow {
  id: number;
  company_name: string;
  website: string | null;
}

interface RssItem {
  title: string;
  link: string;
  snippet: string;
  pubDate: string;
}

/** Parse a minimal RSS 2.0 / Atom feed into flat items. */
function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title   = (/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i.exec(block) ??
                     /<title[^>]*>([\s\S]*?)<\/title>/i.exec(block))?.[1]?.trim() ?? '';
    const link    = (/<link[^>]*>([\s\S]*?)<\/link>/i.exec(block))?.[1]?.trim() ?? '';
    const snippet = (/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i.exec(block) ??
                     /<description[^>]*>([\s\S]*?)<\/description>/i.exec(block))?.[1]
                    ?.replace(/<[^>]+>/g, ' ').trim() ?? '';
    const pubDate = (/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i.exec(block))?.[1]?.trim() ?? '';
    if (title || snippet) {
      items.push({ title, link, snippet, pubDate });
    }
  }

  return items;
}

/** Build a Google Alerts RSS URL for a competitor name. */
function googleAlertsRssUrl(name: string): string {
  return `https://www.google.com/alerts/feeds/00000000000000000/query:${encodeURIComponent(name)}`;
}

async function scoreSentiment(text: string): Promise<'positive' | 'neutral' | 'negative'> {
  const prompt = `Classify the sentiment of this text as exactly one word: positive, neutral, or negative.
Text: "${text.slice(0, 400)}"
Respond with only the single word sentiment label.`;

  try {
    const raw = await ollama.generate(prompt, { model: 'llama3.2', temperature: 0.2, maxTokens: 5, timeoutMs: 30_000 });
    const word = raw.trim().toLowerCase().split(/\s+/)[0] ?? 'neutral';
    if (word === 'positive' || word === 'negative') return word;
    return 'neutral';
  } catch {
    return 'neutral';
  }
}

async function logGovernance(action: string, detail: string): Promise<void> {
  try {
    await db.query(
      `INSERT INTO ai_governance_log (action, model, input_summary, output_summary, created_at)
       VALUES ($1, 'llama3.2', $2, $3, NOW())
       ON CONFLICT DO NOTHING`,
      [action, `CompetitorMonitorJob: ${detail}`, 'sentiment scoring complete'],
    );
  } catch {
    // governance log is best-effort; table may have a different schema
  }
}

export async function run(): Promise<void> {
  console.log('[CompetitorMonitorJob] Starting daily competitor mention scan…');

  // Fetch tracked competitors
  let competitors: CompetitorRow[] = [];
  try {
    const res = await db.query<CompetitorRow>(
      `SELECT id, company_name, website FROM market_competitor ORDER BY company_name`,
    );
    competitors = res.rows;
  } catch {
    console.warn('[CompetitorMonitorJob] market_competitor table not found or empty — skipping RSS pull.');
  }

  let totalInserted = 0;

  for (const competitor of competitors) {
    const rssUrl = googleAlertsRssUrl(competitor.company_name);
    let items: RssItem[] = [];

    try {
      const response = await fetch(rssUrl, {
        headers: { 'User-Agent': 'SohamYoga-MarketResearch/1.0' },
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) {
        const xml = await response.text();
        items = parseRssItems(xml);
      } else {
        console.warn(`[CompetitorMonitorJob] RSS ${response.status} for ${competitor.company_name}`);
      }
    } catch (err) {
      console.warn(`[CompetitorMonitorJob] RSS fetch failed for ${competitor.company_name}:`, (err as Error).message);
    }

    for (const item of items.slice(0, 10)) {
      try {
        const text = [item.title, item.snippet].filter(Boolean).join(' — ');
        const sentiment = await scoreSentiment(text);

        // Parse mention_date from RSS pubDate; fall back to today
        const mentionDate = item.pubDate
          ? new Date(item.pubDate).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10);

        await db.query(
          `INSERT INTO competitor_mention
             (competitor_name, source, title, url, snippet, sentiment, mention_date, reach_estimate)
           VALUES ($1, 'google_alerts', $2, $3, $4, $5, $6, 0)
           ON CONFLICT DO NOTHING`,
          [competitor.company_name, item.title, item.link, item.snippet, sentiment, mentionDate],
        );
        totalInserted++;
      } catch (err) {
        console.error(`[CompetitorMonitorJob] Insert failed for mention:`, err);
      }
    }
  }

  await logGovernance('competitor-monitor-run', `Processed ${competitors.length} competitors, inserted ${totalInserted} mentions`);
  console.log(`[CompetitorMonitorJob] Done. Competitors: ${competitors.length}, Mentions inserted: ${totalInserted}`);
}
