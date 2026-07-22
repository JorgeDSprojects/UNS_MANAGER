export type AssetLevel = "enterprise" | "site" | "area" | "equipment" | "subsystem";

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
  informational?: unknown[] | null;
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
  parent_id: string;
  template_id: string;
  name?: string;
  descriptive_overrides?: Record<string, unknown>;
  analytical_overrides?: Record<string, unknown>;
};

export type UpdateAssetPayload = {
  name?: string;
  descriptive?: Record<string, unknown>;
  analytical?: Record<string, unknown>;
  scada_available?: boolean;
  is_active?: boolean;
};
