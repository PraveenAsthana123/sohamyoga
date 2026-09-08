import { NextRequest } from 'next/server';
import { videoWorkspace } from '@/domain/video/workspaceApi';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = (req: NextRequest) => videoWorkspace(req, false);
export const POST = GET;
export const PATCH = GET;
