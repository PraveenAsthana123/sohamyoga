// Extracted from the video/render API route so both the interactive
// request path and the self-healing retry worker call the exact same real
// espeak-ng + FFmpeg logic — not a duplicated/drifted copy.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { query } from '../../lib/postgres';

const run = promisify(execFile);
const assEscape = (s: string) => s.replace(/[{}]/g, '').replace(/\r?\n/g, '\\N').slice(0, 4000);

export interface RenderVideoInput {
  assetId: string;
  workspaceId: string;
  campaignId: string | null;
  title: string;
  script: string;
  jobId: string;
}

export interface RenderVideoResult {
  status: 'succeeded' | 'failed';
  filePath?: string;
  durationSeconds?: number;
  checksum?: string;
  errorMessage?: string;
}

export async function renderVideoAsset(input: RenderVideoInput): Promise<RenderVideoResult> {
  const { assetId: id, workspaceId, campaignId, title, script, jobId } = input;
  const rel = `/generated/${id}.mp4`;
  const outDir = path.join(process.cwd(), 'public', 'generated');
  const wav = path.join(outDir, `${id}.wav`), ass = path.join(outDir, `${id}.ass`), mp4 = path.join(outDir, `${id}.mp4`);

  try {
    await mkdir(outDir, { recursive: true });
    await run('espeak-ng', ['-s', '155', '-w', wav, script], { timeout: 120000 });
    const assText = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1280\nPlayResY: 720\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,DejaVu Sans,42,&H00FFFFFF,&H000000FF,&H0010182B,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,70,70,70,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:00.00,9:59:00.00,Default,,0,0,0,,${assEscape(title)}\\N\\N${assEscape(script)}\n`;
    await writeFile(ass, assText, 'utf8');
    await run('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=0x10233f:s=1280x720:r=30', '-i', wav, '-vf', `subtitles=${ass}`, '-c:v', 'libopenh264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', mp4], { timeout: 300000, maxBuffer: 4 * 1024 * 1024 });
    const bytes = await readFile(mp4);
    const checksum = createHash('sha256').update(bytes).digest('hex');
    const probe = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', mp4]);
    const duration = Number(probe.stdout.trim());

    await query(`UPDATE marketing_asset SET status='ready_for_review',file_path=$1,mime_type='video/mp4',duration_seconds=$2,checksum_sha256=$3,updated_at=now() WHERE id=$4`, [rel, duration, checksum, id]);
    await query(`UPDATE marketing_production_job SET status='succeeded',completed_at=now(),output=$1,updated_at=now() WHERE id=$2`, [JSON.stringify({ path: rel, duration, checksum }), jobId]);
    await query(`INSERT INTO marketing_event_log(workspace_id,campaign_id,event_name,entity_type,entity_id,actor,provider,outcome,details) VALUES($1,$2,'video.rendered','asset',$3,'admin','FFmpeg','success',$4)`, [workspaceId, campaignId, id, JSON.stringify({ path: rel, duration })]);
    await Promise.allSettled([unlink(wav), unlink(ass)]);
    return { status: 'succeeded', filePath: rel, durationSeconds: duration, checksum };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'render failed';
    await query(`UPDATE marketing_asset SET status='failed',updated_at=now() WHERE id=$1`, [id]);
    await query(`UPDATE marketing_production_job SET status='failed',completed_at=now(),error_message=$1,updated_at=now() WHERE id=$2`, [message.slice(0, 2000), jobId]);
    await query(`INSERT INTO marketing_event_log(workspace_id,campaign_id,event_name,entity_type,entity_id,actor,provider,outcome,details) VALUES($1,$2,'video.render_failed','asset',$3,'system','FFmpeg','failure',$4)`, [workspaceId, campaignId, id, JSON.stringify({ error: message.slice(0, 500) })]);
    await Promise.allSettled([unlink(wav), unlink(ass)]);
    return { status: 'failed', errorMessage: message };
  }
}
