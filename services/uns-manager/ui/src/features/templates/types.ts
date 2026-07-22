export type AssetLevel = "enterprise" | "site" | "area" | "equipment" | "subsystem";

export type TemplateChild = {
  id: string;
  parent_template_id: string;
  child_template_id: string;
  child_level: AssetLevel;
  child_name: string;
  child_display_name: string;
  sort_order: number;
  is_optional: boolean;
};

export type InformationalField = {
  id: string;
  template_id?: string;
  asset_id?: string;
  name: string;
  unit: string;
  data_type: "float" | "integer";
  range_min: number | null;
  range_max: number | null;
  agg_type: "sum" | "avg" | "min" | "max" | "count" | "weighted_avg" | "custom" | null;
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
  is_active?: boolean | null;
};

export type TemplateRecord = {
  id: string;
  level: AssetLevel;
  name: string;
  display_name: string;
  description: string | null;
  descriptive: Record<string, unknown>;
  analytical: Record<string, unknown>;
  icon: string | null;
  children: TemplateChild[];
  informational: InformationalField[];
  created_at: string;
  updated_at: string;
};

export type TemplateUpdatePayload = {
  display_name?: string;
  description?: string | null;
  descriptive?: Record<string, unknown>;
  analytical?: Record<string, unknown>;
  icon?: string | null;
};
