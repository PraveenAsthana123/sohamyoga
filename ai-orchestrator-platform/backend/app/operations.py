"""Project-scoped content handoffs and manually recorded customer follow-ups.

No external account access or publication is implied. Existing SohamYoga
publishing remains in its own authenticated application.
"""
import io
import json
import time
import uuid
import zipfile
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from . import db, media

api = APIRouter(prefix="/operations", tags=["operations"])
CHANNELS = ["LinkedIn", "Facebook", "Instagram", "YouTube", "TikTok", "Pinterest", "Reddit", "WhatsApp Business",
            "Telegram", "Threads", "Snapchat", "Discord", "Twitch", "Medium", "Substack", "Quora", "Tumblr",
            "Mastodon", "Bluesky", "GitHub", "GitLab", "Stack Overflow", "Google Business Profile", "Yelp",
            "Tripadvisor", "Trustpilot", "Vimeo", "Dailymotion", "Spotify", "Apple Podcasts", "SoundCloud", "Patreon",
            "Kijiji", "Kijiji Autos", "Craigslist", "Facebook Marketplace", "Used.ca", "LesPAC", "eBay",
            "AutoTrader.ca", "Rentfaster.ca", "Rentals.ca", "Gumtree", "OLX", "dubizzle"]
EDITORS = ["CapCut", "Doodly", "After Effects", "Premiere Pro", "DaVinci Resolve", "Blender", "Kdenlive", "Shotcut", "Higgsfield", "ComfyUI"]


