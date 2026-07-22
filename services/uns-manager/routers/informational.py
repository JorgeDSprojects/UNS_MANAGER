from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Request, Response, status

from models.schemas import InformationalFieldCreate, InformationalFieldResponse, InformationalFieldUpdate
from services.errors import DomainError, to_http_exception
from services.informational_service import (
    create_asset_informational,
    delete_asset_informational,
    get_asset_informational,
    update_asset_informational,
)

router = APIRouter(prefix="/api/v1", tags=["informational"])

@router.get("/assets/{asset_id}/informational", response_model=list[InformationalFieldResponse])
async def get_asset_informational_route(asset_id: UUID, request: Request):
    try:
        async with request.app.state.db_pool.acquire() as conn:
            return await get_asset_informational(conn, asset_id)
    except DomainError as exc:
        raise to_http_exception(exc) from exc


@router.post(
    "/assets/{asset_id}/informational",
    response_model=InformationalFieldResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_asset_informational_route(
    asset_id: UUID,
    payload: InformationalFieldCreate,
    request: Request,
):
    try:
        async with request.app.state.db_pool.acquire() as conn:
            return await create_asset_informational(conn, asset_id, payload)
    except DomainError as exc:
        raise to_http_exception(exc) from exc


@router.put("/informational/{field_id}", response_model=InformationalFieldResponse)
async def update_asset_informational_route(
    field_id: UUID,
    payload: InformationalFieldUpdate,
    request: Request,
):
    try:
        async with request.app.state.db_pool.acquire() as conn:
            return await update_asset_informational(conn, field_id, payload)
    except DomainError as exc:
        raise to_http_exception(exc) from exc


@router.delete("/informational/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset_informational_route(field_id: UUID, request: Request) -> Response:
    try:
        async with request.app.state.db_pool.acquire() as conn:
            await delete_asset_informational(conn, field_id)
    except DomainError as exc:
        raise to_http_exception(exc) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)
