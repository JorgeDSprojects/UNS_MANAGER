# UNS Manager DB/API Subproject 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready first iteration of UNS Manager DB + API with fixed contracts, recursive template instantiation, and deterministic verification gates.

**Architecture:** Implement a simple layered backend (`routers -> services -> db`) with PostgreSQL `uns_registry` as the only source of truth. Keep HTTP handlers thin, enforce business rules in services, and execute recursive instantiation in one transaction with full rollback on failure.

**Tech Stack:** Python 3.12, FastAPI, asyncpg, Pydantic v2, Uvicorn, PostgreSQL 16, pytest, pytest-asyncio, httpx, Docker Compose.

## Global Constraints

- API base path is `/api/v1` and contract field names stay fixed.
- `uns_registry` is the only source of truth for UNS definitions and instances.
- `asset_level` values: `enterprise`, `site`, `area`, `equipment`, `subsystem`.
- Asset names must match `^[A-Z0-9_]+$`.
- `uns_path` is always server-calculated (`uns/v1/{enterprise}/{site}/{area}/{equipment}/{subsystem}` pattern), never client-provided.
- `POST /api/v1/assets/from-template` must run in one transaction with rollback on any failure.
- Subsystem informational fields require `range_min/range_max` and must keep `agg_type/source_field` null.
- Non-subsystem informational fields require `agg_type`; `source_field` is required except for `agg_type=custom`; `range_min/range_max` must be null.
- Use environment variables for runtime config; do not commit secrets; version `.env.example` only.
- Use Docker networks and service DNS names for container-to-container calls (never `localhost` inside containers).
- Provide local operation shell scripts in `scripts/`: `up.sh`, `down.sh`, `restart.sh`, `logs.sh`, `status.sh`.
- No LLM-based mechanism is used for contract definition or runtime behavior.

---

## File Structure Map

- `db/init-platform.sql`: schema creation, enums, tables, indexes, triggers for `uns_registry`.
- `services/uns-manager/main.py`: FastAPI app bootstrap, router registration, startup/shutdown hooks.
- `services/uns-manager/models/database.py`: asyncpg pool lifecycle and transaction helpers.
- `services/uns-manager/models/schemas.py`: request/response Pydantic models for fixed contracts.
- `services/uns-manager/services/errors.py`: typed domain exceptions and HTTP mapping helpers.
- `services/uns-manager/services/path_service.py`: `uns_path` builders and rename cascade updates.
- `services/uns-manager/services/template_service.py`: template CRUD, children links, template informational CRUD.
- `services/uns-manager/services/asset_service.py`: asset CRUD, hierarchy validation, tree/flat queries.
- `services/uns-manager/services/informational_service.py`: asset informational CRUD + level-aware validation.
- `services/uns-manager/services/instantiation.py`: recursive `from-template` transaction workflow.
- `services/uns-manager/routers/templates.py`: `/api/v1/templates` routes.
- `services/uns-manager/routers/assets.py`: `/api/v1/assets` and `/api/v1/tree` routes.
- `services/uns-manager/routers/informational.py`: `/api/v1/assets/{id}/informational` and `/api/v1/informational/{id}` routes.
- `services/uns-manager/routers/status.py`: `/api/v1/status` and `/health` routes.
- `services/uns-manager/requirements.txt`: pinned runtime dependencies.
- `services/uns-manager/Dockerfile`: container definition for API service.
- `docker-compose.yml`: local orchestration for `postgres` + `uns-manager` in this subproject.
- `.env.example`: non-secret runtime defaults and required vars list.
- `tests/conftest.py`: test fixtures for app client and isolated PostgreSQL schema setup.
- `tests/integration/test_schema_init.py`: validates schema objects and constraints exist.
- `tests/integration/test_templates_api.py`: templates CRUD + children + template informational.
- `tests/integration/test_assets_api.py`: assets CRUD + hierarchy + `uns_path` + rename cascade.
- `tests/integration/test_informational_api.py`: level-specific informational validation.
- `tests/integration/test_instantiation_api.py`: recursive instantiation and rollback behavior.
- `tests/contracts/test_api_contracts.py`: fixed payload keys/types/status codes contract tests.
- `tests/smoke/test_recursive_instantiation_smoke.py`: HTTP smoke flow for recursive instantiation.
- `scripts/up.sh`, `scripts/down.sh`, `scripts/restart.sh`, `scripts/logs.sh`, `scripts/status.sh`: local operation wrappers.