def init():
    with db.conn() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS content_handoffs(
          id TEXT PRIMARY KEY,project_key TEXT NOT NULL,title TEXT NOT NULL,
          body TEXT NOT NULL,kind TEXT NOT NULL,channel TEXT NOT NULL,
          tags TEXT NOT NULL,asset_job_id TEXT,owner TEXT NOT NULL,due_at REAL,
          status TEXT NOT NULL DEFAULT 'draft',revision INTEGER NOT NULL DEFAULT 1,
          receipt_url TEXT,created_at REAL NOT NULL,updated_at REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS customer_followups(
          id TEXT PRIMARY KEY,project_key TEXT NOT NULL,channel TEXT NOT NULL,
          contact TEXT NOT NULL,message TEXT NOT NULL,source_url TEXT,
          owner TEXT NOT NULL,due_at REAL NOT NULL,status TEXT NOT NULL DEFAULT 'open',
          response_note TEXT NOT NULL DEFAULT '',created_at REAL NOT NULL,updated_at REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS operations_events(
          id INTEGER PRIMARY KEY AUTOINCREMENT,project_key TEXT NOT NULL,
          object_id TEXT NOT NULL,event TEXT NOT NULL,created_at REAL NOT NULL);
        """)


def event(c, project, oid, action):
    c.execute("INSERT INTO operations_events(project_key,object_id,event,created_at) VALUES(?,?,?,?)", (project, oid, action, time.time()))


def external_url(value):
    if not value:
        return
    u = urlparse(value)
    if u.scheme != "https" or not u.hostname or u.username or u.password:
        raise HTTPException(422, "Use an HTTPS source or receipt URL")


@api.get("/catalog")
def catalog():
    return {"channels": CHANNELS, "editors": EDITORS,
            "publishing_mode": "manual_handoff", "inbox_mode": "manual_entry",
            "note": "This workspace prepares handoffs and tracks follow-ups. External posting, inbox synchronization and vendor editing APIs are not connected here."}


@api.get("/overview")
def overview(project_key: str):
    media.project_exists(project_key)
    with db.conn() as c:
        handoffs = [dict(r) for r in c.execute("SELECT * FROM content_handoffs WHERE project_key=? ORDER BY created_at DESC LIMIT 200", (project_key,))]
        followups = [dict(r) for r in c.execute("SELECT * FROM customer_followups WHERE project_key=? ORDER BY due_at LIMIT 200", (project_key,))]
        alerts = [dict(r) for r in c.execute("SELECT id,kind,status,error FROM media_jobs WHERE project_key=? AND status IN ('failed','blocked') ORDER BY updated_at DESC LIMIT 20", (project_key,))]
        counts = dict(c.execute("SELECT status,COUNT(*) FROM content_handoffs WHERE project_key=? GROUP BY status", (project_key,)).fetchall())
        overdue = c.execute("SELECT COUNT(*) FROM customer_followups WHERE project_key=? AND status='open' AND due_at<?", (project_key, time.time())).fetchone()[0]
    for h in handoffs:
        h["tags"] = json.loads(h["tags"])
    return {"handoffs": handoffs, "followups": followups, "media_alerts": alerts, "counts": counts, "overdue": overdue,
            "refreshed_at": time.time(), "source": "local_records_not_external_sync"}


class HandoffInput(BaseModel):
    project_key: str
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=20000)
    kind: str = "post"
    channel: str
    tags: list[str] = Field(default_factory=list, max_length=30)
    asset_job_id: str | None = None
    owner: str = Field(default="", max_length=150)
    due_at: float | None = Field(default=None, ge=0, allow_inf_nan=False)


@api.post("/handoffs", status_code=201)
def create_handoff(req: HandoffInput):
    media.project_exists(req.project_key)
    if req.kind not in {"post", "listing", "reel", "editor", "lesson"} or req.channel not in CHANNELS + EDITORS:
        raise HTTPException(422, "Choose a supported destination and content type")
    if any(len(t) > 100 for t in req.tags):
        raise HTTPException(422, "Tags must be under 100 characters")
    if req.asset_job_id:
        job = media.get_job(req.asset_job_id, req.project_key)
        if job["status"] != "succeeded":
            raise HTTPException(409, "Attach only a completed media job")
    oid = uuid.uuid4().hex
    now = time.time()
    with db.conn() as c:
        c.execute("INSERT INTO content_handoffs(id,project_key,title,body,kind,channel,tags,asset_job_id,owner,due_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                  (oid, req.project_key, req.title.strip(), req.body, req.kind, req.channel, json.dumps(req.tags), req.asset_job_id, req.owner, req.due_at, now, now))
        event(c, req.project_key, oid, "draft_created")
    return {"id": oid}


class Transition(BaseModel):
    revision: int = Field(ge=1)
    action: str
    receipt_url: str | None = Field(default=None, max_length=2000)


@api.post("/handoffs/{oid}/transition")
def transition(oid: str, req: Transition, project_key: str):
    external_url(req.receipt_url)
    expected, target = {"approve": ("draft", "approved"), "reopen": ("approved", "draft"), "record_completion": ("approved", "manually_completed")}.get(req.action, (None, None))
    if expected is None:
        raise HTTPException(422, "Unsupported transition")
    if req.action == "record_completion" and not req.receipt_url:
        raise HTTPException(422, "A receipt or published URL is required")
    with db.conn() as c:
        cur = c.execute("UPDATE content_handoffs SET status=?,receipt_url=?,revision=revision+1,updated_at=? WHERE id=? AND project_key=? AND status=? AND revision=?",
                        (target, req.receipt_url, time.time(), oid, project_key, expected, req.revision))
        if not cur.rowcount:
            raise HTTPException(409, "Record changed or transition is not allowed")
        event(c, project_key, oid, req.action)
    return {"status": target, "revision": req.revision + 1}


@api.get("/handoffs/{oid}/package")
def package(oid: str, project_key: str):
    with db.conn() as c:
        row = c.execute("SELECT * FROM content_handoffs WHERE id=? AND project_key=?", (oid, project_key)).fetchone()
    if not row:
        raise HTTPException(404, "Handoff not found")
    data = dict(row)
    if data["status"] not in {"approved", "manually_completed"}:
        raise HTTPException(409, "Approve the handoff before exporting")
    files = []
    if data["asset_job_id"]:
        job = media.get_job(data["asset_job_id"], project_key)
        files = json.loads(job["artifacts"]) if job["status"] == "succeeded" else []
    data["tags"] = json.loads(data["tags"])
    data["artifact_urls"] = [f"/api/media/jobs/{data['asset_job_id']}/artifacts/{name}?project_key={project_key}" for name in files]
    # Lightweight package references private downloadable artifacts; no huge
    # media copies in memory, and no vendor-proprietary project file claims.
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("manifest.json", json.dumps(data, ensure_ascii=False, indent=2))
        z.writestr("content.txt", data["title"] + "\n\n" + data["body"])
        z.writestr("README.txt", "Manual editorial handoff. Download linked artifacts from the authenticated portal. Complete the edit/post in the destination tool, then record the external result URL. No publication has been performed by this export.")
    return Response(buf.getvalue(), media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="handoff-{oid}.zip"'})


class FollowupInput(BaseModel):
    project_key: str
    channel: str
    contact: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=10000)
    source_url: str | None = Field(default=None, max_length=2000)
    owner: str = Field(min_length=1, max_length=150)
    due_at: float = Field(ge=0, allow_inf_nan=False)


@api.post("/followups", status_code=201)
def create_followup(req: FollowupInput):
    media.project_exists(req.project_key)
    if req.channel not in CHANNELS:
        raise HTTPException(422, "Unknown channel")
    external_url(req.source_url)
    oid = uuid.uuid4().hex
    now = time.time()
    with db.conn() as c:
        c.execute("INSERT INTO customer_followups(id,project_key,channel,contact,message,source_url,owner,due_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
                  (oid, req.project_key, req.channel, req.contact, req.message, req.source_url, req.owner, req.due_at, now, now))
        event(c, req.project_key, oid, "manual_inquiry_recorded")
    return {"id": oid}


class ResolveInput(BaseModel):
    response_note: str = Field(min_length=1, max_length=10000)


@api.post("/followups/{oid}/resolve")
def resolve_followup(oid: str, req: ResolveInput, project_key: str):
    with db.conn() as c:
        cur = c.execute("UPDATE customer_followups SET status='resolved',response_note=?,updated_at=? WHERE id=? AND project_key=? AND status='open'",
                        (req.response_note, time.time(), oid, project_key))
        if not cur.rowcount:
            raise HTTPException(409, "Follow-up not open or not in this project")
        event(c, project_key, oid, "manual_resolution_recorded")
    return {"ok": True, "message": "Resolution recorded; no external message was sent"}
