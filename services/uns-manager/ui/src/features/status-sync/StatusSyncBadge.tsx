import type { StatusResponse } from "./types";

export function StatusSyncBadge({ status }: { status: StatusResponse }) {
  const label =
    status.sync_state === "healthy"
      ? "Sync: Healthy"
      : status.sync_state === "down"
        ? "Sync: Down"
        : "Sync: Degraded";

  return <span title={`MQTT connected: ${status.mqtt_connected}`}>{label}</span>;
}
