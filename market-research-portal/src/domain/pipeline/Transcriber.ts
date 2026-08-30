// Extracted from spatial-learning/transcribe/route.ts's real faster-whisper
// pipeline so voice_call recordings can use the exact same, already-working
// STT path instead of it staying wired to only one feature.
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export interface TranscriptionResult {
  text: string;
  language?: string;
  durationSeconds?: number;
}

export async function transcribeAudioBuffer(audio: Buffer, sourceExt = 'webm'): Promise<TranscriptionResult> {
  const id = randomUUID();
  const dir = path.join('/tmp', 'soham-mrp-audio');
  const source = path.join(dir, `${id}-src.${sourceExt}`);
  const wav = path.join(dir, `${id}-norm.wav`);
  await mkdir(dir, { recursive: true });
  try {
    await writeFile(source, audio, { mode: 0o600 });
    await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-ac', '1', '-ar', '16000', wav], { timeout: 60000 });
    const python = path.resolve(process.cwd(), '..', 'tools', 'voice-terminal', '.venv', 'bin', 'python');
    const script = path.resolve(process.cwd(), '..', 'tools', 'voice-terminal', 'transcribe_file.py');
    const { stdout } = await run(python, [script, wav, '--model', 'base.en'], { timeout: 180000, maxBuffer: 1024 * 1024 });
    const result = JSON.parse(stdout) as TranscriptionResult;
    if (!result.text) throw new Error('No speech recognized.');
    return result;
  } finally {
    await Promise.allSettled([unlink(source), unlink(wav)]);
  }
}
