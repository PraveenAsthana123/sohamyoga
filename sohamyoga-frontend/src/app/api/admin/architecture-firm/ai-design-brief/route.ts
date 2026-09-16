import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const { project_type, client_type, city, project_name, gross_area_sqft, construction_budget } = await req.json();
    const prompt = `Write an architectural design brief for a ${project_type} project. Client: ${client_type}, Site: ${city ?? 'Calgary'}, Alberta. Program: ${project_name}, ${gross_area_sqft ?? 'TBD'} sq ft. Budget: $${construction_budget ?? 'TBD'}. Include: project vision, functional requirements, spatial relationships, site considerations, sustainability goals (LEED/BOMA/Step Code targets), Alberta Building Code key considerations, permit process overview (Calgary Development Permit + Building Permit), design constraints, and schedule milestones. Professional architectural practice format.`;
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json() as { response?: string };
      return Response.json({ result: data.response ?? '' });
    } catch {
      return Response.json({ result: `[ARCHITECTURAL DESIGN BRIEF — Offline Draft]\n\nProject: ${project_name}\nType: ${project_type} | Client: ${client_type} | Area: ${gross_area_sqft} sq ft | Budget: $${construction_budget}\n\n1. PROJECT VISION\nDesign a functionally efficient and architecturally distinctive ${project_type} that reflects the client's values and responds to its Calgary, Alberta context.\n\n2. FUNCTIONAL REQUIREMENTS\n• Primary program spaces to be determined through detailed programming sessions\n• Accessibility per Alberta Building Code Division B, Section 3.8\n\n3. SUSTAINABILITY GOALS\n• Target LEED Silver or Alberta Step Code Level 3+\n• High-performance envelope; HRV/ERV mechanical systems\n\n4. PERMIT PROCESS — CALGARY\n• Development Permit (DP): 60-90 day typical review\n• Building Permit (BP): 30-60 day typical review\n• Pre-application meeting recommended for complex projects\n\n5. SCHEDULE MILESTONES\n• Schematic Design: 6-8 weeks\n• Design Development: 8-10 weeks\n• Construction Documents: 12-16 weeks\n• Permits: 8-12 weeks`, fallback: true });
    }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
