"""Private media assets and durable jobs for the single-operator portal.

The worker runs separately in the canonical environment. HTTP requests only
validate/enqueue work; model loading and FFmpeg never block the API process.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
import uuid
from urllib.parse import parse_qs, urlparse

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from . import config, db

api = APIRouter(prefix="/media", tags=["media"])
ROOT = Path(os.environ.get("ORCH_MEDIA_DIR", str(Path(config.DB_PATH).parent / "media")))
FFMPEG = os.environ.get("ORCH_FFMPEG", "/usr/bin/ffmpeg")
FFPROBE = os.environ.get("ORCH_FFPROBE", "/usr/bin/ffprobe")
MAX_UPLOAD = 256 * 1024 * 1024
MAX_DURATION = 7200
TERMINAL = {"succeeded", "failed", "cancelled", "blocked"}


def init():
    ROOT.mkdir(parents=True, exist_ok=True, mode=0o700)
    with db.conn() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS media_assets (
          id TEXT PRIMARY KEY, project_key TEXT NOT NULL, filename TEXT NOT NULL,
          path TEXT NOT NULL, sha256 TEXT NOT NULL, size INTEGER NOT NULL,
          duration REAL, kind TEXT NOT NULL, source TEXT, created_at REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS media_jobs (
          id TEXT PRIMARY KEY, project_key TEXT NOT NULL, kind TEXT NOT NULL,
          status TEXT NOT NULL, stage TEXT NOT NULL, payload TEXT NOT NULL,
          error TEXT, artifacts TEXT NOT NULL DEFAULT '[]', created_at REAL NOT NULL,
          updated_at REAL NOT NULL, owner TEXT, lease_until REAL,
          cancel_requested INTEGER NOT NULL DEFAULT 0, attempt INTEGER NOT NULL DEFAULT 0,
          request_key TEXT, UNIQUE(project_key, request_key));
        CREATE TABLE IF NOT EXISTS media_transcripts (
          job_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, segments TEXT NOT NULL,
          language TEXT, updated_at REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS media_transcript_revisions (
          job_id TEXT NOT NULL, revision INTEGER NOT NULL, segments TEXT NOT NULL,
          created_at REAL NOT NULL, PRIMARY KEY(job_id,revision));
        """)


def project_exists(key):
    with db.conn() as c:
        if not c.execute("SELECT 1 FROM projects WHERE key=?", (key,)).fetchone():
            raise HTTPException(404, "Project not found")


def asset_record(asset_id, project):
    with db.conn() as c:
        row = c.execute("SELECT * FROM media_assets WHERE id=? AND project_key=?", (asset_id, project)).fetchone()
    if not row:
        raise HTTPException(404, "Media asset not found in this project")
    return dict(row)