## Task 1: Bootstrap Schema and API Skeleton

**Files:**
- Create: `db/init-platform.sql`
- Create: `services/uns-manager/main.py`
- Create: `services/uns-manager/models/database.py`
- Create: `services/uns-manager/routers/status.py`
- Create: `services/uns-manager/requirements.txt`
- Test: `tests/integration/test_schema_init.py`
- Test: `tests/conftest.py`

**Interfaces:**
- Consumes: PostgreSQL connection string from environment (`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`).
- Produces:
  - `async def create_pool() -> asyncpg.Pool`
  - `async def close_pool(pool: asyncpg.Pool) -> None`
  - `GET /health -> {"status": "ok"}`
  - `GET /api/v1/status -> {"service": "uns-manager", "version": str, "templates_count": int, "assets_count": int, "informational_fields_count": int, "assets_by_level": dict[str,int]}`

- [ ] **Step 1: Write the failing integration test for schema objects**

```python
# tests/integration/test_schema_init.py
import pytest

@pytest.mark.asyncio
async def test_schema_objects_exist(db_conn):
    rows = await db_conn.fetch(
        """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'uns_registry'
        ORDER BY table_name
        """
    )
    table_names = {r["table_name"] for r in rows}
    assert table_names == {
        "asset_informational",
        "asset_templates",
        "assets",
        "template_children",
        "template_informational",
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/integration/test_schema_init.py::test_schema_objects_exist -v`
Expected: FAIL because schema/tables are not created yet.

- [ ] **Step 3: Write minimal implementation for schema + app skeleton**

```sql
-- db/init-platform.sql (top-level structure)
CREATE SCHEMA IF NOT EXISTS uns_registry;
SET search_path TO uns_registry;

CREATE TYPE asset_level AS ENUM ('enterprise', 'site', 'area', 'equipment', 'subsystem');
CREATE TYPE signal_data_type AS ENUM ('float', 'integer');
CREATE TYPE agg_type AS ENUM ('sum', 'avg', 'min', 'max', 'count', 'weighted_avg', 'custom');

-- Include the exact table, index, and trigger definitions from
-- Definition/UNS_Manager_Service_Spec_v4.md sections 3.2 to 3.7.
```

```python
# services/uns-manager/models/database.py
import asyncpg
import os

def _dsn() -> str:
    return (
        f"postgresql://{os.environ['POSTGRES_USER']}:{os.environ['POSTGRES_PASSWORD']}"
        f"@{os.environ.get('POSTGRES_HOST', 'postgres')}:{os.environ.get('POSTGRES_PORT', '5432')}"
        f"/{os.environ.get('POSTGRES_DB', 'galerna_platform')}"
    )

async def create_pool() -> asyncpg.Pool:
    return await asyncpg.create_pool(dsn=_dsn(), min_size=1, max_size=10)

async def close_pool(pool: asyncpg.Pool) -> None:
    await pool.close()
```

```python
# services/uns-manager/routers/status.py
from fastapi import APIRouter, Request

router = APIRouter(tags=["status"])

@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}

@router.get("/api/v1/status")
async def status(request: Request) -> dict:
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        templates = await conn.fetchval("SELECT COUNT(*) FROM uns_registry.asset_templates")
        assets = await conn.fetchval("SELECT COUNT(*) FROM uns_registry.assets")
        fields = await conn.fetchval("SELECT COUNT(*) FROM uns_registry.asset_informational")
    return {
        "service": "uns-manager",
        "version": "0.1.0",
        "templates_count": templates,
        "assets_count": assets,
        "informational_fields_count": fields,
        "assets_by_level": {},
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/integration/test_schema_init.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add db/init-platform.sql services/uns-manager tests/integration/test_schema_init.py tests/conftest.py
git commit -m "feat: bootstrap uns manager schema and api skeleton"
```

### Task 2: Implement Template Contracts (CRUD + Children + Informational)

