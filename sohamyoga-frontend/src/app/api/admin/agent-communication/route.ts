export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

async function ensureTables() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ac_channels (
        channel_id   VARCHAR(64) PRIMARY KEY,
        name         VARCHAR(128) NOT NULL,
        channel_type VARCHAR(32)  NOT NULL DEFAULT 'queue',
        protocol     VARCHAR(32)  NOT NULL DEFAULT 'AMQP',
        status       VARCHAR(16)  NOT NULL DEFAULT 'active',
        msg_rate_min INT          NOT NULL DEFAULT 0,
        subscribers  INT          NOT NULL DEFAULT 0,
        created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ac_messages (
        id              SERIAL PRIMARY KEY,
        msg_id          VARCHAR(64)  NOT NULL,
        channel_id      VARCHAR(64),
        channel_name    VARCHAR(128),
        from_agent      VARCHAR(64)  NOT NULL,
        to_agent        VARCHAR(64)  NOT NULL,
        message_type    VARCHAR(32)  NOT NULL DEFAULT 'task',
        delivery_status VARCHAR(16)  NOT NULL DEFAULT 'delivered',
        latency_ms      INT          NOT NULL DEFAULT 0,
        created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ac_protocols (
        protocol_id      VARCHAR(64) PRIMARY KEY,
        name             VARCHAR(64) NOT NULL,
        transport        VARCHAR(32) NOT NULL DEFAULT 'TCP',
        serialization    VARCHAR(32) NOT NULL DEFAULT 'JSON',
        auth_required    BOOLEAN     NOT NULL DEFAULT TRUE,
        encryption       BOOLEAN     NOT NULL DEFAULT TRUE,
        max_msg_size_kb  INT         NOT NULL DEFAULT 256
      );
      CREATE TABLE IF NOT EXISTS ac_routing_rules (
        rule_id      VARCHAR(64) PRIMARY KEY,
        pattern      VARCHAR(128) NOT NULL,
        target_channel VARCHAR(128) NOT NULL,
        priority     INT          NOT NULL DEFAULT 5,
        is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ac_dlq (
        id            SERIAL PRIMARY KEY,
        msg_id        VARCHAR(64)  NOT NULL,
        channel_name  VARCHAR(128),
        from_agent    VARCHAR(64),
        to_agent      VARCHAR(64),
        failure_reason TEXT,
        failed_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
        requeue_count INT          NOT NULL DEFAULT 0,
        status        VARCHAR(16)  NOT NULL DEFAULT 'pending'
      );
    `);

    const { rows: chRows } = await client.query('SELECT COUNT(*) FROM ac_channels');
    if (parseInt(chRows[0].count) === 0) {
      const channels: [string,string,string,string,string,number,number][] = [
        ['ch-task',      'Task Dispatch',     'queue',    'AMQP',      'active', 42,  8],
        ['ch-results',   'Results Collector', 'queue',    'AMQP',      'active', 38,  6],
        ['ch-broadcast', 'System Broadcast',  'pub_sub',  'MQTT',      'active', 15, 24],
        ['ch-rpc',       'Synchronous RPC',   'rpc',      'gRPC',      'active',  8,  4],
        ['ch-stream',    'Event Stream',      'stream',   'Kafka',     'active', 120, 12],
      ];
      for (const [channel_id, name, channel_type, protocol, status, msg_rate_min, subscribers] of channels) {
        await client.query(
          `INSERT INTO ac_channels (channel_id,name,channel_type,protocol,status,msg_rate_min,subscribers)
           VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
          [channel_id, name, channel_type, protocol, status, msg_rate_min, subscribers]
        );
      }
    }

    const { rows: msgRows } = await client.query('SELECT COUNT(*) FROM ac_messages');
    if (parseInt(msgRows[0].count) === 0) {
      const messages: [string,string,string,string,string,string,string,number][] = [
        ['amsg-001','ch-task',    'Task Dispatch',    'agent-planner-01','agent-writer-01',   'task',      'delivered',18],
        ['amsg-002','ch-results', 'Results Collector','agent-writer-01', 'agent-planner-01',  'result',    'delivered',22],
        ['amsg-003','ch-broadcast','System Broadcast','agent-ops-01',    'BROADCAST',         'heartbeat', 'delivered', 5],
        ['amsg-004','ch-task',    'Task Dispatch',    'agent-planner-01','agent-editor-01',   'task',      'delivered',19],
        ['amsg-005','ch-rpc',     'Synchronous RPC',  'agent-sales-01', 'agent-enricher-01', 'query',     'delivered',42],
        ['amsg-006','ch-results', 'Results Collector','agent-enricher-01','agent-sales-01',  'result',    'delivered',35],
        ['amsg-007','ch-task',    'Task Dispatch',    'agent-planner-01','agent-analyst-01',  'task',      'failed',   890],
        ['amsg-008','ch-stream',  'Event Stream',     'agent-monitor-01','agent-analyst-01',  'event',     'delivered',12],
        ['amsg-009','ch-broadcast','System Broadcast','agent-ops-01',    'BROADCAST',         'heartbeat', 'delivered', 4],
        ['amsg-010','ch-task',    'Task Dispatch',    'agent-analyst-01','agent-monitor-02',  'task',      'delivered',21],
        ['amsg-011','ch-rpc',     'Synchronous RPC',  'agent-writer-02', 'agent-planner-01',  'query',     'delivered',38],
        ['amsg-012','ch-results', 'Results Collector','agent-planner-01','agent-writer-02',  'result',    'delivered',25],
        ['amsg-013','ch-stream',  'Event Stream',     'agent-monitor-02','BROADCAST',         'event',     'delivered', 8],
        ['amsg-014','ch-task',    'Task Dispatch',    'agent-planner-01','agent-scheduler-01','task',      'failed',   1200],
        ['amsg-015','ch-results', 'Results Collector','agent-scheduler-01','agent-planner-01','result',   'delivered',28],
        ['amsg-016','ch-broadcast','System Broadcast','agent-ops-01',    'BROADCAST',         'heartbeat', 'delivered', 5],
        ['amsg-017','ch-task',    'Task Dispatch',    'agent-planner-01','agent-writer-03',   'task',      'delivered',17],
        ['amsg-018','ch-rpc',     'Synchronous RPC',  'agent-writer-01', 'agent-fact-checker','query',    'delivered',55],
        ['amsg-019','ch-stream',  'Event Stream',     'agent-monitor-01','agent-ops-01',      'event',     'delivered',10],
        ['amsg-020','ch-task',    'Task Dispatch',    'agent-analyst-01','agent-reporter-01', 'task',      'delivered',20],
      ];
      for (const [msg_id, channel_id, channel_name, from_agent, to_agent, message_type, delivery_status, latency_ms] of messages) {
        await client.query(
          `INSERT INTO ac_messages (msg_id,channel_id,channel_name,from_agent,to_agent,message_type,delivery_status,latency_ms)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [msg_id, channel_id, channel_name, from_agent, to_agent, message_type, delivery_status, latency_ms]
        );
      }
    }

    const { rows: protoRows } = await client.query('SELECT COUNT(*) FROM ac_protocols');
    if (parseInt(protoRows[0].count) === 0) {
      const protocols: [string,string,string,string,boolean,boolean,number][] = [
        ['proto-amqp', 'AMQP 1.0',        'TCP',       'MessagePack', true,  true,  512],
        ['proto-mqtt', 'MQTT 5.0',         'TCP/TLS',   'JSON',        true,  true,  64],
        ['proto-grpc', 'gRPC',             'HTTP/2',    'Protobuf',    true,  true,  1024],
        ['proto-kafka','Apache Kafka',     'TCP',       'Avro',        true,  false, 4096],
        ['proto-ws',   'WebSocket',        'HTTP/WS',   'JSON',        false, false, 256],
      ];
      for (const [protocol_id, name, transport, serialization, auth_required, encryption, max_msg_size_kb] of protocols) {
        await client.query(
          `INSERT INTO ac_protocols (protocol_id,name,transport,serialization,auth_required,encryption,max_msg_size_kb)
           VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
          [protocol_id, name, transport, serialization, auth_required, encryption, max_msg_size_kb]
        );
      }
    }

    const { rows: rrRows } = await client.query('SELECT COUNT(*) FROM ac_routing_rules');
    if (parseInt(rrRows[0].count) === 0) {
      const rules: [string,string,string,number,boolean][] = [
        ['rr-001','task.generate.*',     'Task Dispatch',     10, true],
        ['rr-002','task.review.*',        'Task Dispatch',     10, true],
        ['rr-003','result.*',             'Results Collector',  9, true],
        ['rr-004','heartbeat.*',          'System Broadcast',   5, true],
        ['rr-005','event.metric.*',       'Event Stream',       8, true],
        ['rr-006','query.sync.*',         'Synchronous RPC',    9, true],
      ];
      for (const [rule_id, pattern, target_channel, priority, is_active] of rules) {
        await client.query(
          `INSERT INTO ac_routing_rules (rule_id,pattern,target_channel,priority,is_active)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
          [rule_id, pattern, target_channel, priority, is_active]
        );
      }
    }

    const { rows: dlqRows } = await client.query('SELECT COUNT(*) FROM ac_dlq');
    if (parseInt(dlqRows[0].count) === 0) {
      const dlq: [string,string,string,string,string,number][] = [
        ['amsg-007','Task Dispatch',    'agent-planner-01','agent-analyst-01','Connection timeout after 890ms — agent-analyst-01 unresponsive', 1],
        ['amsg-014','Task Dispatch',    'agent-planner-01','agent-scheduler-01','Delivery failed: agent-scheduler-01 queue full (max 100 messages)', 0],
        ['dlq-003', 'System Broadcast','agent-ops-01',    'BROADCAST',         'Serialization error: unexpected null field in heartbeat payload', 2],
        ['dlq-004', 'Event Stream',    'agent-monitor-02','agent-analyst-02',  'No subscriber: agent-analyst-02 not registered on ch-stream', 0],
      ];
      for (const [msg_id, channel_name, from_agent, to_agent, failure_reason, requeue_count] of dlq) {
        await client.query(
          `INSERT INTO ac_dlq (msg_id,channel_name,from_agent,to_agent,failure_reason,requeue_count,status)
           VALUES ($1,$2,$3,$4,$5,$6,'pending')`,
          [msg_id, channel_name, from_agent, to_agent, failure_reason, requeue_count]
        );
      }
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const pool = getPool();
    const [channels, messages, protocols, routingRules, dlq] = await Promise.all([
      pool.query('SELECT * FROM ac_channels ORDER BY name'),
      pool.query('SELECT * FROM ac_messages ORDER BY created_at DESC LIMIT 50'),
      pool.query('SELECT * FROM ac_protocols ORDER BY name'),
      pool.query('SELECT * FROM ac_routing_rules ORDER BY priority DESC, pattern'),
      pool.query("SELECT * FROM ac_dlq WHERE status='pending' ORDER BY failed_at DESC"),
    ]);
    const totalMsgs = messages.rows.length;
    const avgDelivery = totalMsgs
      ? Math.round(messages.rows.reduce((s: number, m: { latency_ms: number }) => s + m.latency_ms, 0) / totalMsgs)
      : 0;
    const failed = messages.rows.filter((m: { delivery_status: string }) => m.delivery_status === 'failed').length;
    return NextResponse.json({
      stats: {
        channels: channels.rows.length, messagesToday: totalMsgs,
        avgDeliveryMs: avgDelivery, failedDeliveries: failed,
      },
      channels: channels.rows, messages: messages.rows, protocols: protocols.rows,
      routingRules: routingRules.rows, dlq: dlq.rows,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const body = await req.json() as { type: string; id?: number; rule_id?: string; pattern?: string; target_channel?: string; priority?: number };
    const pool = getPool();
    if (body.type === 'requeue') {
      const { rows } = await pool.query(
        "UPDATE ac_dlq SET status='requeued', requeue_count=requeue_count+1 WHERE id=$1 RETURNING *",
        [body.id]
      );
      return NextResponse.json({ dlq: rows[0] });
    }
    if (body.type === 'routing_rule') {
      const rule_id = body.rule_id || `rr-${Date.now()}`;
      const { rows } = await pool.query(
        `INSERT INTO ac_routing_rules (rule_id,pattern,target_channel,priority,is_active)
         VALUES ($1,$2,$3,$4,true) RETURNING *`,
        [rule_id, body.pattern, body.target_channel, body.priority || 5]
      );
      return NextResponse.json({ rule: rows[0] }, { status: 201 });
    }
    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const body = await req.json() as { channel_id: string; status: string };
    const pool = getPool();
    const { rows } = await pool.query(
      'UPDATE ac_channels SET status=$1 WHERE channel_id=$2 RETURNING *',
      [body.status, body.channel_id]
    );
    return NextResponse.json({ channel: rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
