import { useMemo, useState } from "react";

import { AssetsWorkspace } from "../features/assets/AssetsWorkspace";
import { StatusSyncBadge } from "../features/status-sync/StatusSyncBadge";
import { useStatusSyncQuery } from "../features/status-sync/hooks";
import type { StatusResponse } from "../features/status-sync/types";
import { TemplatesWorkspace } from "../features/templates/TemplatesWorkspace";

type ViewTab = "templates" | "assets";

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

function formatLastSync(lastSync: string | null): string {
  if (!lastSync) {
    return "Never";
  }

  const date = new Date(lastSync);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ViewTab>("templates");
  const statusQuery = useStatusSyncQuery();

  const status = statusQuery.data ?? DEFAULT_STATUS;
  const metrics = useMemo(
    () => ({
      templates: status.templates_count,
      assets: status.assets_count,
      fields: status.informational_fields_count,
    }),
    [status],
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-content">
          <div className="brand-block">
            <div>
              <h1 className="brand-title">UNS Manager</h1>
              <p className="brand-subtitle">Industrial Dense Console</p>
            </div>

            <nav className="tab-nav" aria-label="Main Navigation">
              <button
                className={`tab-button${activeTab === "templates" ? " is-active" : ""}`}
                onClick={() => setActiveTab("templates")}
                type="button"
              >
                Templates
              </button>
              <button
                className={`tab-button${activeTab === "assets" ? " is-active" : ""}`}
                onClick={() => setActiveTab("assets")}
                type="button"
              >
                Assets
              </button>
            </nav>
          </div>

          <StatusSyncBadge isRefreshing={statusQuery.isFetching} status={status} />
        </div>
      </header>

      <main className="app-main">
        <section className="workspace-frame">
          <div className="workspace-header">
            <h2 className="workspace-title">{activeTab === "templates" ? "Templates" : "Assets"}</h2>
            <span className="chip">Version {status.version}</span>
          </div>

          {activeTab === "templates" ? <TemplatesWorkspace /> : <AssetsWorkspace />}
        </section>
      </main>

      <footer className="status-strip">
        <div className="status-strip-content">
          <span>
            Templates: <strong>{metrics.templates}</strong> | Assets: <strong>{metrics.assets}</strong> | Fields: <strong>{metrics.fields}</strong>
          </span>
          <span>
            Last Sync: <strong>{formatLastSync(status.last_sync_at)}</strong> | MQTT: <strong>{status.mqtt_connected ? "Connected" : "Disconnected"}</strong>
          </span>
        </div>
      </footer>
    </div>
  );
}