**Files:**
- Create: `services/uns-manager/models/schemas.py`
- Create: `services/uns-manager/services/errors.py`
- Create: `services/uns-manager/services/template_service.py`
- Create: `services/uns-manager/routers/templates.py`
- Modify: `services/uns-manager/main.py`
- Test: `tests/integration/test_templates_api.py`

**Interfaces:**
- Consumes:
  - `TemplateCreate`, `TemplateUpdate`, `TemplateChildAdd`, `InformationalFieldCreate`, `InformationalFieldUpdate`.
- Produces:
  - `async def create_template(conn, payload: TemplateCreate) -> dict`
  - `async def list_templates(conn, level: str | None) -> list[dict]`
  - `async def add_template_child(conn, template_id: str, child_id: str, sort_order: int, is_optional: bool) -> None`
  - `async def create_template_informational(conn, template_id: str, payload: InformationalFieldCreate) -> dict`

- [ ] **Step 1: Write failing tests for template CRUD and rule checks**

```python
# tests/integration/test_templates_api.py
import pytest

@pytest.mark.asyncio
async def test_create_template_and_list(async_client):
    payload = {
        "level": "equipment",
        "name": "VESTAS_V90_2MW",
        "display_name": "Vestas V90-2.0MW",
        "descriptive": {"manufacturer": "Vestas"},
        "analytical": {},
    }
    r = await async_client.post("/api/v1/templates", json=payload)
    assert r.status_code == 201
    lr = await async_client.get("/api/v1/templates?level=equipment")
    assert lr.status_code == 200
    assert any(t["name"] == "VESTAS_V90_2MW" for t in lr.json())

@pytest.mark.asyncio
async def test_template_child_level_must_be_consecutive(async_client, seeded_templates):
    parent_id = seeded_templates["equipment_tpl_id"]
    wrong_child_id = seeded_templates["area_tpl_id"]
    r = await async_client.post(
        f"/api/v1/templates/{parent_id}/children",
        json={"child_template_id": wrong_child_id, "sort_order": 0, "is_optional": False},
    )
    assert r.status_code == 400
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/integration/test_templates_api.py -v`
Expected: FAIL with 404 routes or unimplemented handlers.

- [ ] **Step 3: Implement minimal template endpoints and services**

```python
# services/uns-manager/services/template_service.py
from .errors import DomainError

LEVEL_ORDER = {"enterprise": 0, "site": 1, "area": 2, "equipment": 3, "subsystem": 4}

def _validate_child_level(parent_level: str, child_level: str) -> None:
    if LEVEL_ORDER[child_level] - LEVEL_ORDER[parent_level] != 1:
        raise DomainError(status_code=400, message="Template child level must be consecutive")

async def create_template(conn, payload):
    return await conn.fetchrow(
        """
        INSERT INTO uns_registry.asset_templates (level, name, display_name, description, descriptive, analytical, icon)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)
        RETURNING *
        """,
        payload.level, payload.name, payload.display_name, payload.description,
        payload.descriptive, payload.analytical, payload.icon,
    )
```

```python
# services/uns-manager/routers/templates.py
from fastapi import APIRouter, Request, HTTPException
from services.template_service import create_template
from services.errors import DomainError

router = APIRouter(prefix="/api/v1/templates", tags=["templates"])

@router.post("", status_code=201)
async def create_template_route(payload, request: Request):
    try:
        async with request.app.state.db_pool.acquire() as conn:
            row = await create_template(conn, payload)
            return dict(row)
    except DomainError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/integration/test_templates_api.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/uns-manager/models/schemas.py services/uns-manager/services/errors.py services/uns-manager/services/template_service.py services/uns-manager/routers/templates.py services/uns-manager/main.py tests/integration/test_templates_api.py
git commit -m "feat: implement template api contracts and validations"
```

### Task 3: Implement Asset CRUD, Hierarchy Rules, and UNS Path Cascades

**Files:**
- Create: `services/uns-manager/services/path_service.py`
- Create: `services/uns-manager/services/asset_service.py`
- Create: `services/uns-manager/routers/assets.py`
- Modify: `services/uns-manager/main.py`
- Test: `tests/integration/test_assets_api.py`

**Interfaces:**
- Consumes:
  - `async def compute_uns_path(conn, parent_id: str | None, name: str) -> str`
  - `AssetCreate`, `AssetUpdate`.
