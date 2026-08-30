// Core domain service for the 17-phase pipeline engine. Every function here
// does a real Postgres read/write against market_research_portal — no
// fabricated data. Shared by every API route so there is exactly one place
// that knows how a study/phase_run/transaction/status-history is shaped.

import { query, transaction } from '../../lib/postgres';

export interface Phase {
  id: string;
  slug: string;
  name: string;
  layerNumber: number;
  processReference: string;
  inputReference: string;
  outputReference: string;
}

export interface Study {
  id: string;
  topicName: string;
  createdBy: string;
  status: string;
  businessModel: 'b2b' | 'b2c';
  createdAt: string;
  updatedAt: string;
}

export type BusinessModel = 'b2b' | 'b2c';

export interface PhaseRun {
  id: string;
  studyId: string;
  phaseId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  statusHistory: Array<{ status: string; at: string }>;
  goal: string;
  objective: string;
  todoList: Array<{ text: string; done: boolean }>;
  inputContent: string;
  processContent: string;
  outputContent: string;
  visualizationData: Record<string, unknown>;
  checklist: Array<{ text: string; done: boolean }>;
  inclusionBoundary: string;
  exclusionBoundary: string;
  taskList: Array<{ text: string; assignee: string; status: string }>;
  finalOutcomeReport: string;
  createdAt: string;
  updatedAt: string;
}

function mapPhase(row: any): Phase {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    layerNumber: row.layer_number,
    processReference: row.process_reference,
    inputReference: row.input_reference,
    outputReference: row.output_reference,
  };
}

