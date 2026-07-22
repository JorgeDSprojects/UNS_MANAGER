from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

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


UI_DIR = Path(__file__).resolve().parent / "ui"
UI_DIST_DIR = UI_DIR / "dist"

if (UI_DIST_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=UI_DIST_DIR / "assets"), name="ui-assets")


def _ui_index_path() -> Path | None:
    dist_index = UI_DIST_DIR / "index.html"
    if dist_index.exists():
        return dist_index

    source_index = UI_DIR / "index.html"
    if source_index.exists():
        return source_index

    return None


@app.get("/", include_in_schema=False)
async def ui_root():
    index_path = _ui_index_path()
    if index_path is None:
        return JSONResponse(status_code=503, content={"message": "UI build not found"})
    return FileResponse(index_path)


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    if (
        full_path.startswith("api/")
        or full_path == "health"
        or full_path == "openapi.json"
        or full_path.startswith("docs")
        or full_path == "redoc"
        or full_path.startswith("assets/")
    ):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})

    index_path = _ui_index_path()
    if index_path is None:
        return JSONResponse(status_code=503, content={"message": "UI build not found"})

    return FileResponse(index_path)
