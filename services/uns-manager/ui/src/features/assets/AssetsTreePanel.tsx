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

const INITIAL_COLLAPSED_LEVELS: CollapsedLevels = {
  enterprise: false,
  site: false,
  area: false,
  equipment: false,
  subsystem: false,
};

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
        <button
          className={selectedAssetId === asset.id ? "active" : ""}
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
        <span className="tag">{asset.asset_level}</span>
      </div>
      {childrenVisible ? (
        <ul>{children.map((child) => renderNode(child, collapsedLevels, collapsedNodes, selectedAssetId, onToggleNode, onSelect))}</ul>
      ) : null}
    </li>
  );
}

export function AssetsTreePanel({ assets, selectedAssetId, onSelect }: AssetsTreePanelProps) {
  const [collapsedLevels, setCollapsedLevels] = useState<CollapsedLevels>(INITIAL_COLLAPSED_LEVELS);
  const [collapsedNodes, setCollapsedNodes] = useState<CollapsedNodes>({});

  const levelCounts = useMemo(() => collectLevelCounts(assets), [assets]);
  const collapsedCount = useMemo(
    () => ISA95_LEVELS.filter((level) => collapsedLevels[level]).length,
    [collapsedLevels],
  );

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
              className={`level-toggle${collapsed ? " is-collapsed" : ""}`}
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
