// ReferralInvitationJob — Weekly Thursday 08:45 UTC, right after
// advocacy-score. Closes the funnel→advocacy→referral loop for real: for
// every student AdvocacyScoreJob just marked 'strong_candidate' with a
// real linked customer record, this job issues that customer a real
// referral_code (via the real ReferralCode domain class — same one the
// admin referral pages already read from) if they don't already have an
// active one, and drafts a short personalized invitation message they can
// see on their self-service page (/customer/referral).
//
// Action/Test/Advise shape (per the project's §166 policy for new Ollama
// job types): the code ISSUANCE is a deterministic, non-Ollama action — a
// customer having an unused code is harmless and reversible, so it needs
// no separate test pass. The Ollama-drafted invitation TEXT gets a real
// deterministic test step: if it contains a dollar or percent figure that
// doesn't match the real active campaign's configured reward value, the
// draft is discarded and replaced with a safe, fact-free template rather
// than risk Ollama promising a reward that doesn't exist. The advise step
// is the invitation draft itself — customers decide whether to send it,
// same draft-gated pattern as every other content job in this codebase.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';
import { ReferralCode, type ReferralCodeProps } from '../../domain/referral/ReferralCode';

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sohamyoga.ca';
const INVITATION_STALE_DAYS = 30;

function extractText(raw: string): string {
  return raw.trim().replace(/^```(?:text)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

function generateCodeString(seed: string): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  const prefix = seed.replace(/[^A-Za-z]/g, '').slice(0, 6).toUpperCase() || 'SOHAM';
  return `${prefix}-${random}`;
}

/** Reject anything with a $ or % figure that doesn't match the real active reward — never let a drafted invitation promise a number that isn't configured. */
function passesFactCheck(draft: string, realReferrerReward: number | null): boolean {
  const figures = draft.match(/[$€£]\s?\d+(\.\d+)?|\d+(\.\d+)?\s?%/g);
  if (!figures) return true;
  if (realReferrerReward === null) return false;
  return figures.every(f => {
    const n = Number(f.replace(/[^0-9.]/g, ''));
    return Math.abs(n - realReferrerReward) < 0.01;
  });
}

export async function run(): Promise<void> {
  const tenant = await db.query<{ id: string }>(`SELECT id FROM tenant LIMIT 1`);
  if (!tenant.rowCount) { console.log('[referral-invitation] no tenant configured, skipping'); return; }
  const tenantId = tenant.rows[0].id;

  const candidates = await db.query<{
    customer_id: string; display_name: string;
    code_id: string | null; code: string | null; referral_url: string | null;
    invitation_drafted_at: string | null;
    referrer_reward_value: string | null;
  }>(
    `SELECT
       c.id AS customer_id, c.display_name,
       rc.id AS code_id, rc.code, rc.referral_url, rc.invitation_drafted_at,
       camp.referrer_reward_value
     FROM advocacy_score a
     JOIN customer c ON c.student_id = a.student_id
     LEFT JOIN referral_code rc ON rc.referrer_id = c.id AND rc.referrer_type = 'customer_customer' AND rc.status = 'active'
     LEFT JOIN referral_campaign camp ON camp.status = 'active' AND 'customer_customer' = ANY(camp.eligible_referral_types)
     WHERE a.eligibility = 'strong_candidate'
     ORDER BY a.computed_at DESC`,
  );

  if (!candidates.rowCount) { console.log('[referral-invitation] no strong_candidate customers with a linked customer record, skipping'); return; }

  let codesIssued = 0;
  let draftsWritten = 0;

  for (const row of candidates.rows) {
    let codeId = row.code_id;
    let code = row.code;
    let referralUrl = row.referral_url;
    let invitationDraftedAt = row.invitation_drafted_at;

    if (!codeId) {
      // Real, deterministic action via the real domain class — validates
      // its own invariants (non-empty id/referrerId/referralUrl) the same
      // way admin-issued codes do.
      const newCode = generateCodeString(row.display_name);
      const props: ReferralCodeProps = {
        id: crypto.randomUUID(),
        code: newCode,
        referrerId: row.customer_id,
        referrerType: 'customer_customer',
        referralUrl: `${SITE_URL}/r/${newCode}`,
        status: 'active',
        usedCount: 0,
        clickCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const domainCode = new ReferralCode(props); // throws if invariants are violated — fail loud, don't insert a broken row
      await db.query(
        `INSERT INTO referral_code (id, code, referrer_id, referrer_type, referral_url, status, used_count, click_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [domainCode.id, domainCode.code, domainCode.referrerId, domainCode.referrerType, domainCode.referralUrl, domainCode.status, domainCode.usedCount, domainCode.clickCount],
      );
      codeId = domainCode.id;
      code = domainCode.code;
      referralUrl = domainCode.referralUrl;
      invitationDraftedAt = null;
      codesIssued++;
    }

    const isStale = !invitationDraftedAt
      || (Date.now() - new Date(invitationDraftedAt).getTime()) / 86_400_000 > INVITATION_STALE_DAYS;
    if (!isStale) continue;

    const realReward = row.referrer_reward_value ? Number(row.referrer_reward_value) : null;
    let draft: string;
    try {
      const prompt = `Draft a short (1-2 sentence) friendly invitation message that ${row.display_name} could post or send to a friend, inviting them to try SohamYoga using their real referral link: ${referralUrl}.${realReward ? ` The real referral reward is ${realReward}.` : ' No specific reward amount is configured right now — do not mention a dollar amount or percentage.'}`;
      const raw = await ollama.generate(prompt, {
        tier: 'fast',
        system: 'You are writing a short, warm referral-invitation message on behalf of a real yoga-studio customer. Only mention a specific reward figure if one is explicitly given in the prompt — never invent a dollar amount, percentage, or discount that was not stated.',
        maxTokens: 150, timeoutMs: 45_000,
      });
      const generated = extractText(raw);
      draft = passesFactCheck(generated, realReward)
        ? generated
        : `Hi! I've been practicing at SohamYoga and thought you'd enjoy it too — here's my personal invite link: ${referralUrl}`;
    } catch (err) {
      console.error(`[referral-invitation] draft failed for customer ${row.customer_id}:`, err);
      draft = `Hi! I've been practicing at SohamYoga and thought you'd enjoy it too — here's my personal invite link: ${referralUrl}`;
    }

    await db.query(
      `UPDATE referral_code SET invitation_draft = $1, invitation_drafted_at = now() WHERE id = $2`,
      [draft, codeId],
    );
    draftsWritten++;
  }

  console.log(`[referral-invitation] ${candidates.rowCount} strong_candidate customer(s) — ${codesIssued} code(s) issued, ${draftsWritten} invitation draft(s) written`);
  // Do NOT db.end() here — runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container.
}
