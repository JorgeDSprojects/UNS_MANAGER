import importlib
import sys
from pathlib import Path


def _service_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "services" / "sync-service"


def _load_payloads_module():
    service_dir = _service_dir()
    service_dir_str = str(service_dir)
    if service_dir_str not in sys.path:
        sys.path.insert(0, service_dir_str)
    return importlib.import_module("payloads")


def test_build_descriptive_payload_includes_informational_fields():
    payloads = _load_payloads_module()

    descriptive = {"manufacturer": "Vestas"}
    fields = [
        {
            "name": "Gen_RPM_Avg",
            "unit": "RPM",
            "data_type": "float",
            "range_min": 0,
            "range_max": 1700,
            "agg_type": None,
            "source_field": None,
            "chart_type": "time_series",
            "chart_thresholds": False,
            "chart_window": "24h",
        },
        {
            "name": "total_active_power_kw",
            "unit": "kW",
            "data_type": "float",
            "range_min": None,
            "range_max": None,
            "agg_type": "sum",
            "source_field": "Grd_Prod_Pwr_Avg",
            "chart_type": "time_series",
            "chart_thresholds": True,
            "chart_window": "12h",
        },
    ]

    payload = payloads.build_descriptive_payload(descriptive, fields)

    assert payload["manufacturer"] == "Vestas"
    assert "informational_fields" in payload
    assert payload["informational_fields"]["Gen_RPM_Avg"]["range_min"] == 0
    assert payload["informational_fields"]["total_active_power_kw"]["agg_type"] == "sum"


def test_topics_for_asset_returns_descriptive_and_analytical_topics():
    payloads = _load_payloads_module()

    descriptive_topic, analytical_topic = payloads.topics_for_asset("uns/v1/ENT/SITE/A/EQ")

    assert descriptive_topic == "uns/v1/ENT/SITE/A/EQ/_descriptive"
    assert analytical_topic == "uns/v1/ENT/SITE/A/EQ/_analytical"
