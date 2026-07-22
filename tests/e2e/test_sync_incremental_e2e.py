import asyncio
import json
import os
import shutil
import subprocess
from uuid import uuid4

import httpx
import pytest


SYNC_CONTAINER = os.getenv("SYNC_CONTAINER", "uns_manager-sync-service-1")
EMQX_HOST = os.getenv("MQTT_HOST", "emqx")
EMQX_PORT = int(os.getenv("MQTT_PORT", "1883"))
API_BASE = os.getenv("API_BASE", "http://localhost:8002/api/v1").rstrip("/")


def _docker_available() -> bool:
    return shutil.which("docker") is not None


def _is_container_running(name: str) -> bool:
    result = subprocess.run(
        ["docker", "inspect", "-f", "{{.State.Running}}", name],
        capture_output=True,
        text=True,
        check=False,
    )
    return result.returncode == 0 and result.stdout.strip().lower() == "true"


def _read_retained_from_sync_container(topic: str, timeout_seconds: int = 3) -> str:
    script = f"""
import time
import paho.mqtt.client as mqtt

topic = {topic!r}
host = {EMQX_HOST!r}
port = {EMQX_PORT}
timeout = {timeout_seconds}

state = {{"payload": None}}

def on_connect(client, userdata, flags, reason_code, properties=None):
    client.subscribe(topic, qos=1)

def on_message(client, userdata, message):
    state["payload"] = message.payload.decode("utf-8")
    client.disconnect()

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.on_connect = on_connect
client.on_message = on_message
client.connect(host, port, 60)
client.loop_start()
start = time.time()
while time.time() - start < timeout and state["payload"] is None:
    time.sleep(0.05)
client.loop_stop()

if state["payload"] is None:
    print("__NONE__")
elif state["payload"] == "":
    print("__EMPTY__")
else:
    print(state["payload"])
"""

    result = subprocess.run(
        ["docker", "exec", "-i", SYNC_CONTAINER, "python", "-c", script],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"docker exec failed: {result.stderr.strip()}")
    return result.stdout.strip()


async def _wait_for_retained_json(topic: str, matcher, attempts: int = 20, delay: float = 0.25) -> dict:
    last_value = "__NONE__"
    for _ in range(attempts):
        raw = _read_retained_from_sync_container(topic)
        last_value = raw
        if raw not in ("__NONE__", "__EMPTY__"):
            payload = json.loads(raw)
            if matcher(payload):
                return payload
        await asyncio.sleep(delay)
    raise AssertionError(f"Retained payload did not match for topic {topic}. Last value: {last_value}")


async def _wait_for_retained_absent(topic: str, attempts: int = 20, delay: float = 0.25) -> None:
    last_value = ""
    for _ in range(attempts):
        raw = _read_retained_from_sync_container(topic)
        last_value = raw
        if raw in ("__NONE__", "__EMPTY__"):
            return
        await asyncio.sleep(delay)
    raise AssertionError(f"Retained payload still present for topic {topic}. Last value: {last_value}")


def _skip_if_environment_missing() -> None:
    if not _docker_available():
        pytest.skip("docker CLI not available")
    if not _is_container_running(SYNC_CONTAINER):
        pytest.skip(f"sync container is not running: {SYNC_CONTAINER}")


@pytest.mark.anyio
async def test_sync_incremental_asset_crud_updates_retained_topics():
    _skip_if_environment_missing()

    suffix = uuid4().hex[:8].upper()
    asset_name = f"SYNC_E2E_{suffix}"

    async with httpx.AsyncClient(base_url=API_BASE, timeout=20.0) as client:
        create_response = await client.post(
            "/assets",
            json={
                "asset_level": "enterprise",
                "name": asset_name,
                "descriptive": {"sync_probe": 1},
            },
        )
        assert create_response.status_code == 201, create_response.text
        asset = create_response.json()
        asset_id = asset["id"]
        uns_path = asset["uns_path"]

        descriptive_topic = f"{uns_path}/_descriptive"

        await _wait_for_retained_json(
            descriptive_topic,
            lambda payload: payload.get("sync_probe") == 1,
        )

        update_response = await client.put(
            f"/assets/{asset_id}",
            json={"descriptive": {"sync_probe": 2}},
        )
        assert update_response.status_code == 200, update_response.text

        await _wait_for_retained_json(
            descriptive_topic,
            lambda payload: payload.get("sync_probe") == 2,
        )

        delete_response = await client.delete(f"/assets/{asset_id}")
        assert delete_response.status_code == 204, delete_response.text

        await _wait_for_retained_absent(descriptive_topic)


@pytest.mark.anyio
async def test_sync_field_changes_republish_descriptive_topic():
    _skip_if_environment_missing()

    suffix = uuid4().hex[:8].upper()
    ent = f"SYNC_ENT_{suffix}"
    site = f"SYNC_SITE_{suffix}"
    area = f"SYNC_AREA_{suffix}"
    equipment = f"SYNC_EQ_{suffix}"
    subsystem = f"SYNC_SUB_{suffix}"

    async with httpx.AsyncClient(base_url=API_BASE, timeout=20.0) as client:
        ent_resp = await client.post("/assets", json={"asset_level": "enterprise", "name": ent})
        assert ent_resp.status_code == 201, ent_resp.text
        ent_id = ent_resp.json()["id"]

        site_resp = await client.post(
            "/assets",
            json={"asset_level": "site", "name": site, "parent_id": ent_id},
        )
        assert site_resp.status_code == 201, site_resp.text
        site_id = site_resp.json()["id"]

        area_resp = await client.post(
            "/assets",
            json={"asset_level": "area", "name": area, "parent_id": site_id},
        )
        assert area_resp.status_code == 201, area_resp.text
        area_id = area_resp.json()["id"]

        eq_resp = await client.post(
            "/assets",
            json={"asset_level": "equipment", "name": equipment, "parent_id": area_id},
        )
        assert eq_resp.status_code == 201, eq_resp.text
        eq_id = eq_resp.json()["id"]

        sub_resp = await client.post(
            "/assets",
            json={"asset_level": "subsystem", "name": subsystem, "parent_id": eq_id},
        )
        assert sub_resp.status_code == 201, sub_resp.text
        sub = sub_resp.json()
        sub_id = sub["id"]
        sub_topic = f"{sub['uns_path']}/_descriptive"

        await _wait_for_retained_json(sub_topic, lambda payload: "informational_fields" in payload)

        field_create = await client.post(
            f"/assets/{sub_id}/informational",
            json={
                "name": "Sync_Test_Signal",
                "unit": "RPM",
                "data_type": "float",
                "range_min": 0,
                "range_max": 1700,
            },
        )
        assert field_create.status_code == 201, field_create.text
        field_id = field_create.json()["id"]

        await _wait_for_retained_json(
            sub_topic,
            lambda payload: "Sync_Test_Signal" in payload.get("informational_fields", {}),
        )

        field_delete = await client.delete(f"/informational/{field_id}")
        assert field_delete.status_code == 204, field_delete.text

        await _wait_for_retained_json(
            sub_topic,
            lambda payload: "Sync_Test_Signal" not in payload.get("informational_fields", {}),
        )
