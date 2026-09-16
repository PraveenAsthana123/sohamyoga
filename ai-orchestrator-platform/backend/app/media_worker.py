"""One leased CPU media worker; run with python -m app.media_worker."""
import fcntl
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import textwrap
import threading
import time
import uuid

from . import db, media


class Cancelled(Exception):
    pass


class Blocked(Exception):
    pass


def check_cancel(jid):
    with db.conn() as c:
        row = c.execute("SELECT cancel_requested FROM media_jobs WHERE id=?", (jid,)).fetchone()
    if row and row[0]:
        raise Cancelled()


def stage(jid, name):
    check_cancel(jid)
    with db.conn() as c:
        c.execute("UPDATE media_jobs SET stage=?,updated_at=? WHERE id=?", (name, time.time(), jid))


def run(jid, args, cwd, timeout=300):
    log = Path(cwd) / "process.log"
    with log.open("wb") as err:
        p = subprocess.Popen(args, cwd=cwd, stdout=subprocess.DEVNULL, stderr=err, start_new_session=True)
        deadline = time.monotonic() + timeout
        try:
            while p.poll() is None:
                check_cancel(jid)
                if time.monotonic() > deadline:
                    raise TimeoutError("Media operation exceeded its time limit")
                time.sleep(.25)
            if p.returncode:
                raise RuntimeError("Media tool failed: " + log.read_text(errors="replace")[-1200:])
        except BaseException:
            if p.poll() is None:
                os.killpg(p.pid, signal.SIGTERM)
                try:
                    p.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    os.killpg(p.pid, signal.SIGKILL)
                    p.wait()
            raise


def save_transcript(jid, segments, language):
    data = json.dumps(segments, ensure_ascii=False)
    with db.conn() as c:
        # A retry keeps old revisions and appends a new machine revision.
        old = c.execute("SELECT revision FROM media_transcripts WHERE job_id=?", (jid,)).fetchone()
        rev = old[0] + 1 if old else 1
        c.execute("INSERT OR REPLACE INTO media_transcripts VALUES(?,?,?,?,?)", (jid, rev, data, language, time.time()))
        c.execute("INSERT INTO media_transcript_revisions VALUES(?,?,?,?)", (jid, rev, data, time.time()))


def transcribe(jid, source, work, language=None):
    stage(jid, "extracting_audio")
    audio = work / "speech.wav"
    run(jid, [media.FFMPEG, "-nostdin", "-y", "-v", "error", "-i", str(source), "-vn", "-ar", "16000", "-ac", "1", str(audio)], work)
    stage(jid, "transcribing")
    try:
        from faster_whisper import WhisperModel
        # No network downloads during user jobs; provision/cache models separately.
        model = WhisperModel(os.environ.get("ORCH_ASR_MODEL", "base"), device="cpu", compute_type="int8",
                             cpu_threads=2, num_workers=1, local_files_only=True)
    except Exception as e:
        raise Blocked("Local speech model unavailable; provision the configured Whisper model in the canonical environment") from e
    result, info = model.transcribe(str(audio), language=language, vad_filter=True, beam_size=3)
    segments = []
    for s in result:
        check_cancel(jid)
        if s.text.strip():
            segments.append({"start": max(0, s.start), "end": min(info.duration, s.end), "text": s.text.strip()})
    del model
    stage(jid, "writing_transcript")
    save_transcript(jid, segments, info.language)
    for fmt in ["txt", "md", "json", "srt", "vtt"]:
        (work / f"transcript.{fmt}").write_text(media.transcript_export(segments, fmt))
    return [f"transcript.{fmt}" for fmt in ["txt", "md", "json", "srt", "vtt"]]


def youtube_source(jid, payload, work):
    stage(jid, "checking_youtube_source")
    url = media.youtube_url(payload["source_url"])
    # Only a canonical YouTube video reaches yt-dlp. No user plugin/options,
    # login cookies, playlist URLs, private-network URLs or redirects supplied.
    from yt_dlp import YoutubeDL
    opts = {"quiet": True, "no_warnings": True, "noplaylist": True, "socket_timeout": 15,
            "skip_download": True, "cachedir": False, "extractor_retries": 1, "retries": 1}
    try:
        with YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
        if not info or not info.get("duration") or info["duration"] > media.MAX_DURATION or info.get("is_live"):
            raise Blocked("Source must be a non-live video under 120 minutes")
    except Blocked:
        raise
    except Exception as e:
        raise Blocked("YouTube source unavailable through the public retrieval adapter. Upload authorized media instead.") from e
    stage(jid, "downloading_authorized_audio")
    try:
        run(jid, [sys.executable, "-m", "yt_dlp", "--ignore-config", "--no-playlist", "--no-progress",
                  "--max-filesize", "256M", "--socket-timeout", "15", "--retries", "1",
                  "--format", "bestaudio", "--output", "source.%(ext)s", "--", url], work, timeout=600)
    except RuntimeError as e:
        raise Blocked("YouTube audio could not be retrieved. Upload authorized media instead.") from e
    files = [p for p in work.glob("source.*") if p.suffix not in {".part", ".ytdl"}]
    if len(files) != 1 or files[0].stat().st_size > media.MAX_UPLOAD:
        raise Blocked("Audio unavailable or exceeds upload limit")
    media.probe(files[0])
    (work / "source.json").write_text(json.dumps({"url": url, "title": info.get("title"), "video_id": info.get("id"),
                                                "retrieved_at": time.time(), "method": "authorized_audio_asr"}, indent=2))
    return files[0]


