// Phase 6 — Slack inbound-read connector (real, scoped-down slice). Per
// Phase 1's own model: "Workspace → source, Channel → source" — this
// connector discovers channels (each becomes its own `source`) and reads
// recent message history per channel. Threads/reactions/edits are NOT
// modeled yet (see integration-spec.md) — this reads a flat recent-message
// window per channel, honestly, rather than claiming full thread fidelity.

import type { ConnectorAdapter, SourceEnvelope } from './ConnectorAdapter';

export class SlackAdapter implements ConnectorAdapter {
  readonly connectorKey = 'slack';

  constructor(private readonly botToken: string) {}

  private async slackApi<T>(method: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`https://slack.com/api/${method}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url, { headers: { Authorization: `Bearer ${this.botToken}` } });
    const body = await res.json() as T & { ok: boolean; error?: string };
    if (!body.ok) throw new Error(`Slack API ${method} failed: ${body.error ?? 'unknown error'}`);
    return body;
  }

  async discover(): Promise<string[]> {
    const result = await this.slackApi<{ channels: Array<{ id: string; is_member: boolean; is_archived: boolean }> }>(
      'conversations.list', { types: 'public_channel,private_channel', exclude_archived: 'true' },
    );
    // Only channels the bot has actually been invited to — matches Phase 1's
    // "member access" field and avoids claiming visibility into channels the
    // bot can't actually read.
    return result.channels.filter(c => c.is_member && !c.is_archived).map(c => c.id);
  }

  async read(channelId: string): Promise<SourceEnvelope> {
    const info = await this.slackApi<{ channel: { id: string; name: string } }>('conversations.info', { channel: channelId });
    const history = await this.slackApi<{ messages: Array<{ ts: string; text: string; user?: string }> }>(
      'conversations.history', { channel: channelId, limit: '200' },
    );
    return {
      sourceType: 'slack_channel',
      externalId: channelId,
      title: `#${info.channel.name}`,
      retrievedAt: new Date().toISOString(),
      items: history.messages.map(m => ({
        externalItemId: m.ts,
        role: m.user ?? 'unknown',
        text: m.text,
        occurredAt: Math.round(parseFloat(m.ts) * 1000),
      })),
    };
  }
}
