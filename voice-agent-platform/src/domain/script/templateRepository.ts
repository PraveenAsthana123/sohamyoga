import { query } from '@/lib/db';
import { CallScriptDirection } from './CallScript';

export interface ScriptTemplate {
  id: string;
  name: string;
  category: string;
  direction: CallScriptDirection;
  opening: string;
  discoveryQuestions: string[];
  objectionHandling: string;
  closing: string;
}

interface TemplateRow {
  id: string; name: string; category: string; direction: CallScriptDirection;
  opening: string; discovery_questions: string[]; objection_handling: string; closing: string;
}

function toTemplate(row: TemplateRow): ScriptTemplate {
  return {
    id: row.id, name: row.name, category: row.category, direction: row.direction,
    opening: row.opening, discoveryQuestions: row.discovery_questions,
    objectionHandling: row.objection_handling, closing: row.closing,
  };
}

export async function listScriptTemplates(): Promise<ScriptTemplate[]> {
  const { rows } = await query<TemplateRow>('SELECT * FROM script_template ORDER BY category, name');
  return rows.map(toTemplate);
}

export async function getScriptTemplate(id: string): Promise<ScriptTemplate | null> {
  const { rows } = await query<TemplateRow>('SELECT * FROM script_template WHERE id = $1', [id]);
  return rows[0] ? toTemplate(rows[0]) : null;
}
