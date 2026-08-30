import { query } from '@/lib/postgres';

export type ConnectorStatus = 'not_configured' | 'healthy' | 'degraded' | 'auth_expired' | 'unavailable';

interface ConnectorProps {
  id: string;
  tenantId: string;
  connectorKey: string;
  sourceFamily: string;
  authType: string;
  status: ConnectorStatus;
  canDiscover: boolean;
  canRead: boolean;
  canWrite: boolean;
  canWebhook: boolean;
  canIncrementalSync: boolean;
  lastSuccessfulDiscoveryAt?: Date;
  lastFailureAt?: Date;
  lastFailureMessage?: string;
  createdAt: Date;
}

export class Connector {
  private readonly props: ConnectorProps;

  constructor(props: ConnectorProps) {
    if (!props.id) throw new Error('id is required');
    if (!props.connectorKey) throw new Error('connectorKey is required');
    if (!props.sourceFamily) throw new Error('sourceFamily is required');
    this.props = { ...props };
  }

  get id() { return this.props.id; }
  get connectorKey() { return this.props.connectorKey; }
  get sourceFamily() { return this.props.sourceFamily; }
  get status() { return this.props.status; }
  get canDiscover() { return this.props.canDiscover; }
  get canRead() { return this.props.canRead; }
}

/**
 * The full target source-family catalog from the Phase 1 spec. Only
 * `chatgpt_shared_snapshot` has a real connector behind it (ChatGptShareConnector.ts) —
 * everything else stays `not_configured` with every capability false until a
 * later phase (OAuth, file watching, etc.) makes it real. This is the single
 * source of truth for the catalog; ensureDefaultConnectors() upserts it into
 * the `connector` table rather than duplicating it as SQL seed data.
 */
export const INGESTION_SOURCE_FAMILIES: Array<{
  connectorKey: string;
  sourceFamily: string;
  authType: string;
  real: boolean;
}> = [
  { connectorKey: 'chatgpt_shared_snapshot', sourceFamily: 'chatgpt_shared_snapshot', authType: 'none', real: true },
  // local_folder seeds not_configured (real:false) even though the code is real —
  // it only becomes healthy once WATCHED_FOLDER_PATH is set and a scan succeeds
  // (see localFolderOps.ts), same honesty rule as the OAuth connectors.
  { connectorKey: 'local_folder', sourceFamily: 'local_folder', authType: 'none', real: false },
  { connectorKey: 'google_drive', sourceFamily: 'google_drive', authType: 'oauth', real: false },
  { connectorKey: 'google_docs', sourceFamily: 'google_docs', authType: 'oauth', real: false },
  { connectorKey: 'google_sheets', sourceFamily: 'google_sheets', authType: 'oauth', real: false },
  // slack seeds not_configured (real:false) even though the OAuth+read code is
  // real — it only becomes healthy once an admin connects it via the auth page.
  { connectorKey: 'slack', sourceFamily: 'slack', authType: 'oauth', real: false },
  { connectorKey: 'google_chat', sourceFamily: 'google_chat', authType: 'oauth', real: false },
  { connectorKey: 'whatsapp', sourceFamily: 'whatsapp', authType: 'oauth', real: false },
  { connectorKey: 'facebook_messenger', sourceFamily: 'facebook_messenger', authType: 'oauth', real: false },
  { connectorKey: 'linkedin', sourceFamily: 'linkedin', authType: 'oauth', real: false },
  { connectorKey: 'manual_paste', sourceFamily: 'manual_paste', authType: 'none', real: false },
  { connectorKey: 'txt', sourceFamily: 'txt', authType: 'none', real: false },
  { connectorKey: 'docx', sourceFamily: 'docx', authType: 'none', real: false },
  { connectorKey: 'html', sourceFamily: 'html', authType: 'none', real: false },
  { connectorKey: 'pdf', sourceFamily: 'pdf', authType: 'none', real: false },
  { connectorKey: 'csv_xlsx', sourceFamily: 'csv_xlsx', authType: 'none', real: false },
];

/** Single-tenant-in-practice today (per prior session decisions); the earliest-created tenant is the working tenant. */
export async function getPrimaryTenantId(): Promise<string> {
  const result = await query<{ id: string }>('SELECT id FROM tenant ORDER BY created_at ASC LIMIT 1');
  if (!result.rows.length) throw new Error('No tenant exists — cannot resolve a primary tenant for the ingestion registry.');
  return result.rows[0].id;
}

/** Idempotently ensures every catalog family has a connector row for this tenant. Safe to call on every request. */
export async function ensureDefaultConnectors(tenantId: string): Promise<void> {
  for (const family of INGESTION_SOURCE_FAMILIES) {
    await query(
      `INSERT INTO connector (tenant_id, connector_key, source_family, auth_type, status, can_discover, can_read)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT (tenant_id, connector_key) DO NOTHING`,
      [
        tenantId,
        family.connectorKey,
        family.sourceFamily,
        family.authType,
        family.real ? 'healthy' : 'not_configured',
        family.real,
      ],
    );
  }
}
