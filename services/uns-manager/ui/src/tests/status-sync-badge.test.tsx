import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { StatusSyncBadge } from "../features/status-sync/StatusSyncBadge";

test("renders healthy sync badge", () => {
  render(
    <StatusSyncBadge
      status={{
        service: "uns-manager",
        version: "0.1.0",
        templates_count: 1,
        assets_count: 1,
        informational_fields_count: 1,
        assets_by_level: {
          enterprise: 1,
          site: 0,
          area: 0,
          equipment: 0,
          subsystem: 0
        },
        sync_state: "healthy",
        mqtt_connected: true,
        last_sync_at: "2026-07-22T08:00:00Z",
        sync_lag_seconds: 0
      }}
    />,
  );

  expect(screen.getByText("Sync: Healthy")).toBeInTheDocument();
});
