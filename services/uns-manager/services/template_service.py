from __future__ import annotations

from typing import Any
from uuid import UUID

from asyncpg import Connection
from asyncpg.exceptions import UniqueViolationError

from models.schemas import InformationalFieldCreate, InformationalFieldUpdate, TemplateCreate, TemplateUpdate
from services.errors import DomainError

LEVEL_ORDER = {
    "enterprise": 0,
    "site": 1,
    "area": 2,
    "equipment": 3,
    "subsystem": 4,
}

_TEMPLATE_UPDATE_FIELDS = ("display_name", "description", "descriptive", "analytical", "icon")
_INFO_UPDATE_FIELDS = (
    "unit",
    "range_min",
    "range_max",
    "agg_type",
    "source_field",
    "category",
    "is_primary",
    "chart_type",
    "chart_window",
    "chart_thresholds",
    "aliases_es",
    "aliases_en",
    "description_es",
    "description_en",
)


def _to_dict(row: Any) -> dict[str, Any]:
    return dict(row)


def _affected_rows(command_result: str) -> int:
    return int(command_result.rsplit(" ", maxsplit=1)[-1])


def _validate_child_level(parent_level: str, child_level: str) -> None:
    if LEVEL_ORDER[child_level] - LEVEL_ORDER[parent_level] != 1:
        raise DomainError(status_code=400, message="Template child level must be consecutive")


def _validate_informational_for_level(level: str, values: dict[str, Any]) -> None:
    range_min = values.get("range_min")
    range_max = values.get("range_max")
    agg_type = values.get("agg_type")
    source_field = values.get("source_field")

    if level == "subsystem":
        if range_min is None or range_max is None:
            raise DomainError(400, "subsystem requires range_min and range_max")
        if agg_type is not None or source_field is not None:
            raise DomainError(400, "subsystem cannot define agg_type/source_field")
        return

    if agg_type is None:
        raise DomainError(400, "non-subsystem requires agg_type")
    if range_min is not None or range_max is not None:
        raise DomainError(400, "non-subsystem cannot define range_min/range_max")
    if agg_type == "custom":
        if source_field is not None:
            raise DomainError(400, "source_field must be null when agg_type=custom")
        return

    if source_field is None or not source_field.strip():
        raise DomainError(400, "source_field is required unless agg_type=custom")


async def _get_template_level(conn: Connection, template_id: UUID | str) -> str:
    level = await conn.fetchval(
        "SELECT level::text FROM uns_registry.asset_templates WHERE id = $1",
        template_id,
    )
    if level is None:
        raise DomainError(404, "Template not found")
    return level


async def create_template(conn: Connection, payload: TemplateCreate) -> dict[str, Any]:
    try:
        row = await conn.fetchrow(
            """
            INSERT INTO uns_registry.asset_templates (
                level,
                name,
                display_name,
                description,
                descriptive,
                analytical,
                icon
            )
            VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
            RETURNING *
            """,
            payload.level,
            payload.name,
            payload.display_name,
            payload.description,
            payload.descriptive,
            payload.analytical,
            payload.icon,
        )
    except UniqueViolationError as exc:
        raise DomainError(409, "Template name already exists") from exc

    return _to_dict(row)


async def list_templates(conn: Connection, level: str | None) -> list[dict[str, Any]]:
    if level is None:
        rows = await conn.fetch(
            """
            SELECT *
            FROM uns_registry.asset_templates
            ORDER BY level, name
            """
        )
    else:
        rows = await conn.fetch(
            """
            SELECT *
            FROM uns_registry.asset_templates
            WHERE level = $1
            ORDER BY name
            """,
            level,
        )

    return [_to_dict(row) for row in rows]


