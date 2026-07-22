import type { Isa95Level } from "../../shared/data/isa95";

export type AssetLevel = Isa95Level;

export type AggregationType = "sum" | "avg" | "min" | "max" | "count" | "weighted_avg" | "custom";

export type AssetInformationalField = {
  id: string;
  asset_id: string;
  name: string;
  unit: string;
  data_type: "float" | "integer";
  range_min: number | null;
  range_max: number | null;
  agg_type: AggregationType | null;
  source_field: string | null;
  category: string | null;
  is_primary: boolean;
  chart_type: string;
  chart_window: string;
  chart_thresholds: boolean;
  aliases_es: string[];
  aliases_en: string[];
  description_es: string | null;
  description_en: string | null;
  is_active: boolean;
};

export type AssetRecord = {
  id: string;
  parent_id: string | null;
  template_id: string | null;
  template_name?: string | null;
  asset_level: AssetLevel;
  name: string;
  uns_path: string;
  descriptive: Record<string, unknown>;
  analytical: Record<string, unknown>;
  scada_available: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  informational?: AssetInformationalField[] | null;
  children?: AssetRecord[] | null;
};

export type CreateAssetPayload = {
  parent_id?: string | null;
  asset_level: AssetLevel;
  name: string;
  descriptive?: Record<string, unknown>;
  analytical?: Record<string, unknown>;
  scada_available?: boolean;
};

export type CreateAssetFromTemplatePayload = {
  parent_id: string | null;
  template_id: string;
  name: string;
  descriptive_overrides: Record<string, unknown>;
  analytical_overrides: Record<string, unknown>;
};

export type UpdateAssetPayload = {
  name?: string;
  descriptive?: Record<string, unknown>;
  analytical?: Record<string, unknown>;
  scada_available?: boolean;
  is_active?: boolean;
};

export type InformationalFieldCreatePayload = {
  name: string;
  unit: string;
  data_type: "float" | "integer";
  range_min?: number | null;
  range_max?: number | null;
  agg_type?: AggregationType | null;
  source_field?: string | null;
  category?: string | null;
  is_primary?: boolean;
  chart_type?: string;
  chart_window?: string;
  chart_thresholds?: boolean;
  aliases_es?: string[];
  aliases_en?: string[];
  description_es?: string | null;
  description_en?: string | null;
};

export type InformationalFieldUpdatePayload = {
  unit?: string;
  range_min?: number | null;
  range_max?: number | null;
  agg_type?: AggregationType | null;
  source_field?: string | null;
  category?: string | null;
  is_primary?: boolean;
  chart_type?: string;
  chart_window?: string;
  chart_thresholds?: boolean;
  aliases_es?: string[];
  aliases_en?: string[];
  description_es?: string | null;
  description_en?: string | null;
  is_active?: boolean;
};
