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
def seeded_enterprise_parent(db_conn):
    conn, loop = db_conn

    enterprise_id = loop.run_until_complete(
        conn.fetchval(
            """
            INSERT INTO uns_registry.assets (asset_level, name, uns_path)
            VALUES ('enterprise', 'ENT_ROOT', 'uns/v1/ENT_ROOT')
            RETURNING id
            """
        )
    )

    return str(enterprise_id)


@pytest.fixture
def seeded_template_tree(db_conn):
    conn, loop = db_conn

    root_template_id = loop.run_until_complete(
        conn.fetchval(
            """
            INSERT INTO uns_registry.asset_templates (level, name, display_name, descriptive)
            VALUES ('site', 'TPL_SITE_ROOT', 'Template Site Root', '{"region":"default"}'::jsonb)
            RETURNING id
            """
        )
    )

    area_template_id = loop.run_until_complete(
        conn.fetchval(
            """
            INSERT INTO uns_registry.asset_templates (level, name, display_name)
            VALUES ('area', 'TPL_AREA_CHILD', 'Template Area Child')
            RETURNING id
            """
        )
    )

    equipment_template_id = loop.run_until_complete(
        conn.fetchval(
            """
            INSERT INTO uns_registry.asset_templates (level, name, display_name)
            VALUES ('equipment', 'TPL_EQUIPMENT_CHILD', 'Template Equipment Child')
            RETURNING id
            """
        )
    )

    loop.run_until_complete(
        conn.execute(
            """
            INSERT INTO uns_registry.template_children (
                parent_template_id,
                child_template_id,
                sort_order,
                is_optional
            )
            VALUES ($1, $2, 0, false)
            """,
            root_template_id,
            area_template_id,
        )
    )

    loop.run_until_complete(
        conn.execute(
            """
            INSERT INTO uns_registry.template_children (
                parent_template_id,
                child_template_id,
                sort_order,
                is_optional
            )
            VALUES ($1, $2, 0, false)
            """,
            area_template_id,
            equipment_template_id,
        )
    )

    return {
        "root_template_id": str(root_template_id),
        "area_template_id": str(area_template_id),
        "equipment_template_id": str(equipment_template_id),
    }


@pytest.fixture
def seeded_broken_template_tree(db_conn):
    conn, loop = db_conn

    root_template_id = loop.run_until_complete(
        conn.fetchval(
            """
            INSERT INTO uns_registry.asset_templates (level, name, display_name)
            VALUES ('site', 'TPL_BROKEN_SITE_ROOT', 'Template Broken Site Root')
            RETURNING id
            """
        )
    )

    invalid_child_template_id = loop.run_until_complete(
        conn.fetchval(
            """
            INSERT INTO uns_registry.asset_templates (level, name, display_name)
            VALUES ('subsystem', 'TPL_BROKEN_SUBSYSTEM_CHILD', 'Template Broken Subsystem Child')
            RETURNING id
            """
        )
    )

    loop.run_until_complete(
        conn.execute(
            """
            INSERT INTO uns_registry.template_children (
                parent_template_id,
                child_template_id,
                sort_order,
                is_optional
            )
            VALUES ($1, $2, 0, false)
            """,
            root_template_id,
            invalid_child_template_id,
        )
    )

    return str(root_template_id)


def test_recursive_instantiation_creates_children(api_client, seeded_template_tree, seeded_enterprise_parent):
    response = api_client.post(
        "/api/v1/assets/from-template",
        json={
            "parent_id": seeded_enterprise_parent,
            "template_id": seeded_template_tree["root_template_id"],
            "name": "SITE_FROM_TEMPLATE",
            "descriptive_overrides": {"region": "north"},
            "analytical_overrides": {},
        },
    )

    assert response.status_code == 201

    root = response.json()
    assert root["name"] == "SITE_FROM_TEMPLATE"
    assert root["asset_level"] == "site"
    assert root["parent_id"] == seeded_enterprise_parent
    assert root["descriptive"]["region"] == "north"

    first_level = api_client.get("/api/v1/assets", params={"parent_id": root["id"]})
    assert first_level.status_code == 200
    first_level_assets = first_level.json()
    assert len(first_level_assets) == 1
    assert first_level_assets[0]["name"] == "TPL_AREA_CHILD"
    assert first_level_assets[0]["asset_level"] == "area"

    second_level = api_client.get(
        "/api/v1/assets",
        params={"parent_id": first_level_assets[0]["id"]},
    )
    assert second_level.status_code == 200
    second_level_assets = second_level.json()
    assert len(second_level_assets) == 1
    assert second_level_assets[0]["name"] == "TPL_EQUIPMENT_CHILD"
    assert second_level_assets[0]["asset_level"] == "equipment"


def test_instantiation_rolls_back_on_child_error(api_client, seeded_broken_template_tree, seeded_enterprise_parent):
    response = api_client.post(
        "/api/v1/assets/from-template",
        json={
            "parent_id": seeded_enterprise_parent,
            "template_id": seeded_broken_template_tree,
            "name": "BROKEN_SITE",
            "descriptive_overrides": {},
            "analytical_overrides": {},
        },
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "subsystem requires equipment parent"}

    list_response = api_client.get(
        "/api/v1/assets",
        params={"parent_id": seeded_enterprise_parent},
    )
    assert list_response.status_code == 200
    assert all(asset["name"] != "BROKEN_SITE" for asset in list_response.json())
