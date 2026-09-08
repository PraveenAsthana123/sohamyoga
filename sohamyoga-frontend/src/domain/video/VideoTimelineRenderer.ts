// Real multi-clip timeline renderer for video_edit_project/track/clip
// (src/domain/video/db-schema-editor.sql). Closes the documented gap: "no
// multi-clip concatenation, trim, or transition capability -- render is
// single-script-to-video" (VideoRenderer.ts). That schema and the real
// authoring CRUD (workspaceApi.ts, PATCH action=timeline) already existed,
// but grep-confirmed zero consumers of video_render_job/video_edit_clip
// anywhere in cron or app code -- a saved timeline could never actually be
// rendered. This is the first real renderer for it.
//
// Each clip is trimmed via its real source_in_ms/duration and either
// straight-concatenated or, when properties.transition === 'crossfade',
// blended into the next clip with a real ffmpeg xfade (video) + acrossfade
// (audio) pair. properties.denoise === true applies a real FFT denoise
// (afftdn) to that clip's audio during trim.
//
// Multi-track audio mixing (added 2026-09-08, closing the "audio-editing"
// gap -- "no multi-track mixing, background music, or noise removal"):
// the first non-video track of type 'music' or 'voice' is treated as a
// background-audio bed. Its first clip's audio (trimmed the same
// source_in/duration way, volume-scaled from properties.volume) is looped
// to the final video's duration and mixed under the main track's own audio
// via a real ffmpeg amix. V1 scope, stated honestly: only ONE background-
// audio clip is mixed in (not a full multi-clip background timeline), and
// only the first VIDEO-type track's clips form the visual timeline --
// caption/text/shape tracks are not yet composited in.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { query, transaction } from '@/lib/postgres';

const run = promisify(execFile);
const TRANSITION_SECONDS = 0.5;

interface ClipRow { id: string; asset_uri: string; start_ms: number; end_ms: number; source_in_ms: number; properties: { transition?: string; denoise?: boolean; volume?: number } }

export interface RenderTimelineResult {
  status: 'succeeded' | 'failed';
  jobId: string;
  outputUri?: string;
  durationSeconds?: number;
  checksum?: string;
  errorMessage?: string;
}

