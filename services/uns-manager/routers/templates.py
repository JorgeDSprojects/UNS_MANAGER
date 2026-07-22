from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Query, Request, Response, status

from models.schemas import (
    AssetLevel,
    InformationalFieldCreate,
    InformationalFieldResponse,
    InformationalFieldUpdate,
    TemplateChildAdd,
    TemplateChildResponse,
    TemplateCreate,
    TemplateResponse,
    TemplateUpdate,
)
from services.errors import DomainError, to_http_exception
from services.template_service import (
    add_template_child,
    create_template,
    create_template_informational,
    delete_template,
    delete_template_child,
    delete_template_informational,
    get_template,
    get_template_children,
    get_template_informational,
    list_templates,
    update_template,
    update_template_informational,
)

router = APIRouter(prefix="/api/v1/templates", tags=["templates"])

@router.get("", response_model=list[TemplateResponse])
async def list_templates_route(request: Request, level: AssetLevel | None = Query(default=None)):
    try:
        async with request.app.state.db_pool.acquire() as conn:
            return await list_templates(conn, level)
    except DomainError as exc:
        raise to_http_exception(exc) from exc


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template_route(template_id: UUID, request: Request):
    try:
        async with request.app.state.db_pool.acquire() as conn:
            return await get_template(conn, template_id)
    except DomainError as exc:
        raise to_http_exception(exc) from exc


@router.post("", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template_route(payload: TemplateCreate, request: Request):
    try:
        async with request.app.state.db_pool.acquire() as conn:
            return await create_template(conn, payload)
    except DomainError as exc:
        raise to_http_exception(exc) from exc


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template_route(template_id: UUID, payload: TemplateUpdate, request: Request):
    try:
        async with request.app.state.db_pool.acquire() as conn:
            return await update_template(conn, template_id, payload)
    except DomainError as exc:
        raise to_http_exception(exc) from exc


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template_route(template_id: UUID, request: Request) -> Response:
    try:
        async with request.app.state.db_pool.acquire() as conn:
            await delete_template(conn, template_id)
    except DomainError as exc:
        raise to_http_exception(exc) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{template_id}/children", response_model=list[TemplateChildResponse])
async def get_template_children_route(template_id: UUID, request: Request):
    try:
        async with request.app.state.db_pool.acquire() as conn:
            return await get_template_children(conn, template_id)
    except DomainError as exc:
        raise to_http_exception(exc) from exc


@router.post(
    "/{template_id}/children",
    response_model=TemplateChildResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_template_child_route(template_id: UUID, payload: TemplateChildAdd, request: Request):
    try:
        async with request.app.state.db_pool.acquire() as conn:
            return await add_template_child(
                conn,
                template_id,
                payload.child_template_id,
                payload.sort_order,
                payload.is_optional,
            )
    except DomainError as exc:
        raise to_http_exception(exc) from exc


@router.delete("/{template_id}/children/{child_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template_child_route(template_id: UUID, child_id: UUID, request: Request) -> Response:
    try:
        async with request.app.state.db_pool.acquire() as conn:
            await delete_template_child(conn, template_id, child_id)
    except DomainError as exc:
        raise to_http_exception(exc) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{template_id}/informational", response_model=list[InformationalFieldResponse])
async def get_template_informational_route(template_id: UUID, request: Request):
    try:
        async with request.app.state.db_pool.acquire() as conn:
            return await get_template_informational(conn, template_id)
    except DomainError as exc:
        raise to_http_exception(exc) from exc


@router.post(
    "/{template_id}/informational",
    response_model=InformationalFieldResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_template_informational_route(
    template_id: UUID,
    payload: InformationalFieldCreate,
    request: Request,
):
    try:
        async with request.app.state.db_pool.acquire() as conn:
            return await create_template_informational(conn, template_id, payload)
    except DomainError as exc:
        raise to_http_exception(exc) from exc


@router.put("/informational/{field_id}", response_model=InformationalFieldResponse)
async def update_template_informational_route(
    field_id: UUID,
    payload: InformationalFieldUpdate,
    request: Request,
):
    try:
        async with request.app.state.db_pool.acquire() as conn:
            return await update_template_informational(conn, field_id, payload)
    except DomainError as exc:
        raise to_http_exception(exc) from exc


@router.delete("/informational/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template_informational_route(field_id: UUID, request: Request) -> Response:
    try:
        async with request.app.state.db_pool.acquire() as conn:
            await delete_template_informational(conn, field_id)
    except DomainError as exc:
        raise to_http_exception(exc) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)
