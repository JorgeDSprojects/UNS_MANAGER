# UNS Manager DB + API Design (Subproject 1)

Date: 2026-07-21
Status: Approved for planning
Scope Type: Subproject design

## 1. Context

This design defines the first subproject for UNS Manager implementation:

- PostgreSQL schema `uns_registry` as the single source of truth.
- Fixed API contracts for Templates, Assets, and Informational Fields.
- Recursive instantiation endpoint: `POST /api/v1/assets/from-template`.
- Verification through contract tests, real PostgreSQL integration tests, and one HTTP smoke test for recursive instantiation.

The current workspace contains technical definition material only and no existing runnable codebase. This document turns that definition into an implementation-ready design boundary for a first execution cycle.

## 2. Goals and Non-Goals

### Goals

- Preserve the existing contract semantics and payload structure exactly as defined.
- Deliver a robust MVP for DB + API, including transactional recursion from template.
- Define deterministic behavior for validations, errors, and path computation.
- Provide testable acceptance criteria tied to HTTP behavior and persisted PostgreSQL state.

### Non-Goals

- No UI implementation in this subproject.
- No Sync Service or MQTT publishing in this subproject.
- No bootstrap dataset loading beyond what tests require.
- No LLM-based contract generation or runtime dependency.

## 3. Scope Boundary

### In Scope

- DDL for `asset_templates`, `template_children`, `template_informational`, `assets`, `asset_informational`, enums, indexes, and triggers from the technical definition.
- API routes under `/api/v1` for templates, assets, and informational CRUD.
- Business validations for ISA-95 hierarchy and informational field rules by level.
- Recursive instantiation from template in one SQL transaction.

### Out of Scope

- Frontend SPA and static asset serving behavior.
- LISTEN/NOTIFY consumer behavior in Sync Service.
- MQTT topic correctness tests.
- Integration with downstream services (Alarm, ML, Aggregator, ERP connector).

## 4. Architecture (Approach A: Simple Layered)

The implementation uses a simple layered architecture:

- `routers`: HTTP parsing, response codes, and DTO mapping.
- `services`: business rules, orchestration, hierarchy checks, path recalculation, and transactions.
- `db`: SQL access via parameterized async queries.

### Design Intent

- Keep routers thin and deterministic.
- Keep domain rules centralized in service functions.
- Keep SQL explicit and transparent to align with strict data constraints.
- Preserve maintainability while avoiding over-architecture in the first cycle.

## 5. Data Model and Invariants

### Core Invariants

- `enterprise` has no parent; every other level must have a parent.
- Parent-child level transitions are strict and consecutive:
  - `enterprise -> site`
  - `site -> area`
  - `area -> equipment`
  - `equipment -> subsystem`
- `uns_path` is always backend-generated and unique.
- `UNIQUE(parent_id, name)` prevents sibling duplication.
- `assets.template_id` is informative only; template changes do not retroactively mutate existing instances.

### Informational Rules by Level

- `subsystem` informational fields:
  - `range_min` and `range_max` required.
  - `agg_type` and `source_field` must be `NULL`.
- `enterprise/site/area/equipment` informational fields:
  - `agg_type` required.
  - `range_min` and `range_max` must be `NULL`.
  - `source_field` required unless `agg_type = custom`.

Rules are enforced at two levels:

- Service-layer validation for clear API errors.
- DB constraints/checks for final integrity enforcement.

## 6. Fixed API Contract Policy

Contract is fixed for this subproject. No field renaming or structure changes are allowed for:

- Paths (`/api/v1/...`).
- Request/response body keys (`asset_level`, `descriptive`, `analytical`, `informational`, etc.).
- Behavior of template/asset/informational endpoints described in the definition document.

Any improvement must preserve compatibility, or be deferred to a later versioning strategy outside this subproject.

## 7. Critical Workflow: Recursive Instantiation

Endpoint: `POST /api/v1/assets/from-template`

### Input

- `parent_id` (nullable only for enterprise root creation).
- `template_id`.
- `name`.
- Optional `descriptive_overrides`, `analytical_overrides`.

### Algorithmic Behavior

1. Validate parent existence and level compatibility.
2. Load root template.
3. Compute merged root payloads (`template base + overrides`).
4. Compute root `uns_path` from parent path or `uns/v1/{name}`.
5. Insert root asset.
6. Copy all root `template_informational` rows into `asset_informational`.
7. Resolve required children (`is_optional = false`) ordered by `sort_order`.
8. Recursively instantiate each child with template defaults.
9. Commit once; rollback all if any step fails.

### Transaction Boundary

- A single SQL transaction wraps the full recursive operation.
- No partial tree is allowed to persist.

## 8. Error Model

### HTTP Status Mapping

- `400 Bad Request`: domain rule violations (invalid hierarchy relation, invalid field combination by level).
- `404 Not Found`: missing referenced entity (`parent_id`, `template_id`, resource id).
- `409 Conflict`: uniqueness violations and state conflicts.
- `422 Unprocessable Entity`: schema/type validation errors from request model.
- `500 Internal Server Error`: unexpected failures.

### Error Response Principles

- Deterministic messages, no ambiguous wording.
- Include operation context (resource and rule) for rapid client remediation.
- Avoid leaking low-level internal stack details.

## 9. Testing Strategy

### A. Contract Tests

- Validate required/optional fields and response shapes for key endpoints.
- Validate expected status codes for happy path and negative path.
- Validate fixed key names and value types per contract.

### B. Real PostgreSQL Integration Tests

- Execute against actual PostgreSQL schema `uns_registry`.
- Verify persisted state after create/update/delete operations.
- Verify constraints and hierarchy protections.

### C. HTTP Smoke Test (Recursive Instantiation)

End-to-end HTTP flow must verify:

- Template creation with informational fields.
- Parent hierarchy creation.
- Recursive `from-template` execution.
- Existence of instantiated subtree and copied informational rows.

## 10. Acceptance Criteria (Done for Subproject 1)

Subproject is accepted when all of the following are true:

1. Contract behavior matches the fixed definition for DB/API scope.
2. Recursive instantiation is transactional and rollback-safe.
3. Contract tests pass.
4. PostgreSQL integration tests pass.
5. Recursive HTTP smoke test passes.
6. No LLM-based mechanism is required for contract definition or runtime behavior.

## 11. Risks and Mitigations

- Risk: service-layer and DB-layer validations diverge.
  - Mitigation: test negative cases in both layers and keep rule ownership centralized in service helpers.
- Risk: recursive operation complexity grows with deep templates.
  - Mitigation: explicit ordering, transaction-scoped recursion, and bounded test fixtures.
- Risk: accidental contract drift during implementation.
  - Mitigation: contract tests become mandatory quality gate for this subproject.

## 12. Deliverables for Next Phase

This design is intentionally implementation-ready for planning. The next phase should produce:

- A concrete task plan for schema, routes, services, and tests.
- Ordered milestones with verification commands.
- Explicit mapping from each acceptance criterion to one or more tests.

---

Design approval source: interactive brainstorming session with the project owner.
