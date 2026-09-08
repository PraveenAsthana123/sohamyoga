import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real file-upload endpoint -- closes the documented "file-upload logo/
// asset library" gap. Before this, /api/admin/brand-kits/[id]/assets and
// /api/brand-kits' logoUrl only ever accepted a URL an admin had to
// already have hosted somewhere else (grep-confirmed: zero req.formData()
// handlers existed anywhere in this codebase). This saves the real
// uploaded bytes to public/uploads/brand/ and returns a real local URL
// the rest of the brand-kit/asset-library forms can use unchanged.
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg',
};

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || !(file instanceof File)) return Response.json({ error: 'No file provided.' }, { status: 400 });
  const ext = ALLOWED[file.type];
  if (!ext) return Response.json({ error: `Unsupported file type "${file.type}". Use PNG, JPEG, WebP, or SVG.` }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: `File is ${(file.size / 1024 / 1024).toFixed(1)}MB -- max is 5MB.` }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `${randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), 'public', 'uploads', 'brand');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), bytes);

  return Response.json({ ok: true, url: `/uploads/brand/${filename}`, sizeBytes: bytes.length }, { status: 201 });
}
