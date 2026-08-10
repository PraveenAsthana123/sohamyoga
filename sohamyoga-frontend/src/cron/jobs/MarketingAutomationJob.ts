import { Pool } from 'pg';
import { ollama } from '../OllamaClient';
import { CAMPAIGN_SEGMENTS, segmentLabel } from '../campaignSegments';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

type RequestRow = {
  id: string; tenant_id: string; title: string; industry: string; objective: string;
  audience: string; offer_text: string; call_to_action: string; asset_types: string[];
  channels: string[]; model_name: string | null; target_segments: string[];
};

function extractJson(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Ollama returned no JSON object');
  return JSON.parse(fenced.slice(start, end + 1)) as Record<string, unknown>;
}

export async function run(): Promise<void> {
  const client = await db.connect();
  let request: RequestRow | undefined;
  try {
    await client.query('BEGIN');
    const claimed = await client.query<RequestRow>(
      `SELECT id, tenant_id, title, industry, objective, audience, offer_text,
              call_to_action, asset_types, channels, model_name, target_segments
       FROM marketing_automation_request
       WHERE status='queued' AND (scheduled_at IS NULL OR scheduled_at <= now())
       ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`,
    );
    request = claimed.rows[0];
    if (!request) { await client.query('COMMIT'); return; }
    await client.query(
      `UPDATE marketing_automation_request SET status='generating', current_stage='ollama_copy', progress_percent=15, updated_at=now() WHERE id=$1`,
      [request.id],
    );
    await client.query(
      `INSERT INTO marketing_workflow_event (tenant_id, request_id, stage, status, actor_type, message)
       VALUES ($1,$2,'ollama_copy','started','ollama','Local content generation started')`,
      [request.tenant_id, request.id],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    throw error;
  }
  client.release();

  // No segments specified -> one generic asset set, exactly the prior behaviour.
  // Segments specified -> one distinct, Ollama-personalized asset set per segment.
  const segments = request.target_segments?.length
    ? request.target_segments.map(key => CAMPAIGN_SEGMENTS.find(s => s.key === key)).filter((s): s is typeof CAMPAIGN_SEGMENTS[number] => Boolean(s))
    : [null];

  try {
    const results = await Promise.all(segments.map(async segment => {
      const audienceLine = segment
        ? `Audience segment: ${segment.label}\nTone guidance for this segment: ${segment.toneGuidance}`
        : `Audience: ${request.audience}`;
      const response = await ollama.generate(
        `Create a compliant digital marketing campaign as JSON for a ${request.industry} business.
Campaign: ${request.title}
Objective: ${request.objective}
${audienceLine}
Offer: ${request.offer_text}
CTA: ${request.call_to_action}
Channels: ${request.channels.join(', ')}
Return exactly one JSON object with keys: headline, body, short_caption, hashtags (array),
image_prompt, dynamic_banner_prompt, video_title, video_script, youtube_description,
email_subject (<=60 chars, specific to this audience/offer, no generic "Check this out"),
email_preview_text (<=100 chars, complements the subject, does not repeat it).
Do not invent prices, certifications, medical outcomes, testimonials, or guarantees.`,
        { model: request.model_name || undefined, tier: 'strong', temperature: 0.4, maxTokens: 1800, timeoutMs: 180_000 },
      );
      return { segmentKey: segment?.key ?? null, content: extractJson(response) };
    }));
    await transactionResult(request, results);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : 'Generation failed';
    await db.query(
      `UPDATE marketing_automation_request SET status='failed', current_stage='ollama_copy', error_message=$2, updated_at=now() WHERE id=$1`,
      [request.id, message],
    );
    await db.query(
      `INSERT INTO marketing_workflow_event (tenant_id, request_id, stage, status, actor_type, message)
       VALUES ($1,$2,'ollama_copy','failed','ollama',$3)`,
      [request.tenant_id, request.id, message],
    );
    throw error;
  }
}

async function transactionResult(
  request: RequestRow,
  results: { segmentKey: string | null; content: Record<string, unknown> }[],
): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const { segmentKey, content } of results) {
      for (const assetType of request.asset_types) {
        const text = assetType === 'video_script'
          ? String(content.video_script || '')
          : assetType === 'static_banner' || assetType === 'dynamic_banner'
            ? String(content[assetType === 'static_banner' ? 'image_prompt' : 'dynamic_banner_prompt'] || '')
            : JSON.stringify(content);
        await client.query(
          `INSERT INTO generated_marketing_asset
           (tenant_id, request_id, asset_type, status, text_content, metadata, segment_key)
           VALUES ($1,$2,$3,'review_required',$4,$5,$6)`,
          [request.tenant_id, request.id, assetType, text,
            JSON.stringify({ generatedBy: 'ollama', model: request.model_name, channels: request.channels, segment: segmentKey ? segmentLabel(segmentKey) : undefined }),
            segmentKey],
        );
      }
    }
    await client.query(
      `UPDATE marketing_automation_request SET status='review_required', current_stage='admin_review', progress_percent=60, updated_at=now() WHERE id=$1`,
      [request.id],
    );
    await client.query(
      `INSERT INTO marketing_workflow_event (tenant_id, request_id, stage, status, actor_type, message, details)
       VALUES ($1,$2,'admin_review','pending','system','Generated assets require approval',$3)`,
      [request.tenant_id, request.id, JSON.stringify({
        assetTypes: request.asset_types, channels: request.channels,
        segments: results.map(r => r.segmentKey).filter(Boolean),
      })],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
