import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { allergies, current_meds, new_drug, strength } = await req.json();

  const prompt = `Check for drug interactions for patient with allergies: ${(allergies ?? []).join(', ') || 'None known'}. Current medications: ${(current_meds ?? []).join(', ') || 'None'}. New prescription: ${new_drug} ${strength}. Provide: interaction severity (none/minor/moderate/severe), mechanism of action for any interactions, clinical significance, monitoring parameters, and recommendation (safe/monitor/avoid/contraindicated). This is clinical decision support — pharmacist must verify.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    return Response.json({ result: data.response, ai: true });
  } catch {
    // Fallback: list common interaction categories
    const fallback = `CLINICAL DECISION SUPPORT (AI unavailable — manual verification required)

New Drug: ${new_drug} ${strength}
Patient Allergies: ${(allergies ?? []).join(', ') || 'None documented'}
Current Medications: ${(current_meds ?? []).join(', ') || 'None documented'}

⚠️ Please manually check the following categories:
1. Drug-Drug Interactions: Review interaction databases (Lexicomp, Micromedex, Clinical Pharmacology)
2. Drug-Allergy Cross-reactivity: Verify against documented allergy list
3. Drug-Condition Interactions: Review patient's current conditions
4. Duplicate Therapy: Check for therapeutic duplication in same drug class
5. Narrow Therapeutic Index Drugs: Extra caution if patient takes warfarin, digoxin, lithium, phenytoin, theophylline

RECOMMENDATION: Pharmacist must manually verify all interactions before dispensing.`;
    return Response.json({ result: fallback, ai: false });
  }
}
