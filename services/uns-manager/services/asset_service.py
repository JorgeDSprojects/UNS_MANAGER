from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from asyncpg import Connection
from asyncpg.exceptions import UniqueViolationError

from models.schemas import AssetCreate, AssetFromTemplate, AssetUpdate
from services.errors import DomainError
from services.instantiation import instantiate_from_template
from services.path_service import compute_uns_path, recalculate_descendant_paths

NAME_RE = re.compile(r"^[A-Z0-9_]+$")
PARENT_RULES = {
    "enterprise": None,
    "site": "enterprise",
    "area": "site",
    "equipment": "area",
    "subsystem": "equipment",
}
_UPDATE_FIELDS = ("name", "descriptive", "analytical", "scada_available", "is_active")


def _to_dict(row: Any) -> dict[str, Any]:
    return dict(row)


def _validate_name(name: str) -> None:
    if NAME_RE.fullmatch(name) is None:
        raise DomainError(400, "Asset name must match ^[A-Z0-9_]+$")


async def _fetch_asset_base(conn: Connection, asset_id: UUID | str) -> dict[str, Any]:
    row = await conn.fetchrow(
        """
        SELECT
            a.*,
            t.name AS template_name
        FROM uns_registry.assets AS a
        LEFT JOIN uns_registry.asset_templates AS t ON t.id = a.template_id
        WHERE a.id = $1
        """,
        asset_id,
    )
    if row is None:
        raise DomainError(404, "Asset not found")
    return _to_dict(row)


async def _fetch_asset_with_informational(conn: Connection, asset_id: UUID | str) -> dict[str, Any]:
    asset = await _fetch_asset_base(conn, asset_id)
    informational_rows = await conn.fetch(
        """
        SELECT *
        FROM uns_registry.asset_informational
        WHERE asset_id = $1
        ORDER BY name
        """,
        asset_id,
    )
    asset["informational"] = [_to_dict(row) for row in informational_rows]
    return asset


async def _validate_hierarchy(conn: Connection, asset_level: str, parent_id: UUID | None) -> None:
    expected_parent_level = PARENT_RULES[asset_level]

    if expected_parent_level is None:
        if parent_id is not None:
            raise DomainError(400, "enterprise cannot have parent")
        return

    if parent_id is None:
        raise DomainError(400, f"{asset_level} requires {expected_parent_level} parent")

    parent_level = await conn.fetchval(
        "SELECT asset_level::text FROM uns_registry.assets WHERE id = $1",
        parent_id,
    )
    if parent_level is None:
        raise DomainError(404, "Parent asset not found")

    if parent_level != expected_parent_level:
        raise DomainError(400, f"{asset_level} requires {expected_parent_level} parent")


async def create_asset(conn: Connection, payload: AssetCreate) -> dict[str, Any]:
    _validate_name(payload.name)

    async with conn.transaction():
        await _validate_hierarchy(conn, payload.asset_level, payload.parent_id)
        uns_path = await compute_uns_path(conn, payload.parent_id, payload.name)

        try:
            asset_id = await conn.fetchval(
                """
                INSERT INTO uns_registry.assets (
                    parent_id,
                    template_id,
                    asset_level,
                    name,
                    uns_path,
                    descriptive,
                    analytical,
                    scada_available
                )
                VALUES ($1, NULL, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
                RETURNING id
                """,
                payload.parent_id,
                payload.asset_level,
                payload.name,
                uns_path,
                payload.descriptive,
                payload.analytical,
                payload.scada_available,
            )
        except UniqueViolationError as exc:
            raise DomainError(409, "Asset name already exists for parent") from exc

        return await _fetch_asset_with_informational(conn, asset_id)


async def create_asset_from_template(conn: Connection, payload: AssetFromTemplate) -> dict[str, Any]:
    _validate_name(payload.name)

    try:
        async with conn.transaction():
            asset_id = await instantiate_from_template(
                conn=conn,
                parent_id=payload.parent_id,
                template_id=payload.template_id,
                name=payload.name,
                descriptive_overrides=payload.descriptive_overrides,
                analytical_overrides=payload.analytical_overrides,
            )
            return await _fetch_asset_with_informational(conn, asset_id)
    except UniqueViolationError as exc:
        raise DomainError(409, "Asset name already exists for parent") from exc