function mapStudy(row: any): Study {
  return {
    id: row.id,
    topicName: row.topic_name,
    createdBy: row.created_by,
    status: row.status,
    businessModel: row.business_model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPhaseRun(row: any): PhaseRun {
  return {
    id: row.id,
    studyId: row.study_id,
    phaseId: row.phase_id,
    status: row.status,
    statusHistory: row.status_history ?? [],
    goal: row.goal,
    objective: row.objective,
    todoList: row.todo_list ?? [],
    inputContent: row.input_content,
    processContent: row.process_content,
    outputContent: row.output_content,
    visualizationData: row.visualization_data ?? {},
    checklist: row.checklist ?? [],
    inclusionBoundary: row.inclusion_boundary,
    exclusionBoundary: row.exclusion_boundary,
    taskList: row.task_list ?? [],
    finalOutcomeReport: row.final_outcome_report,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPhases(): Promise<Phase[]> {
  const result = await query(`SELECT * FROM phase ORDER BY layer_number`);
  return result.rows.map(mapPhase);
}

export async function getPhaseBySlug(slug: string): Promise<Phase | null> {
  const result = await query(`SELECT * FROM phase WHERE slug = $1`, [slug]);
  return result.rowCount ? mapPhase(result.rows[0]) : null;
}

export async function listStudies(): Promise<Study[]> {
  const result = await query(`SELECT * FROM study ORDER BY created_at DESC`);
  return result.rows.map(mapStudy);
}

export async function getStudy(studyId: string): Promise<Study | null> {
  const result = await query(`SELECT * FROM study WHERE id = $1`, [studyId]);
  return result.rowCount ? mapStudy(result.rows[0]) : null;
}

export interface ChecklistTemplateItem { text: string }

/** Real, phase-specific checklist template for one (phase, business_model) pair — see seed-checklist-templates.sql. */
export async function getChecklistTemplate(phaseId: string, businessModel: BusinessModel): Promise<ChecklistTemplateItem[]> {
  const result = await query(
    `SELECT items FROM phase_checklist_template WHERE phase_id = $1 AND business_model = $2`,
    [phaseId, businessModel],
  );
  if (!result.rowCount) return [];
  return (result.rows[0].items ?? []) as ChecklistTemplateItem[];
}

/** Both B2B and B2C checklist templates for a phase, by slug — used by reference mode to show what each variant looks like before any study exists. */
export async function getChecklistTemplatesForPhaseSlug(phaseSlug: string): Promise<{ b2b: ChecklistTemplateItem[]; b2c: ChecklistTemplateItem[] } | null> {
  const phase = await getPhaseBySlug(phaseSlug);
  if (!phase) return null;
  const result = await query(
    `SELECT business_model, items FROM phase_checklist_template WHERE phase_id = $1`,
    [phase.id],
  );
  const b2b = (result.rows.find(r => r.business_model === 'b2b')?.items ?? []) as ChecklistTemplateItem[];
  const b2c = (result.rows.find(r => r.business_model === 'b2c')?.items ?? []) as ChecklistTemplateItem[];
  return { b2b, b2c };
}

/** Build the seed 13-field structure for a freshly-created phase_run from its phase reference content, merged with the real (phase, business_model) checklist template. */
function seedFieldsForPhase(phase: Phase, topicName: string, templateItems: ChecklistTemplateItem[]) {
  return {
    goal: `Answer, for "${topicName}": ${phase.outputReference}.`,
    objective: `Investigate ${phase.processReference.toLowerCase()} to produce a real, grounded ${phase.name.toLowerCase()} finding for "${topicName}".`,
    todoList: JSON.stringify([
      { text: `Gather ${phase.inputReference}`, done: false },
      { text: `Run Research-AI draft grounded in phase reference text`, done: false },
      { text: `Human review of draft output`, done: false },
      { text: `Mark phase complete`, done: false },
    ]),
    inputContent: phase.inputReference,
    processContent: phase.processReference,
    inclusionBoundary: `Covers ${phase.processReference.toLowerCase()} for the "${topicName}" study, grounded in the ${phase.name} layer's documented reference definition.`,
    exclusionBoundary: `Does not cover live scraping of government/paid data sources, or any other phase's layer — see docs/market-research-growth-framework.md §2 for the full 17-layer boundary.`,
    // Real, phase-specific research items first (from phase_checklist_template,
    // grounded in this phase's process/input/output reference text), then the
    // 4 generic workflow-gate items — both are legitimate, neither replaces
    // the other.
    checklist: JSON.stringify([
      ...templateItems.map(item => ({ text: item.text, done: false })),
      { text: 'Reference content loaded', done: true },
      { text: 'Research-AI draft generated', done: false },
      { text: 'Fact-check passed', done: false },
      { text: 'Human reviewed', done: false },
    ]),
    taskList: JSON.stringify([
      { text: `Run ResearchAiDraftJob for ${phase.name}`, assignee: 'system', status: 'pending' },
    ]),
  };
}

/**
 * Creates a study and one phase_run per phase (17), each seeded with that
 * phase's real reference content plus its real (phase, businessModel)
 * checklist template. Returns the created study + phase_run ids so the
 * caller can kick off ResearchAiDraftJob per phase_run.
 */
export async function createStudy(topicName: string, businessModel: BusinessModel, createdBy = 'admin'): Promise<{ study: Study; phaseRunIds: Array<{ phaseRunId: string; phaseId: string; phaseSlug: string }> }> {
  const phases = await listPhases();
  if (phases.length !== 17) {
    throw new Error(`Expected 17 seeded phase rows, found ${phases.length} — refusing to create a study against an incomplete phase table.`);
  }

  return transaction(async client => {
    const studyResult = await client.query(
      `INSERT INTO study (topic_name, created_by, status, business_model) VALUES ($1, $2, 'running', $3) RETURNING *`,
      [topicName, createdBy, businessModel],
    );
    const study = mapStudy(studyResult.rows[0]);

    const phaseRunIds: Array<{ phaseRunId: string; phaseId: string; phaseSlug: string }> = [];
    for (const phase of phases) {
      const templateResult = await client.query(
        `SELECT items FROM phase_checklist_template WHERE phase_id = $1 AND business_model = $2`,
        [phase.id, businessModel],
      );
      const templateItems: ChecklistTemplateItem[] = templateResult.rowCount ? (templateResult.rows[0].items ?? []) : [];
      const seed = seedFieldsForPhase(phase, topicName, templateItems);
      const nowIso = new Date().toISOString();
      const runResult = await client.query(
        `INSERT INTO phase_run (
           study_id, phase_id, status, status_history, goal, objective, todo_list,
           input_content, process_content, output_content, checklist,
           inclusion_boundary, exclusion_boundary, task_list
         ) VALUES ($1,$2,'pending',$3,$4,$5,$6,$7,$8,'',$9,$10,$11,$12)
         RETURNING id`,
        [
          study.id, phase.id,
          JSON.stringify([{ status: 'pending', at: nowIso }]),
          seed.goal, seed.objective, seed.todoList,
          seed.inputContent, seed.processContent, seed.checklist,
          seed.inclusionBoundary, seed.exclusionBoundary, seed.taskList,
        ],
      );
      const phaseRunId = runResult.rows[0].id as string;
      await client.query(
        `INSERT INTO phase_run_transaction (phase_run_id, event_type, description) VALUES ($1, 'created', $2)`,
        [phaseRunId, `Phase run created for study "${topicName}" — seeded from phase reference content.`],
      );
      phaseRunIds.push({ phaseRunId, phaseId: phase.id, phaseSlug: phase.slug });
    }
    return { study, phaseRunIds };
  });
}

export async function getStudyPhaseRuns(studyId: string): Promise<Array<PhaseRun & { phaseSlug: string; phaseName: string; layerNumber: number }>> {
  const result = await query(
    `SELECT pr.*, p.slug AS phase_slug, p.name AS phase_name, p.layer_number
     FROM phase_run pr JOIN phase p ON p.id = pr.phase_id
     WHERE pr.study_id = $1 ORDER BY p.layer_number`,
    [studyId],
  );
  return result.rows.map(row => ({ ...mapPhaseRun(row), phaseSlug: row.phase_slug, phaseName: row.phase_name, layerNumber: row.layer_number }));
}

export async function getPhaseRunByStudyAndSlug(studyId: string, phaseSlug: string): Promise<{ phase: Phase; phaseRun: PhaseRun } | null> {
  const result = await query(
    `SELECT pr.*, p.id AS p_id, p.slug AS p_slug, p.name AS p_name, p.layer_number AS p_layer_number,
            p.process_reference AS p_process_reference, p.input_reference AS p_input_reference, p.output_reference AS p_output_reference
     FROM phase_run pr JOIN phase p ON p.id = pr.phase_id
     WHERE pr.study_id = $1 AND p.slug = $2`,
    [studyId, phaseSlug],
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  const phase: Phase = {
    id: row.p_id, slug: row.p_slug, name: row.p_name, layerNumber: row.p_layer_number,
    processReference: row.p_process_reference, inputReference: row.p_input_reference, outputReference: row.p_output_reference,
  };
  return { phase, phaseRun: mapPhaseRun(row) };
}

export async function getPhaseRunTransactions(phaseRunId: string) {
  const result = await query(
    `SELECT id, event_type, description, occurred_at FROM phase_run_transaction WHERE phase_run_id = $1 ORDER BY occurred_at DESC`,
    [phaseRunId],
  );
  return result.rows;
}

export async function getPhaseRunAiLogs(phaseRunId: string) {
  const result = await query(
    `SELECT id, purpose, model_name, prompt_chars, output_chars, status, fact_check_passed, created_at
     FROM phase_run_ai_log WHERE phase_run_id = $1 ORDER BY created_at DESC`,
    [phaseRunId],
  );
  return result.rows;
}

export async function appendTransaction(phaseRunId: string, eventType: string, description: string): Promise<void> {
  await query(
    `INSERT INTO phase_run_transaction (phase_run_id, event_type, description) VALUES ($1, $2, $3)`,
    [phaseRunId, eventType, description],
  );
}

export async function setPhaseRunStatus(phaseRunId: string, status: PhaseRun['status']): Promise<void> {
  const nowIso = new Date().toISOString();
  await query(
    `UPDATE phase_run
     SET status = $1, status_history = status_history || $2::jsonb, updated_at = now()
     WHERE id = $3`,
    [status, JSON.stringify([{ status, at: nowIso }]), phaseRunId],
  );
}
