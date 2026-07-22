import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AssetsTreePanel } from "../features/assets/AssetsTreePanel";
import type { AssetRecord } from "../features/assets/types";

beforeEach(() => {
  window.localStorage.clear();
});

function createNode(
  id: string,
  name: string,
  asset_level: AssetRecord["asset_level"],
  children: AssetRecord[] = [],
): AssetRecord {
  return {
    id,
    parent_id: null,
    template_id: null,
    asset_level,
    name,
    uns_path: name,
    descriptive: {},
    analytical: {},
    scada_available: true,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    children,
  };
}

test("collapses child branches by ISA-95 level and can expand all", async () => {
  const user = userEvent.setup();

  const tree = [
    createNode("ent-1", "ENT_A", "enterprise", [
      createNode("site-1", "SITE_A", "site", [createNode("area-1", "AREA_A", "area")]),
    ]),
  ];

  render(<AssetsTreePanel assets={tree} onSelect={() => {}} selectedAssetId={null} />);

  expect(screen.getByRole("button", { name: "AREA_A" })).toBeInTheDocument();

  const toolbar = screen.getByRole("toolbar", { name: "Collapse tree by level" });
  await user.click(within(toolbar).getByRole("button", { name: /site/i }));

  expect(screen.queryByRole("button", { name: "AREA_A" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "SITE_A" })).toBeInTheDocument();

  await user.click(within(toolbar).getByRole("button", { name: /expand all/i }));
  expect(screen.getByRole("button", { name: "AREA_A" })).toBeInTheDocument();
});

test("collapses descendants independently when clicking a parent asset", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();

  const tree = [
    createNode("ent-1", "ENT_A", "enterprise", [
      createNode("site-1", "SITE_A", "site", [createNode("area-1", "AREA_A", "area")]),
      createNode("site-2", "SITE_B", "site", [createNode("area-2", "AREA_B", "area")]),
    ]),
  ];

  render(<AssetsTreePanel assets={tree} onSelect={onSelect} selectedAssetId={null} />);

  await user.click(screen.getByRole("button", { name: "SITE_A" }));

  expect(onSelect).toHaveBeenCalledWith("site-1");
  expect(screen.queryByRole("button", { name: "AREA_A" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "AREA_B" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "SITE_A" }));
  expect(screen.getByRole("button", { name: "AREA_A" })).toBeInTheDocument();
});