def text_video(jid, payload, work):
    stage(jid, "synthesizing_narration")
    script = payload["text"].strip()
    (work / "script.txt").write_text(script)
    # Text is data in a file, never part of a shell/filter expression.
    run(jid, ["espeak-ng", "-s", "145", "-w", "narration.wav", "-f", "script.txt"], work)
    duration, _ = media.probe(work / "narration.wav")
    if duration <= 0:
        raise RuntimeError("Narration produced no audio")
    portrait = payload["aspect"] == "portrait"
    w, h = (720, 1280) if portrait else (1280, 720)
    chunks = textwrap.wrap(script, width=100, break_long_words=False, replace_whitespace=True)
    total = sum(len(t) for t in chunks)
    lines = []
    start = 0
    for text in chunks:
        end = min(duration, start + duration * len(text) / total)
        # Subtitle timings here are estimated from text length, not forced alignment.
        clean = text.replace("\\", " ").replace("{", "(").replace("}", ")")
        wrapped = r"\N".join(textwrap.wrap(clean, width=27 if portrait else 48))
        def ts(v):
            return f"{int(v)//3600}:{int(v)//60%60:02}:{int(v)%60:02}.{int(v*100)%100:02}"
        lines.append(f"Dialogue: 0,{ts(start)},{ts(end)},Default,,0,0,0,,{wrapped}")
        start = end
    (work / "captions.ass").write_text(
        f"[Script Info]\nScriptType: v4.00+\nPlayResX: {w}\nPlayResY: {h}\n"
        "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        "Style: Default,DejaVu Sans,38,&H00FFFFFF,&H00FFFFFF,&H0010182B,&H0010182B,0,0,0,0,100,100,0,0,1,1,0,5,50,50,50,1\n"
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n" + "\n".join(lines))
    stage(jid, "rendering_video")
    encoders = subprocess.run([media.FFMPEG, "-hide_banner", "-encoders"], capture_output=True, text=True, timeout=10, check=True).stdout
    codec = ["-c:v", "libx264", "-preset", "veryfast"] if "libx264" in encoders else ["-c:v", "libopenh264", "-b:v", "1500k"]
    run(jid, [media.FFMPEG, "-nostdin", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c=0x10233f:s={w}x{h}:r=24",
              "-i", "narration.wav", "-vf", "ass=captions.ass", *codec, "-threads", "2",
              "-pix_fmt", "yuv420p", "-c:a", "aac", "-t", str(duration), "-movflags", "+faststart", "video.mp4"], work, timeout=900)
    media.probe(work / "video.mp4")
    (work / "render.json").write_text(json.dumps({"title": payload["title"], "duration": duration, "width": w, "height": h,
                                               "renderer": "ffmpeg_text_narration", "caption_timing": "estimated_text_length"}, indent=2))
    return ["video.mp4", "narration.wav", "script.txt", "captions.ass", "render.json"]


def claim(owner):
    now = time.time()
    with db.conn() as c:
        c.execute("BEGIN IMMEDIATE")
        c.execute("UPDATE media_jobs SET status='queued',stage='recovering',owner=NULL WHERE status='running' AND lease_until<?", (now,))
        row = c.execute("SELECT * FROM media_jobs WHERE status='queued' AND cancel_requested=0 ORDER BY created_at LIMIT 1").fetchone()
        if not row:
            return None
        c.execute("UPDATE media_jobs SET status='running',owner=?,lease_until=?,updated_at=?,attempt=attempt+1 WHERE id=?", (owner, now + 60, now, row["id"]))
        return dict(row)


def execute(row, owner):
    jid = row["id"]
    work = media.ROOT / jid
    work.mkdir(exist_ok=True, mode=0o700)
    payload = json.loads(row["payload"])
    try:
        if row["kind"] == "text_video":
            artifacts = text_video(jid, payload, work)
        else:
            source = youtube_source(jid, payload, work) if row["kind"] == "youtube_transcribe" else Path(media.asset_record(payload["asset_id"], row["project_key"])["path"])
            artifacts = transcribe(jid, source, work, payload.get("language"))
            if row["kind"] == "youtube_transcribe":
                artifacts.append("source.json")
        check_cancel(jid)
        with db.conn() as c:
            c.execute("UPDATE media_jobs SET status='succeeded',stage='complete',artifacts=?,error=NULL,updated_at=?,lease_until=NULL WHERE id=? AND owner=?",
                      (json.dumps(artifacts), time.time(), jid, owner))
    except Exception as e:
        status = "cancelled" if isinstance(e, Cancelled) else "blocked" if isinstance(e, Blocked) else "failed"
        with db.conn() as c:
            c.execute("UPDATE media_jobs SET status=?,stage=?,error=?,updated_at=?,lease_until=NULL WHERE id=? AND owner=?",
                      (status, status, str(e)[:1500], time.time(), jid, owner))


def main():
    db.init()
    media.init()
    lock = (media.ROOT / "worker.lock").open("w")
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    owner = uuid.uuid4().hex
    def heartbeat():
        while True:
            (media.ROOT / "worker-heartbeat").touch()
            with db.conn() as c:
                c.execute("UPDATE media_jobs SET lease_until=?,updated_at=? WHERE owner=? AND status='running'", (time.time() + 60, time.time(), owner))
            time.sleep(10)
    threading.Thread(target=heartbeat, daemon=True).start()
    while True:
        row = claim(owner)
        if row:
            execute(row, owner)
        else:
            time.sleep(1)


if __name__ == "__main__":
    main()