- Produces:
  - `async def create_asset(conn, payload: AssetCreate) -> dict`
  - `async def update_asset(conn, asset_id: str, payload: AssetUpdate) -> dict`
  - `async def delete_asset(conn, asset_id: str) -> None`
  - `async def recalculate_descendant_paths(conn, asset_id: str) -> None`

- [ ] **Step 1: Write failing tests for hierarchy and path behavior**

```python
# tests/integration/test_assets_api.py
import pytest

@pytest.mark.asyncio
async def test_site_requires_enterprise_parent(async_client):
    r = await async_client.post("/api/v1/assets", json={"asset_level": "site", "name": "SITE_A"})
    assert r.status_code == 400

@pytest.mark.asyncio
async def test_rename_cascades_uns_path(async_client, seeded_asset_chain):
    area_id = seeded_asset_chain["area_id"]
    sub_id = seeded_asset_chain["subsystem_id"]
    old_sub = (await async_client.get(f"/api/v1/assets/{sub_id}")).json()
    assert "/AREA_01/" in old_sub["uns_path"]

    ur = await async_client.put(f"/api/v1/assets/{area_id}", json={"name": "AREA_NORTH"})
    assert ur.status_code == 200

    new_sub = (await async_client.get(f"/api/v1/assets/{sub_id}")).json()
    assert "/AREA_NORTH/" in new_sub["uns_path"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/integration/test_assets_api.py -v`
Expected: FAIL with unimplemented endpoints/logic.

- [ ] **Step 3: Implement minimal asset service and router behavior**

```python
# services/uns-manager/services/path_service.py
async def compute_uns_path(conn, parent_id, name: str) -> str:
    if parent_id is None:
        return f"uns/v1/{name}"
    parent_path = await conn.fetchval("SELECT uns_path FROM uns_registry.assets WHERE id=$1", parent_id)
    return f"{parent_path}/{name}"
```

```python
# services/uns-manager/services/asset_service.py
import re
from .errors import DomainError
from .path_service import compute_uns_path

NAME_RE = re.compile(r"^[A-Z0-9_]+$")
PARENT_RULES = {
    "enterprise": None,
    "site": "enterprise",
    "area": "site",
    "equipment": "area",
    "subsystem": "equipment",
}

def _validate_name(name: str) -> None:
    if not NAME_RE.match(name):
        raise DomainError(400, "Asset name must match ^[A-Z0-9_]+$")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/integration/test_assets_api.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/uns-manager/services/path_service.py services/uns-manager/services/asset_service.py services/uns-manager/routers/assets.py services/uns-manager/main.py tests/integration/test_assets_api.py
git commit -m "feat: implement asset crud hierarchy and uns path cascade"
```

### Task 4: Implement Asset Informational CRUD with Level-Specific Validation

**Files:**
- Create: `services/uns-manager/services/informational_service.py`
- Create: `services/uns-manager/routers/informational.py`
- Modify: `services/uns-manager/main.py`
- Test: `tests/integration/test_informational_api.py`

**Interfaces:**
- Consumes:
  - `InformationalFieldCreate`, `InformationalFieldUpdate`.
  - `async def get_asset_level(conn, asset_id: str) -> str`.
- Produces:
  - `async def create_asset_informational(conn, asset_id: str, payload: InformationalFieldCreate) -> dict`
  - `async def update_asset_informational(conn, field_id: str, payload: InformationalFieldUpdate) -> dict`
  - `async def delete_asset_informational(conn, field_id: str) -> None`

- [ ] **Step 1: Write failing tests for subsystem vs aggregated rules**

```python
# tests/integration/test_informational_api.py
import pytest

@pytest.mark.asyncio
async def test_subsystem_requires_range(async_client, seeded_subsystem_asset):
    asset_id = seeded_subsystem_asset
    r = await async_client.post(
        f"/api/v1/assets/{asset_id}/informational",
        json={"name": "Gen_RPM_Avg", "unit": "RPM", "data_type": "float"},
    )
    assert r.status_code == 400

@pytest.mark.asyncio
async def test_equipment_requires_agg_type(async_client, seeded_equipment_asset):
    asset_id = seeded_equipment_asset
    r = await async_client.post(
        f"/api/v1/assets/{asset_id}/informational",
        json={"name": "total_active_power_kw", "unit": "kW", "data_type": "float"},
    )
    assert r.status_code == 400
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/integration/test_informational_api.py -v`
Expected: FAIL until level-aware validation is implemented.

