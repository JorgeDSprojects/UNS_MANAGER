from __future__ import annotations

import json
from typing import Any, Mapping, Sequence

try:
    import orjson
except ModuleNotFoundError:  # pragma: no cover - fallback for local host tools
    orjson = None


def normalize_json_object(value: Any) -> dict[str, Any]:
    if value is None:
        return {}
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        decoded = orjson.loads(value) if orjson is not None else json.loads(value)
        if isinstance(decoded, dict):
            return decoded
        return {}
    return {}


def topics_for_asset(uns_path: str) -> tuple[str, str]:
    base = uns_path.rstrip("/")
    return f"{base}/_descriptive", f"{base}/_analytical"


def _build_field_entry(field: Mapping[str, Any]) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "unit": field.get("unit", ""),
        "data_type": field.get("data_type"),
        "default_chart": {
            "type": field.get("chart_type", "time_series"),
            "show_thresholds": bool(field.get("chart_thresholds", False)),
            "recommended_window": field.get("chart_window", "24h"),
        },
    }

    range_min = field.get("range_min")
    range_max = field.get("range_max")
    if range_min is not None:
        entry["range_min"] = range_min
        entry["range_max"] = range_max

    agg_type = field.get("agg_type")
    if agg_type is not None:
        entry["agg_type"] = agg_type
        entry["source_field"] = field.get("source_field")

    return entry


def build_descriptive_payload(
    descriptive: Mapping[str, Any] | None,
    informational_fields: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    payload = dict(descriptive or {})
    fields_map: dict[str, Any] = {}
    for field in informational_fields:
        name = field.get("name")
        if not name:
            continue
        fields_map[str(name)] = _build_field_entry(field)

    payload["informational_fields"] = fields_map
    return payload
