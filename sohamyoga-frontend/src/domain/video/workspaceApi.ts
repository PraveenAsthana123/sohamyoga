import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getCustomerPrincipal } from '@/lib/customer-auth';
import { databaseConfigured, query, transaction } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { ASPECTS, safeMediaUrl, validateTracks } from './workspaceValidation';
import { renderTimeline } from './VideoTimelineRenderer';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function videoWorkspace(req: NextRequest, admin: boolean): Promise<Response> {
  const auth = admin ? await getAdminPrincipal(req) : await getCustomerPrincipal(req);
  if (auth.denied) return auth.denied;
  if (!databaseConfigured()) return Response.json({ error: 'Video workspace database is unavailable.' }, { status: 503 });
  try {
    const actor = auth.principal!.id;
    let customerId: string | null = null;
    let tenantId: string;
    if (admin) tenantId = await getPrimaryTenantId();
    else {
      const customer = await query<{ id: string; tenant_id: string }>('SELECT id, tenant_id FROM customer WHERE user_id=$1', [actor]);
      if (!customer.rows[0]) return Response.json({ error: 'Customer account not found.' }, { status: 404 });
      customerId = customer.rows[0].id; tenantId = customer.rows[0].tenant_id;
    }
    const scope = admin ? 'tenant_id=$1' : 'tenant_id=$1 AND customer_id=$2';
    const scopeArgs = admin ? [tenantId] : [tenantId, customerId];
    if (req.method === 'GET') {
      const id = req.nextUrl.searchParams.get('id');
      if (!id) {
        const projects = await query(`SELECT * FROM video_edit_project WHERE ${scope} ORDER BY updated_at DESC LIMIT 200`, scopeArgs);
        return Response.json({ projects: projects.rows });
      }
      if (!uuid.test(id)) return Response.json({ error: 'Invalid project ID.' }, { status: 400 });
      const project = await query(`SELECT * FROM video_edit_project WHERE ${scope} AND id=$${scopeArgs.length + 1}`, [...scopeArgs, id]);
      if (!project.rows[0]) return Response.json({ error: 'Project not found.' }, { status: 404 });
      const [tracks, events, jobs] = await Promise.all([
        query(`SELECT t.*, COALESCE((SELECT jsonb_agg(c ORDER BY c.start_ms) FROM video_edit_clip c WHERE c.track_id=t.id),'[]'::jsonb) AS clips FROM video_edit_track t WHERE project_id=$1 ORDER BY sort_order`, [id]),
        query(`SELECT id,event_type,detail,created_at FROM video_project_event WHERE project_id=$1 ORDER BY created_at DESC LIMIT 100`, [id]),
        query(`SELECT id,engine,status,output_uri,attempts,queued_at,completed_at FROM video_render_job WHERE project_id=$1 ORDER BY queued_at DESC LIMIT 30`, [id]),
      ]);
      return Response.json({ project: project.rows[0], tracks: tracks.rows, events: events.rows, jobs: jobs.rows });
    }
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request.' }, { status: 400 });
    if (req.method === 'POST') {
      if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 180 || typeof body.brief !== 'string' || !body.brief.trim() || body.brief.length > 10000 || !ASPECTS.includes(body.aspect)) return Response.json({ error: 'Enter a title, brief and valid aspect ratio.' }, { status: 400 });
      const dimensions: Record<string, number[]> = { '16:9': [1920,1080], '9:16': [1080,1920], '1:1': [1080,1080], '4:5': [1080,1350] };
      const [width,height] = dimensions[body.aspect];
      const project = await transaction(async client => {
        const result = await client.query(`INSERT INTO video_edit_project (tenant_id,customer_id,title,creative_brief,aspect_ratio,width,height,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [tenantId,customerId,body.title.trim(),body.brief.trim(),body.aspect,width,height,actor]);
        await client.query(`INSERT INTO video_project_event(project_id,event_type,actor_id,detail) VALUES ($1,'created',$2,$3)`, [result.rows[0].id,actor,JSON.stringify({ message: admin ? 'Created by staff' : 'Customer brief submitted' })]);
        return result.rows[0];
      });
      return Response.json({ project }, { status: 201 });
    }
    if (req.method !== 'PATCH' || !uuid.test(body.id || '')) return Response.json({ error: 'Invalid project ID.' }, { status: 400 });

    // Render runs its own internal transaction (VideoTimelineRenderer sets
    // status='rendering' immediately, then 'review'/'failed' on completion)
    // -- it must NOT run inside the generic transaction() below, which
    // holds a FOR UPDATE lock on this same project row for the whole call;
    // nesting them would self-deadlock across the two pool connections.
    if (admin && body.action === 'render') {
      const current = await query<{ status: string }>(`SELECT status FROM video_edit_project WHERE ${scope} AND id=$${scopeArgs.length + 1}`, [...scopeArgs, body.id]);
      if (!current.rows[0]) return Response.json({ error: 'Project not found.' }, { status: 404 });
      if (!['draft', 'failed'].includes(current.rows[0].status)) return Response.json({ error: `Cannot render from status "${current.rows[0].status}" -- request a revision first.` }, { status: 409 });
      const outcome = await renderTimeline(body.id);
      if (outcome.status === 'failed') return Response.json({ error: outcome.errorMessage ?? 'Render failed.' }, { status: 422 });
      return Response.json({ ok: true, outputUri: outcome.outputUri, durationSeconds: outcome.durationSeconds, checksum: outcome.checksum });
    }

    const result = await transaction(async client => {
      const current = await client.query(`SELECT * FROM video_edit_project WHERE ${scope} AND id=$${scopeArgs.length + 1} FOR UPDATE`, [...scopeArgs,body.id]);
      if (!current.rows[0]) return { error: 'Project not found.', code: 404 };
      const p = current.rows[0];
      let message = '';
      if (body.action === 'comment') {
        if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 4000) return { error: 'Enter feedback up to 4000 characters.', code: 400 };
        message = body.message.trim();
      } else if (body.action === 'approve' || body.action === 'revision') {
        if (p.status !== 'review' || !p.delivery_url) return { error: 'This project is not awaiting delivery review.', code: 409 };
        if (body.action === 'revision' && (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 4000)) return { error: 'Explain the revision you need.', code: 400 };
        await client.query(`UPDATE video_edit_project SET status=$1,revision=revision+$2,updated_at=now() WHERE id=$3`, [body.action === 'approve' ? 'complete' : 'draft',body.action === 'revision' ? 1 : 0,body.id]);
        message = body.action === 'approve' ? 'Delivery approved' : body.message.trim();
      } else if (body.action === 'cancel') {
        if (!['draft','review','failed'].includes(p.status)) return { error: 'Project cannot be cancelled in its current state.', code: 409 };
        await client.query("UPDATE video_edit_project SET status='archived',updated_at=now() WHERE id=$1", [body.id]);
        message = 'Project archived';
      } else if (admin && body.action === 'delivery') {
        if (!safeMediaUrl(body.url)) return { error: 'Provide an HTTPS video link or the local sample MP4.', code: 400 };
        if (p.status === 'archived') return { error: 'Archived projects cannot receive a delivery.', code: 409 };
        await client.query("UPDATE video_edit_project SET delivery_url=$1,status='review',updated_at=now() WHERE id=$2", [body.url,body.id]);
        message = 'Video delivered for review';
      } else if (admin && body.action === 'assign') {
        if (typeof body.assignee !== 'string' || body.assignee.length > 180 || (body.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate))) return { error: 'Invalid assignee or due date.', code: 400 };
        await client.query('UPDATE video_edit_project SET assigned_to=$1,due_date=$2,updated_at=now() WHERE id=$3', [body.assignee.trim(),body.dueDate || null,body.id]);
        message = `Assigned to ${body.assignee.trim() || 'unassigned'}`;
      } else if (admin && body.action === 'timeline') {
        if (['review','complete','archived','rendering'].includes(p.status)) return { error: 'Request a revision before editing this timeline.', code: 409 };
        const tracks = validateTracks(body.tracks);
        await client.query('DELETE FROM video_edit_track WHERE project_id=$1', [body.id]);
        for (const [i,t] of tracks.entries()) {
          const track = await client.query('INSERT INTO video_edit_track(project_id,track_type,name,sort_order,muted) VALUES($1,$2,$3,$4,$5) RETURNING id', [body.id,t.track_type,t.name,i,t.muted]);
          for (const c of t.clips) await client.query('INSERT INTO video_edit_clip(track_id,asset_uri,start_ms,end_ms,source_in_ms,properties) VALUES($1,$2,$3,$4,$5,$6)', [track.rows[0].id,c.asset_uri,c.start_ms,c.end_ms,c.source_in_ms,JSON.stringify(c.properties)]);
        }
        const duration = Math.max(0,...tracks.flatMap(t=>t.clips.map(c=>c.end_ms)));
        await client.query('UPDATE video_edit_project SET duration_ms=$1,updated_at=now() WHERE id=$2', [duration,body.id]);
        message = `Saved ${tracks.length} tracks`;
      } else return { error: 'Action is not allowed.', code: 403 };
      await client.query('INSERT INTO video_project_event(project_id,event_type,actor_id,detail) VALUES($1,$2,$3,$4)', [body.id,body.action,actor,JSON.stringify({ message })]);
      return { ok: true };
    });
    if ('error' in result) return Response.json({ error: result.error }, { status: result.code });
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && /track|Clip|Volume|HTTPS|timing/i.test(error.message)) return Response.json({ error: error.message }, { status: 400 });
    console.error('[video-workspace] operation failed');
    return Response.json({ error: 'The video workspace could not complete this request.' }, { status: 500 });
  }
}