async def list_assets(
    conn: Connection,
    asset_level: str | None,
    parent_id: UUID | None,
    template_id: UUID | None,
) -> list[dict[str, Any]]:
    conditions: list[str] = []
    values: list[Any] = []

    if asset_level is not None:
        values.append(asset_level)
        conditions.append(f"a.asset_level = ${len(values)}")

    if parent_id is not None:
        values.append(parent_id)
        conditions.append(f"a.parent_id = ${len(values)}")

    if template_id is not None:
        values.append(template_id)
        conditions.append(f"a.template_id = ${len(values)}")

    where_clause = ""
    if conditions:
        where_clause = " WHERE " + " AND ".join(conditions)

    query = (
        "SELECT a.*, t.name AS template_name "
        "FROM uns_registry.assets AS a "
        "LEFT JOIN uns_registry.asset_templates AS t ON t.id = a.template_id"
        f"{where_clause} "
        "ORDER BY a.uns_path"
    )

    rows = await conn.fetch(query, *values)
    return [_to_dict(row) for row in rows]


async def get_asset(conn: Connection, asset_id: UUID | str) -> dict[str, Any]:
    return await _fetch_asset_with_informational(conn, asset_id)


async def update_asset(conn: Connection, asset_id: UUID | str, payload: AssetUpdate) -> dict[str, Any]:
    updates = payload.model_dump(exclude_unset=True)
    updates = {key: value for key, value in updates.items() if key in _UPDATE_FIELDS}

    if "name" in updates and updates["name"] is None:
        raise DomainError(400, "name cannot be null")
    if "descriptive" in updates and updates["descriptive"] is None:
        raise DomainError(400, "descriptive cannot be null")
    if "analytical" in updates and updates["analytical"] is None:
        raise DomainError(400, "analytical cannot be null")
    if "scada_available" in updates and updates["scada_available"] is None:
        raise DomainError(400, "scada_available cannot be null")
    if "is_active" in updates and updates["is_active"] is None:
        raise DomainError(400, "is_active cannot be null")

    async with conn.transaction():
        existing = await _fetch_asset_base(conn, asset_id)

        name_changed = False
        if "name" in updates and updates["name"] is not None:
            _validate_name(updates["name"])
            name_changed = updates["name"] != existing["name"]
            updates["uns_path"] = await compute_uns_path(conn, existing["parent_id"], updates["name"])

        if updates:
            assignments: list[str] = []
            values: list[Any] = [asset_id]
            for index, (field, value) in enumerate(updates.items(), start=2):
                assignments.append(f"{field} = ${index}")
                values.append(value)

            query = (
                "UPDATE uns_registry.assets "
                f"SET {', '.join(assignments)} "
                "WHERE id = $1 RETURNING id"
            )

            try:
                row = await conn.fetchrow(query, *values)
            except UniqueViolationError as exc:
                raise DomainError(409, "Asset name already exists for parent") from exc

            if row is None:
                raise DomainError(404, "Asset not found")

        if name_changed:
            await recalculate_descendant_paths(conn, asset_id)

        return await _fetch_asset_with_informational(conn, asset_id)


async def delete_asset(conn: Connection, asset_id: UUID | str) -> None:
    row = await conn.fetchrow(
        "DELETE FROM uns_registry.assets WHERE id = $1 RETURNING id",
        asset_id,
    )
    if row is None:
        raise DomainError(404, "Asset not found")


async def get_tree(conn: Connection) -> list[dict[str, Any]]:
    rows = await conn.fetch(
        """
        SELECT
            a.*,
            t.name AS template_name
        FROM uns_registry.assets AS a
        LEFT JOIN uns_registry.asset_templates AS t ON t.id = a.template_id
        ORDER BY a.uns_path
        """
    )

    nodes = [_to_dict(row) for row in rows]
    by_id = {node["id"]: node for node in nodes}
    for node in nodes:
        node["children"] = []

    roots: list[dict[str, Any]] = []
    for node in nodes:
        parent_id = node["parent_id"]
        if parent_id is None:
            roots.append(node)
            continue

        parent = by_id.get(parent_id)
        if parent is not None:
            parent["children"].append(node)

    return roots
