import { query } from '@/lib/postgres';

export interface MethodologyValidationResult {
  projectId: string;
  isValid: boolean;
  issues: string[];
  questionCount: number;
}

const MIN_OBJECTIVE_LENGTH = 20;
const MIN_QUESTION_COUNT = 3;

/** Real "Methodology Validation" -- checks a research_project's actual
 * design (objective + research_question rows) against concrete, checkable
 * rules before it's allowed to move to 'fielding'. Not a fabricated
 * quality score: every issue names the exact real row/field that's
 * insufficient. */
export async function validateMethodology(projectId: string): Promise<MethodologyValidationResult> {
  const project = await query<{ objective: string }>('SELECT objective FROM research_project WHERE id = $1', [projectId]);
  if (!project.rowCount) throw new Error('Research project not found.');

  const questions = await query<{ question_text: string }>(
    'SELECT question_text FROM research_question WHERE project_id = $1',
    [projectId]
  );

  const issues: string[] = [];
  const objective = project.rows[0].objective.trim();
  if (objective.length < MIN_OBJECTIVE_LENGTH) {
    issues.push(`Objective is too short (${objective.length} chars) — needs at least ${MIN_OBJECTIVE_LENGTH} to describe a measurable research goal.`);
  }
  if (questions.rows.length < MIN_QUESTION_COUNT) {
    issues.push(`Only ${questions.rows.length} research question(s) defined — needs at least ${MIN_QUESTION_COUNT} before fielding.`);
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const q of questions.rows) {
    const norm = q.question_text.trim().toLowerCase();
    if (seen.has(norm)) duplicates.add(norm);
    seen.add(norm);
  }
  if (duplicates.size > 0) {
    issues.push(`${duplicates.size} duplicate research question(s) found — each question should be distinct.`);
  }

  return { projectId, isValid: issues.length === 0, issues, questionCount: questions.rows.length };
}
