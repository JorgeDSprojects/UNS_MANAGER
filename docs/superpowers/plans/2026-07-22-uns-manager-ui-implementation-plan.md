# UNS Manager UI (Subproject 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an almost-complete UNS Manager web UI for Templates and Assets, including hybrid sync visibility sourced from `/api/v1/status`.

**Architecture:** Implement a React SPA with modular feature boundaries (`templates`, `assets`, `status-sync`) and serve it as static build from `uns-manager`. Keep backend contract names fixed and extend `/api/v1/status` additively for sync health. Use test-first workflow across backend integration tests, frontend unit/integration tests, and one browser E2E critical flow.

**Tech Stack:** Python 3.12, FastAPI, asyncpg, React 18, Vite 5, Tailwind CSS 3, TanStack Query 5, react-arborist 3, Monaco editor wrapper, Vitest, Testing Library, Playwright, Docker Compose.

## Global Constraints

- Keep existing API routes and payload names unchanged (`/api/v1/...`, `asset_level`, `descriptive`, `analytical`, `informational_fields`, `template_id`, `parent_id`).
- Frontend consumes only UNS Manager API; it must not call `sync-service` directly.
- Sync state in UI is hybrid and exposed through extended `GET /api/v1/status`.
- `uns_registry` remains the single source of truth.
- Asset names must match `^[A-Z0-9_]+$`.
- `uns_path` remains server-calculated only.
- Keep Docker network DNS communication for containers (`postgres`, `emqx`), not `localhost` inside containers.
- Keep shell operations scripts in `scripts/` and preserve existing script behavior contracts.
- Code artifacts and code comments remain in English.

---

## File Structure Map

- `services/uns-manager/ui/package.json`: frontend dependencies and scripts.
- `services/uns-manager/ui/vite.config.ts`: Vite build/test config.
- `services/uns-manager/ui/tailwind.config.ts`: Tailwind theme and file scanning.
- `services/uns-manager/ui/src/main.tsx`: SPA entrypoint.
- `services/uns-manager/ui/src/app/App.tsx`: shell layout and routing tabs.
- `services/uns-manager/ui/src/features/status-sync/*`: status models, hooks, and sync badge.
- `services/uns-manager/ui/src/features/templates/*`: templates API hooks and components.
- `services/uns-manager/ui/src/features/assets/*`: assets tree, inspector, and create actions.
- `services/uns-manager/ui/src/shared/*`: shared api client, toasts, form helpers, dirty guard.
- `services/uns-manager/ui/src/tests/*`: frontend unit/integration tests.
- `services/uns-manager/ui/playwright.config.ts`: browser E2E config.
- `services/uns-manager/ui/tests-e2e/*.spec.ts`: critical browser flow tests.
- `services/uns-manager/main.py`: mount static files and SPA fallback route.
- `services/uns-manager/routers/status.py`: additive status contract extension with sync fields.
- `services/sync-service/sync_service.py`: persist heartbeat/sync runtime state into PostgreSQL.
- `db/init-platform.sql`: add `sync_runtime_state` table for status federation.
- `services/uns-manager/Dockerfile`: build and serve frontend static bundle.
- `tests/integration/test_ui_serving.py`: backend test for SPA static serving.
- `tests/integration/test_status_sync_fields.py`: status endpoint extended fields and defaults.

### Task 1: Bootstrap Frontend Workspace and Static Serving Contract

**Files:**
- Create: `services/uns-manager/ui/package.json`
- Create: `services/uns-manager/ui/vite.config.ts`
- Create: `services/uns-manager/ui/tsconfig.json`
- Create: `services/uns-manager/ui/index.html`
- Create: `services/uns-manager/ui/src/main.tsx`
- Create: `services/uns-manager/ui/src/app/App.tsx`
- Create: `tests/integration/test_ui_serving.py`
- Modify: `services/uns-manager/main.py`

**Interfaces:**
- Consumes:
  - FastAPI app instance `app` in `services/uns-manager/main.py`.
