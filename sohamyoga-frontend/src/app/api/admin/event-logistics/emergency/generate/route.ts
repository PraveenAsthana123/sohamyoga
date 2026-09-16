export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { scenario, event_name, venue, capacity } = await req.json();

  const prompt = `You are an event safety specialist. Generate a comprehensive emergency response plan for this scenario:
Scenario: ${scenario}
Event: ${event_name}
Venue: ${venue}
Expected capacity: ${capacity}

Return JSON:
{
  "scenario": "${scenario}",
  "response_steps": ["Step 1: immediate action", "Step 2: ...", "Step 3: ...", "Step 4: ...", "Step 5: ..."],
  "responsible_roles": ["Role 1", "Role 2"],
  "emergency_contacts": ["911 (Emergency)", "Local non-emergency police", "Venue safety officer"],
  "prevention_measures": ["measure 1", "measure 2"],
  "communication_protocol": "how to communicate with attendees",
  "estimated_response_time": "5-10 minutes"
}`;

  const fallbacks: Record<string, string[]> = {
    medical: ['Immediately call 911 and announce your location clearly', 'Send trained first aider to patient location', 'Clear a 3-meter radius around patient', 'Assign someone to meet ambulance at venue entrance', 'Do not move patient unless in immediate danger', 'Complete incident report within 1 hour'],
    fire: ['Activate nearest fire alarm pull station', 'Call 911 from mobile, state address and floor', 'Announce evacuation calmly: "Please proceed to nearest exit in an orderly manner"', 'Direct attendees to assembly point at parking lot', 'Sweep area for stragglers — do not use elevators', 'Account for all attendees — report missing persons to fire department'],
    security: ['Contact venue security and local police (non-emergency: 416-808-2222)', 'Identify and isolate the threat without confrontation', 'Announce lockdown if required: "Please shelter in place"', 'Lock all accessible doors', 'Await police clearance before resuming', 'Preserve evidence for investigation'],
    weather: ['Monitor Environment Canada alerts via radio', 'Assess risk level with venue manager', 'If tornado warning: move all attendees to interior ground floor', 'Provide weather updates to attendees every 10 minutes', 'Postpone outdoor activities immediately', 'Document all decisions with timestamps'],
  };

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json() as { response?: string };
    let parsed: Record<string, unknown> = {};
    try {
      const match = (data.response || '').match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch { /* fallback */ }
    return Response.json(parsed.response_steps ? parsed : {
      scenario,
      response_steps: fallbacks[scenario.toLowerCase()] || fallbacks.medical,
      responsible_roles: ['Event Director', 'Safety Officer', 'Venue Manager'],
      emergency_contacts: ['911 (Emergency)', 'Venue Security: On-site', 'Event Director: On-site'],
      prevention_measures: ['Pre-event safety briefing for all staff', 'First aid kits at 3 locations', 'Clear signage to all exits'],
      communication_protocol: 'Use venue PA system for announcements. Staff use radio channel 2. Text emergency team via WhatsApp group.',
      estimated_response_time: '5-10 minutes',
      ai_generated: false,
    });
  } catch {
    return Response.json({ error: 'AI unavailable' }, { status: 503 });
  }
}
