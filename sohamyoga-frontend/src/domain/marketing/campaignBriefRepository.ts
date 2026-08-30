// Shared load/save for CampaignBrief, mirroring src/domain/video/videoRepository.ts.
import { query } from '@/lib/postgres';
import { CampaignBrief, type CampaignBriefProps } from './CampaignBrief';

interface CampaignBriefRow {
  id: string; tenant_id: string; name: string; description: string | null;
  objective: CampaignBriefProps['objective']; offer_type: CampaignBriefProps['offerType'];
  target_persona: string[]; channels: string[]; content_sequence: CampaignBriefProps['contentSequence'];
  budget_planned_cad: string; budget_actual_cad: string;
  start_date: Date; end_date: Date; status: CampaignBriefProps['status'];
  approved_by: string | null; approved_at: Date | null; paused_reason: string | null;
  utm_campaign: string; created_by: string; created_at: Date; updated_at: Date;
}

function rowToCampaignBrief(r: CampaignBriefRow): CampaignBrief {
  return new CampaignBrief({
    id: r.id, tenantId: r.tenant_id, name: r.name, description: r.description ?? '',
    objective: r.objective, offerType: r.offer_type,
    targetPersona: r.target_persona, channels: r.channels, contentSequence: r.content_sequence,
    budgetPlannedCAD: Number(r.budget_planned_cad), budgetActualCAD: Number(r.budget_actual_cad),
    startDate: new Date(r.start_date), endDate: new Date(r.end_date), status: r.status,
    approvedBy: r.approved_by ?? undefined, approvedAt: r.approved_at ?? undefined,
    pausedReason: r.paused_reason ?? undefined, utmCampaign: r.utm_campaign,
    createdBy: r.created_by, createdAt: new Date(r.created_at), updatedAt: new Date(r.updated_at),
  });
}

export async function loadCampaignBrief(id: string): Promise<CampaignBrief | null> {
  const rows = await query<CampaignBriefRow>(
    `SELECT id, tenant_id, name, description, objective::text, offer_type, target_persona, channels,
            content_sequence, budget_planned_cad, budget_actual_cad, start_date, end_date, status::text,
            approved_by, approved_at, paused_reason, utm_campaign, created_by, created_at, updated_at
     FROM campaign_brief WHERE id = $1`,
    [id],
  );
  if (!rows.rows.length) return null;
  return rowToCampaignBrief(rows.rows[0]);
}

export async function saveCampaignBriefState(brief: CampaignBrief): Promise<void> {
  const p = brief.toJSON();
  await query(
    `UPDATE campaign_brief SET
       status = $2, approved_by = $3, approved_at = $4, paused_reason = $5,
       budget_actual_cad = $6, updated_at = $7
     WHERE id = $1`,
    [p.id, p.status, p.approvedBy ?? null, p.approvedAt ?? null, p.pausedReason ?? null,
      p.budgetActualCAD, p.updatedAt],
  );
}
