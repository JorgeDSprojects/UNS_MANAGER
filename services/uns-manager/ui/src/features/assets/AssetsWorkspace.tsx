import { useMemo, useState } from "react";

import { levelLabel, nextLevelForParent } from "../../shared/data/isa95";
import { useToast } from "../../shared/ui/ToastProvider";
import { ErrorBanner } from "../../shared/ui/ErrorBanner";
import { useTemplatesListQuery } from "../templates/hooks";
import { AssetInspectorPanel } from "./AssetInspectorPanel";
import { AssetsTreePanel } from "./AssetsTreePanel";
import { CreateAssetActions } from "./CreateAssetActions";
import { useAssetsTreeQuery, useCreateAssetMutation, useCreateFromTemplateMutation } from "./hooks";
import type { AssetRecord, CreateAssetFromTemplatePayload, CreateAssetPayload } from "./types";

function findAssetPath(tree: AssetRecord[], targetId: string): AssetRecord[] | null {
  for (const node of tree) {
    if (node.id === targetId) {
      return [node];
    }

    const children = node.children ?? [];
    if (children.length === 0) {
      continue;
    }

    const childPath = findAssetPath(children, targetId);
    if (childPath) {
      return [node, ...childPath];
    }
  }

  return null;
}

export function AssetsWorkspace() {
  const assetsTreeQuery = useAssetsTreeQuery();
  const templatesQuery = useTemplatesListQuery();
  const createManualMutation = useCreateAssetMutation();
  const createFromTemplateMutation = useCreateFromTemplateMutation();
  const { pushToast } = useToast();

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isCreatePanelExpanded, setIsCreatePanelExpanded] = useState(false);

  const assets = assetsTreeQuery.data ?? [];
  const selectedPath = useMemo(() => {
    if (!selectedAssetId) {
      return [] as AssetRecord[];
    }

    return findAssetPath(assets, selectedAssetId) ?? [];
  }, [assets, selectedAssetId]);
  const selectedAsset = selectedPath.at(-1) ?? null;
  const selectedParent = selectedAsset
    ? { id: selectedAsset.id, level: selectedAsset.asset_level, name: selectedAsset.name }
    : null;
  const nextCreateLevel = nextLevelForParent(selectedAsset?.asset_level ?? null);

  const templateOptions = useMemo(
    () =>
      (templatesQuery.data ?? []).map((template) => ({
        id: template.id,
        name: template.name,
        level: template.level,
      })),
    [templatesQuery.data],
  );

  return (
    <div className="panel-grid two-col assets-layout">
      <aside className="panel-grid tree-column tree-column-sticky">
        {assetsTreeQuery.isError ? <ErrorBanner message={assetsTreeQuery.error.message} /> : null}
        <AssetsTreePanel assets={assets} onSelect={setSelectedAssetId} selectedAssetId={selectedAssetId} />
      </aside>

      <div className="panel-grid asset-detail-column">
        <section className="panel">
          <div className="inline-row" style={{ justifyContent: "space-between" }}>
            <h4 className="panel-title">Current ISA Context</h4>
            <span className="chip">{selectedAsset ? levelLabel(selectedAsset.asset_level) : "Root"}</span>
          </div>

          {selectedPath.length === 0 ? (
            <p className="message muted" style={{ marginTop: 8 }}>
              No asset selected. Select a node to lock your current ISA level context.
            </p>
          ) : (
            <div className="path-crumbs" style={{ marginTop: 10 }}>
              {selectedPath.map((node) => (
                <span className="path-crumb" key={node.id}>
                  <span className="path-crumb-level">{levelLabel(node.asset_level)}</span>
                  <span>{node.name}</span>
                </span>
              ))}
            </div>
          )}

          <div className="inline-row" style={{ marginTop: 10 }}>
            <span className="chip">Next level: {nextCreateLevel ? levelLabel(nextCreateLevel) : "None"}</span>
            <span className="chip">Path: {selectedAsset ? selectedAsset.uns_path : "ROOT"}</span>
          </div>
        </section>

        <section className="panel">
          <button
            aria-expanded={isCreatePanelExpanded}
            className="collapsible-trigger"
            onClick={() => setIsCreatePanelExpanded((previous) => !previous)}
            type="button"
          >
            <span className="panel-title">Create Asset</span>
            <span className="chip">{isCreatePanelExpanded ? "Expanded" : "Collapsed"}</span>
          </button>

          {isCreatePanelExpanded ? (
            <div className="collapsible-body">
              <CreateAssetActions
                disabled={createManualMutation.isPending || createFromTemplateMutation.isPending}
                onCreateFromTemplate={(payload: CreateAssetFromTemplatePayload) => {
                  createFromTemplateMutation.mutate(payload, {
                    onSuccess: (created) => {
                      setSelectedAssetId(created.id);
                      pushToast("Asset created from template", "success");
                    },
                    onError: (error) => pushToast(error.message, "error"),
                  });
                }}
                onCreateManual={(payload: CreateAssetPayload) => {
                  createManualMutation.mutate(payload, {
                    onSuccess: (created) => {
                      setSelectedAssetId(created.id);
                      pushToast("Asset created", "success");
                    },
                    onError: (error) => pushToast(error.message, "error"),
                  });
                }}
                selectedParent={selectedParent}
                showContainer={false}
                showTitle={false}
                templateOptions={templateOptions}
              />
            </div>
          ) : (
            <p className="message muted" style={{ marginTop: 8 }}>
              Expand this panel to create manual assets or instantiate from templates.
            </p>
          )}
        </section>

        {templatesQuery.isError ? <ErrorBanner message={templatesQuery.error.message} /> : null}
        <AssetInspectorPanel onDeleted={() => setSelectedAssetId(null)} selectedAssetId={selectedAssetId} />
      </div>
    </div>
  );
}
