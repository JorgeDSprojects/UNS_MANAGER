from contextlib import asynccontextmanager

from fastapi import FastAPI

from models.database import close_pool, create_pool
from routers.assets import router as assets_router
from routers.informational import router as informational_router
from routers.status import router as status_router
from routers.templates import router as templates_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db_pool = await create_pool()
    try:
        yield
    finally:
        await close_pool(app.state.db_pool)


app = FastAPI(title="UNS Manager", version="0.1.0", lifespan=lifespan)
app.include_router(status_router)
app.include_router(templates_router)
app.include_router(assets_router)
app.include_router(informational_router)
