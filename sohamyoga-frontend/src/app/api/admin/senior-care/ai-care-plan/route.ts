import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { age, primary_condition, care_level, aish_recipient = false, alberta_seniors_benefit = false, client_name = 'the client' } = body;
    if (!primary_condition || !care_level) {
      return Response.json({ error: 'primary_condition, care_level required' }, { status: 400 });
    }
    const prompt = `Create a personalized home care plan for ${client_name}, a ${age || 'senior'}-year-old client with ${primary_condition} and ${care_level.replace(/_/g, ' ')} care needs. Include: daily routine, safety recommendations, medication management, nutrition guidelines, fall prevention, caregiver tasks, family communication schedule, Alberta Health Services resources, and ${aish_recipient ? 'AISH eligibility notes' : ''}${alberta_seniors_benefit ? ' Alberta Seniors Benefit notes' : ''}. Format as a structured care plan with numbered sections.`;
    let plan = '';
    let aiUsed = false;
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const data = await res.json();
        plan = data.response || '';
        aiUsed = true;
      }
    } catch { /* Ollama unavailable */ }
    if (!plan) {
      plan = `HOME CARE PLAN — ${client_name}
Condition: ${primary_condition} | Care Level: ${care_level.replace(/_/g, ' ')}

1. DAILY ROUTINE
   Morning: Personal hygiene assistance, breakfast preparation, medication reminder (AM)
   Afternoon: Light activity, social engagement, meal preparation, rest period
   Evening: Dinner assistance, medication reminder (PM), safety check before sleep

2. SAFETY RECOMMENDATIONS
   - Non-slip mats in bathroom and kitchen
   - Grab bars installed in bathroom
   - Clear pathways free of clutter
   - Medical alert system (e.g., Lifeline) recommended
   - Emergency numbers posted visibly

3. MEDICATION MANAGEMENT
   - Medication blister packs organized weekly
   - Caregiver to witness and document medication administration
   - Pharmacy delivery service recommended
   - Physician review scheduled quarterly

4. NUTRITION GUIDELINES
   - 3 balanced meals per day, appropriate for ${primary_condition}
   - Adequate hydration (minimum 6-8 cups of fluid daily)
   - Dietary restrictions per physician orders

5. FALL PREVENTION
   - Appropriate footwear at all times
   - Mobility aids available (walker/cane) if needed
   - Lighting adequate in all areas, especially nighttime

6. CAREGIVER TASKS
   - Personal hygiene assistance as needed
   - Meal preparation and cleanup
   - Light housekeeping
   - Companionship and emotional support
   - Documentation of daily observations

7. FAMILY COMMUNICATION
   - Weekly progress call with family/POA
   - Immediate notification for any incidents, health changes, or emergencies

8. ALBERTA HEALTH SERVICES RESOURCES
   - AHS Home Care: 403-943-1554 (Calgary zone)
   - Alberta Caregivers Association: 1-877-453-5088
   - 211 Alberta: Social support referrals
   ${aish_recipient ? '- AISH Program: 1-888-644-9992\n' : ''}${alberta_seniors_benefit ? '- Alberta Seniors Benefit: 1-877-644-9992\n' : ''}

NOTE: This care plan is a template for review. Adjust per physician orders and individual assessment.`;
    }
    return Response.json({ plan, ai_used: aiUsed });
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
