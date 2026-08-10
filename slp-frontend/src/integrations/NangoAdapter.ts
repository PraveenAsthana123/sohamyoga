// NangoAdapter — OAuth token manager for all social and third-party integrations.
// MCP tools call getToken(provider, connectionId) instead of reading .env directly.
// Nango handles token refresh automatically — tokens never expire silently.
// NEVER log or return tokens to the user or any external AI.

const NANGO_BASE     = process.env.NANGO_BASE_URL  ?? 'http://localhost:3003';
const NANGO_SECRET   = process.env.NANGO_SECRET_KEY ?? '';

export type NangoProvider =
  | 'facebook'    | 'instagram'    | 'linkedin'   | 'twitter'
  | 'tiktok'      | 'youtube'      | 'pinterest'  | 'reddit'
  | 'discord'     | 'telegram'     | 'threads'    | 'bluesky'
  | 'mastodon'    | 'google'       | 'github'     | 'slack'
  | 'hubspot'     | 'notion'       | 'stripe';

export interface NangoConnection {
  connectionId:     string;
  providerConfigKey: string;
  createdAt:        string;
  updatedAt:        string;
}

export interface NangoToken {
  accessToken: string;
  // refreshToken and expiry managed by Nango internally — not exposed here
}

export class NangoAdapter {
  private readonly base:   string;
  private readonly secret: string;

  constructor(base = NANGO_BASE, secret = NANGO_SECRET) {
    this.base   = base;
    this.secret = secret;
  }

  private headers() {
    return {
      'Authorization': `Bearer ${this.secret}`,
      'Content-Type':  'application/json',
    };
  }

  /** Get a valid (auto-refreshed) access token for a connected account. */
  async getToken(provider: NangoProvider, connectionId: string): Promise<string> {
    const res = await fetch(
      `${this.base}/connection/${connectionId}?provider_config_key=${provider}&force_refresh=false`,
      { headers: this.headers(), signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) throw new Error(`Nango getToken failed for ${provider}/${connectionId}: HTTP ${res.status}`);
    const data = await res.json() as { credentials?: { access_token?: string } };
    const token = data.credentials?.access_token;
    if (!token) throw new Error(`No access token returned by Nango for ${provider}/${connectionId}`);
    return token;
    // Token value intentionally not logged
  }

  /** List all active connections for a provider. */
  async listConnections(provider?: NangoProvider): Promise<NangoConnection[]> {
    const url = provider
      ? `${this.base}/connection?provider_config_key=${provider}`
      : `${this.base}/connection`;
    const res = await fetch(url, { headers: this.headers(), signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Nango listConnections HTTP ${res.status}`);
    const data = await res.json() as { connections: NangoConnection[] };
    return data.connections ?? [];
  }

  /** Check if a connection is active and token is valid. */
  async isConnectionHealthy(provider: NangoProvider, connectionId: string): Promise<boolean> {
    try {
      await this.getToken(provider, connectionId);
      return true;
    } catch {
      return false;
    }
  }

  /** Delete a connection (disconnects the account). */
  async deleteConnection(provider: NangoProvider, connectionId: string): Promise<void> {
    await fetch(`${this.base}/connection/${connectionId}?provider_config_key=${provider}`, {
      method:  'DELETE',
      headers: this.headers(),
      signal:  AbortSignal.timeout(10_000),
    });
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.base}/health`, { signal: AbortSignal.timeout(5000) });
      return res.ok;
    } catch { return false; }
  }
}

export const nango = new NangoAdapter();
