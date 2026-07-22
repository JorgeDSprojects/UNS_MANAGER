from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import aiomqtt
import asyncpg
try:
    import orjson
except ModuleNotFoundError:  # pragma: no cover - fallback for local host tools
    orjson = None

from config import Settings
from payloads import build_descriptive_payload, normalize_json_object, topics_for_asset


def _json_dumps_bytes(payload: Any) -> bytes:
    if orjson is not None:
        return orjson.dumps(payload)
    return json.dumps(payload).encode("utf-8")


def _json_loads(raw_payload: str) -> Any:
    if orjson is not None:
        return orjson.loads(raw_payload)
    return json.loads(raw_payload)


class SyncService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.logger = logging.getLogger("sync-service")
        self._pool: asyncpg.Pool | None = None
        self._mqtt_client: aiomqtt.Client | None = None

    async def run_forever(self) -> None:
        backoff_seconds = 1
        while True:
            try:
                await self._run_session()
                backoff_seconds = 1
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                self.logger.exception("Sync loop failed: %s", exc)
                await asyncio.sleep(backoff_seconds)
                backoff_seconds = min(backoff_seconds * 2, 60)

    async def _run_session(self) -> None:
        self._pool = await self._create_pool(self.settings.postgres_dsn)

        mqtt_kwargs: dict[str, Any] = {
            "hostname": self.settings.mqtt_host,
            "port": self.settings.mqtt_port,
            "identifier": self.settings.mqtt_client_id,
        }
        if self.settings.mqtt_sync_user:
            mqtt_kwargs["username"] = self.settings.mqtt_sync_user
        if self.settings.mqtt_sync_password:
            mqtt_kwargs["password"] = self.settings.mqtt_sync_password

        try:
            async with aiomqtt.Client(**mqtt_kwargs) as mqtt_client:
                self._mqtt_client = mqtt_client
                await self.full_sync()
                await self.listen_for_changes()
        finally:
            self._mqtt_client = None
            if self._pool is not None:
                await self._pool.close()
                self._pool = None

    async def _create_pool(self, dsn: str) -> asyncpg.Pool:
        async def _init_connection(conn: asyncpg.Connection) -> None:
            await conn.execute("SET search_path TO uns_registry, public")
            await conn.set_type_codec(
                "json",
                schema="pg_catalog",
                encoder=json.dumps,
                decoder=json.loads,
            )
            await conn.set_type_codec(
                "jsonb",
                schema="pg_catalog",
                encoder=json.dumps,
                decoder=json.loads,
                format="text",
            )

        return await asyncpg.create_pool(dsn=dsn, min_size=1, max_size=10, init=_init_connection)

    async def full_sync(self) -> None:
        assets = await self._fetch_active_assets()

        descriptive_count = 0
        analytical_count = 0
        for asset in assets:
            published_descriptive, published_analytical = await self._publish_asset(
                asset,
                include_analytical=True,
            )
            descriptive_count += published_descriptive
            analytical_count += published_analytical

        self.logger.info(
            "Full sync completed: %s _descriptive, %s _analytical published",
            descriptive_count,
            analytical_count,
        )

    async def listen_for_changes(self) -> None:
        if self._pool is None:
            raise RuntimeError("Pool is not available")

        queue: asyncio.Queue[str] = asyncio.Queue()

        async with self._pool.acquire() as listen_conn:
            def _listener(_conn: asyncpg.Connection, _pid: int, _channel: str, payload: str) -> None:
                queue.put_nowait(payload)

            await listen_conn.add_listener("asset_changes", _listener)
            await listen_conn.execute("LISTEN asset_changes")
            self.logger.info("Listening on PostgreSQL channel asset_changes")
            try:
                while True:
                    raw_payload = await queue.get()
                    await self._process_notification(raw_payload)
            finally:
                await listen_conn.remove_listener("asset_changes", _listener)

    async def _process_notification(self, raw_payload: str) -> None:
        try:
            event = _json_loads(raw_payload)
        except (json.JSONDecodeError, ValueError):
            self.logger.warning("Ignoring malformed notification payload: %s", raw_payload)
            return

        if not isinstance(event, dict):
            self.logger.warning("Ignoring unexpected notification format: %s", raw_payload)
            return

        operation = str(event.get("operation", "")).upper()
        asset_id = event.get("id")
        uns_path = event.get("uns_path")

        if operation == "DELETE":
            if isinstance(uns_path, str) and uns_path:
                await self._clear_retained(uns_path)
            return

        if asset_id is None:
            self.logger.warning("Ignoring notification without id: %s", raw_payload)
            return

        asset = await self._fetch_asset_by_id(asset_id)
        if asset is None:
            if isinstance(uns_path, str) and uns_path:
                await self._clear_retained(uns_path)
            return

        include_analytical = not operation.startswith("FIELD_")
        await self._publish_asset(asset, include_analytical=include_analytical)

    async def _publish_asset(self, asset: dict[str, Any], include_analytical: bool) -> tuple[int, int]:
        descriptive_count = 0
        analytical_count = 0

        await self._publish_descriptive(asset)
        descriptive_count += 1

        if include_analytical:
            published = await self._publish_analytical(asset)
            analytical_count += int(published)

        return descriptive_count, analytical_count

    async def _publish_descriptive(self, asset: dict[str, Any]) -> None:
        mqtt_client = self._require_mqtt_client()

        fields = await self._fetch_active_fields(asset["id"])
        descriptive_payload = build_descriptive_payload(
            normalize_json_object(asset.get("descriptive")),
            fields,
        )
        descriptive_topic, _ = topics_for_asset(asset["uns_path"])
        await mqtt_client.publish(
            descriptive_topic,
            payload=_json_dumps_bytes(descriptive_payload),
            qos=1,
            retain=True,
        )

    async def _publish_analytical(self, asset: dict[str, Any]) -> bool:
        mqtt_client = self._require_mqtt_client()

        analytical_payload = normalize_json_object(asset.get("analytical"))
        if not analytical_payload:
            return False

        _, analytical_topic = topics_for_asset(asset["uns_path"])
        await mqtt_client.publish(
            analytical_topic,
            payload=_json_dumps_bytes(analytical_payload),
            qos=1,
            retain=True,
        )
        return True

    async def _clear_retained(self, uns_path: str) -> None:
        mqtt_client = self._require_mqtt_client()
        descriptive_topic, analytical_topic = topics_for_asset(uns_path)
        await mqtt_client.publish(descriptive_topic, payload=b"", qos=1, retain=True)
        await mqtt_client.publish(analytical_topic, payload=b"", qos=1, retain=True)

    async def _fetch_active_assets(self) -> list[dict[str, Any]]:
        pool = self._require_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, uns_path, asset_level::text AS asset_level, descriptive, analytical
                FROM uns_registry.assets
                WHERE is_active = true
                ORDER BY CASE asset_level::text
                    WHEN 'enterprise' THEN 1
                    WHEN 'site' THEN 2
                    WHEN 'area' THEN 3
                    WHEN 'equipment' THEN 4
                    WHEN 'subsystem' THEN 5
                    ELSE 99
                END, uns_path
                """
            )
        return [dict(row) for row in rows]

    async def _fetch_asset_by_id(self, asset_id: Any) -> dict[str, Any] | None:
        pool = self._require_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, uns_path, asset_level::text AS asset_level, descriptive, analytical
                FROM uns_registry.assets
                WHERE id = $1 AND is_active = true
                """,
                asset_id,
            )
        if row is None:
            return None
        return dict(row)

    async def _fetch_active_fields(self, asset_id: Any) -> list[dict[str, Any]]:
        pool = self._require_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT
                    name,
                    unit,
                    data_type::text AS data_type,
                    range_min,
                    range_max,
                    agg_type::text AS agg_type,
                    source_field,
                    chart_type,
                    chart_window,
                    chart_thresholds
                FROM uns_registry.asset_informational
                WHERE asset_id = $1 AND is_active = true
                ORDER BY name
                """,
                asset_id,
            )
        return [dict(row) for row in rows]

    def _require_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            raise RuntimeError("PostgreSQL pool is not initialized")
        return self._pool

    def _require_mqtt_client(self) -> aiomqtt.Client:
        if self._mqtt_client is None:
            raise RuntimeError("MQTT client is not initialized")
        return self._mqtt_client
