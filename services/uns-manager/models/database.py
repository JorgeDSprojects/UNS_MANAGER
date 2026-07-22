import os
import json

import asyncpg


def _dsn() -> str:
    user = os.getenv("POSTGRES_USER")
    password = os.getenv("POSTGRES_PASSWORD")

    if not user:
        raise RuntimeError("POSTGRES_USER is required")
    if password is None:
        raise RuntimeError("POSTGRES_PASSWORD is required")

    host = os.getenv("POSTGRES_HOST", "postgres")
    port = os.getenv("POSTGRES_PORT", "5432")
    database = os.getenv("POSTGRES_DB", "galerna_platform")

    return f"postgresql://{user}:{password}@{host}:{port}/{database}"


async def create_pool() -> asyncpg.Pool:
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

    return await asyncpg.create_pool(dsn=_dsn(), min_size=1, max_size=10, init=_init_connection)


async def close_pool(pool: asyncpg.Pool) -> None:
    await pool.close()
