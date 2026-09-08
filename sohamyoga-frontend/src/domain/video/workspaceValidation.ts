export const ASPECTS = ['16:9', '9:16', '1:1', '4:5'] as const;
export const TRACK_TYPES = ['video', 'image', 'text', 'caption', 'voice', 'music', 'sfx', 'shape'] as const;
export type EditClip = { asset_uri: string; start_ms: number; end_ms: number; source_in_ms: number; properties: { text?: string; volume?: number } };
export type EditTrack = { name: string; track_type: string; muted: boolean; clips: EditClip[] };
export function safeMediaUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  if (/^\/samples\/[a-zA-Z0-9._-]+\.mp4$/.test(value)) return true;
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
}
export function validateTracks(value: unknown): EditTrack[] {
  if (!Array.isArray(value) || value.length > 20) throw new Error('Use at most 20 tracks.');
  let count = 0;
  return value.map(t => {
    if (!t || !TRACK_TYPES.includes(t.track_type) || typeof t.name !== 'string' || !t.name.trim() || t.name.length > 100 || !Array.isArray(t.clips)) throw new Error('Invalid track.');
    return { name: t.name.trim(), track_type: t.track_type, muted: Boolean(t.muted), clips: t.clips.map((c: EditClip) => {
      if (++count > 100 || !c || ![c.start_ms, c.end_ms, c.source_in_ms].every(Number.isSafeInteger) || c.start_ms < 0 || c.end_ms <= c.start_ms || c.end_ms > 3600000 || c.source_in_ms < 0) throw new Error('Clip timing must be valid milliseconds within one hour.');
      if (c.asset_uri && !safeMediaUrl(c.asset_uri)) throw new Error('Use an HTTPS media link.');
      const text = c.properties?.text;
      const volume = c.properties?.volume;
      if (text !== undefined && (typeof text !== 'string' || text.length > 4000)) throw new Error('Clip text is too long.');
      if (volume !== undefined && (!Number.isFinite(volume) || volume < 0 || volume > 1)) throw new Error('Volume must be between 0 and 1.');
      return { asset_uri: c.asset_uri || '', start_ms: c.start_ms, end_ms: c.end_ms, source_in_ms: c.source_in_ms, properties: { text: text || '', volume: volume ?? 1 } };
    }) };
  });
}
