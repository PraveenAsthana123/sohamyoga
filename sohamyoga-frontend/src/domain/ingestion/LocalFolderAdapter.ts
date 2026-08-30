// Phase 4 — File Ingestion, Desktop Folder Monitoring (real, scoped-down slice).
// Watches ONE admin-configured local folder (WATCHED_FOLDER_PATH) for plain
// text files (.txt, .md) — the two formats needing zero parsing beyond
// reading bytes as UTF-8, so they're real today. DOCX/PDF/HTML/CSV/XLSX
// parsers are deferred (see integration-spec.md) until a real need for them
// exists — adding format-specific parsing libraries speculatively would be
// exactly the kind of unused scaffolding this pipeline has been avoiding.

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import type { ConnectorAdapter, SourceEnvelope } from './ConnectorAdapter';

const ALLOWED_EXTENSIONS = new Set(['.txt', '.md']);
// Phase 1 spec's own "flag rather than blindly enqueue" rule for huge files.
const LARGE_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export class LocalFolderAdapter implements ConnectorAdapter {
  readonly connectorKey = 'local_folder';

  constructor(private readonly folderPath: string) {}

  async discover(): Promise<string[]> {
    const entries = await readdir(this.folderPath, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && ALLOWED_EXTENSIONS.has(extname(e.name).toLowerCase()))
      .map(e => join(this.folderPath, e.name));
  }

  async read(externalId: string): Promise<SourceEnvelope> {
    const stats = await stat(externalId);
    if (stats.size > LARGE_FILE_BYTES) {
      throw new Error(`LARGE_SOURCE: ${externalId} is ${Math.round(stats.size / 1024 / 1024)}MB — exceeds the ${LARGE_FILE_BYTES / 1024 / 1024}MB auto-ingest limit, flagged rather than blindly enqueued.`);
    }
    const content = await readFile(externalId, 'utf-8');
    return {
      sourceType: 'local_folder',
      externalId,
      title: externalId.split('/').pop() ?? externalId,
      retrievedAt: new Date().toISOString(),
      items: [{
        externalItemId: contentHash(content),
        role: 'file',
        text: content,
        occurredAt: stats.mtimeMs,
      }],
    };
  }
}

function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}
