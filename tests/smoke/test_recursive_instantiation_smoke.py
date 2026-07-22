import os
from uuid import uuid4

import pytest
from httpx import AsyncClient


def _endpoint(base_url: str, path: str) -> str:
    if base_url.rstrip("/").endswith("/api/v1"):
        return path
    return f"/api/v1{path}"


@pytest.mark.anyio
async def test_recursive_instantiation_smoke():
    api_base = os.getenv("API_BASE", "http://localhost:8002/api/v1").rstrip("/")
    suffix = uuid4().hex[:8].upper()

    enterprise_name = f"ENT_SMOKE_{suffix}"
    template_name = f"TPL_SITE_SMOKE_{suffix}"
    child_template_name = f"TPL_AREA_SMOKE_{suffix}"
    grandchild_template_name = f"TPL_EQ_SMOKE_{suffix}"
    site_name = f"SITE_SMOKE_{suffix}"

    async with AsyncClient(base_url=api_base, timeout=30.0) as client:
        enterprise_response = await client.post(
            _endpoint(api_base, "/assets"),
            json={"asset_level": "enterprise", "name": enterprise_name},
        )
        assert enterprise_response.status_code == 201, enterprise_response.text
        enterprise_id = enterprise_response.json()["id"]

        template_response = await client.post(
            _endpoint(api_base, "/templates"),
            json={
                "level": "site",
                "name": template_name,
                "display_name": "Smoke Site Template",
                "description": "Smoke test template",
                "descriptive": {},
                "analytical": {},
            },
        )
        assert template_response.status_code == 201, template_response.text
        template_id = template_response.json()["id"]

        child_template_response = await client.post(
            _endpoint(api_base, "/templates"),
            json={
                "level": "area",
                "name": child_template_name,
                "display_name": "Smoke Area Template",
                "description": "Smoke test child template",
                "descriptive": {},
                "analytical": {},
            },
        )
        assert child_template_response.status_code == 201, child_template_response.text
        child_template_id = child_template_response.json()["id"]

        grandchild_template_response = await client.post(
            _endpoint(api_base, "/templates"),
            json={
                "level": "equipment",
                "name": grandchild_template_name,
                "display_name": "Smoke Equipment Template",
                "description": "Smoke test grandchild template",
                "descriptive": {},
                "analytical": {},
            },
        )
        assert grandchild_template_response.status_code == 201, grandchild_template_response.text
        grandchild_template_id = grandchild_template_response.json()["id"]

        child_link_response = await client.post(
            _endpoint(api_base, f"/templates/{template_id}/children"),
            json={
                "child_template_id": child_template_id,
                "sort_order": 0,
                "is_optional": False,
            },
        )
        assert child_link_response.status_code == 201, child_link_response.text

        grandchild_link_response = await client.post(
            _endpoint(api_base, f"/templates/{child_template_id}/children"),
            json={
                "child_template_id": grandchild_template_id,
                "sort_order": 0,
                "is_optional": False,
            },
        )
        assert grandchild_link_response.status_code == 201, grandchild_link_response.text

        info_response = await client.post(
            _endpoint(api_base, f"/templates/{template_id}/informational"),
            json={
                "name": "site_capacity_factor",
                "unit": "%",
                "data_type": "float",
                "agg_type": "custom",
                "source_field": None,
                "category": "performance",
                "is_primary": True,
            },
        )
        assert info_response.status_code == 201, info_response.text

        instantiate_response = await client.post(
            _endpoint(api_base, "/assets/from-template"),
            json={
                "parent_id": enterprise_id,
                "template_id": template_id,
                "name": site_name,
                "descriptive_overrides": {},
                "analytical_overrides": {},
            },
        )

    assert instantiate_response.status_code == 201, instantiate_response.text
    response_body = instantiate_response.json()
    assert response_body["uns_path"].endswith(f"/{site_name}")

    async with AsyncClient(base_url=api_base, timeout=30.0) as client:
        root_detail = await client.get(_endpoint(api_base, f"/assets/{response_body['id']}"))
        assert root_detail.status_code == 200, root_detail.text
        informational = root_detail.json().get("informational") or []
        site_field = next((field for field in informational if field["name"] == "site_capacity_factor"), None)
        assert site_field is not None
        assert site_field["unit"] == "%"
        assert site_field["agg_type"] == "custom"

        child_assets = await client.get(
            _endpoint(api_base, "/assets"),
            params={"parent_id": response_body["id"]},
        )
        assert child_assets.status_code == 200, child_assets.text
        children = child_assets.json()
        assert len(children) == 1
        assert children[0]["name"] == child_template_name
        assert children[0]["asset_level"] == "area"

        grandchild_assets = await client.get(
            _endpoint(api_base, "/assets"),
            params={"parent_id": children[0]["id"]},
        )
        assert grandchild_assets.status_code == 200, grandchild_assets.text
        grandchildren = grandchild_assets.json()
        assert len(grandchildren) == 1
        assert grandchildren[0]["name"] == grandchild_template_name
        assert grandchildren[0]["asset_level"] == "equipment"
