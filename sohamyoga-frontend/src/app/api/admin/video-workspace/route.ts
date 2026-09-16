import { NextRequest } from 'next/server';
import { videoWorkspace } from '@/domain/video/workspaceApi';
import { requireAdmin } from '@/lib/admin-auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = (req: NextRequest) => videoWorkspace(req, true);
export const POST = GET;
export const PATCH = GET;
