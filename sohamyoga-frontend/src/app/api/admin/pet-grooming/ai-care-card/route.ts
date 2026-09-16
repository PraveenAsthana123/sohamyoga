import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { pet_id, boarding_id } = body;
  if (!pet_id) return Response.json({ error: 'pet_id required' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  let petData: Record<string, unknown> = {};
  let boardingData: Record<string, unknown> = {};
  try {
    const petRes = await client.query(
      `SELECT p.*, o.first_name AS owner_first, o.last_name AS owner_last, o.phone AS owner_phone,
              o.emergency_contact_name, o.emergency_contact_phone,
              o.vet_name, o.vet_phone, o.vet_clinic
       FROM pg_pet p LEFT JOIN pg_owner o ON p.owner_id = o.id WHERE p.id = $1`,
      [pet_id]
    );
    if (!petRes.rows.length) return Response.json({ error: 'Pet not found' }, { status: 404 });
    petData = petRes.rows[0];

    if (boarding_id) {
      const boardingRes = await client.query(`SELECT * FROM pg_boarding WHERE id = $1`, [boarding_id]);
      if (boardingRes.rows.length) boardingData = boardingRes.rows[0];
    }
  } finally {
    client.release();
  }

  const age = petData.date_of_birth
    ? Math.floor((Date.now() - new Date(String(petData.date_of_birth)).getTime()) / (365.25 * 24 * 3600 * 1000))
    : 'unknown';
  const spayedStr = petData.spayed_neutered ? 'spayed/neutered' : 'intact';
  const feeding = String(boardingData.feeding_instructions || 'standard feeding schedule');
  const meds = String(boardingData.medication_instructions || 'none');
  const behaviour = String(petData.behavioural_notes || 'no special notes');

  const prompt = `Create a pet care card for a boarding stay. Pet: ${petData.name}, ${petData.species} ${petData.breed || ''}, ${age} years, ${petData.weight_kg || 'unknown'}kg, ${petData.sex || 'unknown sex'}, ${spayedStr}. Feeding: ${feeding}. Medications: ${meds}. Behavioral notes: ${behaviour}. Include: daily routine, enrichment activities, comfort signals, stress indicators to watch for, and emergency protocol.`;

  let card = '';
  try {
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (ollamaRes.ok) {
      const data = await ollamaRes.json();
      card = data.response || '';
    }
  } catch {
    // graceful fallback
  }

  if (!card) {
    card = `# Pet Care Card — ${petData.name}
**Species/Breed:** ${petData.species} / ${petData.breed || 'Mixed'}
**Age:** ${age} years | **Weight:** ${petData.weight_kg || '?'}kg | **Sex:** ${spayedStr}

## Feeding Schedule
${feeding}

## Medications
${meds}

## Daily Routine
- Morning: Outdoor exercise, feeding, water refresh
- Afternoon: Rest/enrichment activities
- Evening: Walk, feeding, settle-down routine

## Enrichment Activities
- Interactive toys appropriate for ${petData.species}
- Socialization (if comfortable with other animals)
- Regular outdoor breaks

## Comfort Signals
- Relaxed posture, seeking attention, playful behaviour

## Stress Indicators to Watch
- Excessive vocalization, hiding, loss of appetite, aggression
- Alert staff immediately if stress signs persist >1 hour

## Emergency Protocol
Owner: ${petData.owner_first} ${petData.owner_last} — ${petData.owner_phone}
Emergency Contact: ${petData.emergency_contact_name || 'N/A'} — ${petData.emergency_contact_phone || 'N/A'}
Vet: ${petData.vet_name || 'N/A'} @ ${petData.vet_clinic || 'N/A'} — ${petData.vet_phone || 'N/A'}

**Allergies:** ${petData.allergies || 'None known'}`;
  }

  return Response.json({ care_card: card, pet: petData });
}
