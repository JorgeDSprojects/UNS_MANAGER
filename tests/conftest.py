import asyncio
import os
from pathlib import Path

import asyncpg
import pytest


def _test_dsn() -> str:
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "postgres")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    database = os.getenv("POSTGRES_DB", "galerna_platform")

    return f"postgresql://{user}:{password}@{host}:{port}/{database}"


_CLEAN_SQL = """
TRUNCATE TABLE
    uns_registry.sync_runtime_state,
    uns_registry.asset_informational,
    uns_registry.assets,
    uns_registry.template_informational,
    uns_registry.template_children,
    uns_registry.asset_templates
RESTART IDENTITY CASCADE;
"""


@pytest.fixture
def db_conn():
    project_root = Path(__file__).resolve().parents[1]
    init_sql_path = project_root / "db" / "init-platform.sql"
    init_sql = init_sql_path.read_text(encoding="utf-8")

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    conn = loop.run_until_complete(asyncpg.connect(dsn=_test_dsn()))
    try:
        schema_ready = loop.run_until_complete(
            conn.fetchval(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'uns_registry'
                      AND table_name = 'assets'
                )
                """
            )
        )
        if not schema_ready:
            loop.run_until_complete(conn.execute(init_sql))

        loop.run_until_complete(
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS uns_registry.sync_runtime_state (
                    service_name VARCHAR(50) PRIMARY KEY,
                    mqtt_connected BOOLEAN NOT NULL DEFAULT false,
                    last_sync_at TIMESTAMPTZ,
                    sync_lag_seconds DOUBLE PRECISION,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
        )

        loop.run_until_complete(conn.execute(_CLEAN_SQL))
        yield conn, loop
    finally:
        loop.run_until_complete(conn.close())
        loop.close()
        asyncio.set_event_loop(None)
