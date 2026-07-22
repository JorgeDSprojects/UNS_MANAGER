import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


def _service_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "services" / "uns-manager"


def _load_app():
    service_dir = _service_dir()
    service_dir_str = str(service_dir)
    if service_dir_str not in sys.path:
        sys.path.insert(0, service_dir_str)

    module = importlib.import_module("main")
    module = importlib.reload(module)
    return module.app


@pytest.fixture
def api_client(db_conn, monkeypatch):
    monkeypatch.setenv("POSTGRES_HOST", "localhost")
    monkeypatch.setenv("POSTGRES_PORT", "5432")
    monkeypatch.setenv("POSTGRES_USER", "postgres")
    monkeypatch.setenv("POSTGRES_PASSWORD", "postgres")
    monkeypatch.setenv("POSTGRES_DB", "galerna_platform")

    app = _load_app()
    with TestClient(app) as client:
        yield client


@pytest.fixture
def seeded_sync_runtime_state(db_conn):
    conn, loop = db_conn

    loop.run_until_complete(
        conn.execute(
            """
            INSERT INTO uns_registry.sync_runtime_state (
                service_name,
                mqtt_connected,
                last_sync_at,
                sync_lag_seconds,
                updated_at
            ) VALUES (
                'sync-service',
                true,
                now() - interval '5 seconds',
                5.0,
                now()
            )
            """
        )
    )


def test_status_contains_sync_fields(api_client):
    response = api_client.get("/api/v1/status")

    assert response.status_code == 200
    body = response.json()
    assert "sync_state" in body
    assert "mqtt_connected" in body
    assert "last_sync_at" in body
    assert "sync_lag_seconds" in body
    assert body["sync_state"] == "degraded"
    assert body["mqtt_connected"] is False
    assert body["last_sync_at"] is None
    assert body["sync_lag_seconds"] is None


def test_status_projects_sync_values(api_client, seeded_sync_runtime_state):
    response = api_client.get("/api/v1/status")

    assert response.status_code == 200
    body = response.json()
    assert body["sync_state"] == "healthy"
    assert body["mqtt_connected"] is True
    assert isinstance(body["last_sync_at"], str)
    assert body["sync_lag_seconds"] == 5.0