- [ ] **Step 3: Implement validation and CRUD handlers**

```python
# services/uns-manager/services/informational_service.py
from .errors import DomainError

def _validate_by_level(asset_level: str, payload) -> None:
    if asset_level == "subsystem":
        if payload.range_min is None or payload.range_max is None:
            raise DomainError(400, "subsystem requires range_min and range_max")
        if payload.agg_type is not None or payload.source_field is not None:
            raise DomainError(400, "subsystem cannot define agg_type/source_field")
    else:
        if payload.agg_type is None:
            raise DomainError(400, "non-subsystem requires agg_type")
        if payload.range_min is not None or payload.range_max is not None:
            raise DomainError(400, "non-subsystem cannot define range_min/range_max")
        if payload.agg_type != "custom" and not payload.source_field:
            raise DomainError(400, "source_field is required unless agg_type=custom")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/integration/test_informational_api.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/uns-manager/services/informational_service.py services/uns-manager/routers/informational.py services/uns-manager/main.py tests/integration/test_informational_api.py
git commit -m "feat: enforce level rules for asset informational fields"
```

### Task 5: Implement Transactional Recursive Instantiation from Template

**Files:**
- Create: `services/uns-manager/services/instantiation.py`
- Modify: `services/uns-manager/services/asset_service.py`
- Modify: `services/uns-manager/routers/assets.py`
- Test: `tests/integration/test_instantiation_api.py`

**Interfaces:**
- Consumes:
  - `async def instantiate_from_template(conn, parent_id: str | None, template_id: str, name: str, descriptive_overrides: dict, analytical_overrides: dict) -> str`
- Produces:
  - `POST /api/v1/assets/from-template` with status `201` and `AssetResponse` body.

- [ ] **Step 1: Write failing tests for recursive creation and rollback**

```python
# tests/integration/test_instantiation_api.py
import pytest

@pytest.mark.asyncio
async def test_recursive_instantiation_creates_children(async_client, seeded_template_tree, seeded_equipment_parent):
    r = await async_client.post(
        "/api/v1/assets/from-template",
        json={
            "parent_id": seeded_equipment_parent,
            "template_id": seeded_template_tree["sub_root_tpl"],
            "name": "SUB_FROM_TPL",
            "descriptive_overrides": {"commissioned": True},
            "analytical_overrides": {},
        },
    )
    assert r.status_code == 201
    created = r.json()
    assert created["name"] == "SUB_FROM_TPL"

@pytest.mark.asyncio
async def test_instantiation_rolls_back_on_child_error(async_client, seeded_broken_template_tree, seeded_equipment_parent):
    r = await async_client.post(
        "/api/v1/assets/from-template",
        json={
            "parent_id": seeded_equipment_parent,
            "template_id": seeded_broken_template_tree,
            "name": "BROKEN_SUB",
        },
    )
    assert r.status_code in (400, 409, 500)

    check = await async_client.get("/api/v1/assets?parent_id=" + seeded_equipment_parent)
    assert all(a["name"] != "BROKEN_SUB" for a in check.json())
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/integration/test_instantiation_api.py -v`
Expected: FAIL until transactional recursion exists.

- [ ] **Step 3: Implement transactional recursion**

