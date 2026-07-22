from __future__ import annotations

from typing import Any
from uuid import UUID

from asyncpg import Connection
from asyncpg.exceptions import UniqueViolationError

from models.schemas import InformationalFieldCreate, InformationalFieldUpdate
from services.errors import DomainError

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
    "is_active",
)


def _to_dict(row: Any) -> dict[str, Any]:
    return dict(row)


def _validate_by_level(asset_level: str, values: dict[str, Any]) -> None:
    range_min = values.get("range_min")
    range_max = values.get("range_max")
    agg_type = values.get("agg_type")
    source_field = values.get("source_field")

    if asset_level == "subsystem":
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


async def get_asset_level(conn: Connection, asset_id: UUID | str) -> str:
    asset_level = await conn.fetchval(
        "SELECT asset_level::text FROM uns_registry.assets WHERE id = $1",
        asset_id,
    )
    if asset_level is None:
        raise DomainError(404, "Asset not found")
    return asset_level


async def get_asset_informational(conn: Connection, asset_id: UUID | str) -> list[dict[str, Any]]:
    await get_asset_level(conn, asset_id)
    rows = await conn.fetch(
        """
        SELECT *
        FROM uns_registry.asset_informational
        WHERE asset_id = $1
        ORDER BY name
        """,
        asset_id,
    )
    return [_to_dict(row) for row in rows]


async def create_asset_informational(
    conn: Connection,
    asset_id: UUID | str,
    payload: InformationalFieldCreate,
) -> dict[str, Any]:
    asset_level = await get_asset_level(conn, asset_id)

    values = payload.model_dump()
    _validate_by_level(asset_level, values)

    try:
        row = await conn.fetchrow(
            """
            INSERT INTO uns_registry.asset_informational (
                asset_id,
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
            asset_id,
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
        raise DomainError(409, "Informational field name already exists for asset") from exc

    return _to_dict(row)


async def update_asset_informational(
    conn: Connection,
    field_id: UUID | str,
    payload: InformationalFieldUpdate,
) -> dict[str, Any]:
    existing_row = await conn.fetchrow(
        """
        SELECT ai.*, a.asset_level::text AS asset_level
        FROM uns_registry.asset_informational ai
        JOIN uns_registry.assets a ON a.id = ai.asset_id
        WHERE ai.id = $1
        """,
        field_id,
    )
    if existing_row is None:
        raise DomainError(404, "Asset informational field not found")

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        row = await conn.fetchrow(
            "SELECT * FROM uns_registry.asset_informational WHERE id = $1",
            field_id,
        )
        if row is None:
            raise DomainError(404, "Asset informational field not found")
        return _to_dict(row)

    merged_values = _to_dict(existing_row)
    merged_values.update(updates)
    _validate_by_level(merged_values["asset_level"], merged_values)

    allowed_updates = {key: value for key, value in updates.items() if key in _INFO_UPDATE_FIELDS}
    if not allowed_updates:
        row = await conn.fetchrow(
            "SELECT * FROM uns_registry.asset_informational WHERE id = $1",
            field_id,
        )
        if row is None:
            raise DomainError(404, "Asset informational field not found")
        return _to_dict(row)

    assignments: list[str] = []
    values: list[Any] = [field_id]
    for index, (field, value) in enumerate(allowed_updates.items(), start=2):
        assignments.append(f"{field} = ${index}")
        values.append(value)

    query = (
        "UPDATE uns_registry.asset_informational "
        f"SET {', '.join(assignments)} "
        "WHERE id = $1 RETURNING *"
    )

    try:
        row = await conn.fetchrow(query, *values)
    except UniqueViolationError as exc:
        raise DomainError(409, "Informational field name already exists for asset") from exc

    if row is None:
        raise DomainError(404, "Asset informational field not found")

    return _to_dict(row)


async def delete_asset_informational(conn: Connection, field_id: UUID | str) -> None:
    row = await conn.fetchrow(
        "DELETE FROM uns_registry.asset_informational WHERE id = $1 RETURNING id",
        field_id,
    )
    if row is None:
        raise DomainError(404, "Asset informational field not found")
