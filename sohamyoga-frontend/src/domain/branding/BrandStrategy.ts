import { query } from '@/lib/postgres';

export interface BrandStrategyProps {
  mission: string;
  vision: string;
  targetAudience: string;
  keyDifferentiators: string[];
  updatedBy: string;
  updatedAt: Date;
}

export interface PositioningEntry {
  id: string;
  label: string;
  isSelf: boolean;
  pricePosition: number;
  qualityPosition: number;
  notes: string;
}

interface StrategyRow {
  mission: string; vision: string; target_audience: string; key_differentiators: string[]; updated_by: string; updated_at: Date;
}
interface PositioningRow {
  id: string; label: string; is_self: boolean; price_position: number; quality_position: number; notes: string;
}

export async function getBrandStrategy(tenantId: string): Promise<BrandStrategyProps | null> {
  const result = await query<StrategyRow>(
    'SELECT mission, vision, target_audience, key_differentiators, updated_by, updated_at FROM brand_strategy WHERE tenant_id = $1',
    [tenantId]
  );
  if (!result.rowCount) return null;
  const r = result.rows[0];
  return { mission: r.mission, vision: r.vision, targetAudience: r.target_audience, keyDifferentiators: r.key_differentiators, updatedBy: r.updated_by, updatedAt: r.updated_at };
}

export async function upsertBrandStrategy(
  tenantId: string,
  input: { mission: string; vision: string; targetAudience: string; keyDifferentiators: string[] },
  updatedBy: string
): Promise<void> {
  await query(
    `INSERT INTO brand_strategy (tenant_id, mission, vision, target_audience, key_differentiators, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (tenant_id) DO UPDATE SET mission = $2, vision = $3, target_audience = $4, key_differentiators = $5, updated_by = $6, updated_at = now()`,
    [tenantId, input.mission, input.vision, input.targetAudience, input.keyDifferentiators, updatedBy]
  );
}

export async function listPositioningEntries(tenantId: string): Promise<PositioningEntry[]> {
  const result = await query<PositioningRow>(
    'SELECT id, label, is_self, price_position, quality_position, notes FROM brand_positioning_entry WHERE tenant_id = $1 ORDER BY is_self DESC, label ASC',
    [tenantId]
  );
  return result.rows.map((r) => ({ id: r.id, label: r.label, isSelf: r.is_self, pricePosition: r.price_position, qualityPosition: r.quality_position, notes: r.notes }));
}

export async function addPositioningEntry(
  tenantId: string,
  input: { label: string; isSelf: boolean; pricePosition: number; qualityPosition: number; notes: string }
): Promise<PositioningEntry> {
  const result = await query<PositioningRow>(
    `INSERT INTO brand_positioning_entry (tenant_id, label, is_self, price_position, quality_position, notes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, label, is_self, price_position, quality_position, notes`,
    [tenantId, input.label, input.isSelf, input.pricePosition, input.qualityPosition, input.notes]
  );
  const r = result.rows[0];
  return { id: r.id, label: r.label, isSelf: r.is_self, pricePosition: r.price_position, qualityPosition: r.quality_position, notes: r.notes };
}

export async function removePositioningEntry(tenantId: string, id: string): Promise<void> {
  await query('DELETE FROM brand_positioning_entry WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
}

export interface BrandArchitectureNode {
  id: string;
  name: string;
  isDefault: boolean;
  primaryColor: string;
}

/** Brand Architecture -- the real hierarchy of brand_kit rows for a tenant:
 * one default (main) brand plus any sub/seasonal kits, not a fabricated
 * house-of-brands diagram with entities that don't exist. */
export async function getBrandArchitecture(tenantId: string): Promise<{ main: BrandArchitectureNode | null; subBrands: BrandArchitectureNode[] }> {
  const result = await query<{ id: string; name: string; is_default: boolean; primary_color: string }>(
    'SELECT id, name, is_default, primary_color FROM brand_kit WHERE tenant_id = $1 ORDER BY is_default DESC, name ASC',
    [tenantId]
  );
  const nodes = result.rows.map((r) => ({ id: r.id, name: r.name, isDefault: r.is_default, primaryColor: r.primary_color }));
  return { main: nodes.find((n) => n.isDefault) ?? null, subBrands: nodes.filter((n) => !n.isDefault) };
}
