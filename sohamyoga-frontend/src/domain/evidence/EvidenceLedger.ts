// Evidence Ledger — real domain service backing the evidence_record table.
// The roadmap's own five-way classification (FACT/ESTIMATE/INFERENCE/
// HYPOTHESIS/UNKNOWN) plus mandatory source traceability. recordEvidence()
// deliberately requires a real sourceRef — there is no code path in this
// service that lets a caller write a claim with no real backing source.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export type EvidenceType = 'FACT' | 'ESTIMATE' | 'INFERENCE' | 'HYPOTHESIS' | 'UNKNOWN';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export interface EvidenceRecord {
  id: string;
  tenantId: string;
  subjectType: string;
  subjectId: string;
  evidenceType: EvidenceType;
  claim: string;
  confidence: Confidence;
  sourceType: string;
  sourceRef: string;
  collectedAt: Date;
  validUntil: Date | null;
  supersededBy: string | null;
  createdBy: string | null;
  createdAt: Date;
}

export interface RecordEvidenceInput {
  tenantId: string;
  subjectType: string;
  subjectId: string;
  evidenceType: EvidenceType;
  claim: string;
  confidence: Confidence;
  sourceType: string;
  sourceRef: string; // required -- see file header
  validUntil?: Date | null;
  createdBy?: string | null;
}

function rowToRecord(r: any): EvidenceRecord {
  return {
    id: r.id, tenantId: r.tenant_id, subjectType: r.subject_type, subjectId: r.subject_id,
    evidenceType: r.evidence_type, claim: r.claim, confidence: r.confidence,
    sourceType: r.source_type, sourceRef: r.source_ref, collectedAt: r.collected_at,
    validUntil: r.valid_until, supersededBy: r.superseded_by, createdBy: r.created_by, createdAt: r.created_at,
  };
}

export async function recordEvidence(input: RecordEvidenceInput): Promise<EvidenceRecord> {
  if (!input.claim.trim()) throw new Error('claim is required');
  if (!input.sourceRef.trim()) throw new Error('sourceRef is required -- evidence must trace to a real source, never recorded bare');
  const res = await db.query(
    `INSERT INTO evidence_record (tenant_id, subject_type, subject_id, evidence_type, claim, confidence, source_type, source_ref, valid_until, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [input.tenantId, input.subjectType, input.subjectId, input.evidenceType, input.claim, input.confidence,
      input.sourceType, input.sourceRef, input.validUntil ?? null, input.createdBy ?? null],
  );
  return rowToRecord(res.rows[0]);
}

export async function getEvidenceForSubject(tenantId: string, subjectType: string, subjectId: string): Promise<EvidenceRecord[]> {
  const res = await db.query(
    `SELECT * FROM evidence_record WHERE tenant_id = $1 AND subject_type = $2 AND subject_id = $3
     ORDER BY collected_at DESC`,
    [tenantId, subjectType, subjectId],
  );
  return res.rows.map(rowToRecord);
}

export async function getRecentEvidence(tenantId: string, limit = 50): Promise<EvidenceRecord[]> {
  const res = await db.query(
    `SELECT * FROM evidence_record WHERE tenant_id = $1 ORDER BY collected_at DESC LIMIT $2`,
    [tenantId, limit],
  );
  return res.rows.map(rowToRecord);
}

// Real staleness check -- evidence past its own valid_until is not
// deleted (audit trail), just excluded from "current" reads by callers
// that care about freshness.
export function isCurrent(e: Pick<EvidenceRecord, 'validUntil'>, now: Date = new Date()): boolean {
  return e.validUntil === null || e.validUntil > now;
}

// Pure, unit-tested: the roadmap's own rule -- a downstream report may
// only assert a claim it can cite real evidence for. Returns which of the
// given claims have zero backing evidence, so a caller can refuse to
// publish them rather than silently including an unsupported assertion.
export function findUnsupportedClaims(claims: string[], evidence: EvidenceRecord[]): string[] {
  const supportedClaims = new Set(evidence.map((e) => e.claim));
  return claims.filter((c) => !supportedClaims.has(c));
}
