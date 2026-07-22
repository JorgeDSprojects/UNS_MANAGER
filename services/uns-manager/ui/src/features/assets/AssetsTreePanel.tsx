import { useEffect, useMemo, useState } from "react";

import { ISA95_LEVELS, levelLabel, type Isa95Level } from "../../shared/data/isa95";
import type { AssetRecord } from "./types";

type AssetsTreePanelProps = {
  assets: AssetRecord[];
  selectedAssetId: string | null;
  onSelect: (assetId: string) => void;
};

type CollapsedLevels = Record<Isa95Level, boolean>;
type CollapsedNodes = Record<string, boolean>;

const COLLAPSED_LEVELS_STORAGE_KEY = "uns-manager-tree-collapsed-levels";
const COLLAPSED_NODES_STORAGE_KEY = "uns-manager-tree-collapsed-nodes";

const INITIAL_COLLAPSED_LEVELS: CollapsedLevels = {
  enterprise: false,
  site: false,
  area: false,
  equipment: false,
  subsystem: false,
};

function resolveCollapsedLevelsState(): CollapsedLevels {
  if (typeof window === "undefined") {
    return INITIAL_COLLAPSED_LEVELS;
  }

  const stored = window.localStorage.getItem(COLLAPSED_LEVELS_STORAGE_KEY);
  if (!stored) {
    return INITIAL_COLLAPSED_LEVELS;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<CollapsedLevels>;
    return {
      enterprise: parsed.enterprise === true,
      site: parsed.site === true,
      area: parsed.area === true,
      equipment: parsed.equipment === true,
      subsystem: parsed.subsystem === true,
    };
  } catch {
    return INITIAL_COLLAPSED_LEVELS;
  }
}

function resolveCollapsedNodesState(): CollapsedNodes {
  if (typeof window === "undefined") {
    return {};
  }

  const stored = window.localStorage.getItem(COLLAPSED_NODES_STORAGE_KEY);
  if (!stored) {
    return {};
  }

  try {
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    const next: CollapsedNodes = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (value === true) {
        next[key] = true;
      }
    }

    return next;
  } catch {
    return {};
  }
}

function collectLevelCounts(assets: AssetRecord[]): Record<Isa95Level, number> {
  const counts: Record<Isa95Level, number> = {
    enterprise: 0,
    site: 0,
    area: 0,
    equipment: 0,
    subsystem: 0,
  };

  const stack = [...assets];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    counts[current.asset_level] += 1;
    if (current.children?.length) {
      stack.push(...current.children);
    }
  }

  return counts;
}

function findPathToAsset(tree: AssetRecord[], assetId: string): AssetRecord[] | null {
  for (const node of tree) {
    if (node.id === assetId) {
      return [node];
    }

    const children = node.children ?? [];
    if (children.length === 0) {
      continue;
    }

    const childPath = findPathToAsset(children, assetId);
    if (childPath) {
      return [node, ...childPath];
    }
  }

  return null;
}

function levelAbbreviation(level: Isa95Level): string {
  switch (level) {
    case "enterprise":
      return "E";
    case "site":
      return "S";
    case "area":
      return "A";
    case "equipment":
      return "EQ";
    case "subsystem":
      return "SS";
    default:
      return "?";
  }
}

function renderNode(
  asset: AssetRecord,
  collapsedLevels: CollapsedLevels,
  collapsedNodes: CollapsedNodes,
  selectedAssetId: string | null,
  onToggleNode: (assetId: string) => void,
  onSelect: (assetId: string) => void,
): JSX.Element {
  const children = asset.children ?? [];
  const isNodeCollapsed = Boolean(collapsedNodes[asset.id]);
  const childrenVisible = children.length > 0 && !collapsedLevels[asset.asset_level] && !isNodeCollapsed;

  return (
    <li key={asset.id}>
      <div className="tree-node">
        {children.length > 0 ? (
          <button
            aria-label={`${isNodeCollapsed ? "Expand" : "Collapse"} children of ${asset.name}`}
            className="tree-collapse-button"
            onClick={() => onToggleNode(asset.id)}
            type="button"
          >
            {isNodeCollapsed ? "+" : "-"}
          </button>
        ) : (
          <span className="tree-collapse-placeholder" aria-hidden>
            .
          </span>
        )}
        <span
          aria-label={`Level ${levelLabel(asset.asset_level)}`}
          className={`tree-level-marker level-${asset.asset_level}${selectedAssetId === asset.id ? " is-selected" : ""}`}
          title={levelLabel(asset.asset_level)}
        >
          {levelAbbreviation(asset.asset_level)}
        </span>
        <button
          className={`tree-asset-button${selectedAssetId === asset.id ? " active" : ""}`}
          onClick={() => {
            onSelect(asset.id);
            if (children.length > 0) {
              onToggleNode(asset.id);
            }
          }}
          type="button"
        >
          {asset.name}
        </button>
      </div>
      {childrenVisible ? (
        <ul>{children.map((child) => renderNode(child, collapsedLevels, collapsedNodes, selectedAssetId, onToggleNode, onSelect))}</ul>
      ) : null}
    </li>
  );
}

