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
def seeded_templates(db_conn):
    conn, loop = db_conn

    equipment_tpl_id = loop.run_until_complete(
        conn.fetchval(
            """
            INSERT INTO uns_registry.asset_templates (level, name, display_name)
            VALUES ('equipment', 'TPL_EQUIPMENT', 'Template Equipment')
            RETURNING id
            """
        )
    )

    area_tpl_id = loop.run_until_complete(
        conn.fetchval(
            """
            INSERT INTO uns_registry.asset_templates (level, name, display_name)
            VALUES ('area', 'TPL_AREA', 'Template Area')
            RETURNING id
            """
        )
    )

    return {
        "equipment_tpl_id": str(equipment_tpl_id),
        "area_tpl_id": str(area_tpl_id),
    }


def test_create_template_and_list(api_client):
    payload = {
        "level": "equipment",
        "name": "VESTAS_V90_2MW",
        "display_name": "Vestas V90-2.0MW",
        "descriptive": {"manufacturer": "Vestas"},
        "analytical": {},
    }

    response = api_client.post("/api/v1/templates", json=payload)

    assert response.status_code == 201

    list_response = api_client.get("/api/v1/templates", params={"level": "equipment"})
    assert list_response.status_code == 200

    body = list_response.json()
    assert any(template["name"] == "VESTAS_V90_2MW" for template in body)


def test_template_child_level_must_be_consecutive(api_client, seeded_templates):
    parent_id = seeded_templates["equipment_tpl_id"]
    wrong_child_id = seeded_templates["area_tpl_id"]

    response = api_client.post(
        f"/api/v1/templates/{parent_id}/children",
        json={
            "child_template_id": wrong_child_id,
            "sort_order": 0,
            "is_optional": False,
        },
    )

    assert response.status_code == 400
