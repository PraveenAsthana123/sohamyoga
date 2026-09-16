import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  return Response.json({
    smtp_configured: !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER),
    imap_configured: !!(process.env.IMAP_HOST && process.env.IMAP_USER),
    smtp_host: process.env.SMTP_HOST ? '(set)' : null,
    smtp_port: process.env.SMTP_PORT ? '(set)' : null,
    smtp_user: process.env.SMTP_USER ? '(set)' : null,
    imap_host: process.env.IMAP_HOST ? '(set)' : null,
    imap_user: process.env.IMAP_USER ? '(set)' : null,
  });
}