- Produces:
  - `GET /` returns HTML shell for SPA.
  - Frontend build script `npm run build` writes `services/uns-manager/ui/dist`.

- [ ] **Step 1: Write the failing backend serving test**

```python
# tests/integration/test_ui_serving.py
import importlib
import sys
from pathlib import Path

from fastapi.testclient import TestClient


def test_root_serves_ui_shell(monkeypatch):
    service_dir = Path("services/uns-manager").resolve()
    service_dir_str = str(service_dir)
    if service_dir_str not in sys.path:
        sys.path.insert(0, service_dir_str)

    monkeypatch.setenv("POSTGRES_HOST", "localhost")
    monkeypatch.setenv("POSTGRES_PORT", "5432")
    monkeypatch.setenv("POSTGRES_USER", "postgres")
    monkeypatch.setenv("POSTGRES_PASSWORD", "postgres")
    monkeypatch.setenv("POSTGRES_DB", "galerna_platform")

    module = importlib.reload(importlib.import_module("main"))
    with TestClient(module.app) as client:
        response = client.get("/")

    assert response.status_code == 200
    assert "UNS Manager" in response.text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/integration/test_ui_serving.py -v`
Expected: FAIL because `GET /` static shell is not mounted yet.

- [ ] **Step 3: Implement minimal SPA shell + mount**

```tsx
// services/uns-manager/ui/src/app/App.tsx
export default function App() {
  return (
    <main>
      <h1>UNS Manager</h1>
      <p>UI bootstrap ready</p>
    </main>
  );
}
```

```python
# services/uns-manager/main.py (excerpt)
from pathlib import Path
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

UI_DIST = Path(__file__).resolve().parent / "ui" / "dist"
if UI_DIST.exists():
    app.mount("/assets", StaticFiles(directory=UI_DIST / "assets"), name="ui-assets")

@app.get("/", include_in_schema=False)
async def ui_root():
    if not UI_DIST.exists():
        return {"message": "UI build not found"}
    return FileResponse(UI_DIST / "index.html")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/integration/test_ui_serving.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/uns-manager/ui services/uns-manager/main.py tests/integration/test_ui_serving.py
git commit -m "feat: bootstrap uns manager ui workspace and static shell"
```

### Task 2: Extend `/api/v1/status` with Sync Runtime Fields

**Files:**
- Modify: `db/init-platform.sql`
- Modify: `services/sync-service/sync_service.py`
- Modify: `services/uns-manager/routers/status.py`
- Create: `tests/integration/test_status_sync_fields.py`

**Interfaces:**
- Consumes:
  - PostgreSQL `uns_registry` schema.
- Produces:
  - `GET /api/v1/status` additive fields:
    - `sync_state: str`
    - `mqtt_connected: bool`
    - `last_sync_at: str | null`
    - `sync_lag_seconds: float | null`

- [ ] **Step 1: Write failing status contract test**

```python
# tests/integration/test_status_sync_fields.py
def test_status_contains_sync_fields(api_client):
    response = api_client.get("/api/v1/status")
    assert response.status_code == 200
    body = response.json()
    assert "sync_state" in body
    assert "mqtt_connected" in body
    assert "last_sync_at" in body
    assert "sync_lag_seconds" in body
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/integration/test_status_sync_fields.py -v`
Expected: FAIL because current endpoint does not include sync fields.

- [ ] **Step 3: Implement table + heartbeat + status projection**