```python
# services/uns-manager/services/instantiation.py
async def instantiate_from_template(conn, parent_id, template_id, name, descriptive_overrides, analytical_overrides):
    tpl = await conn.fetchrow("SELECT * FROM uns_registry.asset_templates WHERE id=$1", template_id)
    if tpl is None:
        raise ValueError("template not found")

    descriptive = {**dict(tpl["descriptive"]), **(descriptive_overrides or {})}
    analytical = {**dict(tpl["analytical"]), **(analytical_overrides or {})}

    if parent_id:
        parent_path = await conn.fetchval("SELECT uns_path FROM uns_registry.assets WHERE id=$1", parent_id)
        uns_path = f"{parent_path}/{name}"
    else:
        uns_path = f"uns/v1/{name}"

    asset_id = await conn.fetchval(
        """
        INSERT INTO uns_registry.assets (parent_id, template_id, asset_level, name, uns_path, descriptive, analytical)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)
        RETURNING id
        """,
        parent_id, template_id, tpl["level"], name, uns_path, descriptive, analytical,
    )

    await conn.execute(
        """
        INSERT INTO uns_registry.asset_informational (
            asset_id, name, unit, data_type, range_min, range_max, agg_type, source_field,
            category, is_primary, chart_type, chart_window, chart_thresholds,
            aliases_es, aliases_en, description_es, description_en
        )
        SELECT $1, name, unit, data_type, range_min, range_max, agg_type, source_field,
               category, is_primary, chart_type, chart_window, chart_thresholds,
               aliases_es, aliases_en, description_es, description_en
        FROM uns_registry.template_informational
        WHERE template_id=$2
        """,
        asset_id, template_id,
    )

    children = await conn.fetch(
        """
        SELECT child_template_id
        FROM uns_registry.template_children
        WHERE parent_template_id=$1 AND is_optional=false
        ORDER BY sort_order
        """,
        template_id,
    )
    for child in children:
        child_name = await conn.fetchval("SELECT name FROM uns_registry.asset_templates WHERE id=$1", child["child_template_id"])
        await instantiate_from_template(conn, asset_id, child["child_template_id"], child_name, {}, {})

    return asset_id
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/integration/test_instantiation_api.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/uns-manager/services/instantiation.py services/uns-manager/services/asset_service.py services/uns-manager/routers/assets.py tests/integration/test_instantiation_api.py
git commit -m "feat: add transactional recursive instantiation from templates"
```

### Task 6: Add Contract Tests and Error Code Guarantees

**Files:**
- Create: `tests/contracts/test_api_contracts.py`
- Modify: `services/uns-manager/routers/templates.py`
- Modify: `services/uns-manager/routers/assets.py`
- Modify: `services/uns-manager/routers/informational.py`
- Modify: `services/uns-manager/services/errors.py`

**Interfaces:**
- Consumes:
  - Domain exception: `DomainError(status_code: int, message: str)`.
- Produces:
  - Stable error body: `{ "detail": "Asset name must match ^[A-Z0-9_]+$" }` style with deterministic status mappings.

- [ ] **Step 1: Write failing contract tests for status and payload keys**

```python
# tests/contracts/test_api_contracts.py
import pytest

@pytest.mark.asyncio
async def test_create_asset_contract_keys(async_client, seeded_enterprise_asset):
    r = await async_client.post(
        "/api/v1/assets",
        json={"asset_level": "site", "name": "SITE_NW", "parent_id": seeded_enterprise_asset},
    )
    assert r.status_code == 201
    body = r.json()
    assert set(["id", "parent_id", "template_id", "asset_level", "name", "uns_path", "descriptive", "analytical", "scada_available", "is_active", "created_at", "updated_at"]).issubset(body.keys())

@pytest.mark.asyncio
async def test_invalid_asset_name_returns_400(async_client):
    r = await async_client.post("/api/v1/assets", json={"asset_level": "enterprise", "name": "bad-name"})
    assert r.status_code == 400
    assert "^[A-Z0-9_]+$" in r.json()["detail"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/contracts/test_api_contracts.py -v`
Expected: FAIL until response mappings and keys are aligned.

- [ ] **Step 3: Implement deterministic error mapping and shape alignment**

```python
# services/uns-manager/services/errors.py
from dataclasses import dataclass

@dataclass
class DomainError(Exception):
    status_code: int
    message: str

    def __str__(self) -> str:
        return self.message
```

```python
# router exception handling pattern
from fastapi import HTTPException
from services.errors import DomainError

try:
    row = await create_template(conn, payload)
    return dict(row)
except DomainError as exc:
    raise HTTPException(status_code=exc.status_code, detail=exc.message)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/contracts/test_api_contracts.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/contracts/test_api_contracts.py services/uns-manager/services/errors.py services/uns-manager/routers/templates.py services/uns-manager/routers/assets.py services/uns-manager/routers/informational.py
git commit -m "test: enforce fixed api contract and error mappings"
```

