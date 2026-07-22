from __future__ import annotations

import os
from dataclasses import dataclass


def _optional_env(name: str) -> str | None:
    value = os.getenv(name)
    if value is None:
        return None
    clean = value.strip()
    return clean or None


@dataclass(slots=True)
class Settings:
    postgres_user: str
    postgres_password: str
    postgres_host: str
    postgres_port: int
    postgres_db: str
    mqtt_host: str
    mqtt_port: int
    mqtt_sync_user: str | None
    mqtt_sync_password: str | None
    mqtt_client_id: str
    sync_log_level: str

    @property
    def postgres_dsn(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @classmethod
    def from_env(cls) -> "Settings":
        user = os.getenv("POSTGRES_USER")
        password = os.getenv("POSTGRES_PASSWORD")

        if not user:
            raise RuntimeError("POSTGRES_USER is required")
        if password is None:
            raise RuntimeError("POSTGRES_PASSWORD is required")

        return cls(
            postgres_user=user,
            postgres_password=password,
            postgres_host=os.getenv("POSTGRES_HOST", "postgres"),
            postgres_port=int(os.getenv("POSTGRES_PORT", "5432")),
            postgres_db=os.getenv("POSTGRES_DB", "galerna_platform"),
            mqtt_host=os.getenv("MQTT_HOST", "emqx"),
            mqtt_port=int(os.getenv("MQTT_PORT", "1883")),
            mqtt_sync_user=_optional_env("MQTT_SYNC_USER"),
            mqtt_sync_password=_optional_env("MQTT_SYNC_PASSWORD"),
            mqtt_client_id=os.getenv("MQTT_CLIENT_ID", "sync-service"),
            sync_log_level=os.getenv("SYNC_LOG_LEVEL", "INFO"),
        )
