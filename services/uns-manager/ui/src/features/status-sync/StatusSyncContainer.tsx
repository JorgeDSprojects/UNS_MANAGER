import { StatusSyncBadge } from "./StatusSyncBadge";
import { useStatusSyncQuery } from "./hooks";
import type { StatusResponse } from "./types";

const DEFAULT_STATUS: StatusResponse = {
  service: "uns-manager",
  version: "0.1.0",
  templates_count: 0,
  assets_count: 0,
  informational_fields_count: 0,
  assets_by_level: {
    enterprise: 0,
    site: 0,
    area: 0,
    equipment: 0,
    subsystem: 0,
  },
  sync_state: "degraded",
  mqtt_connected: false,
  last_sync_at: null,
  sync_lag_seconds: null,
};

export function StatusSyncContainer() {
  const query = useStatusSyncQuery();
  const status = query.data ?? DEFAULT_STATUS;

  return <StatusSyncBadge status={status} />;
}