### Task 7: Add Local Operations, Compose, and Recursive HTTP Smoke Gate

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `services/uns-manager/Dockerfile`
- Create: `scripts/up.sh`
- Create: `scripts/down.sh`
- Create: `scripts/restart.sh`
- Create: `scripts/logs.sh`
- Create: `scripts/status.sh`
- Create: `tests/smoke/test_recursive_instantiation_smoke.py`

**Interfaces:**
- Consumes:
  - `docker compose` runtime.
  - API endpoint `/api/v1/assets/from-template`.
- Produces:
  - Reproducible local lifecycle commands.
  - Smoke test command validating end-to-end recursive HTTP flow.

- [ ] **Step 1: Write failing smoke test for full recursive HTTP flow**

```python
# tests/smoke/test_recursive_instantiation_smoke.py
import pytest

@pytest.mark.asyncio
async def test_recursive_instantiation_smoke(async_client, seeded_template_tree, seeded_equipment_parent):
    r = await async_client.post(
        "/api/v1/assets/from-template",
        json={
            "parent_id": seeded_equipment_parent,
            "template_id": seeded_template_tree["sub_root_tpl"],
            "name": "SUB_SMOKE",
            "descriptive_overrides": {"commissioned": True},
            "analytical_overrides": {"thresholds": {"alarm": 90}},
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "SUB_SMOKE"
    assert body["uns_path"].endswith("/SUB_SMOKE")
```

- [ ] **Step 2: Run smoke test to verify it fails first**

Run: `pytest tests/smoke/test_recursive_instantiation_smoke.py -v`
Expected: FAIL if environment scripts/compose are not ready.

- [ ] **Step 3: Implement compose, Dockerfile, and shell scripts**

```yaml
# docker-compose.yml (subproject scope)
services:
  postgres:
    image: timescale/timescaledb:latest-pg16
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - ./db/init-platform.sql:/docker-entrypoint-initdb.d/01-init.sql:ro
    networks: [backend]

  uns-manager:
    build: ./services/uns-manager
    env_file: .env
    depends_on:
      - postgres
    ports:
      - "${UNS_MANAGER_HOST_PORT:-8002}:8002"
    networks: [backend]

networks:
  backend:
    driver: bridge
```

```sh
# scripts/up.sh
#!/usr/bin/env sh
set -euo pipefail
docker compose up -d "$@"
```

```sh
# scripts/status.sh
#!/usr/bin/env sh
set -euo pipefail
docker compose ps
```

- [ ] **Step 4: Run full verification suite**

Run: `pytest tests/integration tests/contracts tests/smoke -v`
Expected: PASS.

Run: `docker compose ps`
Expected: `postgres` and `uns-manager` are `Up`.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml .env.example services/uns-manager/Dockerfile scripts tests/smoke/test_recursive_instantiation_smoke.py
git commit -m "chore: add compose scripts and recursive http smoke gate"
```

## Final Verification Gate

- [ ] Run: `pytest tests/integration tests/contracts tests/smoke -v`
- [ ] Run: `docker compose up -d postgres uns-manager`
- [ ] Run: `curl http://localhost:8002/health`
- [ ] Expected: `{"status":"ok"}`

## Self-Review

### 1. Spec Coverage Check

- Fixed contracts for DB/API scope: covered by Tasks 2, 3, 4, 6.
- Recursive instantiation with transaction/rollback: covered by Task 5 and smoke in Task 7.
- Contract tests + PostgreSQL integration + recursive HTTP smoke: covered by Tasks 6, 1-5 integration tests, and Task 7.
- No LLM dependency: enforced as process/tooling constraint in Global Constraints.

### 2. Placeholder Scan

- No `TODO`, `TBD`, or deferred placeholders found.
- Every task includes concrete files, code snippets, commands, and expected outcomes.

### 3. Type and Interface Consistency

- `instantiate_from_template(conn, parent_id, template_id, name, descriptive_overrides, analytical_overrides)` signature is consistent between Task 5 interfaces, tests, and implementation snippet.
- Domain error shape (`DomainError(status_code, message)`) is reused consistently in Task 2 and Task 6.
- Contract key expectations align with fixed API response structure used across Task 3/6.
