import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS north_star_metric (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        metric_formula TEXT,
        current_value NUMERIC,
        target_value NUMERIC,
        unit TEXT DEFAULT 'count',
        is_primary BOOLEAN DEFAULT false,
        status TEXT DEFAULT 'active',
        last_updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS okr (
        id SERIAL PRIMARY KEY,
        cycle TEXT NOT NULL,
        level TEXT DEFAULT 'company',
        team TEXT,
        objective TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        progress_pct INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS key_result (
        id SERIAL PRIMARY KEY,
        okr_id INTEGER REFERENCES okr(id) ON DELETE CASCADE,
        kr_number INTEGER,
        description TEXT NOT NULL,
        metric_type TEXT DEFAULT 'number',
        start_value NUMERIC DEFAULT 0,
        current_value NUMERIC DEFAULT 0,
        target_value NUMERIC NOT NULL,
        unit TEXT DEFAULT 'count',
        confidence_pct INTEGER DEFAULT 50,
        status TEXT DEFAULT 'on_track',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Seed North Star
    const nsCheck = await client.query('SELECT id FROM north_star_metric WHERE is_primary = true LIMIT 1');
    if (nsCheck.rows.length === 0) {
      await client.query(
        `INSERT INTO north_star_metric (name,description,metric_formula,current_value,target_value,unit,is_primary,status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          'Monthly Active Revenue-Generating Users',
          'Users who completed at least one revenue-generating action in the calendar month',
          'Weekly Active Users × Avg Sessions × Avg Value',
          450, 2000, 'users', true, 'active',
        ],
      );
    }

    // Seed OKRs
    const okrCheck = await client.query("SELECT id FROM okr WHERE cycle = 'Q4-2026' LIMIT 1");
    if (okrCheck.rows.length === 0) {
      const okrData = [
        {
          objective: 'Grow digital marketing client base',
          krs: [
            { desc: 'Signed digital agencies', start: 0, current: 0, target: 25, unit: 'agencies', confidence: 60 },
            { desc: 'Monthly Recurring Revenue (MRR)', start: 12500, current: 12500, target: 30000, unit: '$', confidence: 55 },
            { desc: 'Net Promoter Score', start: 42, current: 42, target: 65, unit: 'score', confidence: 50 },
          ],
        },
        {
          objective: 'Ship AI-powered features',
          krs: [
            { desc: 'AI features live in production', start: 5, current: 5, target: 15, unit: 'features', confidence: 70 },
            { desc: 'Ollama local model uptime', start: 95, current: 95, target: 99.9, unit: '%', confidence: 75 },
            { desc: 'User AI feature adoption rate', start: 10, current: 10, target: 60, unit: '%', confidence: 45 },
          ],
        },
        {
          objective: 'Scale TalentsHill portal',
          krs: [
            { desc: 'TalentsHill monthly active users', start: 0, current: 0, target: 500, unit: 'users', confidence: 40 },
            { desc: 'Campaigns managed on platform', start: 0, current: 0, target: 200, unit: 'campaigns', confidence: 50 },
            { desc: 'Client retention rate', start: 0, current: 0, target: 85, unit: '%', confidence: 55 },
          ],
        },
      ];

      for (const [idx, okr] of okrData.entries()) {
        const okrResult = await client.query(
          `INSERT INTO okr (cycle,level,objective,status,progress_pct) VALUES ('Q4-2026','company',$1,'active',0) RETURNING id`,
          [okr.objective],
        );
        const okrId = okrResult.rows[0].id;
        for (const [krIdx, kr] of okr.krs.entries()) {
          await client.query(
            `INSERT INTO key_result (okr_id,kr_number,description,start_value,current_value,target_value,unit,confidence_pct,status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'on_track')`,
            [okrId, krIdx+1, kr.desc, kr.start, kr.current, kr.target, kr.unit, kr.confidence],
          );
        }
        void idx; // suppress unused warning
      }
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTables().catch(() => {});

  const client = await pool.connect();
  try {
    const [nsResult, okrResult, krResult] = await Promise.all([
      client.query('SELECT * FROM north_star_metric ORDER BY is_primary DESC, id ASC').catch(() => ({ rows: [] })),
      client.query('SELECT * FROM okr ORDER BY created_at DESC').catch(() => ({ rows: [] })),
      client.query('SELECT * FROM key_result ORDER BY okr_id, kr_number').catch(() => ({ rows: [] })),
    ]);
    return Response.json({
      northStars: nsResult.rows,
      okrs: okrResult.rows,
      keyResults: krResult.rows,
    });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { type } = body;

  const client = await pool.connect();
  try {
    if (type === 'north_star') {
      const { name, description, metric_formula, current_value, target_value, unit, is_primary } = body;
      const result = await client.query(
        `INSERT INTO north_star_metric (name,description,metric_formula,current_value,target_value,unit,is_primary)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [name, description, metric_formula, current_value, target_value, unit ?? 'count', is_primary ?? false],
      );
      return Response.json({ northStar: result.rows[0] }, { status: 201 });
    }

    if (type === 'okr') {
      const { cycle, level, team, objective, status, key_results } = body;
      const okrResult = await client.query(
        `INSERT INTO okr (cycle,level,team,objective,status) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [cycle, level ?? 'company', team ?? null, objective, status ?? 'active'],
      );
      const okr = okrResult.rows[0];
      const krs = [];
      if (key_results && Array.isArray(key_results)) {
        for (const [i, kr] of key_results.entries()) {
          const krRes = await client.query(
            `INSERT INTO key_result (okr_id,kr_number,description,start_value,target_value,unit,metric_type)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [okr.id, i+1, kr.description, kr.start_value ?? 0, kr.target_value, kr.unit ?? 'count', kr.metric_type ?? 'number'],
          );
          krs.push(krRes.rows[0]);
        }
      }
      return Response.json({ okr, keyResults: krs }, { status: 201 });
    }

    if (type === 'key_result') {
      const { okr_id, kr_number, description, metric_type, start_value, target_value, unit } = body;
      const result = await client.query(
        `INSERT INTO key_result (okr_id,kr_number,description,metric_type,start_value,target_value,unit)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [okr_id, kr_number, description, metric_type ?? 'number', start_value ?? 0, target_value, unit ?? 'count'],
      );
      return Response.json({ keyResult: result.rows[0] }, { status: 201 });
    }

    return Response.json({ error: 'Invalid type. Use north_star, okr, or key_result' }, { status: 400 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { type, id, ...fields } = body;

  const client = await pool.connect();
  try {
    if (type === 'north_star') {
      const allowed = ['name','description','metric_formula','current_value','target_value','unit','is_primary','status'] as const;
      const setClauses: string[] = ['last_updated_at = NOW()'];
      const vals: unknown[] = [];
      let idx = 1;
      for (const key of allowed) {
        if (fields[key] !== undefined) { setClauses.push(`${key} = $${idx++}`); vals.push(fields[key]); }
      }
      vals.push(id);
      const result = await client.query(
        `UPDATE north_star_metric SET ${setClauses.join(',')} WHERE id = $${idx} RETURNING *`,
        vals,
      );
      return Response.json({ northStar: result.rows[0] });
    }

    if (type === 'okr') {
      const allowed = ['cycle','level','team','objective','status','progress_pct'] as const;
      const setClauses: string[] = [];
      const vals: unknown[] = [];
      let idx = 1;
      for (const key of allowed) {
        if (fields[key] !== undefined) { setClauses.push(`${key} = $${idx++}`); vals.push(fields[key]); }
      }
      if (setClauses.length === 0) return Response.json({ error: 'No fields' }, { status: 400 });
      vals.push(id);
      const result = await client.query(
        `UPDATE okr SET ${setClauses.join(',')} WHERE id = $${idx} RETURNING *`,
        vals,
      );
      return Response.json({ okr: result.rows[0] });
    }

    if (type === 'key_result') {
      const allowed = ['description','current_value','target_value','confidence_pct','status','unit'] as const;
      const setClauses: string[] = ['updated_at = NOW()'];
      const vals: unknown[] = [];
      let idx = 1;
      for (const key of allowed) {
        if (fields[key] !== undefined) { setClauses.push(`${key} = $${idx++}`); vals.push(fields[key]); }
      }
      vals.push(id);
      const result = await client.query(
        `UPDATE key_result SET ${setClauses.join(',')} WHERE id = $${idx} RETURNING *`,
        vals,
      );

      // Recalculate parent OKR progress
      if (result.rows.length > 0) {
        const okrId = result.rows[0].okr_id;
        await client.query(`
          UPDATE okr SET progress_pct = (
            SELECT COALESCE(AVG(
              CASE WHEN target_value > 0
                   THEN LEAST(100, GREATEST(0, (current_value - start_value) / (target_value - start_value) * 100))
                   ELSE 0 END
            )::INTEGER, 0)
            FROM key_result WHERE okr_id = $1
          ) WHERE id = $1
        `, [okrId]).catch(() => {});
      }

      return Response.json({ keyResult: result.rows[0] });
    }

    return Response.json({ error: 'Invalid type' }, { status: 400 });
  } finally {
    client.release();
  }
}
