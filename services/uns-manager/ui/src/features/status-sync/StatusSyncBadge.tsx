import type { StatusResponse } from "./types";

function labelForState(syncState: StatusResponse["sync_state"]): string {
  if (syncState === "healthy") {
    return "Sync: Healthy";
  }
  if (syncState === "down") {
    return "Sync: Down";
  }
  return "Sync: Degraded";
}

function details(status: StatusResponse): string {
  const lastSync = status.last_sync_at ?? "never";
  const lag = status.sync_lag_seconds == null ? "n/a" : `${status.sync_lag_seconds.toFixed(1)}s`;
  return `MQTT connected: ${status.mqtt_connected} | last_sync_at: ${lastSync} | lag: ${lag}`;
}

export function StatusSyncBadge({ status, isRefreshing }: { status: StatusResponse; isRefreshing: boolean }) {
  const label = labelForState(status.sync_state);

  return (
    <span className={`status-pill ${status.sync_state}`} title={details(status)}>
      {label}
      {isRefreshing ? "*" : ""}
    </span>
  );
}