def probe(path):
    try:
        result = subprocess.run([FFPROBE, "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)],
                                capture_output=True, timeout=20, check=True)
        data = json.loads(result.stdout)
        streams = data.get("streams", [])
        if not any(s.get("codec_type") in {"audio", "video"} for s in streams):
            raise ValueError("No audio or video stream")
        duration = float(data.get("format", {}).get("duration", 0))
        if duration > MAX_DURATION:
            raise ValueError("Maximum supported duration is 120 minutes")
        if duration < 0:
            raise ValueError("Invalid media duration")
        return duration, "video" if any(s.get("codec_type") == "video" for s in streams) else "audio"
    except (subprocess.SubprocessError, ValueError, KeyError) as e:
        raise HTTPException(422, "Unsupported, corrupt or over-duration media") from e


def register_asset(path, project, filename, source=None):
    duration, kind = probe(path)
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    aid = uuid.uuid4().hex
    with db.conn() as c:
        c.execute("INSERT INTO media_assets VALUES(?,?,?,?,?,?,?,?,?,?)", (
            aid, project, filename, str(path), digest.hexdigest(), Path(path).stat().st_size,
            duration, kind, source, time.time()))
    return aid


@api.get("/capabilities")
def capabilities():
    with db.conn() as c:
        row = c.execute("SELECT MAX(updated_at) AS seen FROM media_jobs WHERE owner IS NOT NULL").fetchone()
    # A worker heartbeat file is written atomically; stale means not ready.
    heartbeat = ROOT / "worker-heartbeat"
    return {"ffmpeg": bool(shutil.which(FFMPEG)), "ffprobe": bool(shutil.which(FFPROBE)),
            "tts": bool(shutil.which("espeak-ng")), "max_upload_mb": MAX_UPLOAD // 1024 // 1024,
            "worker_ready": heartbeat.exists() and time.time() - heartbeat.stat().st_mtime < 30,
            "last_job_activity": row["seen"], "mode": "single_operator_project_scoped"}


@api.post("/assets", status_code=201)
async def upload(project_key: str = Form(...), file: UploadFile = File(...)):
    project_exists(project_key)
    target = ROOT / (uuid.uuid4().hex + ".media")
    total = 0
    try:
        with target.open("xb") as out:
            os.chmod(target, 0o600)
            while chunk := await file.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_UPLOAD:
                    raise HTTPException(413, "Upload exceeds 256 MB")
                out.write(chunk)
        if not total:
            raise HTTPException(422, "Empty upload")
        # Offload probing and hashing so uploads do not stall chat websockets.
        from starlette.concurrency import run_in_threadpool
        aid = await run_in_threadpool(register_asset, target, project_key, Path(file.filename or "media").name[:200])
        return {"id": aid}
    except Exception:
        target.unlink(missing_ok=True)
        raise
    finally:
        await file.close()


@api.get("/assets")
def assets(project_key: str):
    project_exists(project_key)
    with db.conn() as c:
        return [dict(r) for r in c.execute("SELECT id,project_key,filename,size,duration,kind,source,created_at FROM media_assets WHERE project_key=? ORDER BY created_at DESC LIMIT 100", (project_key,))]


def youtube_url(value):
    u = urlparse(value)
    if u.scheme != "https" or u.username or u.password or u.port not in (None, 443):
        raise ValueError("Use an HTTPS YouTube video URL")
    if u.hostname == "youtu.be":
        vid = u.path.strip("/")
    elif u.hostname in {"youtube.com", "www.youtube.com", "m.youtube.com"}:
        vid = parse_qs(u.query).get("v", [""])[0] if u.path == "/watch" else u.path.split("/")[-1] if u.path.startswith(("/shorts/", "/embed/")) else ""
    else:
        raise ValueError("Only YouTube video URLs are supported")
    if not re.fullmatch(r"[A-Za-z0-9_-]{11}", vid):
        raise ValueError("Invalid YouTube video ID")
    return "https://www.youtube.com/watch?v=" + vid


class JobRequest(BaseModel):
    project_key: str
    kind: str
    asset_id: str | None = None
    source_url: str | None = None
    authorized_source: bool = False
    text: str = Field(default="", max_length=6000)
    title: str = Field(default="", max_length=150)
    language: str | None = Field(default=None, pattern=r"^[a-z]{2,3}$")
    aspect: str = "landscape"
    request_key: str = Field(min_length=8, max_length=100)


@api.post("/jobs", status_code=201)
def create_job(req: JobRequest):
    project_exists(req.project_key)
    if req.kind not in {"transcribe", "youtube_transcribe", "text_video"}:
        raise HTTPException(422, "Unsupported media workflow")
    if req.kind == "transcribe":
        asset_record(req.asset_id, req.project_key)
    if req.kind == "youtube_transcribe":
        if not req.authorized_source:
            raise HTTPException(422, "Confirm you are authorized to retrieve and transcribe this source")
        try:
            req.source_url = youtube_url(req.source_url or "")
        except ValueError as e:
            raise HTTPException(422, str(e)) from e
    if req.kind == "text_video" and (not req.text.strip() or req.aspect not in {"landscape", "portrait"}):
        raise HTTPException(422, "Script and valid aspect ratio required")
    payload = json.dumps(req.model_dump(), sort_keys=True)
    jid = uuid.uuid4().hex
    now = time.time()
    with db.conn() as c:
        c.execute("INSERT OR IGNORE INTO media_jobs(id,project_key,kind,status,stage,payload,created_at,updated_at,request_key) VALUES(?,?,?,'queued','queued',?,?,?,?)",
                  (jid, req.project_key, req.kind, payload, now, now, req.request_key))
        row = c.execute("SELECT * FROM media_jobs WHERE project_key=? AND request_key=?", (req.project_key, req.request_key)).fetchone()
        if row["payload"] != payload:
            raise HTTPException(409, "Idempotency key already used with different input")
    return public_job(row)


def public_job(row):
    d = dict(row)
    for key in ("payload", "owner", "lease_until", "request_key"):
        d.pop(key, None)
    d["artifacts"] = json.loads(d["artifacts"])
    return d


def get_job(jid, project):
    with db.conn() as c:
        row = c.execute("SELECT * FROM media_jobs WHERE id=? AND project_key=?", (jid, project)).fetchone()
    if not row:
        raise HTTPException(404, "Job not found in this project")
    return row


@api.get("/jobs")
def jobs(project_key: str):
    project_exists(project_key)
    with db.conn() as c:
        return [public_job(r) for r in c.execute("SELECT * FROM media_jobs WHERE project_key=? ORDER BY created_at DESC LIMIT 100", (project_key,))]


@api.post("/jobs/{jid}/{action}")
def control(jid: str, action: str, project_key: str):
    get_job(jid, project_key)
    with db.conn() as c:
        if action == "cancel":
            cur = c.execute("UPDATE media_jobs SET cancel_requested=1,status=CASE WHEN status='queued' THEN 'cancelled' ELSE status END,updated_at=? WHERE id=? AND status IN ('queued','running')", (time.time(), jid))
        elif action == "retry":
            cur = c.execute("UPDATE media_jobs SET status='queued',stage='queued',error=NULL,cancel_requested=0,owner=NULL,lease_until=NULL,updated_at=? WHERE id=? AND status IN ('failed','blocked','cancelled')", (time.time(), jid))
        else:
            raise HTTPException(404, "Unknown action")
        if not cur.rowcount:
            raise HTTPException(409, "Job state does not allow this action")
    return {"ok": True}


def stamp(seconds, sep=","):
    ms = max(0, round(seconds * 1000))
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02}{sep}{ms % 1000:03}"


