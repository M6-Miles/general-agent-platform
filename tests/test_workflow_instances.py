from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.main import app
from app.models import Run, WorkflowInstance


def test_workflow_instance_is_bound_to_run_and_can_cancel():
    with TestClient(app) as client:
        response = client.post('/api/v1/auth/login', json={'email': 'admin@example.com', 'password': 'ChangeMe123456!'})
        if response.status_code == 401:
            from scripts.seed import main
            main()
            response = client.post('/api/v1/auth/login', json={'email': 'admin@example.com', 'password': 'ChangeMe123456!'})
        login = response.json()['data']
        headers = {'Authorization': f"Bearer {login['access_token']}"}
        agent = client.post('/api/v1/agents', headers=headers, json={'name': 'workflow-instance-test', 'definition': {'workflow': [{'key': 'prepare', 'type': 'prepare'}]}}).json()['data']
        assert client.post(f"/api/v1/agents/{agent['id']}/publish", headers=headers).status_code == 201
        created = client.post('/api/v1/workflow-instances', headers=headers, json={'workflow_id': agent['id'], 'input': {'prompt': 'test'}})
        assert created.status_code == 202
        instance = created.json()['data']
        assert instance['run_id']
        detail = client.get(f"/api/v1/workflow-instances/{instance['id']}", headers=headers)
        assert detail.status_code == 200
        assert detail.json()['data']['run_id'] == instance['run_id']
        with SessionLocal() as db:
            assert db.query(WorkflowInstance).filter(
                WorkflowInstance.run_id == instance['run_id']
            ).count() == 1
        cancelled = client.post(f"/api/v1/workflow-instances/{instance['id']}/cancel", headers=headers)
        assert cancelled.status_code == 200
        assert cancelled.json()['data']['status'] == 'cancelled'
        with SessionLocal() as db:
            run = db.get(Run, instance['run_id'])
            assert run.status == 'cancelled'
            assert run.finished_at is not None


def test_workflow_instance_detail_reflects_run_status_and_rejects_terminal_cancel():
    with TestClient(app) as client:
        response = client.post('/api/v1/auth/login', json={'email': 'admin@example.com', 'password': 'ChangeMe123456!'})
        if response.status_code == 401:
            from scripts.seed import main
            main()
            response = client.post('/api/v1/auth/login', json={'email': 'admin@example.com', 'password': 'ChangeMe123456!'})
        headers = {'Authorization': f"Bearer {response.json()['data']['access_token']}"}
        agent = client.post('/api/v1/agents', headers=headers, json={'name': 'workflow-sync-test', 'definition': {'workflow': [{'key': 'prepare', 'type': 'prepare'}]}}).json()['data']
        assert client.post(f"/api/v1/agents/{agent['id']}/publish", headers=headers).status_code == 201
        created = client.post('/api/v1/workflow-instances', headers=headers, json={'workflow_id': agent['id'], 'input': {'prompt': 'sync'}})
        instance = created.json()['data']
    with SessionLocal() as db:
        run = db.get(Run, instance['run_id'])
        run.status = 'completed'
        run.output_json = {'ok': True}
        db.commit()
    with TestClient(app) as client:
        detail = client.get(f"/api/v1/workflow-instances/{instance['id']}", headers=headers)
        assert detail.status_code == 200
        assert detail.json()['data']['status'] == 'completed'
        assert detail.json()['data']['output_json'] == {'ok': True}
        assert client.post(f"/api/v1/workflow-instances/{instance['id']}/cancel", headers=headers).status_code == 409
