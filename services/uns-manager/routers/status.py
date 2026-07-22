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
        sync_table_exists = await conn.fetchval(
            "SELECT to_regclass('uns_registry.sync_runtime_state') IS NOT NULL"
        )
        sync_row = None
        if sync_table_exists:
            sync_row = await conn.fetchrow(
                """
                SELECT mqtt_connected, last_sync_at, sync_lag_seconds, updated_at
                FROM uns_registry.sync_runtime_state
                WHERE service_name = 'sync-service'
                """
            )

    assets_by_level = {level: 0 for level in _ASSET_LEVELS}
    for row in rows:
        assets_by_level[row["asset_level"]] = int(row["total"])

    mqtt_connected = bool(sync_row["mqtt_connected"]) if sync_row else False
    last_sync_at = sync_row["last_sync_at"].isoformat() if sync_row and sync_row["last_sync_at"] else None
    sync_lag_seconds = (
        float(sync_row["sync_lag_seconds"]) if sync_row and sync_row["sync_lag_seconds"] is not None else None
    )

    sync_state = "degraded"
    if sync_row:
        if not mqtt_connected:
            sync_state = "down"
        elif sync_lag_seconds is not None and sync_lag_seconds > 60.0:
            sync_state = "degraded"
        else:
            sync_state = "healthy"

    return {
        "service": _SERVICE_NAME,
        "version": _VERSION,
        "templates_count": int(templates_count),
        "assets_count": int(assets_count),
        "informational_fields_count": int(informational_fields_count),
        "assets_by_level": assets_by_level,
        "sync_state": sync_state,
        "mqtt_connected": mqtt_connected,
        "last_sync_at": last_sync_at,
        "sync_lag_seconds": sync_lag_seconds,
    }
