from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from asyncpg import Connection

from services.errors import DomainError
from services.path_service import compute_uns_path

NAME_RE = re.compile(r"^[A-Z0-9_]+$")
PARENT_RULES = {
    "enterprise": None,
    "site": "enterprise",
    "area": "site",
    "equipment": "area",
    "subsystem": "equipment",
}


def _validate_name(name: str) -> None:
    if NAME_RE.fullmatch(name) is None:
        raise DomainError(400, "Asset name must match ^[A-Z0-9_]+$")


async def _validate_hierarchy(conn: Connection, asset_level: str, parent_id: UUID | str | None) -> None:
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


def _merged(base: dict[str, Any] | None, overrides: dict[str, Any] | None) -> dict[str, Any]:
    return {**(base or {}), **(overrides or {})}


async def instantiate_from_template(
    conn: Connection,
    parent_id: UUID | str | None,
    template_id: UUID | str,
    name: str,
    descriptive_overrides: dict[str, Any] | None,
    analytical_overrides: dict[str, Any] | None,
) -> UUID:
    _validate_name(name)

    template = await conn.fetchrow(
        """
        SELECT level::text AS level, descriptive, analytical
        FROM uns_registry.asset_templates
        WHERE id = $1
        """,
        template_id,
    )
    if template is None:
        raise DomainError(404, "Template not found")

    template_level = template["level"]
    await _validate_hierarchy(conn, template_level, parent_id)

    descriptive = _merged(template["descriptive"], descriptive_overrides)
    analytical = _merged(template["analytical"], analytical_overrides)
    uns_path = await compute_uns_path(conn, parent_id, name)

    asset_id = await conn.fetchval(
        """
        INSERT INTO uns_registry.assets (
            parent_id,
            template_id,
            asset_level,
            name,
            uns_path,
            descriptive,
            analytical
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
        RETURNING id
        """,
        parent_id,
        template_id,
        template_level,
        name,
        uns_path,
        descriptive,
        analytical,
    )

    await conn.execute(
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
        SELECT
            $1,
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
        FROM uns_registry.template_informational
        WHERE template_id = $2
        """,
        asset_id,
        template_id,
    )

    child_templates = await conn.fetch(
        """
        SELECT
            tc.child_template_id,
            child.name AS child_name
        FROM uns_registry.template_children AS tc
        JOIN uns_registry.asset_templates AS child
            ON child.id = tc.child_template_id
        WHERE tc.parent_template_id = $1
          AND tc.is_optional = false
        ORDER BY tc.sort_order, child.name
        """,
        template_id,
    )

    for child in child_templates:
        await instantiate_from_template(
            conn,
            asset_id,
            child["child_template_id"],
            child["child_name"],
            {},
            {},
        )

    return asset_id
