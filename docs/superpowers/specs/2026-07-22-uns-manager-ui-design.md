# UNS Manager UI Design (Subproject 3)

Date: 2026-07-22
Status: Approved for planning
Scope Type: Subproject design

## 1. Context

This design defines the UNS Manager Web UI subproject on top of the existing backend foundation:

- `uns-manager` API is operational for templates, assets, informational fields, and recursive instantiation.
- `sync-service` is operational for full sync and incremental retained publishing to MQTT.
- The UI does not exist yet in the repository.

The objective of this subproject is to deliver an almost-complete operational UI for Templates and Assets management, while preserving fixed backend contract names and endpoint structure.

## 2. Product Goal and Scope

### Goal

Provide a production-ready React SPA for UNS management that allows operators/admins to:

- Manage templates end-to-end.
- Manage ISA-95 assets end-to-end.
- Instantiate assets from templates in-context.
- See sync health in the same interface.

### In Scope

- UI shell with two main sections: `Templates` and `Assets`.
- Dense, operator-first workspace based on the approved mockup direction **A (Industrial Dense)**.
- JSON editing for descriptive/analytical fields.
- Children/informational management for templates.
- ISA-95 tree + inspector for assets.
- Manual and from-template asset creation.
- Status bar with counters and sync state.
- Sync health consumed only through `GET /api/v1/status`.

### Out of Scope

- Direct MQTT connections from browser.
- Real-time SCADA telemetry widgets.
- Analytics dashboards beyond operational counters and sync indicators.

## 3. Constraints

- Keep existing API routes and payload names unchanged (`/api/v1/...`, `asset_level`, `descriptive`, `analytical`, `informational_fields`, `template_id`, `parent_id`).
- Frontend consumes only UNS Manager API; it must not call `sync-service` directly.
- Sync state in UI is hybrid but exposed by `uns-manager` via extended `/api/v1/status`.
- UI is served as static build by FastAPI in the `uns-manager` container.

## 4. UX Direction (Approved)

Approved visual base: **A — Industrial Dense**.

Design characteristics:

- High information density.
- Persistent left navigation/list pane.
- Inspector-first right pane.
- Compact tables for informational fields.
- Always-visible operational footer/status strip.

This favors speed for frequent operators over progressive, wizard-like flows.

## 5. Architecture (Frontend Modular by Domain)

The SPA is organized by feature boundaries:

- `features/templates`
- `features/assets`
- `features/status-sync`
- shared foundation (`app/layout`, shared UI primitives, API utilities)

Each feature contains focused units:

- `api`: route-specific HTTP client functions.
- `hooks`: react-query hooks and view-model logic.
- `components`: feature UI components.
- `types`: domain contracts used by the feature.

This prevents monolithic pages and keeps behavior testable and independently evolvable.

## 6. UI Structure and Components

### 6.1 Global Shell

- Top bar with section tabs (`Templates`, `Assets`).
- Sync badge (`healthy`, `degraded`, `down`) and tooltip detail.
- Footer strip with counters (`assets`, `fields`, `templates`) and update timestamp.

### 6.2 Templates Section

- `TemplateListPanel`: grouped by ISA level, with search and quick actions.
- `TemplateEditorPanel`: metadata + JSON editors (`descriptive`, `analytical`).
- `TemplateChildrenTable`: add/remove child templates, optional flag, sort order.
- `TemplateInformationalTable`: dynamic columns by level:
  - subsystem: `range_min/range_max`
  - other levels: `agg_type/source_field`

Actions:

- create template
- update template
- delete template
- import/export template JSON

### 6.3 Assets Section

- `AssetsTreePanel`: ISA-95 hierarchical tree.
- `AssetInspectorPanel`: selected node details and editable payloads.
- `AssetInformationalTable`: per-asset informational CRUD with level-aware form behavior.
- `CreateAssetActions`: manual creation and from-template creation with level-constrained options.

Actions:

- create asset manually
- create asset from template
- update asset (including rename with server-driven `uns_path` cascade)
- delete asset

## 7. Data Flow and Interaction Model

- React Query manages read/write operations and cache invalidation per domain key.
- Mutations are optimistic only where safe; default is confirmed-update with explicit success/error feedback.
- Editing is local-first with dirty tracking:
  - `Save`
  - `Discard`
  - navigation guard when unsaved changes exist
- Status polling:
- `/api/v1/status` is polled every 5 seconds.
  - sync badge and counters are updated from this endpoint only.

## 8. Validation and Error Handling

Client-side pre-validation mirrors server rules to reduce round trips:

- asset naming regex (`^[A-Z0-9_]+$`)
- ISA-95 parent/child constraints in creation forms
- informational field level rules:
  - subsystem requires ranges and forbids aggregation fields
  - non-subsystem requires aggregation semantics

Error display policy:

- inline panel error for contextual failures
- short toast for operation result
- API `detail` is preserved to keep deterministic operator feedback

## 9. Backend Extension for UI Sync Visibility

`GET /api/v1/status` is extended (backward compatible) with sync health fields:

- `sync_state`: `healthy | degraded | down`
- `mqtt_connected`: boolean
- `last_sync_at`: timestamp or null
- `sync_lag_seconds`: numeric

Compatibility rule:

- existing fields remain unchanged
- new fields are additive/optional

## 10. Testing Strategy for UI Subproject

### Unit/Component

- Render and behavior tests for core panels and forms.
- Validation behavior by level/field type.
- Sync badge state mapping from `/api/v1/status` payload.

### Frontend Integration

- Templates flows: create/edit/delete/import/export.
- Assets flows: tree selection, inspect/edit, create manual, create from template.
- Error and loading state behavior consistency.

### E2E

- Full critical path through browser:
  - create template and child config
  - instantiate asset from template
  - edit informational fields
  - verify sync indicator state presentation

## 11. Acceptance Criteria

UI subproject is accepted when:

1. Templates and Assets are operational end-to-end from the SPA.
2. From-template creation is available and level-constrained in the UI.
3. Validation and error messages are clear and deterministic.
4. Sync indicator is visible and sourced only from `/api/v1/status`.
5. Frontend unit/integration/e2e suites for critical paths pass.
6. Static frontend build is served by `uns-manager` container.

## 12. Risks and Mitigations

- Risk: dense layout becomes visually noisy.
  - Mitigation: strict visual hierarchy, spacing scale, and consistent grouping.
- Risk: drift between client and server validation rules.
  - Mitigation: keep server as source of truth; client validation is advisory and covered by tests.
- Risk: sync badge becomes misleading without clear semantics.
  - Mitigation: explicit state model (`healthy/degraded/down`) and tooltip reason fields.

---

Design approval source: interactive brainstorming with visual mockup comparison; final UX direction approved as Industrial Dense (A).