async def get_template(conn: Connection, template_id: UUID | str) -> dict[str, Any]:
    row = await conn.fetchrow(
        "SELECT * FROM uns_registry.asset_templates WHERE id = $1",
        template_id,
    )
    if row is None:
        raise DomainError(404, "Template not found")

    children_rows = await conn.fetch(
        """
        SELECT
            tc.id,
            tc.parent_template_id,
            tc.child_template_id,
            child.level::text AS child_level,
            child.name AS child_name,
            child.display_name AS child_display_name,
            tc.sort_order,
            tc.is_optional
        FROM uns_registry.template_children tc
        JOIN uns_registry.asset_templates child
            ON child.id = tc.child_template_id
        WHERE tc.parent_template_id = $1
        ORDER BY tc.sort_order, child.name
        """,
        template_id,
    )

    informational_rows = await conn.fetch(
        """
        SELECT *
        FROM uns_registry.template_informational
        WHERE template_id = $1
        ORDER BY name
        """,
        template_id,
    )

    result = _to_dict(row)
    result["children"] = [_to_dict(child) for child in children_rows]
    result["informational"] = [_to_dict(info) for info in informational_rows]
    return result


async def update_template(
    conn: Connection,
    template_id: UUID | str,
    payload: TemplateUpdate,
) -> dict[str, Any]:
    updates = payload.model_dump(exclude_unset=True)
    updates = {key: value for key, value in updates.items() if key in _TEMPLATE_UPDATE_FIELDS}

    if not updates:
        row = await conn.fetchrow(
            "SELECT * FROM uns_registry.asset_templates WHERE id = $1",
            template_id,
        )
        if row is None:
            raise DomainError(404, "Template not found")
        return _to_dict(row)

    assignments: list[str] = []
    values: list[Any] = [template_id]
    for index, (field, value) in enumerate(updates.items(), start=2):
        assignments.append(f"{field} = ${index}")
        values.append(value)

    query = (
        "UPDATE uns_registry.asset_templates "
        f"SET {', '.join(assignments)} "
        "WHERE id = $1 RETURNING *"
    )

    row = await conn.fetchrow(query, *values)
    if row is None:
        raise DomainError(404, "Template not found")
    return _to_dict(row)


async def delete_template(conn: Connection, template_id: UUID | str) -> None:
    row = await conn.fetchrow(
        "DELETE FROM uns_registry.asset_templates WHERE id = $1 RETURNING id",
        template_id,
    )
    if row is None:
        raise DomainError(404, "Template not found")


async def get_template_children(conn: Connection, template_id: UUID | str) -> list[dict[str, Any]]:
    await _get_template_level(conn, template_id)

    rows = await conn.fetch(
        """
        SELECT
            tc.id,
            tc.parent_template_id,
            tc.child_template_id,
            child.level::text AS child_level,
            child.name AS child_name,
            child.display_name AS child_display_name,
            tc.sort_order,
            tc.is_optional
        FROM uns_registry.template_children tc
        JOIN uns_registry.asset_templates child
            ON child.id = tc.child_template_id
        WHERE tc.parent_template_id = $1
        ORDER BY tc.sort_order, child.name
        """,
        template_id,
    )

    return [_to_dict(row) for row in rows]


async def add_template_child(
    conn: Connection,
    template_id: UUID | str,
    child_id: UUID | str,
    sort_order: int,
    is_optional: bool,
) -> dict[str, Any]:
    parent_level = await _get_template_level(conn, template_id)
    child_level = await _get_template_level(conn, child_id)

    _validate_child_level(parent_level, child_level)

    try:
        row = await conn.fetchrow(
            """
            INSERT INTO uns_registry.template_children (
                parent_template_id,
                child_template_id,
                sort_order,
                is_optional
            )
            VALUES ($1, $2, $3, $4)
            RETURNING *
            """,
            template_id,
            child_id,
            sort_order,
            is_optional,
        )
    except UniqueViolationError as exc:
        raise DomainError(409, "Template child already linked") from exc

    child = await conn.fetchrow(
        "SELECT level::text AS child_level, name AS child_name, display_name AS child_display_name "
        "FROM uns_registry.asset_templates WHERE id = $1",
        child_id,
    )
    if child is None:
        raise DomainError(404, "Template not found")

    result = _to_dict(row)
    result.update(_to_dict(child))
    return result


async def delete_template_child(conn: Connection, template_id: UUID | str, child_id: UUID | str) -> None:
    await _get_template_level(conn, template_id)

    delete_result = await conn.execute(
        """
        DELETE FROM uns_registry.template_children
        WHERE parent_template_id = $1 AND child_template_id = $2
        """,
        template_id,
        child_id,
    )
    if _affected_rows(delete_result) == 0:
        raise DomainError(404, "Template child link not found")


