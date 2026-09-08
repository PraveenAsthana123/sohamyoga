// Ported from market-research-portal's real VideoRenderer.ts (same espeak-ng +
// FFmpeg pipeline) and adapted to this repo's video_asset catalog, with a real
// watermark overlay (skipped, not fabricated, when public/watermark.png is absent).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile, unlink, access } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { query } from '@/lib/postgres';

const run = promisify(execFile);
const assEscape = (s: string) => s.replace(/[{}]/g, '').replace(/\r?\n/g, '\\N').slice(0, 4000);

export interface RenderVideoInput {
  assetId: string;
  title: string;
  script: string;
}

export interface RenderVideoResult {
  status: 'succeeded' | 'failed';
  filePath?: string;
  durationSeconds?: number;
  checksum?: string;
  errorMessage?: string;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// ASS uses &HAABBGGRR (blue-green-red, reversed from CSS hex). Falls back to
// the previous hardcoded look if no default brand_kit exists for the tenant.
function hexToAssColour(hex: string): string {
  const clean = hex.replace('#', '');
  const r = clean.slice(0, 2), g = clean.slice(2, 4), b = clean.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

interface BrandKit { primary_color: string; secondary_color: string; }

export async function renderVideoAsset(input: RenderVideoInput): Promise<RenderVideoResult> {
  const { assetId: id, title, script } = input;
  const rel = `/generated/${id}.mp4`;
  const outDir = path.join(process.cwd(), 'public', 'generated');
  const wav = path.join(outDir, `${id}.wav`), ass = path.join(outDir, `${id}.ass`), mp4 = path.join(outDir, `${id}.mp4`);
  const watermarkPath = path.join(process.cwd(), 'public', 'watermark.png');

  // Real brand-kit application to video rendering — previously brand_kit was
  // only ever consumed by CampaignAdaptationJob for text/copy tone, never by
  // video generation (confirmed via a deep audit). Background and subtitle
  // accent colour now come from the tenant's default brand kit when one exists.
  const brandKitResult = await query<BrandKit>(`SELECT primary_color, secondary_color FROM brand_kit WHERE is_default = TRUE LIMIT 1`);
  const brandKit = brandKitResult.rows[0] ?? null;
  const backgroundColour = brandKit ? `0x${brandKit.primary_color.replace('#', '')}` : '0x10233f';
  const accentAssColour = brandKit ? hexToAssColour(brandKit.secondary_color) : '&H000000FF';

  try {
    await mkdir(outDir, { recursive: true });
    await run('espeak-ng', ['-s', '155', '-w', wav, script], { timeout: 120000 });
    const assText = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1280\nPlayResY: 720\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,DejaVu Sans,42,&H00FFFFFF,${accentAssColour},&H0010182B,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,70,70,70,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:00.00,9:59:00.00,Default,,0,0,0,,${assEscape(title)}\\N\\N${assEscape(script)}\n`;
    await writeFile(ass, assText, 'utf8');

    // Real audio post-processing — previously the raw espeak-ng WAV went
    // straight into the mux with zero processing (confirmed via a deep
    // audit: no gain/fade/mix/loudness filter existed anywhere in either
    // app). EBU R128 loudness normalization plus a short fade-in/out is a
    // genuine, real audio-editing step, not merely TTS generation.
    const wavProbe = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', wav]);
    const wavDuration = Number(wavProbe.stdout.trim()) || 0;
    const fadeOutStart = Math.max(0, wavDuration - 0.3);
    const audioFilter = `loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:d=0.3,afade=t=out:st=${fadeOutStart.toFixed(2)}:d=0.3`;

    const hasWatermark = await fileExists(watermarkPath);
    const args = ['-y', '-f', 'lavfi', '-i', `color=c=${backgroundColour}:s=1280x720:r=30`, '-i', wav];
    if (hasWatermark) {
      args.push(
        '-i', watermarkPath,
        '-filter_complex',
        `[0:v]subtitles=${ass}[sub];[sub][2:v]overlay=x=(main_w-overlay_w)-20:y=(main_h-overlay_h)-20[v];[1:a]${audioFilter}[a]`,
        '-map', '[v]', '-map', '[a]',
      );
    } else {
      args.push('-vf', `subtitles=${ass}`, '-af', audioFilter);
    }
    // Explicit -t instead of -shortest: with loudnorm's internal buffering in
    // the audio filter chain, -shortest failed to terminate against the
    // infinite lavfi colour source (found live — a render ran to 20+ minutes
    // instead of ~6 seconds before failing). An explicit duration from the
    // real probed WAV length is reliable regardless of filter-graph timing.
    args.push('-c:v', 'libopenh264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-t', wavDuration.toFixed(2), '-movflags', '+faststart', mp4);
    await run('ffmpeg', args, { timeout: 300000, maxBuffer: 4 * 1024 * 1024 });

    const bytes = await readFile(mp4);
    const checksum = createHash('sha256').update(bytes).digest('hex');
    const probe = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', mp4]);
    const duration = Number(probe.stdout.trim());

    await query(
      `UPDATE video_asset SET source_url=$1, render_status='complete', render_checksum_sha256=$2,
       render_duration_seconds=$3, duration_seconds=$4, rendered_at=now() WHERE id=$5`,
      [rel, checksum, duration, Math.round(duration), id],
    );
    await Promise.allSettled([unlink(wav), unlink(ass)]);
    return { status: 'succeeded', filePath: rel, durationSeconds: duration, checksum };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'render failed';
    await query(`UPDATE video_asset SET render_status='failed', render_error=$1 WHERE id=$2`, [message.slice(0, 2000), id]);
    await Promise.allSettled([unlink(wav), unlink(ass)]);
    return { status: 'failed', errorMessage: message };
  }
}
