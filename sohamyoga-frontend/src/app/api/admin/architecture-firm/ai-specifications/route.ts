import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const { spec_section, project_type, phase } = await req.json();
    const prompt = `Write an outline specification section for: ${spec_section} in a ${project_type} project in Calgary, Alberta. Phase: ${phase ?? 'construction_documents'}. Include: work included/excluded, reference standards (CSA, ASTM, NRC), material requirements, execution requirements, quality control, and submittals. NMS (National Master Specification) format alignment.`;
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
      return Response.json({ result: `[SPECIFICATION SECTION — Offline Draft]\n\nSection: ${spec_section}\nProject Type: ${project_type} | Phase: ${phase}\n\nPART 1 — GENERAL\n1.01 SCOPE OF WORK\n.1 Provide all labour, materials and equipment for ${spec_section} as specified.\n\n1.02 RELATED SECTIONS\n.1 Coordinate with adjacent specification sections.\n\n1.03 REFERENCE STANDARDS\n.1 CSA Standards applicable to this section\n.2 NRC National Building Code of Canada\n.3 Alberta Building Code 2019\n\nPART 2 — PRODUCTS\n2.01 MATERIALS\n.1 Materials to meet specified performance requirements.\n.2 Submit product data for approval prior to ordering.\n\nPART 3 — EXECUTION\n3.01 INSTALLATION\n.1 Install per manufacturer's instructions and reference standards.\n.2 Coordinate with other trades.\n\n3.02 QUALITY CONTROL\n.1 Site inspection by qualified representative.\n.2 Document inspections; correct deficiencies before concealing.`, fallback: true });
    }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
