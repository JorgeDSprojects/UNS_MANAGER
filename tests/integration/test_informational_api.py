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
def seeded_asset_chain(db_conn):
    conn, loop = db_conn

    enterprise_id = loop.run_until_complete(
        conn.fetchval(
            """
            INSERT INTO uns_registry.assets (asset_level, name, uns_path)
            VALUES ('enterprise', 'ENT_A', 'uns/v1/ENT_A')
            RETURNING id
            """
        )
    )

    site_id = loop.run_until_complete(
        conn.fetchval(
            """
            INSERT INTO uns_registry.assets (parent_id, asset_level, name, uns_path)
            VALUES ($1, 'site', 'SITE_A', 'uns/v1/ENT_A/SITE_A')
            RETURNING id
            """,
            enterprise_id,
        )
    )

    area_id = loop.run_until_complete(
        conn.fetchval(
            """
            INSERT INTO uns_registry.assets (parent_id, asset_level, name, uns_path)
            VALUES ($1, 'area', 'AREA_01', 'uns/v1/ENT_A/SITE_A/AREA_01')
            RETURNING id
            """,
            site_id,
        )
    )

    equipment_id = loop.run_until_complete(
        conn.fetchval(
            """
            INSERT INTO uns_registry.assets (parent_id, asset_level, name, uns_path)
            VALUES ($1, 'equipment', 'EQ_01', 'uns/v1/ENT_A/SITE_A/AREA_01/EQ_01')
            RETURNING id
            """,
            area_id,
        )
    )

    subsystem_id = loop.run_until_complete(
        conn.fetchval(
            """
            INSERT INTO uns_registry.assets (parent_id, asset_level, name, uns_path)
            VALUES ($1, 'subsystem', 'SUB_01', 'uns/v1/ENT_A/SITE_A/AREA_01/EQ_01/SUB_01')
            RETURNING id
            """,
            equipment_id,
        )
    )

    return {
        "equipment_id": str(equipment_id),
        "subsystem_id": str(subsystem_id),
    }


def test_subsystem_requires_range(api_client, seeded_asset_chain):
    asset_id = seeded_asset_chain["subsystem_id"]

    response = api_client.post(
        f"/api/v1/assets/{asset_id}/informational",
        json={"name": "Gen_RPM_Avg", "unit": "RPM", "data_type": "float"},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "subsystem requires range_min and range_max"}


def test_equipment_requires_agg_type(api_client, seeded_asset_chain):
    asset_id = seeded_asset_chain["equipment_id"]

    response = api_client.post(
        f"/api/v1/assets/{asset_id}/informational",
        json={"name": "total_active_power_kw", "unit": "kW", "data_type": "float"},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "non-subsystem requires agg_type"}