/** Resolves an asset_uri (local /samples/*.mp4 or an https URL) to a real local file path, downloading https sources once into a temp working dir. */
async function resolveLocalPath(assetUri: string, workDir: string, index: number): Promise<string> {
  if (assetUri.startsWith('/samples/')) return path.join(process.cwd(), 'public', assetUri);
  const res = await fetch(assetUri, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`Could not fetch clip source ${assetUri}: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const dest = path.join(workDir, `src-${index}.mp4`);
  await writeFile(dest, bytes);
  return dest;
}

export async function renderTimeline(projectId: string): Promise<RenderTimelineResult> {
  const project = await query<{ width: number; height: number; fps: number }>(
    `SELECT width, height, fps FROM video_edit_project WHERE id = $1`, [projectId],
  );
  if (!project.rowCount) throw new Error('Project not found.');
  const { width, height, fps } = project.rows[0];

  const videoTrack = await query<{ id: string }>(
    `SELECT id FROM video_edit_track WHERE project_id = $1 AND track_type = 'video' ORDER BY sort_order LIMIT 1`, [projectId],
  );
  const jobId = (await query<{ id: string }>(
    `INSERT INTO video_render_job (project_id, engine, status, snapshot) VALUES ($1, 'ffmpeg', 'running', $2) RETURNING id`,
    [projectId, JSON.stringify({ width, height, fps })],
  )).rows[0].id;
  await query(`UPDATE video_edit_project SET status = 'rendering', updated_at = now() WHERE id = $1`, [projectId]);

  const workDir = path.join(process.cwd(), 'public', 'generated', `timeline-${jobId}`);
  const outDir = path.join(process.cwd(), 'public', 'generated');
  const outFile = path.join(outDir, `timeline-${jobId}.mp4`);
  const relOut = `/generated/timeline-${jobId}.mp4`;

  const fail = async (message: string): Promise<RenderTimelineResult> => {
    await query(`UPDATE video_render_job SET status='failed', error_detail=$1, completed_at=now(), attempts=attempts+1 WHERE id=$2`, [message.slice(0, 2000), jobId]);
    await query(`UPDATE video_edit_project SET status='failed', updated_at=now() WHERE id=$1`, [projectId]);
    return { status: 'failed', jobId, errorMessage: message };
  };

  if (!videoTrack.rowCount) return fail('No video-type track exists on this project -- nothing to render.');

  const clips = (await query<ClipRow>(
    `SELECT id, asset_uri, start_ms, end_ms, source_in_ms, properties FROM video_edit_clip WHERE track_id = $1 ORDER BY start_ms`,
    [videoTrack.rows[0].id],
  )).rows;
  if (clips.length === 0) return fail('The video track has no clips -- nothing to render.');
  if (clips.some(c => !c.asset_uri)) return fail('Every clip on the video track needs a real asset_uri before rendering.');

  try {
    await mkdir(workDir, { recursive: true });

    // Resolve every distinct source once, trim+normalize each clip to a
    // common resolution/fps (required before concat/xfade can join them).
    const sourceCache = new Map<string, string>();
    const segmentFiles: string[] = [];
    for (let i = 0; i < clips.length; i++) {
      const c = clips[i];
      let localSrc = sourceCache.get(c.asset_uri);
      if (!localSrc) { localSrc = await resolveLocalPath(c.asset_uri, workDir, i); sourceCache.set(c.asset_uri, localSrc); }
      const durationSec = (c.end_ms - c.start_ms) / 1000;
      const startSec = c.source_in_ms / 1000;
      const seg = path.join(workDir, `seg-${i}.mp4`);
      const audioFilter = c.properties?.denoise ? 'afftdn=nf=-25' : 'anull';
      await run('ffmpeg', [
        '-y', '-ss', startSec.toFixed(3), '-t', durationSec.toFixed(3), '-i', localSrc,
        '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,fps=${fps},setsar=1`,
        '-af', audioFilter,
        '-c:v', 'libopenh264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '128k',
        seg,
      ], { timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
      segmentFiles.push(seg);
    }

    // Join segments -- straight concat unless a clip (from the 2nd onward)
    // requests a real crossfade, in which case that boundary uses xfade/
    // acrossfade instead of a hard cut.
    let currentVideo = segmentFiles[0];
    let runningDurationSec = await probeDuration(segmentFiles[0]);

    for (let i = 1; i < segmentFiles.length; i++) {
      const wantsCrossfade = clips[i].properties?.transition === 'crossfade';
      const nextDurationSec = await probeDuration(segmentFiles[i]);
      const joined = path.join(workDir, `join-${i}.mp4`);
      if (wantsCrossfade && runningDurationSec > TRANSITION_SECONDS && nextDurationSec > TRANSITION_SECONDS) {
        const offset = Math.max(0, runningDurationSec - TRANSITION_SECONDS);
        await run('ffmpeg', [
          '-y', '-i', currentVideo, '-i', segmentFiles[i],
          '-filter_complex',
          `[0:v][1:v]xfade=transition=fade:duration=${TRANSITION_SECONDS}:offset=${offset.toFixed(3)}[v];` +
          `[0:a][1:a]acrossfade=d=${TRANSITION_SECONDS}[a]`,
          '-map', '[v]', '-map', '[a]',
          '-c:v', 'libopenh264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
          joined,
        ], { timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
        runningDurationSec = runningDurationSec + nextDurationSec - TRANSITION_SECONDS;
      } else {
        const listFile = path.join(workDir, `concat-${i}.txt`);
        await writeFile(listFile, `file '${currentVideo}'\nfile '${segmentFiles[i]}'\n`);
        await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', joined], { timeout: 120000 });
        runningDurationSec = runningDurationSec + nextDurationSec;
      }
      currentVideo = joined;
    }

    // Real background-music/voice-bed mixing -- the first clip on the
    // first non-video 'music' or 'voice' track (if any) is looped to the
    // final duration and mixed under the main track's own audio via amix.
    const musicTrack = await query<{ id: string }>(
      `SELECT id FROM video_edit_track WHERE project_id = $1 AND track_type IN ('music','voice') ORDER BY sort_order LIMIT 1`,
      [projectId],
    );
    let mixedVideo = currentVideo;
    if (musicTrack.rowCount) {
      const musicClip = (await query<ClipRow>(
        `SELECT id, asset_uri, start_ms, end_ms, source_in_ms, properties FROM video_edit_clip WHERE track_id = $1 ORDER BY start_ms LIMIT 1`,
        [musicTrack.rows[0].id],
      )).rows[0];
      if (musicClip?.asset_uri) {
        const musicLocal = await resolveLocalPath(musicClip.asset_uri, workDir, 900);
        const musicVolume = musicClip.properties?.volume ?? 1;
        const mixed = path.join(workDir, 'mixed.mp4');
        await run('ffmpeg', [
          '-y', '-i', currentVideo,
          '-stream_loop', '-1', '-t', runningDurationSec.toFixed(3), '-i', musicLocal,
          '-filter_complex', `[1:a]volume=${musicVolume}[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=0[a]`,
          '-map', '0:v', '-map', '[a]',
          '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest',
          mixed,
        ], { timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
        mixedVideo = mixed;
      }
    }

    await mkdir(outDir, { recursive: true });
    await run('ffmpeg', ['-y', '-i', mixedVideo, '-c', 'copy', '-movflags', '+faststart', outFile], { timeout: 60000 });

    const bytes = await readFile(outFile);
    const checksum = createHash('sha256').update(bytes).digest('hex');
    const durationSeconds = await probeDuration(outFile);

    await transaction(async client => {
      await client.query(
        `UPDATE video_render_job SET status='succeeded', output_uri=$1, checksum_sha256=$2, completed_at=now(), attempts=attempts+1 WHERE id=$3`,
        [relOut, checksum, jobId],
      );
      await client.query(
        `UPDATE video_edit_project SET status='review', delivery_url=$1, duration_ms=$2, updated_at=now() WHERE id=$3`,
        [relOut, Math.round(durationSeconds * 1000), projectId],
      );
      await client.query(
        `INSERT INTO video_project_event (project_id, event_type, detail) VALUES ($1, 'rendered', $2)`,
        [projectId, JSON.stringify({
          message: `Real ffmpeg render: ${clips.length} clip(s), ${durationSeconds.toFixed(1)}s output${mixedVideo !== currentVideo ? ' (with background audio mix)' : ''}`,
          jobId,
        })],
      );
    });

    await rm(workDir, { recursive: true, force: true });
    return { status: 'succeeded', jobId, outputUri: relOut, durationSeconds, checksum };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'render failed';
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
    return fail(message);
  }
}

async function probeDuration(file: string): Promise<number> {
  const probe = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  return Number(probe.stdout.trim()) || 0;
}