export function AssetsTreePanel({ assets, selectedAssetId, onSelect }: AssetsTreePanelProps) {
  const [collapsedLevels, setCollapsedLevels] = useState<CollapsedLevels>(() => resolveCollapsedLevelsState());
  const [collapsedNodes, setCollapsedNodes] = useState<CollapsedNodes>(() => resolveCollapsedNodesState());

  const levelCounts = useMemo(() => collectLevelCounts(assets), [assets]);
  const collapsedCount = useMemo(
    () => ISA95_LEVELS.filter((level) => collapsedLevels[level]).length,
    [collapsedLevels],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(COLLAPSED_LEVELS_STORAGE_KEY, JSON.stringify(collapsedLevels));
  }, [collapsedLevels]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(COLLAPSED_NODES_STORAGE_KEY, JSON.stringify(collapsedNodes));
  }, [collapsedNodes]);

  useEffect(() => {
    if (!selectedAssetId) {
      return;
    }

    const path = findPathToAsset(assets, selectedAssetId);
    if (!path || path.length <= 1) {
      return;
    }

    setCollapsedLevels((previous) => {
      let changed = false;
      const next = { ...previous };

      for (const ancestor of path.slice(0, -1)) {
        if (next[ancestor.asset_level]) {
          next[ancestor.asset_level] = false;
          changed = true;
        }
      }

      return changed ? next : previous;
    });

    setCollapsedNodes((previous) => {
      let changed = false;
      const next = { ...previous };

      for (const ancestor of path.slice(0, -1)) {
        if (next[ancestor.id]) {
          delete next[ancestor.id];
          changed = true;
        }
      }

      return changed ? next : previous;
    });
  }, [assets, selectedAssetId]);

  return (
    <section className="panel">
      <div className="inline-row" style={{ justifyContent: "space-between" }}>
        <h4 className="panel-title">ISA-95 Tree</h4>
        <span className="chip">{collapsedCount === 0 ? "All levels expanded" : `${collapsedCount} level(s) collapsed`}</span>
      </div>

      <div className="tree-level-toolbar" role="toolbar" aria-label="Collapse tree by level">
        {ISA95_LEVELS.map((level) => {
          const collapsed = collapsedLevels[level];

          return (
            <button
              aria-pressed={collapsed}
              className={`level-toggle level-${level}${collapsed ? " is-collapsed" : ""}`}
              key={level}
              onClick={() =>
                setCollapsedLevels((previous) => ({
                  ...previous,
                  [level]: !previous[level],
                }))
              }
              type="button"
            >
              <span className="level-toggle-icon" aria-hidden>
                {collapsed ? "+" : "-"}
              </span>
              <span>{levelLabel(level)}</span>
              <span className="level-toggle-count">{levelCounts[level]}</span>
            </button>
          );
        })}
        <button
          className="level-reset-button"
          disabled={collapsedCount === 0}
          onClick={() => {
            setCollapsedLevels(INITIAL_COLLAPSED_LEVELS);
            setCollapsedNodes({});
          }}
          type="button"
        >
          Expand all
        </button>
      </div>

      {assets.length === 0 ? <p className="message muted">No assets found.</p> : null}
      <ul className="tree-list">
        {assets.map((asset) =>
          renderNode(
            asset,
            collapsedLevels,
            collapsedNodes,
            selectedAssetId,
            (assetId: string) => {
              setCollapsedNodes((previous) => {
                if (previous[assetId]) {
                  const next = { ...previous };
                  delete next[assetId];
                  return next;
                }

                return {
                  ...previous,
                  [assetId]: true,
                };
              });
            },
            onSelect,
          ),
        )}
      </ul>
    </section>
  );
}
