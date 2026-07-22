import os

from fastapi import APIRouter, Request

router = APIRouter(tags=["status"])

_SERVICE_NAME = "uns-manager"
_VERSION = os.getenv("UNS_MANAGER_VERSION", "0.1.0")
_ASSET_LEVELS = ("enterprise", "site", "area", "equipment", "subsystem")


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/api/v1/status")
async def status(request: Request) -> dict:
    pool = request.app.state.db_pool

    async with pool.acquire() as conn:
        templates_count = await conn.fetchval("SELECT COUNT(*) FROM uns_registry.asset_templates")
        assets_count = await conn.fetchval("SELECT COUNT(*) FROM uns_registry.assets")
        informational_fields_count = await conn.fetchval(
            "SELECT COUNT(*) FROM uns_registry.asset_informational"
        )
        rows = await conn.fetch(
            """
            SELECT asset_level::text AS asset_level, COUNT(*)::bigint AS total
            FROM uns_registry.assets
            GROUP BY asset_level
            """
        )

    assets_by_level = {level: 0 for level in _ASSET_LEVELS}
    for row in rows:
        assets_by_level[row["asset_level"]] = int(row["total"])

    return {
        "service": _SERVICE_NAME,
        "version": _VERSION,
        "templates_count": int(templates_count),
        "assets_count": int(assets_count),
        "informational_fields_count": int(informational_fields_count),
        "assets_by_level": assets_by_level,
    }