async def get_template_informational(conn: Connection, template_id: UUID | str) -> list[dict[str, Any]]:
    await _get_template_level(conn, template_id)

    rows = await conn.fetch(
        """
        SELECT *
        FROM uns_registry.template_informational
        WHERE template_id = $1
        ORDER BY name
        """,
        template_id,
    )
    return [_to_dict(row) for row in rows]


async def create_template_informational(
    conn: Connection,
    template_id: UUID | str,
    payload: InformationalFieldCreate,
) -> dict[str, Any]:
    template_level = await _get_template_level(conn, template_id)

    payload_values = payload.model_dump()
    _validate_informational_for_level(template_level, payload_values)

    try:
        row = await conn.fetchrow(
            """
            INSERT INTO uns_registry.template_informational (
                template_id,
                name,
                unit,
                data_type,
                range_min,
                range_max,
                agg_type,
                source_field,
                category,
                is_primary,
                chart_type,
                chart_window,
                chart_thresholds,
                aliases_es,
                aliases_en,
                description_es,
                description_en
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11,
                $12,
                $13,
                $14,
                $15,
                $16,
                $17
            )
            RETURNING *
            """,
            template_id,
            payload.name,
            payload.unit,
            payload.data_type,
            payload.range_min,
            payload.range_max,
            payload.agg_type,
            payload.source_field,
            payload.category,
            payload.is_primary,
            payload.chart_type,
            payload.chart_window,
            payload.chart_thresholds,
            payload.aliases_es,
            payload.aliases_en,
            payload.description_es,
            payload.description_en,
        )
    except UniqueViolationError as exc:
        raise DomainError(409, "Informational field name already exists for template") from exc

    return _to_dict(row)


async def update_template_informational(
    conn: Connection,
    field_id: UUID | str,
    payload: InformationalFieldUpdate,
) -> dict[str, Any]:
    existing_row = await conn.fetchrow(
        """
        SELECT ti.*, t.level::text AS template_level
        FROM uns_registry.template_informational ti
        JOIN uns_registry.asset_templates t ON t.id = ti.template_id
        WHERE ti.id = $1
        """,
        field_id,
    )
    if existing_row is None:
        raise DomainError(404, "Template informational field not found")

    updates = payload.model_dump(exclude_unset=True)
    if "is_active" in updates:
        raise DomainError(400, "is_active is not allowed for template informational fields")

    if not updates:
        row = await conn.fetchrow(
            "SELECT * FROM uns_registry.template_informational WHERE id = $1",
            field_id,
        )
        if row is None:
            raise DomainError(404, "Template informational field not found")
        return _to_dict(row)

    merged_values = _to_dict(existing_row)
    merged_values.update(updates)
    _validate_informational_for_level(merged_values["template_level"], merged_values)

    allowed_updates = {key: value for key, value in updates.items() if key in _INFO_UPDATE_FIELDS}
    if not allowed_updates:
        row = await conn.fetchrow(
            "SELECT * FROM uns_registry.template_informational WHERE id = $1",
            field_id,
        )
        if row is None:
            raise DomainError(404, "Template informational field not found")
        return _to_dict(row)

    assignments: list[str] = []
    values: list[Any] = [field_id]
    for index, (field, value) in enumerate(allowed_updates.items(), start=2):
        assignments.append(f"{field} = ${index}")
        values.append(value)

    query = (
        "UPDATE uns_registry.template_informational "
        f"SET {', '.join(assignments)} "
        "WHERE id = $1 RETURNING *"
    )

    try:
        row = await conn.fetchrow(query, *values)
    except UniqueViolationError as exc:
        raise DomainError(409, "Informational field name already exists for template") from exc

    if row is None:
        raise DomainError(404, "Template informational field not found")
    return _to_dict(row)


async def delete_template_informational(conn: Connection, field_id: UUID | str) -> None:
    deleted = await conn.fetchrow(
        "DELETE FROM uns_registry.template_informational WHERE id = $1 RETURNING id",
        field_id,
    )
    if deleted is None:
        raise DomainError(404, "Template informational field not found")
