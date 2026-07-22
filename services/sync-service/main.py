from __future__ import annotations

import asyncio
import logging

from config import Settings
from sync_service import SyncService


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )


async def _run() -> None:
    settings = Settings.from_env()
    configure_logging(settings.sync_log_level)
    service = SyncService(settings)
    await service.run_forever()


if __name__ == "__main__":
    try:
        asyncio.run(_run())
    except KeyboardInterrupt:
        pass
