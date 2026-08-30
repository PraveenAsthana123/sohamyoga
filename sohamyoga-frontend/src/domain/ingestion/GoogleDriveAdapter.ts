// Phase 5 — Google Drive, Docs & Sheets Connector (real, scoped-down slice).
// One OAuth grant (tied to the `google_drive` connector row — its scopes,
// per Phase 2's GoogleOAuthConnector.ts, already cover Drive+Docs+Sheets)
// serves all three products, matching how Google's own consent screen works.
// Discovered Google Docs/Sheets get source_type 'google_doc'/'google_sheet'
// but stay under the google_drive connector_id — see integration-spec.md.

import { google } from 'googleapis';
import type { ConnectorAdapter, SourceEnvelope } from './ConnectorAdapter';

const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';
const GOOGLE_SHEET_MIME = 'application/vnd.google-apps.spreadsheet';
const SUPPORTED_MIME_TYPES = [GOOGLE_DOC_MIME, GOOGLE_SHEET_MIME];

export class GoogleDriveAdapter implements ConnectorAdapter {
  readonly connectorKey = 'google_drive';
  // Deliberately googleapis's own bundled auth.OAuth2 (not the standalone
  // google-auth-library package used by GoogleOAuthConnector.ts) — npm hoists
  // two structurally-identical-but-nominally-distinct OAuth2Client classes
  // when both packages are installed, and googleapis's own API clients only
  // accept their own bundled one.
  private readonly auth: InstanceType<typeof google.auth.OAuth2>;

  constructor(accessToken: string) {
    this.auth = new google.auth.OAuth2();
    this.auth.setCredentials({ access_token: accessToken });
  }

  async discover(): Promise<string[]> {
    const drive = google.drive({ version: 'v3', auth: this.auth });
    const res = await drive.files.list({
      q: `(mimeType='${GOOGLE_DOC_MIME}' or mimeType='${GOOGLE_SHEET_MIME}') and trashed=false`,
      fields: 'files(id, mimeType)',
      pageSize: 100,
    });
    return (res.data.files ?? []).map(f => f.id!).filter(Boolean);
  }

  async read(fileId: string): Promise<SourceEnvelope> {
    const drive = google.drive({ version: 'v3', auth: this.auth });
    const meta = await drive.files.get({ fileId, fields: 'id, name, mimeType, modifiedTime' });
    const mimeType = meta.data.mimeType;
    if (!mimeType || !SUPPORTED_MIME_TYPES.includes(mimeType)) {
      throw new Error(`Unsupported Google Drive mimeType: ${mimeType ?? 'unknown'} — only Google Docs and Sheets are read in this phase.`);
    }

    if (mimeType === GOOGLE_DOC_MIME) {
      const exported = await drive.files.export({ fileId, mimeType: 'text/plain' }, { responseType: 'text' });
      return {
        sourceType: 'google_doc',
        externalId: fileId,
        title: meta.data.name ?? fileId,
        retrievedAt: new Date().toISOString(),
        items: [{ externalItemId: fileId, role: 'document', text: String(exported.data), occurredAt: meta.data.modifiedTime ? Date.parse(meta.data.modifiedTime) : null }],
      };
    }

    // Google Sheet — read all values from the first sheet tab only in this
    // phase (multi-tab logical-sub-source tracking is a real Phase 1 idea
    // deferred until a real multi-tab spreadsheet needs it).
    const sheets = google.sheets({ version: 'v4', auth: this.auth });
    const values = await sheets.spreadsheets.values.get({ spreadsheetId: fileId, range: 'A1:Z1000' });
    const rows = values.data.values ?? [];
    return {
      sourceType: 'google_sheet',
      externalId: fileId,
      title: meta.data.name ?? fileId,
      retrievedAt: new Date().toISOString(),
      items: [{ externalItemId: fileId, role: 'spreadsheet', text: rows.map(r => r.join('\t')).join('\n'), occurredAt: meta.data.modifiedTime ? Date.parse(meta.data.modifiedTime) : null }],
    };
  }
}
