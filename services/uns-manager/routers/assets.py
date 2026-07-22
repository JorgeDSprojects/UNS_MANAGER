from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Query, Request, Response, status

from models.schemas import AssetCreate, AssetFromTemplate, AssetLevel, AssetResponse, AssetUpdate
from services.asset_service import (
    create_asset,
    create_asset_from_template,
    delete_asset,
    get_asset,
    get_tree,
    list_assets,
    update_asset,
)
from services.errors import DomainError, to_http_exception

router = APIRouter(prefix="/api/v1", tags=["assets"])

@router.get("/tree", response_model=list[AssetResponse])
async def get_tree_route(request: Request):
    try:
        async with request.app.state.db_pool.acquire() as conn:
            return await get_tree(conn)
    except DomainError as exc:
        raise to_http_exception(exc) from exc


@router.get("/assets", response_model=list[AssetResponse])
async def list_assets_route(
    request: Request,
    asset_level: AssetLevel | None = Query(default=None),
    parent_id: UUID | None = Query(default=None),
    template_id: UUID | None = Query(default=None),
):
    try:
        async with request.app.state.db_pool.acquire() as conn:
            return await list_assets(conn, asset_level, parent_id, template_id)
    except DomainError as exc:
        raise to_http_exception(exc) from exc


@router.get("/assets/{asset_id}", response_model=AssetResponse)
async def get_asset_route(asset_id: UUID, request: Request):
    try:
        async with request.app.state.db_pool.acquire() as conn:
            return await get_asset(conn, asset_id)
    except DomainError as exc:
        raise to_http_exception(exc) from exc


@router.post(
    "/assets",
    response_model=AssetResponse,
    response_model_exclude={"template_name", "informational", "children"},
    status_code=status.HTTP_201_CREATED,
)
async def create_asset_route(payload: AssetCreate, request: Request):
    try:
        async with request.app.state.db_pool.acquire() as conn:
            return await create_asset(conn, payload)
    except DomainError as exc:
        raise to_http_exception(exc) from exc


@router.post(
    "/assets/from-template",
    response_model=AssetResponse,
    response_model_exclude={"template_name", "informational", "children"},
    status_code=status.HTTP_201_CREATED,
)
async def create_asset_from_template_route(payload: AssetFromTemplate, request: Request):
    try:
        async with request.app.state.db_pool.acquire() as conn:
            return await create_asset_from_template(conn, payload)
    except DomainError as exc:
        raise to_http_exception(exc) from exc


@router.put("/assets/{asset_id}", response_model=AssetResponse)
async def update_asset_route(asset_id: UUID, payload: AssetUpdate, request: Request):
    try:
        async with request.app.state.db_pool.acquire() as conn:
            return await update_asset(conn, asset_id, payload)
    except DomainError as exc:
        raise to_http_exception(exc) from exc


@router.delete("/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset_route(asset_id: UUID, request: Request) -> Response:
    try:
        async with request.app.state.db_pool.acquire() as conn:
            await delete_asset(conn, asset_id)
    except DomainError as exc:
        raise to_http_exception(exc) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)
