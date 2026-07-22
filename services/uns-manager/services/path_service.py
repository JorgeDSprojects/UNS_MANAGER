from __future__ import annotations

from uuid import UUID

from asyncpg import Connection

from services.errors import DomainError


async def compute_uns_path(conn: Connection, parent_id: UUID | str | None, name: str) -> str:
    if parent_id is None:
        return f"uns/v1/{name}"

    parent_path = await conn.fetchval(
        "SELECT uns_path FROM uns_registry.assets WHERE id = $1",
        parent_id,
    )
    if parent_path is None:
        raise DomainError(404, "Parent asset not found")

    return f"{parent_path}/{name}"


async def recalculate_descendant_paths(conn: Connection, asset_id: UUID | str) -> None:
    asset_exists = await conn.fetchval(
        "SELECT 1 FROM uns_registry.assets WHERE id = $1",
        asset_id,
    )
    if asset_exists is None:
        raise DomainError(404, "Asset not found")

    await conn.execute(
        """
        WITH RECURSIVE path_tree AS (
            SELECT id, parent_id, name, uns_path::varchar(500) AS uns_path
            FROM uns_registry.assets
            WHERE id = $1

            UNION ALL

            SELECT
                child.id,
                child.parent_id,
                child.name,
                (path_tree.uns_path || '/' || child.name)::varchar(500) AS uns_path
            FROM uns_registry.assets AS child
            JOIN path_tree ON child.parent_id = path_tree.id
        )
        UPDATE uns_registry.assets AS target
        SET uns_path = path_tree.uns_path
        FROM path_tree
        WHERE target.id = path_tree.id
          AND target.uns_path IS DISTINCT FROM path_tree.uns_path
        """,
        asset_id,
    )
