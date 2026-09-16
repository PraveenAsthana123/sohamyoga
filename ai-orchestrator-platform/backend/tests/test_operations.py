import io
import time
import zipfile

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from app import auth, db, media, operations


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB", str(tmp_path / "test.db"))
    monkeypatch.setattr(media, "ROOT", tmp_path / "media")
    db.init(); media.init(); operations.init()
    db.upsert_project("alpha"); db.upsert_project("beta")
    app = FastAPI(); app.include_router(operations.api); app.add_middleware(auth.AuthMiddleware)
    with TestClient(app) as c:
        c.cookies.set(auth.SESSION_COOKIE, auth.create_session())
        yield c


def test_handoff_approval_export_and_receipt(client):
    r = client.post('/operations/handoffs', json={'project_key':'alpha','title':'Local listing','body':'Draft listing content','kind':'listing','channel':'Kijiji','tags':['yoga']})
    assert r.status_code == 201
    oid = r.json()['id']; path = f'/operations/handoffs/{oid}'
    assert client.get(path+'/package?project_key=alpha').status_code == 409
    assert client.post(path+'/transition?project_key=beta', json={'revision':1,'action':'approve'}).status_code == 409
    assert client.post(path+'/transition?project_key=alpha', json={'revision':1,'action':'approve'}).status_code == 200
    assert client.post(path+'/transition?project_key=alpha', json={'revision':1,'action':'approve'}).status_code == 409
    package = client.get(path+'/package?project_key=alpha')
    with zipfile.ZipFile(io.BytesIO(package.content)) as z:
        assert 'Draft listing content' in z.read('content.txt').decode()
        assert 'No publication' in z.read('README.txt').decode()
    assert client.post(path+'/transition?project_key=alpha', json={'revision':2,'action':'record_completion'}).status_code == 422
    assert client.post(path+'/transition?project_key=alpha', json={'revision':2,'action':'record_completion','receipt_url':'javascript:alert(1)'}).status_code == 422
    assert client.post(path+'/transition?project_key=alpha', json={'revision':2,'action':'record_completion','receipt_url':'https://example.com/result'}).json()['status'] == 'manually_completed'


def test_followup_overdue_resolution_and_scope(client):
    payload = {'project_key':'alpha','channel':'LinkedIn','contact':'Test contact','message':'Interested in lessons','owner':'Operator','due_at':time.time()-60}
    r = client.post('/operations/followups',json=payload)
    assert r.status_code == 201
    oid = r.json()['id']
    assert client.get('/operations/overview?project_key=alpha').json()['overdue'] == 1
    assert client.get('/operations/overview?project_key=beta').json()['followups'] == []
    assert client.post(f'/operations/followups/{oid}/resolve?project_key=beta', json={'response_note':'Handled'}).status_code == 409
    r = client.post(f'/operations/followups/{oid}/resolve?project_key=alpha', json={'response_note':'Called customer and answered question'})
    assert r.status_code == 200 and 'no external message' in r.json()['message']
    assert client.get('/operations/overview?project_key=alpha').json()['overdue'] == 0
    client.cookies.clear()
    assert client.get('/operations/overview?project_key=alpha').status_code == 401


def test_invalid_destination_rejected(client):
    r = client.post('/operations/handoffs',json={'project_key':'alpha','title':'x','body':'y','channel':'invented'})
    assert r.status_code == 422
