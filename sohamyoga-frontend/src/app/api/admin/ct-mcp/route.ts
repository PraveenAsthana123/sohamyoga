export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcp_servers (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        url TEXT,
        status TEXT DEFAULT 'connected',
        tool_count INTEGER DEFAULT 0,
        last_ping TIMESTAMPTZ DEFAULT NOW(),
        response_ms INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcp_tool_calls (
        id SERIAL PRIMARY KEY,
        server_name TEXT,
        tool_name TEXT,
        input_preview TEXT,
        output_preview TEXT,
        status TEXT DEFAULT 'success',
        duration_ms INTEGER DEFAULT 0,
        called_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { rows: serverCount } = await client.query('SELECT COUNT(*)::int AS c FROM mcp_servers');
    if (serverCount[0].c === 0) {
      await client.query(`INSERT INTO mcp_servers (name, url, status, tool_count, last_ping, response_ms) VALUES
        ('gmail', 'mcp://gmail.googleapis.com', 'connected', 12, NOW() - INTERVAL '5 minutes', 145),
        ('calendar', 'mcp://calendar.googleapis.com', 'connected', 8, NOW() - INTERVAL '3 minutes', 112),
        ('drive', 'mcp://drive.googleapis.com', 'connected', 15, NOW() - INTERVAL '7 minutes', 189),
        ('slack-mcp', 'mcp://slack.com/api/mcp', 'disconnected', 6, NOW() - INTERVAL '2 hours', 0),
        ('brave-search', 'mcp://brave.com/search', 'connected', 3, NOW() - INTERVAL '1 minute', 234)`);
    }

    const { rows: callCount } = await client.query('SELECT COUNT(*)::int AS c FROM mcp_tool_calls');
    if (callCount[0].c === 0) {
      await client.query(`INSERT INTO mcp_tool_calls (server_name, tool_name, input_preview, output_preview, status, duration_ms, called_at) VALUES
        ('gmail', 'search_threads', 'query: "invoice"', '12 threads found', 'success', 312, NOW() - INTERVAL '10 minutes'),
        ('gmail', 'send_message', 'to: customer@example.com', 'Message sent (id: msg_abc)', 'success', 445, NOW() - INTERVAL '20 minutes'),
        ('calendar', 'list_events', 'timeMin: today', '3 events returned', 'success', 198, NOW() - INTERVAL '30 minutes'),
        ('calendar', 'create_event', 'Yoga class: Saturday 10am', 'Event created', 'success', 287, NOW() - INTERVAL '45 minutes'),
        ('drive', 'search_files', 'query: "marketing plan"', '5 files found', 'success', 412, NOW() - INTERVAL '1 hour'),
        ('drive', 'read_file_content', 'fileId: 1abc...', '2.3KB content returned', 'success', 567, NOW() - INTERVAL '1 hour 10 min'),
        ('brave-search', 'web_search', 'yoga studios Toronto', '10 results returned', 'success', 1230, NOW() - INTERVAL '1 hour 30 min'),
        ('slack-mcp', 'send_message', 'channel: #marketing', 'Connection refused', 'failed', 5000, NOW() - INTERVAL '2 hours'),
        ('gmail', 'get_thread', 'threadId: thread_xyz', 'Thread with 4 messages', 'success', 267, NOW() - INTERVAL '2 hours 10 min'),
        ('calendar', 'update_event', 'Reschedule Saturday class', 'Event updated', 'success', 334, NOW() - INTERVAL '2 hours 30 min'),
        ('drive', 'create_file', 'filename: report-2026-09.pdf', 'File created (id: file_new)', 'success', 892, NOW() - INTERVAL '3 hours'),
        ('gmail', 'create_draft', 'subject: Weekly newsletter', 'Draft saved', 'success', 378, NOW() - INTERVAL '3 hours 30 min'),
        ('brave-search', 'web_search', 'hot yoga benefits 2026', '10 results returned', 'success', 1456, NOW() - INTERVAL '4 hours'),
        ('drive', 'share_file', 'share with: team@sohamyoga.com', 'Permission granted', 'success', 445, NOW() - INTERVAL '4 hours 30 min'),
        ('calendar', 'search_events', 'query: yoga retreat', '2 events found', 'success', 212, NOW() - INTERVAL '5 hours'),
        ('gmail', 'label_thread', 'label: customer-inquiry', 'Thread labeled', 'success', 189, NOW() - INTERVAL '5 hours 30 min'),
        ('slack-mcp', 'list_channels', '', 'Connection refused', 'failed', 5000, NOW() - INTERVAL '2 hours 15 min'),
        ('drive', 'get_file_metadata', 'fileId: meta_123', 'Metadata returned', 'success', 134, NOW() - INTERVAL '6 hours'),
        ('brave-search', 'web_search', 'competitor yoga pricing', '8 results returned', 'success', 1120, NOW() - INTERVAL '6 hours 30 min'),
        ('gmail', 'list_labels', '', '14 labels returned', 'success', 98, NOW() - INTERVAL '7 hours')`);
    }

    const [serversRes, callStatsRes] = await Promise.all([
      client.query('SELECT * FROM mcp_servers ORDER BY status DESC, name ASC').catch(() => ({ rows: [] })),
      client.query(`
        SELECT
          COUNT(*)::int AS total_calls,
          COUNT(*) FILTER (WHERE status = 'success')::int AS successful,
          ROUND(AVG(duration_ms)::numeric, 0) AS avg_response_ms,
          COUNT(*) FILTER (WHERE called_at >= NOW() - INTERVAL '24 hours')::int AS calls_today
        FROM mcp_tool_calls
      `).catch(() => ({ rows: [{ total_calls: 0, successful: 0, avg_response_ms: 0, calls_today: 0 }] })),
    ]);

    const servers = serversRes.rows;
    const totalServers = servers.length;
    const connectedServers = servers.filter(s => s.status === 'connected').length;
    const cs = callStatsRes.rows[0];
    const totalCalls = parseInt(cs.total_calls) || 1;
    const successRate = Math.round((parseInt(cs.successful) / totalCalls) * 100);
    const avgResponseMs = parseInt(cs.avg_response_ms) || 0;

    const health_score = Math.min(100,
      Math.round((connectedServers / Math.max(1, totalServers)) * 50) +
      (successRate >= 95 ? 30 : successRate >= 80 ? 20 : 10) +
      (avgResponseMs <= 500 ? 20 : avgResponseMs <= 1000 ? 10 : 5)
    );

    return Response.json({
      health_score,
      traffic_light: health_score >= 70 ? 'green' : health_score >= 40 ? 'yellow' : 'red',
      servers_connected: connectedServers,
      servers_total: totalServers,
      call_success_rate: successRate,
      avg_response_ms: avgResponseMs,
      calls_today: cs.calls_today,
      kpis: [
        { label: 'Servers Connected', value: `${connectedServers}/${totalServers}`, target: totalServers, trend: connectedServers === totalServers ? 'up' : 'down', unit: 'servers' },
        { label: 'Call Success Rate', value: successRate, target: 99, trend: successRate >= 99 ? 'up' : 'down', unit: '%' },
        { label: 'Avg Response', value: avgResponseMs, target: 500, trend: avgResponseMs <= 500 ? 'up' : 'down', unit: 'ms' },
        { label: 'Calls Today', value: cs.calls_today, target: 20, trend: cs.calls_today >= 20 ? 'up' : 'down', unit: 'calls' },
      ],
      servers,
      updated_at: new Date().toISOString(),
    });
  } finally {
    client.release();
  }
}
