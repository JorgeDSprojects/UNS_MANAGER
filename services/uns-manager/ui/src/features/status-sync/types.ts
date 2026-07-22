export type AssetsByLevel = {
  enterprise: number;
  site: number;
  area: number;
  equipment: number;
  subsystem: number;
};

export type SyncState = "healthy" | "degraded" | "down";

export type StatusResponse = {
  service: string;
  version: string;
  templates_count: number;
  assets_count: number;
  informational_fields_count: number;
  assets_by_level: AssetsByLevel;
  sync_state: SyncState;
  mqtt_connected: boolean;
  last_sync_at: string | null;
  sync_lag_seconds: number | null;
};