def transcript_export(segments, fmt):
    if fmt == "json":
        return json.dumps(segments, ensure_ascii=False, indent=2)
    if fmt in {"txt", "md"}:
        return "\n".join(s["text"] for s in segments)
    return ("WEBVTT\n\n" if fmt == "vtt" else "") + "\n\n".join(
        (f"{i + 1}\n" if fmt == "srt" else "") + f"{stamp(s['start'], '.' if fmt == 'vtt' else ',')} --> {stamp(s['end'], '.' if fmt == 'vtt' else ',')}\n{s['text']}"
        for i, s in enumerate(segments)) + "\n"


@api.get("/jobs/{jid}/transcript")
def transcript(jid: str, project_key: str):
    get_job(jid, project_key)
    with db.conn() as c:
        r = c.execute("SELECT * FROM media_transcripts WHERE job_id=?", (jid,)).fetchone()
    if not r:
        raise HTTPException(404, "Transcript not available")
    return {**dict(r), "segments": json.loads(r["segments"])}


class Segment(BaseModel):
    start: float = Field(ge=0, allow_inf_nan=False)
    end: float = Field(gt=0, allow_inf_nan=False)
    text: str = Field(max_length=5000)


class TranscriptEdit(BaseModel):
    revision: int = Field(ge=1)
    segments: list[Segment] = Field(max_length=20000)


@api.put("/jobs/{jid}/transcript")
def edit_transcript(jid: str, req: TranscriptEdit, project_key: str):
    get_job(jid, project_key)
    prev = 0
    for s in req.segments:
        if s.start < prev or s.end <= s.start or s.end > MAX_DURATION:
            raise HTTPException(422, "Segments must be ordered with valid start/end times")
        prev = s.start
    segments = json.dumps([s.model_dump() for s in req.segments], ensure_ascii=False)
    with db.conn() as c:
        cur = c.execute("UPDATE media_transcripts SET segments=?,revision=revision+1,updated_at=? WHERE job_id=? AND revision=?", (segments, time.time(), jid, req.revision))
        if not cur.rowcount:
            raise HTTPException(409, "Transcript changed; reload before saving")
        c.execute("INSERT INTO media_transcript_revisions VALUES(?,?,?,?)", (jid, req.revision + 1, segments, time.time()))
    return {"revision": req.revision + 1}


@api.get("/jobs/{jid}/export/{fmt}")
def export_transcript(jid: str, fmt: str, project_key: str):
    if fmt not in {"txt", "md", "json", "srt", "vtt"}:
        raise HTTPException(404, "Unsupported export")
    from fastapi.responses import Response
    t = transcript(jid, project_key)
    return Response(transcript_export(t["segments"], fmt), media_type="text/plain; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="transcript-r{t["revision"]}.{fmt}"'})


@api.get("/jobs/{jid}/artifacts/{filename}")
def artifact(jid: str, filename: str, project_key: str):
    row = get_job(jid, project_key)
    if row["status"] != "succeeded" or filename not in json.loads(row["artifacts"]):
        raise HTTPException(404, "Artifact not available")
    path = ROOT / jid / filename
    if Path(filename).name != filename or not path.is_file():
        raise HTTPException(404, "Artifact missing")
    return FileResponse(path, filename=filename)
