import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { listScriptTemplates } from '@/domain/script/templateRepository';

// Available to admin only for now, matching where script creation lives --
// real seeded templates (see db-schema-template.sql), not fabricated
// branching logic Vapi has no way to execute.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;
  const templates = await listScriptTemplates();
  return NextResponse.json({ templates });
}
