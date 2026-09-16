import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Types ──────────────────────────────────────────────────────────────────

interface Json3Event {
  tStartMs: number;
  dDurationMs?: number;
  segs?: Array<{ utf8?: string }>;
}

interface Json3Response {
  events?: Json3Event[];
}

interface OEmbedResponse {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

interface Segment {
  start_seconds: number;
  duration_seconds: number;
  text: string;
  seq_num: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function msToSrtTime(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const millisRemainder = ms % 1000;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millisRemainder).padStart(3, '0')}`;
}

function buildSrt(segments: Segment[]): string {
  return segments
    .map((seg, i) => {
      const startMs = seg.start_seconds * 1000;
      const endMs = startMs + seg.duration_seconds * 1000;
      return `${i + 1}\n${msToSrtTime(startMs)} --> ${msToSrtTime(endMs)}\n${seg.text.trim()}`;
    })
    .join('\n\n');
}

async function fetchOEmbed(videoId: string): Promise<OEmbedResponse> {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`oEmbed failed: ${res.status}`);
  return res.json() as Promise<OEmbedResponse>;
}

async function fetchTranscriptFromYouTube(
  videoId: string,
  language: string
): Promise<{ segments: Segment[]; warning?: string }> {
  // Method A: scrape ytInitialPlayerResponse for captionTracks
  const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const pageRes = await fetch(pageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!pageRes.ok) {
    return {
      segments: [],
      warning: `Transcript unavailable. Possible reasons: auto-captions disabled, private video, or YouTube blocked the request. Try again or use YouTube Studio to download captions.`,
    };
  }

  const html = await pageRes.text();

  // Extract captionTracks JSON from ytInitialPlayerResponse
  // Use a non-dotAll regex that stops at the closing bracket
  const captionTracksMatch = html.match(/"captionTracks":(\[[^\]]*(?:\][^,\]])*\])/);
  // Fallback: locate by index-based extraction if regex misses multi-line content
  let captionTracksStr: string | undefined = captionTracksMatch?.[1];
  if (!captionTracksStr) {
    const idx = html.indexOf('"captionTracks":');
    if (idx !== -1) {
      const start = html.indexOf('[', idx);
      if (start !== -1) {
        let depth = 0;
        let end = start;
        for (; end < html.length; end++) {
          if (html[end] === '[') depth++;
          else if (html[end] === ']') { depth--; if (depth === 0) { end++; break; } }
        }
        captionTracksStr = html.slice(start, end);
      }
    }
  }
  const captionTracksMatchFinal = captionTracksStr ? [null, captionTracksStr] : null;
  if (!captionTracksMatchFinal) {
    return {
      segments: [],
      warning: `Transcript unavailable. Possible reasons: auto-captions disabled, private video, or YouTube blocked the request. Try again or use YouTube Studio to download captions.`,
    };
  }

  let captionTracks: Array<{ languageCode: string; baseUrl: string; name?: { simpleText?: string } }>;
  try {
    captionTracks = JSON.parse(captionTracksMatchFinal[1] as string);
  } catch {
    return {
      segments: [],
      warning: `Transcript unavailable. Possible reasons: auto-captions disabled, private video, or YouTube blocked the request. Try again or use YouTube Studio to download captions.`,
    };
  }

  if (!captionTracks.length) {
    return {
      segments: [],
      warning: `Transcript unavailable. Possible reasons: auto-captions disabled, private video, or YouTube blocked the request. Try again or use YouTube Studio to download captions.`,
    };
  }

  // Prefer matching language, fall back to first available
  const track =
    captionTracks.find((t) => t.languageCode === language) ||
    captionTracks.find((t) => t.languageCode?.startsWith('en')) ||
    captionTracks[0];

  if (!track?.baseUrl) {
    return {
      segments: [],
      warning: `Transcript unavailable. Possible reasons: auto-captions disabled, private video, or YouTube blocked the request. Try again or use YouTube Studio to download captions.`,
    };
  }

  // Fetch the timedtext as JSON3
  const timedtextUrl = `${track.baseUrl}&fmt=json3`;
  const timedtextRes = await fetch(timedtextUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
    signal: AbortSignal.timeout(15_000),
  });

  if (!timedtextRes.ok) {
    return {
      segments: [],
      warning: `Transcript unavailable. Possible reasons: auto-captions disabled, private video, or YouTube blocked the request. Try again or use YouTube Studio to download captions.`,
    };
  }

  const json3: Json3Response = await timedtextRes.json();
  if (!json3.events?.length) {
    return {
      segments: [],
      warning: `Transcript unavailable. Possible reasons: auto-captions disabled, private video, or YouTube blocked the request. Try again or use YouTube Studio to download captions.`,
    };
  }

  const segments: Segment[] = [];
  let seqNum = 0;
  for (const event of json3.events) {
    if (!event.segs?.length) continue;
    const text = event.segs.map((s) => s.utf8 ?? '').join('').replace(/\n/g, ' ').trim();
    if (!text) continue;
    segments.push({
      start_seconds: (event.tStartMs ?? 0) / 1000,
      duration_seconds: (event.dDurationMs ?? 2000) / 1000,
      text,
      seq_num: seqNum++,
    });
  }

  if (!segments.length) {
    return {
      segments: [],
      warning: `Transcript unavailable. Possible reasons: auto-captions disabled, private video, or YouTube blocked the request. Try again or use YouTube Studio to download captions.`,
    };
  }

  return { segments };
}

async function runOllamaPrompt(prompt: string, timeoutMs = 30_000): Promise<string | null> {
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = await res.json() as { response?: string };
    return data.response?.trim() ?? null;
  } catch {
    return null;
  }
}

// ── Route Handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json().catch(() => null) as { videoId?: string; language?: string } | null;
    if (!body?.videoId?.trim()) {
      return Response.json({ error: 'videoId is required.' }, { status: 400 });
    }
    const videoId = body.videoId.trim();
    const language = body.language?.trim() || 'en';

    // Mark as fetching
    await client.query(`
      INSERT INTO youtube_transcripts (video_id, language, status)
      VALUES ($1, $2, 'fetching')
      ON CONFLICT (video_id) DO UPDATE SET language = EXCLUDED.language, status = 'fetching', updated_at = NOW()
    `, [videoId, language]);

    let warning: string | undefined;

    // Step 1: oEmbed metadata
    let videoTitle: string | null = null;
    let channelName: string | null = null;
    let thumbnailUrl: string | null = null;

    try {
      const oEmbed = await fetchOEmbed(videoId);
      videoTitle = oEmbed.title ?? null;
      channelName = oEmbed.author_name ?? null;
      thumbnailUrl = oEmbed.thumbnail_url ?? null;
    } catch (err) {
      console.warn('[youtube-transcript] oEmbed failed:', err);
    }

    // Step 2: Fetch transcript
    let segments: Segment[] = [];
    let transcriptRaw = '';
    let transcriptSrt = '';
    let wordCount = 0;
    let status = 'done';

    try {
      const result = await fetchTranscriptFromYouTube(videoId, language);
      segments = result.segments;
      warning = result.warning;

      if (segments.length === 0) {
        status = 'no_transcript';
      } else {
        transcriptRaw = segments.map((s) => s.text).join(' ');
        transcriptSrt = buildSrt(segments);
        wordCount = transcriptRaw.split(/\s+/).filter(Boolean).length;
        status = 'done';
      }
    } catch (err) {
      console.error('[youtube-transcript] transcript fetch failed:', err);
      status = 'error';
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';

      await client.query(`
        UPDATE youtube_transcripts SET status = 'error', error_message = $2, updated_at = NOW() WHERE video_id = $1
      `, [videoId, errorMsg]);

      return Response.json({
        error: `Failed to fetch transcript: ${errorMsg}`,
        warning: `Transcript unavailable. Possible reasons: auto-captions disabled, private video, or YouTube blocked the request. Try again or use YouTube Studio to download captions.`,
      }, { status: 422 });
    }

    // Step 4: AI processing via Ollama
    let aiSummary: string | null = null;
    let aiKeyTopics: string[] = [];

    if (transcriptRaw.length > 100) {
      const first1500 = transcriptRaw.slice(0, 1500);
      const first1000 = transcriptRaw.slice(0, 1000);

      const [summaryResult, topicsResult] = await Promise.all([
        runOllamaPrompt(`Summarize this YouTube video transcript in 3 bullet points. Transcript: ${first1500}...`),
        runOllamaPrompt(`List 5 key topics from this transcript as a comma-separated list. Transcript: ${first1000}`),
      ]);

      aiSummary = summaryResult ?? 'Ollama not available';
      if (topicsResult) {
        aiKeyTopics = topicsResult.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10);
      }
    }

    // Step 5: Save to DB
    const upsertResult = await client.query(`
      INSERT INTO youtube_transcripts (
        video_id, video_title, channel_name, thumbnail_url, language,
        transcript_raw, transcript_srt, word_count, status,
        ai_summary, ai_key_topics, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
      ON CONFLICT (video_id) DO UPDATE SET
        video_title       = EXCLUDED.video_title,
        channel_name      = EXCLUDED.channel_name,
        thumbnail_url     = EXCLUDED.thumbnail_url,
        language          = EXCLUDED.language,
        transcript_raw    = EXCLUDED.transcript_raw,
        transcript_srt    = EXCLUDED.transcript_srt,
        word_count        = EXCLUDED.word_count,
        status            = EXCLUDED.status,
        ai_summary        = EXCLUDED.ai_summary,
        ai_key_topics     = EXCLUDED.ai_key_topics,
        error_message     = NULL,
        updated_at        = NOW()
      RETURNING *
    `, [
      videoId, videoTitle, channelName, thumbnailUrl, language,
      transcriptRaw || null, transcriptSrt || null, wordCount || null, status,
      aiSummary, aiKeyTopics.length ? aiKeyTopics : null,
    ]);

    const transcript = upsertResult.rows[0];

    // Insert segments
    if (segments.length > 0) {
      // Delete old segments first
      await client.query(`DELETE FROM youtube_transcript_segments WHERE transcript_id = $1`, [transcript.id]);

      for (const seg of segments) {
        await client.query(`
          INSERT INTO youtube_transcript_segments (transcript_id, start_seconds, duration_seconds, text, seq_num)
          VALUES ($1, $2, $3, $4, $5)
        `, [transcript.id, seg.start_seconds, seg.duration_seconds, seg.text, seg.seq_num]);
      }
    }

    return Response.json({
      transcript,
      segments,
      warning,
    });
  } catch (err) {
    console.error('[youtube-transcript/fetch POST]', err);
    return Response.json({ error: 'Failed to process transcript.' }, { status: 500 });
  } finally {
    client.release();
  }
}
