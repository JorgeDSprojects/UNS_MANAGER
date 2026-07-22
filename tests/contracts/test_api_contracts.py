import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


EXPECTED_ASSET_CREATE_KEYS = {
    "id",
    "parent_id",
    "template_id",
    "asset_level",
    "name",
    "uns_path",
    "descriptive",
    "analytical",
    "scada_available",
    "is_active",
    "created_at",
    "updated_at",
}


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
def seeded_enterprise_asset(db_conn):
    conn, loop = db_conn
    enterprise_id = loop.run_until_complete(
        conn.fetchval(
            """
            INSERT INTO uns_registry.assets (asset_level, name, uns_path)
            VALUES ('enterprise', 'ENT_CONTRACT', 'uns/v1/ENT_CONTRACT')
            RETURNING id
            """
        )
    )
    return str(enterprise_id)


def test_create_asset_contract_keys(api_client, seeded_enterprise_asset):
    response = api_client.post(
        "/api/v1/assets",
        json={
            "asset_level": "site",
            "name": "SITE_NW",
            "parent_id": seeded_enterprise_asset,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert set(body.keys()) == EXPECTED_ASSET_CREATE_KEYS


def test_invalid_asset_name_returns_400(api_client):
    response = api_client.post(
        "/api/v1/assets",
        json={"asset_level": "enterprise", "name": "bad-name"},
    )

    assert response.status_code == 400
    assert "^[A-Z0-9_]+$" in response.json()["detail"]
