import json
import subprocess
import time

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from app import auth, db, media, media_worker


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB", str(tmp_path / "test.db"))
    monkeypatch.setattr(media, "ROOT", tmp_path / "media")
    db.init(); media.init()
    db.upsert_project("alpha"); db.upsert_project("beta")
    app = FastAPI()
    app.include_router(media.api)
    app.add_middleware(auth.AuthMiddleware)
    with TestClient(app) as c:
        c.cookies.set(auth.SESSION_COOKIE, auth.create_session())
        yield c


def enqueue(client, **extra):
    data = {"project_key": "alpha", "kind": "text_video", "text": "Hello world.", "request_key": "test-key-123"}
    data.update(extra)
    return client.post("/media/jobs", json=data)


def test_auth_and_project_scope(client):
    job = enqueue(client).json()
    assert client.get("/media/jobs?project_key=beta").json() == []
    assert client.post(f'/media/jobs/{job["id"]}/cancel?project_key=beta').status_code == 404
    client.cookies.clear()
    assert client.get("/media/jobs?project_key=alpha").status_code == 401


def test_idempotency_and_conflicting_replay(client):
    one = enqueue(client)
    two = enqueue(client)
    assert one.status_code == two.status_code == 201
    assert one.json()["id"] == two.json()["id"]
    assert enqueue(client, text="Changed input").status_code == 409
    assert len(client.get("/media/jobs?project_key=alpha").json()) == 1


def test_cancel_retry_and_claim_recovery(client):
    jid = enqueue(client).json()["id"]
    assert client.post(f"/media/jobs/{jid}/cancel?project_key=alpha").status_code == 200
    assert media_worker.claim("a") is None
    assert client.post(f"/media/jobs/{jid}/retry?project_key=alpha").status_code == 200
    assert media_worker.claim("a")["id"] == jid
    assert media_worker.claim("b") is None
    with db.conn() as c:
        c.execute("UPDATE media_jobs SET lease_until=? WHERE id=?", (time.time() - 1, jid))
    assert media_worker.claim("b")["id"] == jid


@pytest.mark.parametrize("url", ["http://youtube.com/watch?v=abcdefghijk", "https://127.0.0.1/a", "https://youtube.com.evil.test/watch?v=abcdefghijk", "https://user@youtube.com/watch?v=abcdefghijk", "https://youtube.com/playlist?list=abc", "https://youtu.be/../../secret"])
def test_youtube_rejects_non_video_and_internal_urls(client, url):
    assert enqueue(client, kind="youtube_transcribe", source_url=url, authorized_source=True).status_code == 422


def test_youtube_requires_authorization_and_normalizes(client):
    url = "https://youtu.be/abcdefghijk?t=12"
    assert enqueue(client, kind="youtube_transcribe", source_url=url).status_code == 422
    assert media.youtube_url(url) == "https://www.youtube.com/watch?v=abcdefghijk"


def test_upload_probe_and_wrong_project_asset(client, tmp_path):
    audio = tmp_path / "tone.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.2", str(audio)], check=True)
    r = client.post("/media/assets", data={"project_key": "alpha"}, files={"file": ("tone.wav", audio.read_bytes(), "audio/wav")})
    assert r.status_code == 201
    aid = r.json()["id"]
    assert enqueue(client, project_key="beta", kind="transcribe", asset_id=aid).status_code == 404
    assert enqueue(client, kind="transcribe", asset_id=aid).status_code == 201
    r = client.post("/media/assets", data={"project_key": "alpha"}, files={"file": ("bad.mp4", b"not media", "video/mp4")})
    assert r.status_code == 422
    assert len(list(media.ROOT.glob("*.media"))) == 1


def test_upload_size_limit_cleans_partial_file(client, monkeypatch):
    monkeypatch.setattr(media, "MAX_UPLOAD", 3)
    r = client.post("/media/assets", data={"project_key": "alpha"}, files={"file": ("large.mp4", b"1234")})
    assert r.status_code == 413
    assert not list(media.ROOT.glob("*.media"))


def test_transcript_revision_conflict_and_exports(client):
    jid = enqueue(client).json()["id"]
    segments = [{"start": .5, "end": 2.5, "text": "Original"}]
    media_worker.save_transcript(jid, segments, "en")
    segments[0]["text"] = "Corrected"
    url = f"/media/jobs/{jid}/transcript?project_key=alpha"
    assert client.put(url, json={"revision": 1, "segments": segments}).json() == {"revision": 2}
    assert client.put(url, json={"revision": 1, "segments": segments}).status_code == 409
    srt = client.get(f"/media/jobs/{jid}/export/srt?project_key=alpha").text
    assert "00:00:00,500 --> 00:00:02,500" in srt and "Corrected" in srt
    with db.conn() as c:
        assert c.execute("SELECT COUNT(*) FROM media_transcript_revisions WHERE job_id=?", (jid,)).fetchone()[0] == 2
    segments[0]["end"] = .1
    assert client.put(url, json={"revision": 2, "segments": segments}).status_code == 422


def test_real_text_video_render_and_artifact_gate(client):
    jid = enqueue(client, text="A short local video test.").json()["id"]
    row = media_worker.claim("test")
    assert client.get(f"/media/jobs/{jid}/artifacts/video.mp4?project_key=alpha").status_code == 404
    media_worker.execute(row, "test")
    job = client.get("/media/jobs?project_key=alpha").json()[0]
    assert job["status"] == "succeeded", job["error"]
    r = client.get(f"/media/jobs/{jid}/artifacts/video.mp4?project_key=alpha")
    assert r.status_code == 200 and len(r.content) > 1000
    assert client.get(f"/media/jobs/{jid}/artifacts/process.log?project_key=alpha").status_code == 404
    assert client.get(f"/media/jobs/{jid}/artifacts/video.mp4?project_key=beta").status_code == 404