```sql
-- db/init-platform.sql (append)
CREATE TABLE IF NOT EXISTS sync_runtime_state (
    service_name VARCHAR(50) PRIMARY KEY,
    mqtt_connected BOOLEAN NOT NULL DEFAULT false,
    last_sync_at TIMESTAMPTZ,
    sync_lag_seconds DOUBLE PRECISION,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

```python
# services/sync-service/sync_service.py (new helper)
async def _upsert_sync_runtime_state(self, mqtt_connected: bool, sync_lag_seconds: float | None) -> None:
    pool = self._require_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO uns_registry.sync_runtime_state (
                service_name, mqtt_connected, last_sync_at, sync_lag_seconds, updated_at
            ) VALUES ('sync-service', $1, now(), $2, now())
            ON CONFLICT (service_name)
            DO UPDATE SET
                mqtt_connected = EXCLUDED.mqtt_connected,
                last_sync_at = EXCLUDED.last_sync_at,
                sync_lag_seconds = EXCLUDED.sync_lag_seconds,
                updated_at = EXCLUDED.updated_at
            """,
            mqtt_connected,
            sync_lag_seconds,
        )
```

```python
# services/uns-manager/routers/status.py (projection excerpt)
row = await conn.fetchrow(
    """
    SELECT mqtt_connected, last_sync_at, sync_lag_seconds, updated_at
    FROM uns_registry.sync_runtime_state
    WHERE service_name = 'sync-service'
    """
)
sync_state = "degraded"
if row and row["mqtt_connected"]:
    sync_state = "healthy"
status_payload["sync_state"] = sync_state
status_payload["mqtt_connected"] = bool(row["mqtt_connected"]) if row else False
status_payload["last_sync_at"] = row["last_sync_at"].isoformat() if row and row["last_sync_at"] else None
status_payload["sync_lag_seconds"] = float(row["sync_lag_seconds"]) if row and row["sync_lag_seconds"] is not None else None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/integration/test_status_sync_fields.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add db/init-platform.sql services/sync-service/sync_service.py services/uns-manager/routers/status.py tests/integration/test_status_sync_fields.py
git commit -m "feat: extend status endpoint with sync runtime fields"
```

### Task 3: Build App Shell, Tabs, and Sync Badge

**Files:**
- Create: `services/uns-manager/ui/src/features/status-sync/types.ts`
- Create: `services/uns-manager/ui/src/features/status-sync/api.ts`
- Create: `services/uns-manager/ui/src/features/status-sync/hooks.ts`
- Create: `services/uns-manager/ui/src/features/status-sync/StatusSyncBadge.tsx`
- Modify: `services/uns-manager/ui/src/app/App.tsx`
- Create: `services/uns-manager/ui/src/tests/status-sync-badge.test.tsx`

**Interfaces:**
- Consumes:
  - `GET /api/v1/status` extended response.
- Produces:
  - `useStatusSyncQuery(): UseQueryResult<StatusResponse>`
  - `<StatusSyncBadge status={StatusResponse} />`

- [ ] **Step 1: Write failing badge mapping test**

```tsx
// services/uns-manager/ui/src/tests/status-sync-badge.test.tsx
import { render, screen } from "@testing-library/react";
import { StatusSyncBadge } from "../features/status-sync/StatusSyncBadge";

test("renders healthy sync badge", () => {
  render(
    <StatusSyncBadge
      status={{
        service: "uns-manager",
        version: "0.1.0",
        templates_count: 1,
        assets_count: 1,
        informational_fields_count: 1,
        assets_by_level: {},
        sync_state: "healthy",
        mqtt_connected: true,
        last_sync_at: "2026-07-22T08:00:00Z",
        sync_lag_seconds: 0,
      }}
    />
  );

  expect(screen.getByText("Sync: Healthy")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix services/uns-manager/ui run test -- status-sync-badge.test.tsx`
Expected: FAIL because badge component does not exist.

- [ ] **Step 3: Implement shell + badge**

```tsx
// services/uns-manager/ui/src/features/status-sync/StatusSyncBadge.tsx
import type { StatusResponse } from "./types";

export function StatusSyncBadge({ status }: { status: StatusResponse }) {
  const label =
    status.sync_state === "healthy"
      ? "Sync: Healthy"
      : status.sync_state === "down"
        ? "Sync: Down"
        : "Sync: Degraded";

  return <span title={`MQTT connected: ${status.mqtt_connected}`}>{label}</span>;
}
```

```tsx
// services/uns-manager/ui/src/app/App.tsx (excerpt)
export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b p-3 flex justify-between">
        <nav className="flex gap-3">
          <button>Templates</button>
          <button>Assets</button>
        </nav>
        <StatusSyncContainer />
      </header>
      <footer className="border-t p-2 text-sm">Templates: 0 | Assets: 0 | Fields: 0</footer>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix services/uns-manager/ui run test -- status-sync-badge.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/uns-manager/ui/src/app/App.tsx services/uns-manager/ui/src/features/status-sync services/uns-manager/ui/src/tests/status-sync-badge.test.tsx
git commit -m "feat: add ui shell tabs and sync status badge"
```

### Task 4: Implement Templates Feature (List + Editor + Save/Delete)

**Files:**
- Create: `services/uns-manager/ui/src/features/templates/types.ts`
- Create: `services/uns-manager/ui/src/features/templates/api.ts`
- Create: `services/uns-manager/ui/src/features/templates/hooks.ts`
- Create: `services/uns-manager/ui/src/features/templates/TemplateListPanel.tsx`
- Create: `services/uns-manager/ui/src/features/templates/TemplateEditorPanel.tsx`
- Create: `services/uns-manager/ui/src/tests/templates-flow.test.tsx`

**Interfaces:**
- Consumes:
  - `GET /api/v1/templates`
  - `GET /api/v1/templates/{id}`
  - `POST /api/v1/templates`
  - `PUT /api/v1/templates/{id}`
  - `DELETE /api/v1/templates/{id}`
- Produces:
  - `useTemplatesListQuery()`
  - `useTemplateDetailQuery(templateId: string | null)`
  - `useSaveTemplateMutation()`

- [ ] **Step 1: Write failing templates UI flow test**

```tsx
// services/uns-manager/ui/src/tests/templates-flow.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplatesWorkspace } from "../features/templates/TemplatesWorkspace";

test("edits display_name and saves template", async () => {
  const user = userEvent.setup();
  render(<TemplatesWorkspace />);

  await user.click(await screen.findByText("VESTAS_V90_2MW"));
  const input = await screen.findByLabelText("Display Name");
  await user.clear(input);
  await user.type(input, "Vestas V90 Updated");
  await user.click(screen.getByRole("button", { name: "Save" }));

  expect(await screen.findByText("Saved")) .toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix services/uns-manager/ui run test -- templates-flow.test.tsx`
Expected: FAIL because workspace and hooks are not implemented.

- [ ] **Step 3: Implement minimal list/editor workflow**

```ts
// services/uns-manager/ui/src/features/templates/api.ts
import { apiClient } from "../../shared/api/client";

export async function fetchTemplates(level?: string) {
  const params = level ? `?level=${level}` : "";
  return apiClient(`/api/v1/templates${params}`);
}

export async function updateTemplate(id: string, payload: Record<string, unknown>) {
  return apiClient(`/api/v1/templates/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}
```

```tsx
// services/uns-manager/ui/src/features/templates/TemplateEditorPanel.tsx (excerpt)
export function TemplateEditorPanel({ selectedId }: { selectedId: string | null }) {
  const detail = useTemplateDetailQuery(selectedId);
  const saveMutation = useSaveTemplateMutation();
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (detail.data) setDisplayName(detail.data.display_name);
  }, [detail.data]);

  return (
    <section>
      <label htmlFor="display-name">Display Name</label>
      <input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      <button onClick={() => selectedId && saveMutation.mutate({ id: selectedId, payload: { display_name: displayName } })}>
        Save
      </button>
      {saveMutation.isSuccess ? <p>Saved</p> : null}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix services/uns-manager/ui run test -- templates-flow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/uns-manager/ui/src/features/templates services/uns-manager/ui/src/tests/templates-flow.test.tsx
git commit -m "feat: implement templates list and editor flows"
```

### Task 5: Implement Template Children and Informational Tables

**Files:**
- Create: `services/uns-manager/ui/src/features/templates/TemplateChildrenTable.tsx`
- Create: `services/uns-manager/ui/src/features/templates/TemplateInformationalTable.tsx`
- Create: `services/uns-manager/ui/src/tests/template-informational-columns.test.tsx`

**Interfaces:**
- Consumes:
  - `GET/POST/DELETE /api/v1/templates/{id}/children`
  - `GET/POST/PUT/DELETE /api/v1/templates/{id}/informational`
- Produces:
  - Conditional columns by template level.

- [ ] **Step 1: Write failing conditional-columns test**

```tsx
// services/uns-manager/ui/src/tests/template-informational-columns.test.tsx
import { render, screen } from "@testing-library/react";
import { TemplateInformationalTable } from "../features/templates/TemplateInformationalTable";

test("shows range columns for subsystem", () => {
  render(<TemplateInformationalTable templateLevel="subsystem" rows={[]} onCreate={() => {}} onDelete={() => {}} />);
  expect(screen.getByText("range_min")).toBeInTheDocument();
  expect(screen.getByText("range_max")).toBeInTheDocument();
});

test("shows aggregation columns for equipment", () => {
  render(<TemplateInformationalTable templateLevel="equipment" rows={[]} onCreate={() => {}} onDelete={() => {}} />);
  expect(screen.getByText("agg_type")).toBeInTheDocument();
  expect(screen.getByText("source_field")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix services/uns-manager/ui run test -- template-informational-columns.test.tsx`
Expected: FAIL because table component does not exist.

- [ ] **Step 3: Implement children and informational tables**

```tsx
// services/uns-manager/ui/src/features/templates/TemplateInformationalTable.tsx (excerpt)
export function TemplateInformationalTable({ templateLevel, rows }: Props) {
  const isSubsystem = templateLevel === "subsystem";
  return (
    <table>
      <thead>
        <tr>
          <th>name</th>
          <th>unit</th>
          {isSubsystem ? <th>range_min</th> : <th>agg_type</th>}
          {isSubsystem ? <th>range_max</th> : <th>source_field</th>}
        </tr>
      </thead>
      <tbody>{rows.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.unit}</td></tr>)}</tbody>
    </table>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix services/uns-manager/ui run test -- template-informational-columns.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/uns-manager/ui/src/features/templates/TemplateChildrenTable.tsx services/uns-manager/ui/src/features/templates/TemplateInformationalTable.tsx services/uns-manager/ui/src/tests/template-informational-columns.test.tsx
git commit -m "feat: add templates children and informational tables"
```

### Task 6: Implement Assets Workspace (Tree, Inspector, Manual + From-Template)

**Files:**
- Create: `services/uns-manager/ui/src/features/assets/types.ts`
- Create: `services/uns-manager/ui/src/features/assets/api.ts`
- Create: `services/uns-manager/ui/src/features/assets/hooks.ts`
- Create: `services/uns-manager/ui/src/features/assets/AssetsTreePanel.tsx`
- Create: `services/uns-manager/ui/src/features/assets/AssetInspectorPanel.tsx`
- Create: `services/uns-manager/ui/src/features/assets/CreateAssetActions.tsx`
- Create: `services/uns-manager/ui/src/tests/assets-from-template.test.tsx`

**Interfaces:**
- Consumes:
  - `GET /api/v1/tree`
  - `GET /api/v1/assets/{id}`
  - `POST /api/v1/assets`
  - `POST /api/v1/assets/from-template`
  - `PUT /api/v1/assets/{id}`
  - `DELETE /api/v1/assets/{id}`
- Produces:
  - `useAssetsTreeQuery()`
  - `useCreateAssetMutation()`
  - `useCreateFromTemplateMutation()`

- [ ] **Step 1: Write failing from-template UI action test**

```tsx
// services/uns-manager/ui/src/tests/assets-from-template.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateAssetActions } from "../features/assets/CreateAssetActions";

test("calls from-template action with selected template", async () => {
  const user = userEvent.setup();
  const onFromTemplate = vi.fn();

  render(
    <CreateAssetActions
      parentId="11111111-1111-1111-1111-111111111111"
      allowedTemplates={[{ id: "tpl-1", name: "VESTAS_V90_2MW" }]}
      onCreateManual={() => {}}
      onCreateFromTemplate={onFromTemplate}
    />
  );

  await user.selectOptions(screen.getByLabelText("Template"), "tpl-1");
  await user.click(screen.getByRole("button", { name: "Create from Template" }));

  expect(onFromTemplate).toHaveBeenCalledWith({ parent_id: "11111111-1111-1111-1111-111111111111", template_id: "tpl-1" });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix services/uns-manager/ui run test -- assets-from-template.test.tsx`
Expected: FAIL because actions component does not exist.

- [ ] **Step 3: Implement assets modules and actions**

```tsx
// services/uns-manager/ui/src/features/assets/CreateAssetActions.tsx
type TemplateOption = { id: string; name: string };

export function CreateAssetActions({ parentId, allowedTemplates, onCreateFromTemplate }: {
  parentId: string | null;
  allowedTemplates: TemplateOption[];
  onCreateManual: () => void;
  onCreateFromTemplate: (payload: { parent_id: string; template_id: string }) => void;
}) {
  const [templateId, setTemplateId] = useState("");
  return (
    <div>
      <label htmlFor="template-select">Template</label>
      <select id="template-select" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
        <option value="">Select template</option>
        {allowedTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
      </select>
      <button
        onClick={() => parentId && templateId && onCreateFromTemplate({ parent_id: parentId, template_id: templateId })}
      >
        Create from Template
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix services/uns-manager/ui run test -- assets-from-template.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/uns-manager/ui/src/features/assets services/uns-manager/ui/src/tests/assets-from-template.test.tsx
git commit -m "feat: implement assets tree inspector and from-template action"
```

### Task 7: Add UI Validation, Dirty Guard, and Error Presentation

**Files:**
- Create: `services/uns-manager/ui/src/shared/validation/assetName.ts`
- Create: `services/uns-manager/ui/src/shared/forms/useDirtyGuard.ts`
- Create: `services/uns-manager/ui/src/shared/ui/ErrorBanner.tsx`
- Create: `services/uns-manager/ui/src/tests/asset-name-validation.test.ts`
- Modify: `services/uns-manager/ui/src/features/assets/AssetInspectorPanel.tsx`
- Modify: `services/uns-manager/ui/src/features/templates/TemplateEditorPanel.tsx`

**Interfaces:**
- Consumes:
  - API error shape `{ detail: string }`.
- Produces:
  - `validateAssetName(name: string): string | null`
  - `useDirtyGuard(isDirty: boolean): { confirmNavigation: () => boolean }`

- [ ] **Step 1: Write failing validation test**

```ts
// services/uns-manager/ui/src/tests/asset-name-validation.test.ts
import { validateAssetName } from "../shared/validation/assetName";

test("rejects lowercase names", () => {
  expect(validateAssetName("site_a")).toContain("^[A-Z0-9_]+$");
});

test("accepts uppercase underscore names", () => {
  expect(validateAssetName("SITE_A")).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix services/uns-manager/ui run test -- asset-name-validation.test.ts`
Expected: FAIL because validator does not exist.

- [ ] **Step 3: Implement validation and dirty guard**

```ts
// services/uns-manager/ui/src/shared/validation/assetName.ts
const NAME_RE = /^[A-Z0-9_]+$/;

export function validateAssetName(name: string): string | null {
  if (!NAME_RE.test(name)) {
    return "Asset name must match ^[A-Z0-9_]+$";
  }
  return null;
}
```

```ts
// services/uns-manager/ui/src/shared/forms/useDirtyGuard.ts
export function useDirtyGuard(isDirty: boolean) {
  function confirmNavigation() {
    if (!isDirty) return true;
    return window.confirm("You have unsaved changes. Continue?");
  }
  return { confirmNavigation };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix services/uns-manager/ui run test -- asset-name-validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/uns-manager/ui/src/shared services/uns-manager/ui/src/features/assets/AssetInspectorPanel.tsx services/uns-manager/ui/src/features/templates/TemplateEditorPanel.tsx services/uns-manager/ui/src/tests/asset-name-validation.test.ts
git commit -m "feat: add ui validation dirty guard and error banners"
```

### Task 8: Add Browser E2E and Final Build Integration

**Files:**
- Create: `services/uns-manager/ui/playwright.config.ts`
- Create: `services/uns-manager/ui/tests-e2e/templates-assets-critical.spec.ts`
- Modify: `services/uns-manager/Dockerfile`
- Modify: `services/uns-manager/main.py`
- Create: `services/uns-manager/ui/src/tests/status-polling.test.tsx`

**Interfaces:**
- Consumes:
  - Running stack with `uns-manager` API.
- Produces:
  - Browser critical path validation.
  - Static bundle served by FastAPI in container.

- [ ] **Step 1: Write failing critical E2E test**

```ts
// services/uns-manager/ui/tests-e2e/templates-assets-critical.spec.ts
import { test, expect } from "@playwright/test";

test("templates and assets critical flow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Templates" }).click();
  await expect(page.getByText("TEMPLATES")).toBeVisible();
  await page.getByRole("button", { name: "Assets" }).click();
  await expect(page.getByText("ISA-95")).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix services/uns-manager/ui run test:e2e -- --project=chromium`
Expected: FAIL because final UI wiring and e2e config are not complete.

- [ ] **Step 3: Implement build serving and e2e wiring**

```dockerfile
# services/uns-manager/Dockerfile (multi-stage excerpt)
FROM node:20-alpine AS ui-build
WORKDIR /ui
COPY ui/package*.json ./
RUN npm ci
COPY ui ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
COPY --from=ui-build /ui/dist /app/ui/dist
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
```

```python
# services/uns-manager/main.py (SPA fallback excerpt)
from fastapi import Request

@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str, request: Request):
    if full_path.startswith("api/") or full_path == "health":
        return {"detail": "Not Found"}
    return FileResponse(UI_DIST / "index.html")
```

- [ ] **Step 4: Run end-to-end verification**

Run: `npm --prefix services/uns-manager/ui run test`
Expected: PASS for unit/integration tests.

Run: `npm --prefix services/uns-manager/ui run test:e2e -- --project=chromium`
Expected: PASS for critical browser flow.

Run: `docker compose up -d --build uns-manager`
Expected: UI available at `http://localhost:8002/` and API endpoints continue to work.

- [ ] **Step 5: Commit**

```bash
git add services/uns-manager/Dockerfile services/uns-manager/main.py services/uns-manager/ui/playwright.config.ts services/uns-manager/ui/tests-e2e services/uns-manager/ui/src/tests/status-polling.test.tsx
git commit -m "feat: add ui e2e coverage and static build integration"
```

## Final Verification Gate

- [ ] Run: `python -m pytest tests/integration tests/contracts tests/smoke tests/unit tests/e2e -v`
- [ ] Run: `npm --prefix services/uns-manager/ui run test`
- [ ] Run: `npm --prefix services/uns-manager/ui run test:e2e -- --project=chromium`
- [ ] Run: `docker compose up -d --build`
- [ ] Run: `curl.exe -s http://localhost:8002/health`
- [ ] Run: `curl.exe -s http://localhost:8002/api/v1/status`
- [ ] Expected: API healthy, status includes sync fields, UI root served.

## Self-Review

### 1. Spec Coverage

- Modular UI architecture by domain: covered in Tasks 3 to 7.
- Dense industrial layout foundation: covered in Tasks 3, 4, and 6.
- Templates full management (including children and informational): covered in Tasks 4 and 5.
- Assets full management with from-template: covered in Task 6.
- Sync state through extended `/api/v1/status`: covered in Task 2 and consumed in Task 3.
- Validation, errors, and dirty guard: covered in Task 7.
- Browser critical flow and static serving integration: covered in Task 8.

### 2. Placeholder Scan

- No `TODO`, `TBD`, or deferred implementation markers remain.
- Every task includes explicit files, commands, and concrete code snippets.

### 3. Type and Interface Consistency

- `StatusResponse` shape is consistently referenced for status-sync feature and badge.
- Asset/template action signatures are consistent between components and tests.
- Validation signature `validateAssetName(name: string): string | null` is reused consistently.
