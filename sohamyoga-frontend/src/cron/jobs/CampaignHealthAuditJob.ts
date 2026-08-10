// CampaignHealthAuditJob — audits active ad_campaign rows for structural
// config problems (no ad groups, no targeting, budget below a group's own
// bid, expired-but-active, etc). All facts are computed deterministically in
// SQL from columns that are always populated at campaign creation — nothing
// here depends on impression/click/spend data, which does not exist yet (no
// ad platform is connected). Ollama only writes the human-readable summary
// and recommended action for facts it is explicitly handed; it never invents
// a metric. Findings are drafts requiring human acknowledgement/resolution —
// nothing here mutates ad_campaign, ad_group, or budget directly.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const BATCH_SIZE = 20;

interface CampaignRow {
  id: string;
  name: string;
  daily_budget_cents: number;
  start_date: string;
  end_date: string | null;
  geo_targets: string[];
  device_targets: string[];
  language_targets: string[];
  audience_targets: string[];
  ad_group_count: string;
  ad_count: string;
  eligible_ad_count: string;
  max_group_bid_cents: string | null;
  analytics_row_count: string;
}

interface Issue {
  key: string;
  severity: 'info' | 'warning' | 'critical';
  factsForModel: Record<string, unknown>;
}

function detectIssues(row: CampaignRow): Issue[] {
  const issues: Issue[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const adGroupCount = Number(row.ad_group_count);
  const adCount = Number(row.ad_count);
  const eligibleAdCount = Number(row.eligible_ad_count);
  const maxGroupBid = row.max_group_bid_cents !== null ? Number(row.max_group_bid_cents) : null;

  if (adGroupCount === 0) {
    issues.push({ key: 'no_ad_groups', severity: 'critical', factsForModel: { adGroupCount } });
  } else if (adCount === 0) {
    issues.push({ key: 'no_ads_in_group', severity: 'critical', factsForModel: { adGroupCount, adCount } });
  } else if (eligibleAdCount === 0) {
    issues.push({ key: 'all_ads_under_review', severity: 'warning', factsForModel: { adCount, eligibleAdCount } });
  }

  const hasTargeting = [row.geo_targets, row.device_targets, row.language_targets, row.audience_targets]
    .some(arr => Array.isArray(arr) && arr.length > 0);
  if (!hasTargeting) {
    issues.push({ key: 'no_targeting', severity: 'warning', factsForModel: {} });
  }

  if (row.end_date && row.end_date < today) {
    issues.push({ key: 'expired_but_active', severity: 'critical', factsForModel: { endDate: row.end_date, today } });
  }
  if (row.start_date > today) {
    issues.push({ key: 'not_started_but_active', severity: 'info', factsForModel: { startDate: row.start_date, today } });
  }
  if (row.start_date <= today && Number(row.analytics_row_count) === 0) {
    issues.push({ key: 'no_analytics_data', severity: 'info', factsForModel: { startDate: row.start_date } });
  }
  if (maxGroupBid !== null && maxGroupBid > row.daily_budget_cents) {
    issues.push({
      key: 'bid_exceeds_daily_budget', severity: 'critical',
      factsForModel: { dailyBudgetCents: row.daily_budget_cents, maxGroupBidCents: maxGroupBid },
    });
  }

  return issues;
}

const SYSTEM = `You write short operator-facing notes about a single detected configuration
problem on an ad campaign. You are given only structural facts (never performance metrics —
none are supplied because none exist yet). Do not state or imply any click, impression,
spend, CTR, CPC, or ROAS figure — none was given to you, so none may appear in your answer.
Return exactly one JSON object: {"summary": "1-2 sentences describing the problem using only
the given facts", "recommended_action": "1 short sentence, imperative, actionable"}`;

function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Ollama returned no JSON object');
  return JSON.parse(fenced.slice(start, end + 1)) as T;
}

const ISSUE_LABEL: Record<string, string> = {
  no_ad_groups: 'Campaign is active but has zero ad groups, so no ads can serve.',
  no_ads_in_group: 'Campaign has ad groups but zero ads in any of them.',
  all_ads_under_review: 'Every ad in this campaign is still under_review — none are eligible to serve.',
  no_targeting: 'No geo, device, language, or audience targeting is configured.',
  expired_but_active: 'end_date has passed but status is still active.',
  not_started_but_active: 'start_date is in the future but status is already active.',
  no_analytics_data: 'Campaign should be running but has zero ad_analytics rows — no performance data is flowing in.',
  bid_exceeds_daily_budget: "An ad group's default_bid_cents exceeds the campaign's daily_budget_cents.",
};

export async function run(): Promise<void> {
  const campaigns = await db.query<CampaignRow>(
    `SELECT c.id, c.name, c.daily_budget_cents, c.start_date::text, c.end_date::text,
            c.geo_targets, c.device_targets::text[], c.language_targets, c.audience_targets,
            COUNT(DISTINCT g.id) AS ad_group_count,
            COUNT(DISTINCT a.id) AS ad_count,
            COUNT(DISTINCT a.id) FILTER (WHERE a.status <> 'under_review') AS eligible_ad_count,
            MAX(g.default_bid_cents) AS max_group_bid_cents,
            (SELECT COUNT(*) FROM ad_analytics n WHERE n.campaign_id = c.id) AS analytics_row_count
     FROM ad_campaign c
     LEFT JOIN ad_group g ON g.campaign_id = c.id
     LEFT JOIN advertisement a ON a.ad_group_id = g.id
     WHERE c.status = 'active'
     GROUP BY c.id
     ORDER BY c.updated_at ASC
     LIMIT $1`,
    [BATCH_SIZE],
  );

  let created = 0;
  let resolved = 0;

  for (const row of campaigns.rows) {
    const issues = detectIssues(row);
    const detectedKeys = issues.map(i => i.key);

    const resolvedResult = await db.query(
      `UPDATE ad_campaign_health_finding SET status='resolved', resolved_at=now()
       WHERE campaign_id=$1 AND status='open' AND NOT (finding_key = ANY($2::text[]))`,
      [row.id, detectedKeys],
    );
    resolved += resolvedResult.rowCount ?? 0;

    for (const issue of issues) {
      let write: { summary: string; recommended_action: string };
      try {
        const response = await ollama.generate(
          `Campaign: ${row.name}\nDetected issue: ${ISSUE_LABEL[issue.key]}\nFacts: ${JSON.stringify(issue.factsForModel)}`,
          { tier: 'fast', system: SYSTEM, maxTokens: 200, timeoutMs: 45_000 },
        );
        write = extractJson(response);
      } catch (error) {
        // Fall back to the deterministic label — a parse/model failure must
        // not block recording a real, already-detected structural issue.
        write = { summary: ISSUE_LABEL[issue.key], recommended_action: 'Review this campaign in the Ads admin panel.' };
      }

      const result = await db.query(
        `INSERT INTO ad_campaign_health_finding (campaign_id, finding_key, severity, summary, recommended_action, facts)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (campaign_id, finding_key) WHERE status='open' DO NOTHING`,
        [row.id, issue.key, issue.severity, write.summary, write.recommended_action, JSON.stringify(issue.factsForModel)],
      );
      created += result.rowCount ?? 0;
    }
  }

  console.log(`[campaign-health-audit] campaigns=${campaigns.rows.length} findings_created=${created} findings_resolved=${resolved}`);
  // Do NOT db.end() here — this module is cached and reused across every
  // scheduled invocation in the long-lived cron runner; ending the pool
  // breaks every run after the first ("Cannot use a pool after calling end
  // on the pool" — confirmed live in production for other jobs with this
  // same now-fixed anti-pattern).
}
