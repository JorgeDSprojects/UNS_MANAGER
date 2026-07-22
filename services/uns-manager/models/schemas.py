from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

AssetLevel = Literal["enterprise", "site", "area", "equipment", "subsystem"]
SignalDataType = Literal["float", "integer"]
AggregationType = Literal["sum", "avg", "min", "max", "count", "weighted_avg", "custom"]


class TemplateCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    level: AssetLevel
    name: str
    display_name: str = ""
    description: str | None = None
    descriptive: dict[str, Any] = Field(default_factory=dict)
    analytical: dict[str, Any] = Field(default_factory=dict)
    icon: str | None = None


class TemplateUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str | None = None
    description: str | None = None
    descriptive: dict[str, Any] | None = None
    analytical: dict[str, Any] | None = None
    icon: str | None = None


class TemplateChildAdd(BaseModel):
    model_config = ConfigDict(extra="forbid")

    child_template_id: UUID
    sort_order: int = 0
    is_optional: bool = False


class InformationalFieldCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    unit: str = ""
    data_type: SignalDataType
    range_min: float | None = None
    range_max: float | None = None
    agg_type: AggregationType | None = None
    source_field: str | None = None
    category: str | None = None
    is_primary: bool = False
    chart_type: str = "time_series"
    chart_window: str = "24h"
    chart_thresholds: bool = False
    aliases_es: list[str] = Field(default_factory=list)
    aliases_en: list[str] = Field(default_factory=list)
    description_es: str | None = None
    description_en: str | None = None


class InformationalFieldUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    unit: str | None = None
    range_min: float | None = None
    range_max: float | None = None
    agg_type: AggregationType | None = None
    source_field: str | None = None
    category: str | None = None
    is_primary: bool | None = None
    chart_type: str | None = None
    chart_window: str | None = None
    chart_thresholds: bool | None = None
    aliases_es: list[str] | None = None
    aliases_en: list[str] | None = None
    description_es: str | None = None
    description_en: str | None = None
    is_active: bool | None = None


class TemplateChildResponse(BaseModel):
    id: UUID
    parent_template_id: UUID
    child_template_id: UUID
    child_level: AssetLevel
    child_name: str
    child_display_name: str
    sort_order: int
    is_optional: bool


class InformationalFieldResponse(BaseModel):
    id: UUID
    template_id: UUID | None = None
    asset_id: UUID | None = None
    name: str
    unit: str
    data_type: SignalDataType
    range_min: float | None
    range_max: float | None
    agg_type: AggregationType | None
    source_field: str | None
    category: str | None
    is_primary: bool
    chart_type: str
    chart_window: str
    chart_thresholds: bool
    aliases_es: list[str]
    aliases_en: list[str]
    description_es: str | None
    description_en: str | None
    is_active: bool | None = None


class TemplateResponse(BaseModel):
    id: UUID
    level: AssetLevel
    name: str
    display_name: str
    description: str | None
    descriptive: dict[str, Any]
    analytical: dict[str, Any]
    icon: str | None
    children: list[TemplateChildResponse] = Field(default_factory=list)
    informational: list[InformationalFieldResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class AssetCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    parent_id: UUID | None = None
    asset_level: AssetLevel
    name: str
    descriptive: dict[str, Any] = Field(default_factory=dict)
    analytical: dict[str, Any] = Field(default_factory=dict)
    scada_available: bool = True


class AssetFromTemplate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    parent_id: UUID | None = None
    template_id: UUID
    name: str
    descriptive_overrides: dict[str, Any] = Field(default_factory=dict)
    analytical_overrides: dict[str, Any] = Field(default_factory=dict)


class AssetUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    descriptive: dict[str, Any] | None = None
    analytical: dict[str, Any] | None = None
    scada_available: bool | None = None
    is_active: bool | None = None


class AssetResponse(BaseModel):
    id: UUID
    parent_id: UUID | None
    template_id: UUID | None
    template_name: str | None = None
    asset_level: AssetLevel
    name: str
    uns_path: str
    descriptive: dict[str, Any]
    analytical: dict[str, Any]
    scada_available: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    informational: list[InformationalFieldResponse] | None = None
    children: list["AssetResponse"] | None = None


AssetResponse.model_rebuild()
